interface Props {
  peaks: number[];
  beats?: number[];
  duration?: number;
  progress?: number;
  height?: number;
  compact?: boolean;
}

/** Bar waveform with optional beat markers; progress (0..1) tints played bars. */
export function Waveform({ peaks, beats = [], duration = 0, progress = 0, height = 56, compact = false }: Props) {
  const bars = compact ? peaks.filter((_, i) => i % 2 === 0) : peaks;
  return (
    <div className="relative w-full" style={{ height }}>
      <div className="absolute inset-0 flex items-center gap-[2px]">
        {bars.map((p, i) => (
          <span
            key={i}
            className={`flex-1 rounded-full ${i / bars.length <= progress ? 'bg-accent shadow-[0_0_6px_rgba(255,106,26,0.8)]' : 'bg-white/25'}`}
            style={{ height: `${Math.max(6, p * 100)}%` }}
          />
        ))}
      </div>
      {duration > 0 &&
        beats.map((b, i) =>
          i % (compact ? 4 : 2) === 0 ? (
            <span key={b} className="absolute bottom-0 top-0 w-px bg-accent-light/40" style={{ left: `${(b / duration) * 100}%` }} />
          ) : null,
        )}
    </div>
  );
}
