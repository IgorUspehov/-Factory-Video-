#!/usr/bin/env node
// Probe: RunPod Public Endpoint "infinitetalk" (photo + audio + prompt -> MP4).
//
//   RUNPOD_API_KEY=... node scripts/probe/runpod-infinitetalk.mjs --image face.png --audio voice.wav [--prompt "..."] [--out probe-out]
//
// --image/--audio: public URL or local file (a local file is sent as a data: URI — whether the endpoint accepts that is UNKNOWN;
//   if it rejects it, upload the file somewhere public and pass the URL).
// --dry prints the request without sending (no cost). Cost seen manually: $0.25 per clip (22 s audio).
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { args, download, fileOrUrl, json, need, secs, sleep } from './lib.mjs';

const a = args();
const ID = a.endpoint ?? 'infinitetalk';
const BASE = (process.env.RUNPOD_API_BASE ?? 'https://api.runpod.ai/v2').replace(/\/+$/, '');
if (!a.image || !a.audio) {
  console.error('Need --image <file|url> --audio <file|url>');
  process.exit(2);
}
const input = {
  prompt: a.prompt ?? 'A person talking to the camera, natural expression, subtle head movement',
  image: await fileOrUrl(a.image),
  audio: await fileOrUrl(a.audio),
};
if (a.dry) {
  console.log(`POST ${BASE}/${ID}/run`, JSON.stringify({ input: { ...input, image: input.image.slice(0, 60) + '…', audio: input.audio.slice(0, 60) + '…' } }, null, 2));
  process.exit(0);
}
const headers = { Authorization: `Bearer ${need('RUNPOD_API_KEY')}`, 'Content-Type': 'application/json' };
const t0 = Date.now();
const job = await json(`${BASE}/${ID}/run`, { method: 'POST', headers, body: JSON.stringify({ input }) });
console.log('submitted:', JSON.stringify(job));
await mkdir(a.out ?? 'probe-out', { recursive: true });
await writeFile(path.join(a.out ?? 'probe-out', 'last-job.json'), JSON.stringify({ endpoint: ID, id: job.id, at: new Date().toISOString() })); // so a paid job is never lost
let st = job;
let delay = 5000;
while (!['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(st.status)) {
  await sleep(delay);
  st = await json(`${BASE}/${ID}/status/${job.id}`, { headers });
  process.stdout.write(`\r${st.status} ${secs(t0)} s   `);
}
console.log();
console.log('final response (media fields shortened):', JSON.stringify(st, (k, v) => (typeof v === 'string' && v.length > 200 ? v.slice(0, 80) + `…(${v.length} chars)` : v), 2));
if (st.status !== 'COMPLETED') process.exit(1);

// The output shape is UNKNOWN: look for a URL or a base64 string in the output.
const out = st.output;
const url = typeof out === 'string' ? out : (out?.video_url ?? out?.video ?? out?.url ?? out?.result ?? Object.values(out ?? {}).find((v) => typeof v === 'string' && /^https?:/.test(v)));
const dest = path.join(a.out ?? 'probe-out', `talk_${job.id}.mp4`);
if (typeof url === 'string' && /^https?:/.test(url)) console.log('downloaded', await download(url, dest), 'B ->', dest);
else console.log('No URL found in output — inspect the response above (base64?).');
console.log(`total ${secs(t0)} s  delayTime=${st.delayTime ?? '?'} executionTime=${st.executionTime ?? '?'} ms`);
console.log('Check: ffprobe -v error -show_entries stream=width,height,duration -of csv=p=0', dest);
