#!/usr/bin/env node
// Probe: Replicate resemble-ai/chatterbox-multilingual (voice cloning TTS).
//
//   REPLICATE_API_TOKEN=... node scripts/probe/replicate-tts.mjs --schema
//   REPLICATE_API_TOKEN=... node scripts/probe/replicate-tts.mjs --voice sample.wav --lang de --text "Hallo ..." [--out probe-out]
//
// Input field names are UNKNOWN until --schema has been run; override with
//   --text-field text --lang-field language --voice-field <name>   (defaults are guesses and are checked against the schema)
// Extra model inputs: --extra '{"cfg_weight":0.5}'
import path from 'node:path';
import { args, download, fileOrUrl, json, need, secs, sleep } from './lib.mjs';

const MODEL = 'resemble-ai/chatterbox-multilingual';
const API = 'https://api.replicate.com/v1';
const a = args();
const token = need('REPLICATE_API_TOKEN');
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const model = await json(`${API}/models/${MODEL}`, { headers });
const props = model.latest_version?.openapi_schema?.components?.schemas?.Input?.properties ?? {};
console.log(`model ${MODEL}, version ${model.latest_version?.id ?? '?'}`);
console.log('input fields:');
for (const [k, v] of Object.entries(props)) console.log(`  ${k}  type=${v.type ?? v.format ?? '?'}  default=${JSON.stringify(v.default)}  ${(v.description ?? '').slice(0, 90)}`);
if (a.schema) process.exit(0);

if (!a.voice || !a.text || !a.lang) {
  console.error('Need --voice <file|url> --text "<text>" --lang <code>   (run with --schema first)');
  process.exit(2);
}
const field = { text: a['text-field'] ?? 'text', lang: a['lang-field'] ?? 'language', voice: a['voice-field'] ?? 'reference_audio' };
for (const [what, f] of Object.entries(field)) if (!(f in props)) console.warn(`WARNING: field "${f}" (${what}) is not in the schema — pass --${what}-field`);

const input = { [field.text]: a.text, [field.lang]: a.lang, [field.voice]: await fileOrUrl(a.voice), ...(a.extra ? JSON.parse(a.extra) : {}) };
const t0 = Date.now();
// community models (not "official") must be run by version id via /predictions
let pred = await json(`${API}/predictions`, { method: 'POST', headers: { ...headers, Prefer: 'wait=30' }, body: JSON.stringify({ version: model.latest_version.id, input }) });
console.log(`prediction ${pred.id} created, status ${pred.status}`);
while (!['succeeded', 'failed', 'canceled'].includes(pred.status)) {
  await sleep(2000);
  pred = await json(pred.urls.get, { headers });
  process.stdout.write(`\r${pred.status} ${secs(t0)} s   `);
}
console.log();
if (pred.status !== 'succeeded') {
  console.error('FAILED:', pred.error, '\n', (pred.logs ?? '').slice(-1500));
  process.exit(1);
}
const outUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
const ext = path.extname(new URL(outUrl).pathname) || '.wav';
const dest = path.join(a.out ?? 'probe-out', `tts_${a.lang}_${pred.id}${ext}`);
const bytes = await download(outUrl, dest);
console.log(`OK  total ${secs(t0)} s  predict_time=${pred.metrics?.predict_time ?? '?'} s  text=${a.text.length} chars  file=${dest} (${bytes} B)`);
console.log('Check: ffprobe -v error -show_entries format=duration -of csv=p=0', dest);
console.log('Output URL host (expires — download at once):', new URL(outUrl).host);
