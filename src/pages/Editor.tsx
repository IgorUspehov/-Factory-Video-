import { useCallback, useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CloudOff,
  Download,
  FolderOpen,
  Images,
  LayoutGrid,
  Loader2,
  Music,
  Palette,
  Play,
  Save,
  Sparkles,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../lib/api';
import { autoLayout } from '../lib/project';
import { nodeKey } from '../lib/labels';
import { useI18n, type TKey } from '../i18n';
import { EditorProvider, useEditor } from '../editor/EditorContext';
import { BlockNode } from '../editor/nodes/BlockNode';
import { nodeIcon } from '../editor/nodeMeta';
import { AudioPanel } from '../editor/panels/AudioPanel';
import { VisualPanel } from '../editor/panels/VisualPanel';
import { TextPanel } from '../editor/panels/TextPanel';
import { StylePanel } from '../editor/panels/StylePanel';
import { MontagePanel } from '../editor/panels/MontagePanel';
import { OutputPanel } from '../editor/panels/OutputPanel';
import { AssistantPanel } from '../editor/AssistantPanel';
import { NextSteps } from '../editor/NextSteps';
import { PlayerModal } from '../editor/PlayerModal';
import { Spinner } from '../components/Spinner';
import type { FlowEdgeData, NodeKind, Project } from '../types';

const nodeTypes: NodeTypes = {
  audio: BlockNode,
  visual: BlockNode,
  text: BlockNode,
  style: BlockNode,
  montage: BlockNode,
  output: BlockNode,
};

const toRfEdge = (e: FlowEdgeData): Edge => ({ ...e, animated: true });

const panels: Record<NodeKind, () => JSX.Element> = {
  audio: AudioPanel,
  visual: VisualPanel,
  text: TextPanel,
  style: StylePanel,
  montage: MontagePanel,
  output: OutputPanel,
};

type NavId = 'projects' | 'canvas' | 'materials' | 'audio' | 'brand' | 'export';
interface NavItem {
  id: NavId;
  icon: LucideIcon;
  label: TKey;
  hint: TKey;
  node?: NodeKind;
}
const NAV: NavItem[] = [
  { id: 'projects', icon: FolderOpen, label: 'editor.nav.projects', hint: 'editor.navHint.projects' },
  { id: 'canvas', icon: Workflow, label: 'editor.nav.canvas', hint: 'editor.navHint.canvas' },
  { id: 'audio', icon: Music, label: 'editor.nav.audio', hint: 'editor.navHint.audio', node: 'audio' },
  { id: 'materials', icon: Images, label: 'editor.nav.materials', hint: 'editor.navHint.materials', node: 'visual' },
  { id: 'export', icon: Download, label: 'editor.nav.export', hint: 'editor.navHint.export' },
];
/** rarely needed: behind "Advanced" */
const NAV_ADVANCED: NavItem[] = [{ id: 'brand', icon: Palette, label: 'editor.nav.brand', hint: 'editor.navHint.brand', node: 'style' }];

const PANEL_KEY = 'fv_panel_width';
const PANEL_MIN = 380;
const clampPanel = (w: number) => Math.round(Math.min(Math.max(w, PANEL_MIN), Math.max(PANEL_MIN, window.innerWidth * 0.6)));
function initialPanelWidth() {
  try {
    const saved = Number(localStorage.getItem(PANEL_KEY));
    if (saved > 0) return clampPanel(saved);
  } catch {
    /* storage unavailable */
  }
  return clampPanel(window.innerWidth * 0.33);
}

const MOBILE_COLS = 2;
const DESKTOP_COLS = 3;
const isNarrow = () => window.innerWidth < 768;

function Canvas() {
  const { project, update, select } = useEditor();
  const { t } = useI18n();
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    (isNarrow() ? autoLayout(project.nodes, project.edges, MOBILE_COLS) : project.nodes).map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: {},
    })),
  );
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>(project.edges.map(toRfEdge));

  const persistEdges = useCallback(
    (next: Edge[]) => update({ edges: next.map((e) => ({ id: e.id, source: e.source, target: e.target })) }),
    [update],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChangeBase(changes);
      if (changes.some((c) => c.type === 'remove')) {
        const removed = new Set(changes.filter((c) => c.type === 'remove').map((c) => c.id));
        persistEdges(edges.filter((e) => !removed.has(e.id)));
      }
    },
    [onEdgesChangeBase, edges, persistEdges],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      const next = addEdge({ ...c, id: `e-${c.source}-${c.target}`, animated: true }, edges);
      setEdges(next);
      persistEdges(next);
    },
    [edges, setEdges, persistEdges],
  );

  const arrange = () => {
    const laid = autoLayout(project.nodes, project.edges, isNarrow() ? MOBILE_COLS : DESKTOP_COLS);
    update({ nodes: laid });
    setNodes((ns) => ns.map((n) => ({ ...n, position: laid.find((l) => l.id === n.id)?.position ?? n.position })));
    window.setTimeout(() => void fitView({ padding: 0.2, duration: 500 }), 50);
  };

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, n) => select(n.type as NodeKind)}
        onPaneClick={() => select(null)}
        onNodeDragStop={(_, __, dragged) => {
          const moved = new Map(dragged.map((d) => [d.id, d.position]));
          update((p: Project) => ({ nodes: p.nodes.map((n) => ({ ...n, position: moved.get(n.id) ?? n.position })) }));
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.15}
        maxZoom={1.75}
        panOnDrag
        zoomOnPinch
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#2c2c33" />
        <MiniMap
          className="!hidden sm:!block"
          pannable
          zoomable
          nodeColor={(n) => (n.type === 'output' ? '#FF6A1A' : '#26262B')}
          nodeStrokeColor="#FF8A3D"
          nodeBorderRadius={8}
        />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
      <button className="btn-secondary btn-sm absolute bottom-3 left-14 z-10 min-h-[40px] bg-card/90 backdrop-blur" onClick={arrange} title={t('editor.arrangeHint')}>
        <LayoutGrid size={14} /> {t('editor.arrange')}
      </button>
    </div>
  );
}

