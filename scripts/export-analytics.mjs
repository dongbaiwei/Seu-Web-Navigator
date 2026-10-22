import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

// The deployment job passes its secret through the environment; never log API responses or headers.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'assets/analytics-config.js');
const context = {window: {}};
vm.runInNewContext(await fs.readFile(configPath, 'utf8'), context, {timeout: 1000});
const config = context.window.BmeAnalyticsConfig;
const fail = message => { throw new Error(message); };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!config?.enabled || !uuid.test(config.websiteId || '')) fail('Enable a valid analytics website configuration first.');
if (!/^\d{4}-\d{2}-\d{2}$/.test(config.startedAt || '')) fail('Set the real collection start date in analytics-config.js.');
const startAt = Date.parse(config.startedAt + 'T00:00:00Z');
const endAt = Date.now();
if (!Number.isFinite(startAt) || new Date(startAt).toISOString().slice(0, 10) !== config.startedAt || startAt >= endAt) fail('Invalid collection start date.');
const apiKey = process.env.UMAMI_API_KEY;
if (!apiKey) fail('Set the UMAMI_API_KEY GitHub Actions secret.');
const apiBase = new URL((process.env.UMAMI_API_BASE || 'https://api.umami.is/v1').replace(/\/?$/, '/'));
if (apiBase.protocol !== 'https:' || apiBase.username || apiBase.password || apiBase.search || apiBase.hash) fail('Use an HTTPS Umami API base URL.');
async function stats(from) {
  const url = new URL('websites/' + config.websiteId + '/stats', apiBase);
  url.searchParams.set('startAt', String(from)); url.searchParams.set('endAt', String(endAt));
  let response;
  try {
    response = await fetch(url, {headers: {Authorization: 'Bearer ' + apiKey, Accept: 'application/json'}, redirect: 'error', signal: AbortSignal.timeout(15000)});
  } catch { fail('Umami API request failed; no public snapshot was replaced.'); }
  if (!response.ok) fail('Umami API returned HTTP ' + response.status + '; no public snapshot was replaced.');
  let result;
  try { result = await response.json(); } catch { fail('Umami API returned invalid JSON.'); }
  const count = key => {
    // Umami v3 returns numbers; v2 returns {value, prev}.
    const value = typeof result[key] === 'number' ? result[key] : result[key]?.value;
    if (!Number.isSafeInteger(value) || value < 0) fail('Umami API returned invalid ' + key + '.');
    return value;
  };
  return {pageviews: count('pageviews'), visitors: count('visitors')};
}
const [total, recent] = await Promise.all([stats(startAt), stats(Math.max(startAt, endAt - 30 * 86400000))]);
const output = path.resolve(root, process.argv[2] || 'assets/analytics-summary.json');
const summary = {ready: true, websiteId: config.websiteId, siteUrl: config.siteUrl, since: config.startedAt,
  updatedAt: new Date(endAt).toISOString(), windowDays: 30, pageviews: total.pageviews, visitors30d: recent.visitors};
await fs.mkdir(path.dirname(output), {recursive: true});
await fs.writeFile(output + '.tmp', JSON.stringify(summary, null, 2) + '\n');
await fs.rename(output + '.tmp', output);
console.log('Published an aggregate-only analytics snapshot.');
