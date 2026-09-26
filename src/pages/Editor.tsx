import { useCallback, useEffect, useMemo, useState } from 'react';
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
const NAV: { id: NavId; icon: LucideIcon; label: TKey; node?: NodeKind }[] = [
  { id: 'projects', icon: FolderOpen, label: 'editor.nav.projects' },
  { id: 'canvas', icon: Workflow, label: 'editor.nav.canvas' },
  { id: 'materials', icon: Images, label: 'editor.nav.materials', node: 'visual' },
  { id: 'audio', icon: Music, label: 'editor.nav.audio', node: 'audio' },
  { id: 'brand', icon: Palette, label: 'editor.nav.brand', node: 'style' },
  { id: 'export', icon: Download, label: 'editor.nav.export' },
];

const MOBILE_COLS = 2;
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
    const laid = autoLayout(project.nodes, project.edges, isNarrow() ? MOBILE_COLS : Infinity);
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
      <button className="btn-secondary btn-sm absolute right-3 top-3 z-10 bg-card/90 backdrop-blur" onClick={arrange}>
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
  const Panel = selected ? panels[selected] : null;
  const PanelIcon = selected ? nodeIcon[selected] : null;

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

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      {/* toolbar */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-card/60 px-3 sm:px-4">
        <Link to="/projects" className="btn-ghost p-2 md:hidden" aria-label={t('editor.nav.projects')}>
          <ArrowLeft size={18} />
        </Link>
        <input
          className="min-w-0 flex-1 truncate rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-display text-sm font-bold outline-none transition hover:border-line focus:border-accent sm:max-w-xs sm:text-base"
          value={project.title}
          onChange={(e) => update({ title: e.target.value })}
          aria-label={t('editor.title')}
        />
        <span className={`hidden items-center gap-1 text-xs sm:flex ${saveState === 'error' ? 'text-red-300' : 'text-muted'}`}>
          {saveIcon}
          {t(`editor.save.${saveState}`)}
        </span>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button className="btn-secondary btn-sm" onClick={() => void save()} disabled={saveState === 'saved' || saveState === 'saving'}>
            <Save size={14} />
            <span className="hidden sm:inline">{t('editor.saveBtn')}</span>
          </button>
          <button className={`btn-secondary btn-sm ${assistant ? 'border-accent/70' : ''}`} onClick={() => setAssistant((v) => !v)}>
            <Sparkles size={14} className="text-accent-light" />
            <span className="hidden sm:inline">{t('assistant.title')}</span>
          </button>
          <button className="btn-primary btn-sm" onClick={() => void run()} disabled={renderStarting}>
            <span className="hidden sm:inline">{t('editor.run')}</span>
            <Play size={14} className="fill-white" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* sidebar */}
        <nav className="hidden w-16 shrink-0 flex-col gap-1 border-r border-line bg-card/40 p-2 md:flex xl:w-52">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => nav(n.id, n.node)}
              title={t(n.label)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                activeNav === n.id ? 'bg-accent/10 text-white shadow-glow-sm' : 'text-muted hover:bg-white/5 hover:text-white'
              }`}
            >
              <n.icon size={18} className={activeNav === n.id ? 'text-accent-light' : ''} />
              <span className="hidden xl:inline">{t(n.label)}</span>
            </button>
          ))}
        </nav>

        {/* canvas */}
        <div className="min-w-0 flex-1">
          <Canvas />
        </div>

        {/* properties */}
        {Panel && selected && PanelIcon && (
          <aside className="absolute inset-x-0 bottom-0 z-20 flex max-h-[72dvh] flex-col rounded-t-[20px] border-t border-line bg-card shadow-2xl lg:static lg:max-h-none lg:w-[380px] lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none">
            <div className="flex items-center gap-3 border-b border-line p-4">
              <span className="icon-tile h-9 w-9">
                <PanelIcon size={16} />
              </span>
              <div className="flex-1">
                <div className="label-caps">{t('editor.properties')}</div>
                <div className="font-display font-bold">{t(nodeKey[selected])}</div>
              </div>
              <button className="btn-ghost p-2" onClick={() => select(null)} aria-label={t('common.close')}>
                <X size={18} />
              </button>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto p-4 pb-8">
              <Panel />
            </div>
          </aside>
        )}

        {assistant && <AssistantPanel onClose={() => setAssistant(false)} />}
      </div>

      {/* mobile nav */}
      <nav className="grid shrink-0 grid-cols-6 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => nav(n.id, n.node)}
            className={`flex flex-col items-center gap-1 py-2 text-[10px] ${activeNav === n.id ? 'text-accent-light' : 'text-muted'}`}
          >
            <n.icon size={18} />
            <span className="max-w-full truncate px-0.5">{t(n.label)}</span>
          </button>
        ))}
      </nav>
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