function Workspace() {
  const { project, update, save, saveState, selected, select, startRender, renderStarting } = useEditor();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { fitView } = useReactFlow();
  const [assistant, setAssistant] = useState(false);
  const [advancedNav, setAdvancedNav] = useState(false);
  const [panelWidth, setPanelWidth] = useState(initialPanelWidth);
  const Panel = selected ? panels[selected] : null;
  const PanelIcon = selected ? nodeIcon[selected] : null;

  useEffect(() => {
    const onResize = () => setPanelWidth((w) => clampPanel(w));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    let width = panelWidth;
    const move = (ev: PointerEvent) => {
      width = clampPanel(window.innerWidth - ev.clientX);
      setPanelWidth(width);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      try {
        localStorage.setItem(PANEL_KEY, String(width));
      } catch {
        /* storage unavailable */
      }
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };

  const nav = (id: NavId, node?: NodeKind) => {
    if (id === 'projects') navigate('/projects');
    else if (id === 'export') navigate(`/export/${project.id}`);
    else if (id === 'canvas') {
      select(null);
      void fitView({ padding: 0.2, duration: 400 });
    } else if (node) select(node);
  };
  const activeNav: NavId = selected === 'visual' ? 'materials' : selected === 'audio' ? 'audio' : selected === 'style' ? 'brand' : 'canvas';

  const run = async () => {
    select('output');
    await startRender();
  };

  const saveIcon =
    saveState === 'saving' ? <Loader2 size={13} className="animate-spin" /> : saveState === 'error' ? <CloudOff size={13} /> : saveState === 'saved' ? <Check size={13} /> : null;

  const navButton = (n: NavItem) => (
    <button
      key={n.id}
      onClick={() => nav(n.id, n.node)}
      title={t(n.hint)}
      className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition ${
        activeNav === n.id ? 'bg-accent/10 text-white shadow-glow-sm' : 'text-muted hover:bg-white/5 hover:text-white'
      }`}
    >
      <n.icon size={18} className={`shrink-0 ${activeNav === n.id ? 'text-accent-light' : ''}`} />
      <span className="hidden xl:inline">{t(n.label)}</span>
    </button>
  );

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      {/* toolbar */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-card/60 px-3 sm:px-4">
        <Link to="/projects" className="btn-ghost p-2 md:hidden" aria-label={t('editor.nav.projects')} title={t('editor.navHint.projects')}>
          <ArrowLeft size={18} />
        </Link>
        <input
          className="min-w-0 flex-1 truncate rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-display text-sm font-bold outline-none transition hover:border-line focus:border-accent sm:max-w-xs sm:text-base"
          value={project.title}
          onChange={(e) => update({ title: e.target.value })}
          aria-label={t('editor.title')}
          title={t('editor.titleHint')}
        />
        <span className={`hidden items-center gap-1 text-xs sm:flex ${saveState === 'error' ? 'text-red-300' : 'text-muted'}`} title={t('editor.autosaveHint')}>
          {saveIcon}
          {t(`editor.save.${saveState}`)}
        </span>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button className="btn-secondary btn-sm" onClick={() => void save()} disabled={saveState === 'saved' || saveState === 'saving'} title={t('editor.saveHint')}>
            <Save size={14} />
            <span className="hidden sm:inline">{t('editor.saveBtn')}</span>
          </button>
          <button className={`btn-secondary btn-sm ${assistant ? 'border-accent/70' : ''}`} onClick={() => setAssistant((v) => !v)} title={t('assistant.subtitle')}>
            <Sparkles size={14} className="text-accent-light" />
            <span className="hidden sm:inline">{t('assistant.title')}</span>
          </button>
          <button className="btn-primary btn-sm" onClick={() => void run()} disabled={renderStarting} title={t('steps.buildNowHint')}>
            <span className="hidden sm:inline">{t('steps.buildNow')}</span>
            <Play size={14} className="fill-white" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* sidebar */}
        <nav className="hidden w-16 shrink-0 flex-col gap-1 border-r border-line bg-card/40 p-2 md:flex xl:w-56" aria-label={t('editor.navLabel')}>
          {NAV.map(navButton)}
          <div className="mt-2 border-t border-line pt-2">
            <button
              onClick={() => setAdvancedNav((v) => !v)}
              aria-expanded={advancedNav}
              title={t('common.advancedHint')}
              className="flex min-h-[40px] w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-muted hover:text-white"
            >
              <ChevronDown size={16} className={`shrink-0 transition ${advancedNav ? 'rotate-180' : ''}`} />
              <span className="hidden xl:inline">{t('common.advanced')}</span>
            </button>
            {advancedNav && NAV_ADVANCED.map(navButton)}
          </div>
        </nav>

        {/* steps + canvas */}
        <div className="flex min-w-0 flex-1 flex-col">
          <NextSteps />
          <div className="min-h-0 flex-1">
            <Canvas />
          </div>
        </div>

        {/* properties */}
        {Panel && selected && PanelIcon && (
          <aside
            style={{ '--panel-w': `${panelWidth}px` } as CSSProperties}
            className="panel absolute inset-x-0 bottom-0 z-20 flex h-[85dvh] flex-col rounded-t-[20px] border-t border-line bg-card shadow-2xl lg:relative lg:h-auto lg:w-[var(--panel-w)] lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none"
          >
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t('editor.resize')}
              title={t('editor.resize')}
              onPointerDown={startResize}
              className="absolute -left-1.5 top-0 z-10 hidden h-full w-3 cursor-col-resize lg:block"
            >
              <span className="mx-auto block h-full w-px bg-line transition hover:bg-accent" />
            </div>
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-line lg:hidden" />
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="icon-tile h-11 w-11">
                <PanelIcon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-bold">{t(nodeKey[selected])}</div>
                <div className="truncate text-[13px] text-muted">{t(`nodes.desc.${selected}`)}</div>
              </div>
              <button className="btn-ghost min-h-[44px] min-w-[44px] p-2" onClick={() => select(null)} aria-label={t('common.close')} title={t('common.close')}>
                <X size={20} />
              </button>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5 pb-10">
              <Panel />
            </div>
          </aside>
        )}

        {assistant && <AssistantPanel onClose={() => setAssistant(false)} />}
      </div>

      {/* mobile nav */}
      <nav className="grid shrink-0 grid-cols-5 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => nav(n.id, n.node)}
            title={t(n.hint)}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-1 py-2 text-[11px] ${activeNav === n.id ? 'text-accent-light' : 'text-muted'}`}
          >
            <n.icon size={19} />
            <span className="max-w-full truncate px-0.5">{t(n.label)}</span>
          </button>
        ))}
      </nav>

      <PlayerModal />
    </div>
  );
}

export default function Editor() {
  const { projectId = '' } = useParams();
  const { t } = useI18n();
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setProject(null);
    setMissing(false);
    api
      .getProject(projectId)
      .then(setProject)
      .catch(() => setMissing(true));
  }, [projectId]);

  const content = useMemo(
    () =>
      project && (
        <EditorProvider key={project.id} initial={project}>
          <ReactFlowProvider>
            <Workspace />
          </ReactFlowProvider>
        </EditorProvider>
      ),
    [project],
  );

  if (missing)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="h-display text-2xl">{t('editor.notFound')}</h1>
        <Link to="/projects" className="btn-primary mt-6">
          {t('nav.myProjects')} →
        </Link>
      </div>
    );
  if (!project) return <Spinner full />;
  return content;
}
