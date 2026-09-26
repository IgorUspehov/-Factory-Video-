import { useState } from 'react';
import { ClipboardPaste, Plus, Rows3, Trash2 } from 'lucide-react';
import { useEditor } from '../EditorContext';
import { useI18n } from '../../i18n';
import { projectDuration, uid } from '../../lib/project';
import { textModeKey } from '../../lib/labels';
import { Hint } from '../../components/Hint';
import type { LyricLine, TextMode } from '../../types';

const MODES: TextMode[] = ['titles', 'slogan', 'lyrics'];

function distribute(lines: string[], total: number): LyricLine[] {
  const span = Math.max(total, lines.length * 2) / Math.max(lines.length, 1);
  return lines.map((text, i) => ({
    id: uid('ln'),
    text,
    start: Math.round(i * span * 10) / 10,
    end: Math.round((i * span + span * 0.9) * 10) / 10,
  }));
}

export function TextPanel() {
  const { project, update } = useEditor();
  const { t } = useI18n();
  const [paste, setPaste] = useState(false);
  const [raw, setRaw] = useState('');
  const lines = project.lyrics;

  const setLine = (id: string, patch: Partial<LyricLine>) =>
    update((p) => ({ lyrics: p.lyrics.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

  const addLine = () => {
    const last = lines[lines.length - 1];
    const start = last ? Math.round((last.end + 0.5) * 10) / 10 : 0;
    update((p) => ({ lyrics: [...p.lyrics, { id: uid('ln'), text: '', start, end: start + 3 }] }));
  };

  const num = (v: string) => Math.max(0, Math.round((parseFloat(v.replace(',', '.')) || 0) * 10) / 10);

  return (
    <div className="space-y-4">
      <Hint>{t('text.intro')}</Hint>
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-bg p-1">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => update({ textMode: m })}
            title={t(`text.hints.${m}`)}
            className={`min-h-[44px] rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
              project.textMode === m ? 'bg-accent/15 text-accent-light' : 'text-muted hover:text-white'
            }`}
          >
            {t(textModeKey[m])}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{t(`text.hints.${project.textMode}`)}</p>

      <div className="space-y-2">
        {lines.length > 0 && (
          <div className="grid grid-cols-[1fr_64px_64px_36px] gap-1.5 px-1">
            <span className="label-caps">{t('text.line')}</span>
            <span className="label-caps">{t('text.start')}</span>
            <span className="label-caps">{t('text.end')}</span>
            <span />
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id} className="grid grid-cols-[1fr_64px_64px_36px] items-center gap-1.5">
            <input className="input px-3 py-2" value={l.text} placeholder={t('text.placeholder')} onChange={(e) => setLine(l.id, { text: e.target.value })} />
            <input
              className="input px-2 py-2 text-center tabular-nums"
              inputMode="decimal"
              value={l.start}
              aria-label={t('text.start')}
              onChange={(e) => setLine(l.id, { start: num(e.target.value) })}
            />
            <input
              className="input px-2 py-2 text-center tabular-nums"
              inputMode="decimal"
              value={l.end}
              aria-label={t('text.end')}
              onChange={(e) => setLine(l.id, { end: num(e.target.value) })}
            />
            <button className="btn-ghost p-1.5" onClick={() => update((p) => ({ lyrics: p.lyrics.filter((x) => x.id !== l.id) }))} aria-label={t('common.remove')}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {lines.some((l) => l.end <= l.start) && <p className="text-xs text-red-300">{t('text.timeError')}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary btn-sm" onClick={addLine} title={t('text.addHint')}>
          <Plus size={14} /> {t('text.add')}
        </button>
        <button className="btn-secondary btn-sm" onClick={() => setPaste((v) => !v)} title={t('text.pasteHint')}>
          <ClipboardPaste size={14} /> {t('text.paste')}
        </button>
        {lines.length > 1 && (
          <button
            className="btn-ghost btn-sm"
            title={t('text.distributeHint')}
            onClick={() => update((p) => ({ lyrics: distribute(p.lyrics.map((l) => l.text), projectDuration(p)) }))}
          >
            <Rows3 size={14} /> {t('text.distribute')}
          </button>
        )}
      </div>

      {paste && (
        <div className="space-y-2">
          <textarea className="input min-h-[140px]" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={t('text.pastePlaceholder')} />
          <button
            className="btn-primary btn-sm"
            disabled={!raw.trim()}
            onClick={() => {
              const parsed = raw.split('\n').map((s) => s.trim()).filter(Boolean);
              update((p) => ({ lyrics: distribute(parsed, projectDuration(p)), textMode: p.textMode }));
              setRaw('');
              setPaste(false);
            }}
          >
            {t('text.pasteApply')} →
          </button>
        </div>
      )}
    </div>
  );
}
