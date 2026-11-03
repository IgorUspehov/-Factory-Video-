#!/usr/bin/env node
// After a redeploy/restart: does the e2e test user, its project and its render still exist?
//   node scripts/check-persist.mjs <api base> <email> <jobId>      (password: the fixed e2e test password)
const [BASE, email, jobId] = [process.argv[2]?.replace(/\/+$/, ''), process.argv[3], process.argv[4]];
if (!BASE || !email || !jobId) (console.error('usage: check-persist.mjs <api base> <email> <jobId>'), process.exit(2));
let failed = 0;
const check = (n, ok, x = '') => (ok || failed++, console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`));
const j = async (m, p, o = {}) => {
  const r = await fetch(BASE + p, { method: m, ...o, signal: AbortSignal.timeout(90_000) });
  const t = await r.text();
  try { return { status: r.status, data: JSON.parse(t) }; } catch { return { status: r.status, data: t }; }
};
const login = await j('POST', '/api/auth/login', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'e2e-Test-pass-1' }) });
check('login after restart', login.status === 200 && !!login.data.token, `HTTP ${login.status}`);
const h = { Authorization: `Bearer ${login.data.token}` };
const projects = (await j('GET', '/api/projects', { headers: h })).data;
check('project exists', Array.isArray(projects) && projects.some((p) => p.title === 'E2E'), `${projects.length ?? '?'} project(s)`);
const job = await j('GET', `/api/render/${jobId}`, { headers: h });
check('render job exists, status done', job.status === 200 && job.data.status === 'done', `HTTP ${job.status} ${job.data.status ?? ''}`);
if (job.data.url) {
  const f = await fetch(job.data.url);
  const size = (await f.arrayBuffer()).byteLength;
  check('render downloads (re-fetched from R2 into the fresh cache)', f.status === 200 && size > 10_000, `HTTP ${f.status}, ${size} B`);
}
const audioUrl = projects.find((p) => p.title === 'E2E')?.audio?.url;
if (audioUrl) check('uploaded audio downloads', (await fetch(audioUrl)).status === 200);
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
