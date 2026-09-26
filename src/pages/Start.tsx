import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Check,
  Coffee,
  Flame,
  Gem,
  Megaphone,
  Monitor,
  Music,
  Smartphone,
  Square,
  type LucideIcon,
} from 'lucide-react';
import { useI18n, type TKey } from '../i18n';
import { api } from '../lib/api';
import { createDraft } from '../lib/project';
import { formatKey, goalKey, moodKey } from '../lib/labels';
import type { Format, Goal, Mood } from '../types';

const goals: { id: Goal; icon: LucideIcon; hint: TKey }[] = [
  { id: 'clip', icon: Music, hint: 'start.goalHints.clip' },
  { id: 'promo', icon: Megaphone, hint: 'start.goalHints.promo' },
  { id: 'reels', icon: Smartphone, hint: 'start.goalHints.reels' },
];
const formats: { id: Format; icon: LucideIcon; hint: TKey }[] = [
  { id: '9:16', icon: Smartphone, hint: 'start.formatHints.vertical' },
  { id: '16:9', icon: Monitor, hint: 'start.formatHints.horizontal' },
  { id: '1:1', icon: Square, hint: 'start.formatHints.square' },
];
const moods: { id: Mood; icon: LucideIcon; hint: TKey }[] = [
  { id: 'calm', icon: Coffee, hint: 'start.moodHints.calm' },
  { id: 'energetic', icon: Flame, hint: 'start.moodHints.energetic' },
  { id: 'premium', icon: Gem, hint: 'start.moodHints.premium' },
  { id: 'corporate', icon: Briefcase, hint: 'start.moodHints.corporate' },
];

const defaultFormat: Record<Goal, Format> = { clip: '16:9', promo: '1:1', reels: '9:16' };

export default function Start() {
  const { t, formatDate } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [format, setFormat] = useState<Format | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const create = async (m: Mood) => {
    if (!goal || !format) return;
    setBusy(true);
    setError(false);
    try {
      const starterLines =
        goal === 'promo' ? [t('start.starter.promo1'), t('start.starter.promo2')] : goal === 'reels' ? [t('start.starter.reels1')] : [];
      const project = await api.createProject(
        createDraft({
          title: t('start.defaultTitle', { goal: t(goalKey[goal]), date: formatDate(new Date().toISOString()) }),
          goal,
          format,
          mood: m,
          starterLines,
        }),
      );
      navigate(`/editor/${project.id}`);
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  const steps: { title: TKey; subtitle: TKey }[] = [
    { title: 'start.steps.goal', subtitle: 'start.steps.goalSub' },
    { title: 'start.steps.format', subtitle: 'start.steps.formatSub' },
    { title: 'start.steps.mood', subtitle: 'start.steps.moodSub' },
  ];

  const Option = ({ active, icon: Icon, title, hint, onClick }: { active: boolean; icon: LucideIcon; title: string; hint: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      disabled={busy}
      className={`card group flex items-start gap-4 p-5 text-left transition hover:border-accent/60 ${active ? 'border-accent shadow-glow' : ''}`}
    >
      <span className={`icon-tile h-12 w-12 ${active ? 'bg-accent/20' : ''}`}>
        <Icon size={22} />
      </span>
      <span className="flex-1">
        <span className="block font-display text-lg font-bold">{title}</span>
        <span className="mt-1 block text-sm text-muted">{hint}</span>
      </span>
      {active && <Check size={18} className="text-accent" />}
    </button>
  );

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="flex items-center justify-between">
        <span className="label-caps">{t('start.progress', { n: step + 1, total: 3 })}</span>
        {step > 0 && (
          <button className="btn-ghost btn-sm" onClick={() => setStep(step - 1)} disabled={busy}>
            <ArrowLeft size={14} /> {t('common.back')}
          </button>
        )}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="glow-line h-full rounded-full transition-all duration-500" style={{ width: `${((step + 1) / 3) * 100}%` }} />
      </div>

      <h1 className="h-display mt-10 text-3xl sm:text-4xl">
        {t(steps[step].title)}
      </h1>
      <p className="mt-2 text-muted">{t(steps[step].subtitle)}</p>

      <div className={`mt-8 grid gap-4 ${step === 2 ? 'sm:grid-cols-2' : ''}`}>
        {step === 0 &&
          goals.map((g) => (
            <Option
              key={g.id}
              active={goal === g.id}
              icon={g.icon}
              title={t(goalKey[g.id])}
              hint={t(g.hint)}
              onClick={() => {
                setGoal(g.id);
                setFormat((f) => f ?? defaultFormat[g.id]);
                setStep(1);
              }}
            />
          ))}
        {step === 1 &&
          formats.map((f) => (
            <Option
              key={f.id}
              active={format === f.id}
              icon={f.icon}
              title={`${f.id} · ${t(formatKey[f.id])}`}
              hint={t(f.hint)}
              onClick={() => {
                setFormat(f.id);
                setStep(2);
              }}
            />
          ))}
        {step === 2 &&
          moods.map((m) => (
            <Option
              key={m.id}
              active={mood === m.id}
              icon={m.icon}
              title={t(moodKey[m.id])}
              hint={t(m.hint)}
              onClick={() => {
                setMood(m.id);
                void create(m.id);
              }}
            />
          ))}
      </div>

      {busy && <p className="mt-6 text-center text-sm text-accent-light animate-pulse-glow">{t('start.creating')}</p>}
      {error && <p className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{t('auth.errors.generic')}</p>}
      <div className="hand mt-10 text-center text-2xl">{t('start.hand')}</div>
    </section>
  );
}
