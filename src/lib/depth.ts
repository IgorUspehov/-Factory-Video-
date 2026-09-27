/**
 * Depth maps for 2.5D parallax, computed in the user's browser with an open model:
 * Depth Anything V2 Small (Apache-2.0), ONNX, 8-bit quantized (~27 MB), via transformers.js (ONNX Runtime Web, WASM).
 * transformers.js is NOT an npm dependency: its self-contained browser bundle is imported at runtime from
 * jsDelivr (pinned version), only when parallax is switched on. ONNX Runtime's WASM also comes from jsDelivr,
 * the model from Hugging Face; the browser caches all of it, so it is downloaded once.
 */

/** Pinned version; this bundle has no bare imports, so the browser can load it directly. */
export const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js';

/** The part of the transformers.js API used here. */
interface RawImageLike {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  channels: number;
}
interface TransformersModule {
  env: { allowLocalModels: boolean };
  pipeline: (task: 'depth-estimation', model: string, options: Record<string, unknown>) => Promise<unknown>;
  RawImage: { fromCanvas: (canvas: HTMLCanvasElement) => unknown };
}

let modulePromise: Promise<TransformersModule> | null = null;
function loadTransformers(): Promise<TransformersModule> {
  // a variable URL + @vite-ignore keeps Vite from bundling it
  const url = TRANSFORMERS_URL;
  modulePromise ??= (import(/* @vite-ignore */ url) as Promise<TransformersModule>).catch((err) => {
    modulePromise = null;
    throw err;
  });
  return modulePromise;
}

export const DEPTH_MODEL = 'onnx-community/depth-anything-v2-small';
/** long side of the depth map = long side of the largest render format (720×1280) */
const MAX_SIDE = 1280;

export interface DepthResult {
  png: Blob;
  threshold: number;
  width: number;
  height: number;
  ms: number;
}

export type ModelProgress = (percent: number) => void;

type DepthPipeline = (input: unknown) => Promise<{ depth: RawImageLike }>;

let pipelinePromise: Promise<DepthPipeline> | null = null;

async function getPipeline(onProgress?: ModelProgress): Promise<DepthPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await loadTransformers();
      env.allowLocalModels = false;
      const loaded = new Map<string, { loaded: number; total: number }>();
      const pipe = await pipeline('depth-estimation', DEPTH_MODEL, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (p: { status?: string; file?: string; loaded?: number; total?: number }) => {
          // only large files (the model weights) count; small config files would make the bar jump to 100 %
          if (p.status === 'progress' && p.file && p.total && p.total > 1_000_000) {
            loaded.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
            let a = 0;
            let b = 0;
            for (const v of loaded.values()) {
              a += v.loaded;
              b += v.total;
            }
            onProgress?.(Math.round((a / b) * 100));
          }
        },
      });
      return pipe as unknown as DepthPipeline;
    })().catch((err) => {
      pipelinePromise = null; // allow a retry later
      throw err;
    });
  }
  return pipelinePromise;
}

/** Throws ModelError when the model/runtime cannot be loaded (old browser, offline, blocked CDN). */
export class ModelError extends Error {}

export async function preloadDepthModel(onProgress?: ModelProgress): Promise<void> {
  try {
    await getPipeline(onProgress);
  } catch (err) {
    throw new ModelError(err instanceof Error ? err.message : String(err));
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // pixels must be readable (server /files and Unsplash/Pexels send CORS headers)
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = url;
  });
}

/** Otsu threshold on the depth histogram, kept between the 40th and 85th percentile. */
function foregroundThreshold(values: Uint8Array | Uint8ClampedArray, step: number): number {
  const hist = new Array<number>(256).fill(0);
  let n = 0;
  for (let i = 0; i < values.length; i += step) {
    hist[values[i]]++;
    n++;
  }
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = i;
    }
  }
  const percentile = (q: number) => {
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= q * n) return i;
    }
    return 255;
  };
  return Math.min(percentile(0.85), Math.max(percentile(0.4), threshold));
}

export async function computeDepth(url: string, onModelProgress?: ModelProgress): Promise<DepthResult> {
  let pipe: DepthPipeline;
  try {
    pipe = await getPipeline(onModelProgress);
  } catch (err) {
    throw new ModelError(err instanceof Error ? err.message : String(err));
  }
  const t0 = performance.now();
  const img = await loadImage(url);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);

  const { RawImage } = await loadTransformers();
  const { depth } = await pipe(RawImage.fromCanvas(canvas));
  const { data, width, height, channels } = depth;
  const threshold = foregroundThreshold(data, channels);

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d')!;
  const pixels = ctx.createImageData(width, height);
  for (let i = 0, j = 0; i < width * height; i++, j += channels) {
    const v = data[j];
    pixels.data[i * 4] = v;
    pixels.data[i * 4 + 1] = v;
    pixels.data[i * 4 + 2] = v;
    pixels.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const png = await new Promise<Blob>((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('png_failed'))), 'image/png'));
  const ms = Math.round(performance.now() - t0);
  console.info(`[depth] ${width}×${height} in ${ms} ms, threshold ${threshold}`);
  return { png, threshold, width, height, ms };
}
