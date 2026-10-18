/* Publishing from the admin panel: commit only the deal and settings files as the
   site owner, push to main and let the Pages workflow deploy (Telegram follows it).
   Commands run through execFile with argument arrays, never through a shell. */
import { execFile } from 'node:child_process';
import { ROOT, PUBLISH_FILES, InputError } from './store.mjs';

const AUTHOR_NAME = 'Dibyajyoti Kabi';
const AUTHOR_EMAIL = '166307538+Dibyajyotikabi@users.noreply.github.com';
const BRANCH = 'main';
const TIMEOUT_MS = 90000;

const run = (cmd, args) => new Promise((resolve, reject) => {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_COMMITTER_NAME: AUTHOR_NAME, GIT_COMMITTER_EMAIL: AUTHOR_EMAIL };
  execFile(cmd, args, { cwd: ROOT, env, timeout: TIMEOUT_MS, maxBuffer: 4 << 20 }, (err, stdout, stderr) => {
    if (err) reject(new Error(`${cmd} ${args[0]} failed: ${(stderr || err.message).trim().split('\n').slice(-3).join(' ')}`));
    else resolve(stdout.trim());
  });
});
const git = (...args) => run('git', args);

/* Deal files that differ from the last commit */
export const pending = async () => {
  const out = await git('status', '--porcelain', '--', ...PUBLISH_FILES);
  return out ? out.split('\n').map((line) => line.slice(3).replace(/^"|"$/g, '')) : [];
};

/* commits made here that a failed push left behind */
const ahead = async () => Number(await git('rev-list', '--count', `origin/${BRANCH}..HEAD`).catch(() => '0')) || 0;

export const publish = async (message) => {
  const subject = String(message || '').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Update deals';
  const branch = await git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== BRANCH) throw new InputError(`Switch the repo to ${BRANCH} first (it is on ${branch}).`);
  const files = await pending();
  if (files.length) {
    await git('add', '--', ...PUBLISH_FILES);
    await git('commit', '-m', `feat: ${subject.replace(/^feat:\s*/i, '')}`, `--author=${AUTHOR_NAME} <${AUTHOR_EMAIL}>`, '--', ...PUBLISH_FILES);
  } else if (!(await ahead())) {
    throw new InputError('Nothing to publish. Every change is already live.');
  }
  /* the Telegram job commits posted.json back to main, so take that first */
  await git('pull', '--rebase', '--autostash', 'origin', BRANCH);
  await git('push', 'origin', `HEAD:${BRANCH}`);
  return { files, commit: await git('rev-parse', '--short', 'HEAD') };
};

/* Brings in posted.json updates from the Telegram job so the panel shows real post links */
export const refresh = async () => {
  const files = await pending();
  if (files.length) return { pulled: false, reason: 'You have changes waiting to publish' };
  await git('pull', '--rebase', '--autostash', 'origin', BRANCH);
  return { pulled: true };
};

export const runs = async () => {
  const out = await run('gh', ['run', 'list', '--limit', '8', '--json', 'databaseId,workflowName,status,conclusion,displayTitle,createdAt,url']);
  return JSON.parse(out || '[]');
};

export const triggerTelegram = (isDry) => run('gh', ['workflow', 'run', 'telegram.yml', '--ref', BRANCH, '-f', `dry=${isDry ? 'true' : 'false'}`]);

/* Names only: GitHub never returns secret values, and this panel never asks for them */
export const secretNames = async () => {
  const out = await run('gh', ['secret', 'list', '--json', 'name']);
  return JSON.parse(out || '[]').map((s) => s.name).filter((name) => name.startsWith('TELEGRAM_'));
};
