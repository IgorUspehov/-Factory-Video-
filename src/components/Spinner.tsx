import { Loader2 } from 'lucide-react';

export function Spinner({ full = false }: { full?: boolean }) {
  const icon = <Loader2 className="animate-spin text-accent" size={28} />;
  return full ? <div className="flex min-h-[50vh] items-center justify-center">{icon}</div> : icon;
}
