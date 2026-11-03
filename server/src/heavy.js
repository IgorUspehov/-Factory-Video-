/**
 * Mutex for memory-hungry ffmpeg work. Render Free has 512 MB: a video render (~280 MB) and an avatar
 * composition must never run at the same time. FIFO, one holder.
 */
let tail = Promise.resolve();

export function withHeavyLock(fn) {
  const run = tail.then(fn, fn);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
