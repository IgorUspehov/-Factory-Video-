import { useEffect, useRef, useState } from 'react';

/** Single shared audio element for previewing tracks in lists. */
export function useAudioPreview() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => () => audio.current?.pause(), []);

  const toggle = (id: string, url: string) => {
    if (playing === id) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    const a = new Audio(url);
    a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    a.onended = () => setPlaying(null);
    a.play().catch(() => setPlaying(null));
    audio.current = a;
    setProgress(0);
    setPlaying(id);
  };

  return { playing, progress, toggle };
}
