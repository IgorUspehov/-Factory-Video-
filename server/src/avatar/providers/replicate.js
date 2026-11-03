import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchRetry, jsonRequest, sleep } from '../http.js';

export const TTS_MODEL = 'resemble-ai/chatterbox-multilingual';
export const TTS_LANGUAGES = new Set(['ru', 'en', 'de']);

/**
 * Voice cloning TTS on Replicate. A community model must be run by version id (POST /predictions);
 * /models/{owner}/{name}/predictions only exists for official models.
 * One request = one chunk of at most 300 characters. A chunk costs cents, so on a restart it is simply redone.
 */
export function createReplicate({ token, base = 'https://api.replicate.com/v1', model = TTS_MODEL, pollMs = 2000, timeoutMs = 4 * 60_000 }) {
  if (!token) throw new Error('replicate_not_configured');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  let version = null;

  const latestVersion = async () => (version ??= (await jsonRequest(`${base}/models/${model}`, { headers })).latest_version?.id);

  return {
    /**
     * @param {{text: string, language: 'ru'|'en'|'de', referenceAudio: string, outFile: string}} o
     *   referenceAudio: data: URI or https URL of the owner's 3–10 s voice sample
     * @returns {Promise<{file: string, predictionId: string, seconds: number}>}
     */
    async synthesize({ text, language, referenceAudio, outFile }) {
      if (!TTS_LANGUAGES.has(language)) throw new Error(`unsupported_language:${language}`);
      if (!text?.trim() || text.length > 300) throw new Error('invalid_tts_text');
      const started = Date.now();
      let pred = await jsonRequest(`${base}/predictions`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'wait=30' },
        body: JSON.stringify({ version: await latestVersion(), input: { text, language, reference_audio: referenceAudio } }),
      });
      while (!['succeeded', 'failed', 'canceled'].includes(pred.status)) {
        if (Date.now() - started > timeoutMs) throw new Error('tts_timeout');
        await sleep(pollMs);
        pred = await jsonRequest(pred.urls.get, { headers });
      }
      if (pred.status !== 'succeeded') throw new Error(`tts_${pred.status}: ${String(pred.error ?? '').slice(0, 200)}`);
      const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
      // the output URL expires: download at once
      const res = await fetchRetry(url);
      if (!res.ok) throw new Error(`tts_download_${res.status}`);
      await mkdir(path.dirname(outFile), { recursive: true });
      await writeFile(outFile, Buffer.from(await res.arrayBuffer()));
      return { file: outFile, predictionId: pred.id, seconds: pred.metrics?.predict_time ?? (Date.now() - started) / 1000 };
    },
  };
}
