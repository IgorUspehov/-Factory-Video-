/** Browser-side helpers for previews of uploaded files. */

const THUMB = 320;

function drawThumb(source: CanvasImageSource, w: number, h: number): string {
  const canvas = document.createElement('canvas');
  const scale = THUMB / Math.max(w, h);
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export function imageThumb(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(drawThumb(img, img.naturalWidth, img.naturalHeight));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image_decode_failed'));
    };
    img.src = url;
  });
}

export function videoInfo(file: File): Promise<{ thumb: string; duration: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    video.playsInline = true;
    const fail = () => {
      URL.revokeObjectURL(url);
      resolve({ thumb: '', duration: 5 });
    };
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      const thumb = drawThumb(video, video.videoWidth || 16, video.videoHeight || 9);
      resolve({ thumb, duration: Math.round((video.duration || 5) * 10) / 10 });
      URL.revokeObjectURL(url);
    };
    video.onerror = fail;
    setTimeout(fail, 8000);
    video.src = url;
  });
}

export function audioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration * 10) / 10 : 0);
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      resolve(0);
      URL.revokeObjectURL(url);
    };
    audio.src = url;
  });
}

/** Real waveform peaks from the decoded file; returns null if the browser cannot decode it. */
export async function computePeaks(file: File, count = 120): Promise<number[] | null> {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    void ctx.close();
    const data = buffer.getChannelData(0);
    const block = Math.floor(data.length / count) || 1;
    const peaks: number[] = [];
    for (let i = 0; i < count; i++) {
      let max = 0;
      for (let j = i * block; j < Math.min(data.length, (i + 1) * block); j += 16) max = Math.max(max, Math.abs(data[j]));
      peaks.push(max);
    }
    const top = Math.max(...peaks, 0.01);
    return peaks.map((p) => Math.round((p / top) * 100) / 100);
  } catch {
    return null;
  }
}

export const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac'];
export const AUDIO_EXT = /\.(mp3|wav|m4a)$/i;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
