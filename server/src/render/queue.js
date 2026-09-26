import { rm } from 'node:fs/promises';
import path from 'node:path';
import { config, limits } from '../config.js';
import { fetchRemote } from '../media.js';
import { storage } from '../storage/index.js';
import { renderProject } from './pipeline.js';

/**
 * In-process FIFO render queue, one job at a time.
 * Job rows live in the `jobs` collection; credits are refunded when a job fails.
 */
export function createRenderQueue(db) {
  const pending = [];
  let busy = false;

  const uploadPath = async (userId, id) => {
    const upload = db.get('uploads', id);
    return upload && upload.userId === userId ? storage.localPath(upload.key) : null;
  };

  const resolver = (userId) => ({
    resolveMedia: async (item) => (await uploadPath(userId, item.id)) ?? fetchRemote(item.url),
    resolveAudio: async (audio) => (audio.id && (await uploadPath(userId, audio.id))) ?? fetchRemote(audio.url),
  });

  async function process(job) {
    const workDir = path.join(config.dataDir, 'tmp', job.id);
    const started = Date.now();
    await db.update('jobs', job.id, { status: 'rendering', progress: 0, startedAt: new Date().toISOString() });
    let lastSaved = 0;
    try {
      const { file, duration } = await renderProject({
        project: job.snapshot,
        format: job.format,
        watermark: job.watermark,
        workDir,
        timeoutMs: limits.renderTimeoutMs,
        ...resolver(job.userId),
        onProgress: (p) => {
          job.progress = Math.max(job.progress ?? 0, Math.min(99, p));
          if (Date.now() - lastSaved > 1000) {
            lastSaved = Date.now();
            void db.update('jobs', job.id, { progress: job.progress });
          }
        },
      });
      const key = `renders/${job.userId}/${job.id}.mp4`;
      await storage.put(key, file);
      await db.update('jobs', job.id, {
        status: 'done',
        progress: 100,
        key,
        duration,
        renderMs: Date.now() - started,
        finishedAt: new Date().toISOString(),
        linkExpiresAt: new Date(Date.now() + limits.linkTtlMs).toISOString(),
        snapshot: undefined,
      });
      console.log(`[render] ${job.id} done in ${Date.now() - started} ms (${duration.toFixed(1)} s, ${job.format})`);
    } catch (err) {
      console.error(`[render] ${job.id} failed:`, err.message);
      const user = db.get('users', job.userId);
      if (user) await db.update('users', user.id, { credits: user.credits + job.cost });
      await db.update('jobs', job.id, { status: 'failed', error: String(err.message).slice(0, 500), refunded: true, finishedAt: new Date().toISOString() });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  async function pump() {
    if (busy) return;
    busy = true;
    try {
      while (pending.length) {
        const job = db.get('jobs', pending.shift());
        if (job && (job.status === 'queued' || job.status === 'rendering')) await process(job);
      }
    } finally {
      busy = false;
    }
  }

  return {
    enqueue(jobId) {
      pending.push(jobId);
      void pump();
    },
    /** Re-queues jobs interrupted by a restart. */
    recover() {
      const open = db.find('jobs', (j) => j.status === 'queued' || j.status === 'rendering');
      open.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const j of open) {
        j.status = 'queued';
        j.progress = 0;
        pending.push(j.id);
      }
      if (open.length) console.log(`[render] recovered ${open.length} job(s)`);
      void pump();
    },
    size: () => pending.length + (busy ? 1 : 0),
  };
}
