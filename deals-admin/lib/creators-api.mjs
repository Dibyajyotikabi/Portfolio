/* Talks to the Amazon Creators API, the official product data feed for Associates that
   replaced PA-API 5. It never logs in to an Amazon account and never opens a product
   page: the keys are app keys made in Associates Central > Tools > Creators API, kept
   in GitHub secrets, and the calls go to Amazon's API servers.

   AMAZON_CREATORS_ID, AMAZON_CREATORS_SECRET  the credential pair
   AMAZON_CREATORS_VERSION                     the version shown with them (3.2 for India) */

const API_BASE = 'https://creatorsapi.amazon/catalog/v1/';
export const MARKETPLACE = 'www.amazon.in';
/* Each credential version gets its token from its own region */
const TOKEN_URLS = Object.freeze({
  '3.1': 'https://api.amazon.com/auth/o2/token',
  '3.2': 'https://api.amazon.co.uk/auth/o2/token',
  '3.3': 'https://api.amazon.co.jp/auth/o2/token',
  '2.1': 'https://creatorsapi.auth.us-east-1.amazoncognito.com/oauth2/token',
  '2.2': 'https://creatorsapi.auth.eu-south-2.amazoncognito.com/oauth2/token',
  '2.3': 'https://creatorsapi.auth.us-west-2.amazoncognito.com/oauth2/token',
});
const DEFAULT_VERSION = '3.2';
export const BATCH_SIZE = 10;
/* New keys get 1 call a second, so calls are spaced a little wider than that */
const MIN_GAP_MS = 1100;
const TOKEN_MARGIN_MS = 60e3;
const TIMEOUT_MS = 20e3;
const RETRIES = 3;
const BACKOFF_MS = 2000;

export class ApiError extends Error {
  constructor(message, { status = 0, code = '' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/* Bad keys or no API access: every later call would fail the same way, so the run stops */
export const isFatal = (err) => err instanceof ApiError && [401, 403].includes(err.status);

/* The keys are fine but Amazon hasn't turned on API access yet (new keys wait up to
   48 hours, and the account needs 10 qualified sales in 30 days). Not a broken run. */
export const isNotEligible = (err) => err instanceof ApiError && err.status === 403;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* The keys from the environment, or null when they are not set up yet */
export const credentialsFromEnv = (env = process.env) => {
  const id = String(env.AMAZON_CREATORS_ID || '').trim();
  const secret = String(env.AMAZON_CREATORS_SECRET || '').trim();
  const version = String(env.AMAZON_CREATORS_VERSION || DEFAULT_VERSION).trim();
  if (!id || !secret) return null;
  if (!TOKEN_URLS[version]) throw new Error(`AMAZON_CREATORS_VERSION "${version}" is not known. Use one of ${Object.keys(TOKEN_URLS).join(', ')}`);
  return { id, secret, version };
};

const isV3 = (version) => version.startsWith('3.');

const tokenRequest = ({ id, secret, version }) => (isV3(version)
  ? {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: id, client_secret: secret, scope: 'creatorsapi::default' }),
  }
  : {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}` },
    body: 'grant_type=client_credentials&scope=creatorsapi/default',
  });

const readBody = async (res) => {
  const raw = await res.text();
  try { return JSON.parse(raw); } catch { return { message: raw.slice(0, 200) }; }
};

/* Amazon's error body as a short message, without anything from the request */
const apiError = (status, body, where) => {
  const first = Array.isArray(body?.errors) ? body.errors[0] : body;
  const code = String(first?.code || first?.error || first?.__type || '').slice(0, 60);
  const detail = String(first?.message || first?.error_description || '').slice(0, 200);
  const hint = {
    401: 'Check AMAZON_CREATORS_ID and AMAZON_CREATORS_SECRET.',
    403: 'The keys work but have no access. Creators API needs qualified sales in the last 30 days and keys made for India.',
    429: 'Too many calls.',
  }[status] || '';
  return new ApiError(`${where} answered ${status}${code ? ` ${code}` : ''}${detail ? `: ${detail}` : ''}${hint ? `. ${hint}` : ''}`, { status, code });
};

const isRetryable = (err) => !(err instanceof ApiError) || err.status === 429 || err.status >= 500;

export const createClient = ({ credentials, partnerTag, fetchImpl = fetch, sleep = wait, now = Date.now }) => {
  if (!credentials) throw new Error('Creators API keys are missing');
  if (!partnerTag) throw new Error('An Associates tag is needed for Creators API calls');
  let token = null;
  let lastCall = 0;

  const send = async (url, init, where) => {
    const res = await fetchImpl(url, { ...init, method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await readBody(res);
    if (!res.ok) throw apiError(res.status, body, where);
    return body;
  };

  const accessToken = async () => {
    if (token && token.expires - TOKEN_MARGIN_MS > now()) return token.value;
    const body = await send(TOKEN_URLS[credentials.version], tokenRequest(credentials), 'The token server');
    if (!body.access_token) throw new ApiError('The token server sent no access token');
    token = { value: body.access_token, expires: now() + (Number(body.expires_in) || 3600) * 1000 };
    return token.value;
  };

  const authHeader = (value) => (isV3(credentials.version) ? `Bearer ${value}` : `Bearer ${value}, Version ${credentials.version}`);

  const callOnce = async (operation, body) => {
    const gap = lastCall + MIN_GAP_MS - now();
    if (gap > 0) await sleep(gap);
    lastCall = now();
    const headers = { Authorization: authHeader(await accessToken()), 'Content-Type': 'application/json', 'x-marketplace': MARKETPLACE };
    return send(API_BASE + operation, { headers, body: JSON.stringify({ ...body, marketplace: MARKETPLACE, partnerTag }) }, operation);
  };

  /* Waits and tries again when Amazon is busy or a call times out. A 401 gets one new token. */
  const call = async (operation, body) => {
    let renewed = false;
    for (let attempt = 0; ; attempt++) {
      try {
        return await callOnce(operation, body);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401 && !renewed) { renewed = true; token = null; continue; }
        if (!isRetryable(err) || attempt >= RETRIES) throw err;
        await sleep(BACKOFF_MS * 2 ** attempt);
      }
    }
  };

  /* Up to 10 products. Returns { items, errors }; a product Amazon won't share shows up in errors. */
  const getItems = async (asins, resources) => {
    const body = await call('getItems', { itemIds: asins, itemIdType: 'ASIN', condition: 'New', resources });
    return { items: body?.itemResults?.items || [], errors: Array.isArray(body?.errors) ? body.errors : [] };
  };

  /* Every product, 10 per call. A failed batch keeps going unless the keys themselves fail. */
  const getAllItems = async (asins, resources) => {
    const items = new Map(), failed = [];
    for (let i = 0; i < asins.length; i += BATCH_SIZE) {
      const batch = asins.slice(i, i + BATCH_SIZE);
      try {
        const res = await getItems(batch, resources);
        res.items.forEach((item) => item?.asin && items.set(item.asin, item));
        res.errors.forEach((e) => failed.push({ asins: batch.filter((a) => String(e.message || '').includes(a)), reason: `${e.code || 'Error'}: ${e.message || ''}`.trim() }));
      } catch (err) {
        if (isFatal(err)) throw err;
        failed.push({ asins: batch, reason: err.message });
      }
    }
    return { items, failed };
  };

  const searchItems = async (params, resources) => {
    const body = await call('searchItems', { ...params, resources });
    return body?.searchResult?.items || [];
  };

  return { getItems, getAllItems, searchItems };
};
