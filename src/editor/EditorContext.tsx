import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useRender, type RenderError } from '../lib/useRender';
import type { Format, NodeKind, Project, RenderState } from '../types';

export interface DepthState {
  /** idle → model (downloading) → running → idle; error = model unavailable (Ken Burns is used instead) */
  phase: 'idle' | 'model' | 'running' | 'error';
  done: number;
  total: number;
  modelPercent: number;
  /** photos whose image could not be read (e.g. no CORS) — they use Ken Burns */
  failed: number;
}

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

interface EditorValue {
  project: Project;
  update: (patch: Partial<Project> | ((p: Project) => Partial<Project>)) => void;
  save: () => Promise<void>;
  saveState: SaveState;
  selected: NodeKind | null;
  select: (kind: NodeKind | null) => void;
  startRender: (format?: Format) => Promise<boolean>;
  renderStarting: boolean;
  renderError: RenderError | null;
  /** big player modal over the canvas */
  playerOpen: boolean;
  setPlayerOpen: (open: boolean) => void;
  depth: DepthState;
  /** after a model error: allow another attempt */
  retryDepth: () => void;
}

const Ctx = createContext<EditorValue | null>(null);

export function EditorProvider({ initial, children }: { initial: Project; children: ReactNode }) {
  const [project, setProject] = useState<Project>(initial);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [selected, setSelected] = useState<NodeKind | null>(null);
  const pending = useRef<Partial<Project>>({});
  const timer = useRef<number>();
  const projectRef = useRef(project);
  projectRef.current = project;

  const inflight = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    // wait for a save that is already running, so callers see the server up to date
    await inflight.current;
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    setSaveState('saving');
    const run = (async () => {
      try {
        await api.updateProject(projectRef.current.id, patch);
        setSaveState(Object.keys(pending.current).length ? 'dirty' : 'saved');
      } catch {
        pending.current = { ...patch, ...pending.current };
        setSaveState('error');
      }
    })();
    inflight.current = run;
    await run;
  }, []);

  const update = useCallback(
    (input: Partial<Project> | ((p: Project) => Partial<Project>)) => {
      const patch = typeof input === 'function' ? input(projectRef.current) : input;
      const next = { ...projectRef.current, ...patch };
      projectRef.current = next;
      setProject(next);
      pending.current = { ...pending.current, ...patch };
      setSaveState('dirty');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 900);
    },
    [flush],
  );

  useEffect(() => {
    const onUnload = () => void flush();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      void flush();
    };
  }, [flush]);

  const [playerOpen, setPlayerOpen] = useState(false);
  const watching = useRef(false);
  const onRender = useCallback(
    (render: RenderState) => {
      update({ render });
      // open the finished video automatically, but only for renders started in this session
      if (render.status === 'done' && watching.current) {
        watching.current = false;
        setPlayerOpen(true);
      }
    },
    [update],
  );
  const { start, starting, error } = useRender(project, onRender);

  // the backend renders the SAVED project: flush pending edits first
  const startRender = useCallback(
    async (format?: Format) => {
      await flush();
      watching.current = true;
      const ok = await start(format);
      if (!ok) watching.current = false;
      return ok;
    },
    [flush, start],
  );

  // ---- 2.5D depth maps: computed in the browser while parallax is on, one photo at a time
  const [depth, setDepth] = useState<DepthState>({ phase: 'idle', done: 0, total: 0, modelPercent: 0, failed: 0 });
  const depthBusy = useRef(false);
  const [depthPass, setDepthPass] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const depthFailed = useRef(new Set<string>());
  const parallax = !!project.style.parallax;
  const pendingIds = project.media
    .filter((m) => m.kind === 'image' && !m.depth && !depthFailed.current.has(m.id))
    .map((m) => m.id)
    .join(',');

  // depth maps can disappear on the server (DATA_DIR is not persistent until R2): check once per editor session
  // and drop missing ones, so they are computed again
  const depthChecked = useRef(false);
  useEffect(() => {
    if (!parallax || depthChecked.current) return;
    depthChecked.current = true;
    const withDepth = projectRef.current.media.filter((m) => m.depth?.url);
    void Promise.all(
      withDepth.map(async (m) => {
        try {
          const res = await fetch(m.depth!.url, { method: 'HEAD' });
          return res.ok ? null : m.id;
        } catch {
          return null; // offline etc.: keep it, the server falls back to Ken Burns anyway
        }
      }),
    ).then((ids) => {
      const lost = new Set(ids.filter(Boolean) as string[]);
      if (lost.size) update((p) => ({ media: p.media.map((m) => (lost.has(m.id) ? { ...m, depth: undefined } : m)) }));
    });
  }, [parallax, update]);

  useEffect(() => {
    if (!parallax || !pendingIds || depthBusy.current || depth.phase === 'error') return;
    depthBusy.current = true;
    const stopped = () => !mounted.current || !projectRef.current.style.parallax;
    (async () => {
      const { computeDepth, preloadDepthModel, ModelError } = await import('../lib/depth');
      const queue = pendingIds.split(',');
      setDepth((d) => ({ ...d, phase: 'model', done: 0, total: queue.length }));
      try {
        await preloadDepthModel((pct) => setDepth((d) => ({ ...d, modelPercent: pct })));
        setDepth((d) => ({ ...d, phase: 'running' }));
        for (const id of queue) {
          if (stopped()) break;
          const item = projectRef.current.media.find((m) => m.id === id);
          if (item && !item.depth) {
            try {
              const r = await computeDepth(item.url);
              const up = await api.uploadDepth(r.png);
              update((p) => ({
                media: p.media.map((m) => (m.id === id ? { ...m, depth: { id: up.id, url: up.url, threshold: r.threshold } } : m)),
              }));
            } catch (err) {
              if (err instanceof ModelError) throw err;
              depthFailed.current.add(id);
              setDepth((d) => ({ ...d, failed: d.failed + 1 }));
            }
          }
          setDepth((d) => ({ ...d, done: d.done + 1 }));
        }
        setDepth((d) => ({ ...d, phase: 'idle' }));
      } catch (err) {
        console.warn('[depth] model unavailable, Ken Burns is used instead', err);
        setDepth((d) => ({ ...d, phase: 'error' }));
      } finally {
        depthBusy.current = false;
        // photos added meanwhile: run another pass
        if (mounted.current) setDepthPass((n) => n + 1);
      }
    })();
    // no cleanup: a running pass must not be cancelled by its own progress (pendingIds changes per photo)
  }, [parallax, pendingIds, update, depthPass, depth.phase]);

  const value = useMemo<EditorValue>(
    () => ({
      project,
      update,
      save: flush,
      saveState,
      selected,
      select: setSelected,
      startRender,
      renderStarting: starting,
      renderError: error,
      playerOpen,
      setPlayerOpen,
      depth,
      retryDepth: () => setDepth((d) => ({ ...d, phase: 'idle', done: 0, total: 0 })),
    }),
    [project, update, flush, saveState, selected, startRender, starting, error, playerOpen, depth],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEditor(): EditorValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEditor must be used inside EditorProvider');
  return ctx;
}
