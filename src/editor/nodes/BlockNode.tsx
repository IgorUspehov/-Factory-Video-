import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play, Zap } from 'lucide-react';
import { useEditor } from '../EditorContext';
import { useI18n } from '../../i18n';
import { nodeIcon } from '../nodeMeta';
import { nodeKey, statusKey, textModeKey, transitionKey } from '../../lib/labels';
import { effectiveTimeline, formatClock, projectDuration } from '../../lib/project';
import { renderCost } from '../../config/pricing';
import { Waveform } from '../../components/Waveform';
import type { NodeKind } from '../../types';

function Summary({ kind }: { kind: NodeKind }) {
  const { project, startRender, renderStarting } = useEditor();
  const { t } = useI18n();
  const empty = (text: string) => <p className="text-[13px] text-muted">{text}</p>;

  switch (kind) {
    case 'audio': {
      const a = project.audio;
      if (!a) return empty(t('nodes.audioEmpty'));
      if (a.source === 'none') return empty(t('audio.noneActive'));
      return (
        <div>
          <div className="truncate text-[13px] font-medium">{a.name}</div>
          <div className="mt-2 rounded-lg bg-bg p-1.5">
            <Waveform peaks={a.peaks} beats={a.beats} duration={a.duration} height={28} compact />
          </div>
          <div className="mt-1.5 flex justify-between text-[12px] text-muted">
            <span>{a.bpm ? `${a.bpm} BPM` : ''}</span>
            <span>{formatClock(a.duration)}</span>
          </div>
        </div>
      );
    }
    case 'visual':
      if (project.media.length === 0) return empty(t('nodes.visualEmpty'));
      return (
        <div>
          <div className="grid grid-cols-4 gap-1">
            {project.media.slice(0, 8).map((m) => (
              <div key={m.id} className="aspect-square overflow-hidden rounded-md bg-bg">
                {m.thumb && <img src={m.thumb} alt="" className="h-full w-full object-cover" draggable={false} />}
              </div>
            ))}
          </div>
          <div className="mt-1.5 text-[12px] text-muted">{t('nodes.items', { n: project.media.length })}</div>
        </div>
      );
    case 'text':
      return (
        <div>
          <div className="label-caps mb-1.5 text-[11px] text-accent-light">{t(textModeKey[project.textMode])}</div>
          {project.lyrics.length === 0
            ? empty(t('nodes.textEmpty'))
            : project.lyrics.slice(0, 2).map((l) => (
                <div key={l.id} className="truncate text-[13px]">
                  <span className="mr-1.5 tabular-nums text-muted">{l.start.toFixed(1)}s</span>
                  {l.text}
                </div>
              ))}
          {project.lyrics.length > 2 && <div className="mt-1 text-[12px] text-muted">+{project.lyrics.length - 2}</div>}
        </div>
      );
    case 'style': {
      const s = project.style;
      return (
        <div className="flex items-center gap-2">
          {[s.background, s.accent, s.text].map((c, i) => (
            <span key={i} className="h-5 w-5 rounded-full border border-white/20" style={{ background: c }} />
          ))}
          <span className="ml-1 truncate text-xs" style={{ fontFamily: s.font }}>
            {s.font}
          </span>
          <span className="ml-auto text-[12px] text-muted">{t(transitionKey[s.transition])}</span>
        </div>
      );
    }
    case 'montage': {
      const plan = effectiveTimeline(project);
      const total = plan.total;
      if (project.timeline.length === 0) return empty(t('nodes.montageEmpty'));
      return (
        <div>
          <div className="flex h-6 gap-px overflow-hidden rounded-md">
            {plan.clips.map((c, i) => (
              <span key={i} className={i % 2 ? 'bg-accent/60' : 'bg-accent'} style={{ flexGrow: c.duration }} />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[12px] text-muted">
            <span>{t('nodes.clips', { n: plan.clips.length })}</span>
            <span>{formatClock(total)}</span>
          </div>
        </div>
      );
    }
    case 'output': {
      const r = project.render;
      const cost = renderCost(projectDuration(project) || 15);
      return (
        <div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted">
              {project.format} · {formatClock(projectDuration(project))}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <Zap size={12} className="fill-accent text-accent" />
              {cost}
            </span>
          </div>
          {r.status !== 'idle' && (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                <div className="glow-line h-full transition-all" style={{ width: `${r.status === 'done' ? 100 : r.progress}%` }} />
              </div>
              <div className="mt-1 text-[12px] text-muted">
                {t(statusKey[r.status])}
                {r.status === 'rendering' ? ` · ${r.progress}%` : ''}
              </div>
            </div>
          )}
          <button
            className="btn-primary btn-sm nodrag mt-3 w-full"
            disabled={renderStarting || r.status === 'queued' || r.status === 'rendering'}
            onClick={(e) => {
              e.stopPropagation();
              void startRender();
            }}
          >
            <Play size={12} className="fill-white" /> {t('steps.buildNow')}
          </button>
        </div>
      );
    }
  }
}

function BlockNodeImpl({ type }: NodeProps) {
  const kind = type as NodeKind;
  const { selected } = useEditor();
  const { t } = useI18n();
  const Icon = nodeIcon[kind];
  const active = selected === kind;
  const isOutput = kind === 'output';
  return (
    <div
      title={t(`nodes.desc.${kind}`)}
      className={`w-[280px] cursor-pointer rounded-[18px] border bg-card p-4 transition ${
        active ? 'border-accent shadow-glow' : isOutput ? 'border-accent/50 shadow-glow-sm' : 'border-line hover:border-accent/50'
      }`}
    >
      {kind !== 'audio' && <Handle type="target" position={Position.Left} />}
      <div className="mb-3 flex items-start gap-3">
        <span className="icon-tile h-10 w-10 rounded-xl">
          <Icon size={18} />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[14px] font-extrabold uppercase tracking-[0.12em]">{t(nodeKey[kind])}</span>
          <span className="block text-[13px] leading-snug text-muted">{t(`nodes.desc.${kind}`)}</span>
        </span>
      </div>
      <Summary kind={kind} />
      {!isOutput && <Handle type="source" position={Position.Right} />}
    </div>
  );
}

export const BlockNode = memo(BlockNodeImpl);
