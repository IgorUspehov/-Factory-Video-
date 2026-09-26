import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useRender, type RenderError } from '../lib/useRender';
import type { Format, NodeKind, Project, RenderState } from '../types';

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
    }),
    [project, update, flush, saveState, selected, startRender, starting, error, playerOpen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEditor(): EditorValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEditor must be used inside EditorProvider');
  return ctx;
}
