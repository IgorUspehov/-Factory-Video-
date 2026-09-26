import { Crown, Zap } from 'lucide-react';
import type { Plan } from '../types';

export function PlanBadge({ plan }: { plan: Plan }) {
  return plan === 'pro' ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/60 bg-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-light shadow-glow-sm">
      <Crown size={11} /> Pro
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-line px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">Free</span>
  );
}

export function CreditsBadge({ credits }: { credits: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-bg px-2.5 py-1 text-xs font-semibold tabular-nums">
      <Zap size={13} className="fill-accent text-accent" />
      {credits}
    </span>
  );
}
