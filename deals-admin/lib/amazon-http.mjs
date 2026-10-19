/* Plain page requests to Amazon.in, shared by the deal finder and the offer refresher.
   A bot check throws BlockedError, so callers stop there instead of retrying around it. */
import { isBlockPage } from './amazon.mjs';

const BASE = 'https://www.amazon.in';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Accept-Language': 'en-IN,en;q=0.9',
  Accept: 'text/html',
};
const PAUSE_MS = 4000;
const JITTER_MS = 3000;
const TIMEOUT_MS = 30000;

export class BlockedError extends Error {}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const pause = (ms = PAUSE_MS, jitter = JITTER_MS) => sleep(ms + Math.floor(Math.random() * jitter));

export const get = async (path) => {
  const res = await fetch(BASE + path, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const html = await res.text();
  if (res.status === 503 || isBlockPage(html)) throw new BlockedError(`Amazon blocked ${path} (HTTP ${res.status})`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return html;
};
