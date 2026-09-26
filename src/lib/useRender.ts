import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { useAuth } from './auth';
import { projectDuration } from './project';
import type { Format, Project, RenderState } from '../types';

export type RenderError = 'credits' | 'too_long' | 'generic';

/** Starts render jobs and polls their status until they finish. */
export function useRender(project: Project | null, onChange: (render: RenderState) => void) {
  const { refresh } = useAuth();
  const [error, setError] = useState<RenderError | null>(null);
  const [starting, setStarting] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const render = project?.render;
  const jobId = render?.jobId;
  const active = render?.status === 'queued' || render?.status === 'rendering';

  useEffect(() => {
    if (!jobId || !active || !render) return;
    let cancelled = false;
    const base = render;
    const tick = async () => {
      try {
        const s = await api.renderStatus(jobId);
        if (cancelled) return;
        onChangeRef.current({
          ...base,
          status: s.status,
          progress: s.progress,
          url: s.url ?? undefined,
          expiresAt: s.expiresAt ?? undefined,
          watermark: s.watermark,
        });
        if (s.status === 'done') void refresh();
      } catch {
        /* keep polling; transient network errors are expected on mobile */
      }
    };
    const id = window.setInterval(tick, 1200);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // `render` changes on each tick; polling only restarts for a new job or state transition
  }, [jobId, active, refresh]);

  const start = useCallback(
    async (format?: Format) => {
      if (!project) return false;
      setError(null);
      setStarting(true);
      try {
        const fmt = format ?? project.format;
        const job = await api.startRender({ projectId: project.id, title: project.title, format: fmt, duration: projectDuration(project) || 15 });
        onChangeRef.current({ jobId: job.jobId, cost: job.cost, status: 'queued', progress: 0, format: fmt });
        void refresh();
        return true;
      } catch (err) {
        setError(
          err instanceof ApiError && err.status === 402 ? 'credits' : err instanceof ApiError && err.message === 'too_long' ? 'too_long' : 'generic',
        );
        return false;
      } finally {
        setStarting(false);
      }
    },
    [project, refresh],
  );

  return { start, starting, error, active };
}
