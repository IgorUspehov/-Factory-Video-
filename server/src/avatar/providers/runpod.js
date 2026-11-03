import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchRetry, jsonRequest } from '../http.js';

const STATES = { IN_QUEUE: 'queued', IN_PROGRESS: 'running', COMPLETED: 'done', FAILED: 'failed', CANCELLED: 'failed', TIMED_OUT: 'failed' };

/**
 * RunPod Public Endpoint "infinitetalk": photo + audio + prompt -> talking-head MP4 (size follows the photo:
 * a 1024x1536 portrait gives 512x768). $0.25 per request regardless of length; about 9–14 s of work per second of audio.
 * The job id is returned right after submission so the caller can store it and resume polling after a restart —
 * never submit the same job twice (it is paid).
 */
export function createRunpod({ apiKey, endpoint = 'infinitetalk', base = 'https://api.runpod.ai/v2' }) {
  if (!apiKey) throw new Error('runpod_not_configured');
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const root = `${base.replace(/\/+$/, '')}/${endpoint}`;

  return {
    /** @param {{image: string, audio: string, prompt?: string}} o  image/audio: data: URI or https URL @returns {Promise<string>} job id */
    async submit({ image, audio, prompt = 'A person talking to the camera, natural expression, subtle head movement' }) {
      const job = await jsonRequest(`${root}/run`, { method: 'POST', headers, body: JSON.stringify({ input: { prompt, image, audio } }) });
      if (!job?.id) throw new Error('runpod_no_job_id');
      return job.id;
    },
    /** @returns {Promise<{state: 'queued'|'running'|'done'|'failed', resultUrl?: string, cost?: number, error?: string}>} */
    async status(id) {
      let st;
      try {
        st = await jsonRequest(`${root}/status/${encodeURIComponent(id)}`, { headers });
      } catch (err) {
        if (err.status === 404) return { state: 'failed', error: 'job_not_found' }; // expired or unknown id
        throw err;
      }
      const state = STATES[st.status] ?? 'running';
      if (state === 'failed') return { state, error: String(st.error ?? st.status).slice(0, 300) };
      if (state !== 'done') return { state };
      const out = st.output;
      const resultUrl = typeof out === 'string' ? out : out?.result ?? out?.video_url ?? out?.url;
      if (!/^https?:\/\//.test(resultUrl ?? '')) return { state: 'failed', error: 'no_result_url' };
      return { state, resultUrl, cost: typeof out?.cost === 'number' ? out.cost : undefined };
    },
    async download(url, dest) {
      const res = await fetchRetry(url, {}, 5);
      if (!res.ok) throw new Error(`runpod_download_${res.status}`);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      return dest;
    },
  };
}
