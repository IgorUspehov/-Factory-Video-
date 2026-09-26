import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { useEditor } from './EditorContext';
import { useI18n, type TKey } from '../i18n';
import { api } from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const QUICK: TKey[] = ['assistant.quick.order', 'assistant.quick.slogan', 'assistant.quick.next'];

export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { project } = useEditor();
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: t('assistant.greeting') }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const ask = async (text: string) => {
    if (!text.trim() || busy) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setBusy(true);
    try {
      const { suggestion } = await api.assistant({
        projectId: project.id,
        message: text,
        lang,
        context: {
          goal: project.goal,
          format: project.format,
          mood: project.mood,
          hasAudio: !!project.audio && project.audio.source !== 'none',
          mediaCount: project.media.length,
          lyricsCount: project.lyrics.length,
          textMode: project.textMode,
        },
      });
      setMessages((m) => [...m, { role: 'assistant', text: suggestion }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: t('assistant.error') }]);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input);
  };

  return (
    <aside className="absolute inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l border-line bg-card shadow-2xl">
      <div className="flex items-center gap-3 border-b border-line p-4">
        <span className="icon-tile h-9 w-9">
          <Sparkles size={16} />
        </span>
        <div className="flex-1">
          <div className="font-display font-bold">{t('assistant.title')}</div>
          <div className="text-[11px] text-muted">{t('assistant.subtitle')}</div>
        </div>
        <button className="btn-ghost p-2" onClick={onClose} aria-label={t('common.close')}>
          <X size={18} />
        </button>
      </div>
      <div ref={listRef} className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm ${
              m.role === 'user' ? 'ml-auto bg-accent/15 text-white' : 'border border-line bg-bg text-white/90'
            }`}
          >
            {m.text}
          </div>
        ))}
        {busy && <div className="w-16 rounded-2xl border border-line bg-bg px-3.5 py-2.5 text-sm animate-pulse-glow">•••</div>}
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pb-2">
        {QUICK.map((q) => (
          <button key={q} className="chip" onClick={() => void ask(t(q))} disabled={busy}>
            {t(q)}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <input className="input py-2.5" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('assistant.placeholder')} />
        <button className="btn-primary px-3.5" disabled={busy || !input.trim()} aria-label={t('assistant.send')}>
          <Send size={16} />
        </button>
      </form>
    </aside>
  );
}
