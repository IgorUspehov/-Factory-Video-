import { phraseWeight, splitPhrases } from './text.js';

const pad = (n, w = 2) => String(n).padStart(w, '0');
const assTime = (sec) => {
  const cs = Math.max(0, Math.round(sec * 100));
  return `${Math.floor(cs / 360000)}:${pad(Math.floor(cs / 6000) % 60)}:${pad(Math.floor(cs / 100) % 60)}.${pad(cs % 100)}`;
};
const escapeText = (s) => String(s).replace(/\\/g, '/').replace(/[{}]/g, '').replace(/\r?\n/g, '\\N');

/**
 * Subtitle lines (2–4 words each) from audio chunks. Chunks play one after another, so every chunk's start and
 * length are exact; inside a chunk the lines share its duration in proportion to their length plus the pause after them.
 * A chunk may carry `start` (seconds from the beginning of the audio) — used for a recording whose speech does not
 * begin at 0; otherwise a chunk starts where the previous one ended.
 * @param {{text: string, duration: number, start?: number}[]} chunks
 */
export function subtitleLines(chunks, { gap = 0 } = {}) {
  const lines = [];
  let t = 0;
  for (const c of chunks) {
    const phrases = splitPhrases(c.text);
    const weight = phrases.reduce((n, p) => n + phraseWeight(p), 0) || 1;
    let at = c.start ?? t;
    for (const p of phrases) {
      const len = (c.duration * phraseWeight(p)) / weight;
      lines.push({ text: p, start: at, end: at + len });
      at += len;
    }
    t = (c.start ?? t) + c.duration + gap;
  }
  return lines;
}

/**
 * ASS file for a vertical reel: subtitles above the bottom plate, plus the plate itself.
 * libass is used because ffmpeg-static is built without drawtext. Inter (Latin + Cyrillic) is shipped in server/fonts.
 */
export function buildAvatarAss({ lines, total, width = 1080, height = 1920, plate = 'Telegram @Ihor_Kriazhev' }) {
  const subSize = Math.round(width * 0.094); // big: two or three words fill a line
  const plateSize = Math.round(width * 0.048);
  const plateH = Math.round(height * 0.055);
  const margin = Math.round(width * 0.05);
  const subBottom = Math.round(height * 0.15); // above the plate
  const plateBottom = Math.round(height * 0.045);
  const styles = [
    // bold white text (Inter 700 from server/fonts), thick black outline, soft shadow
    `Style: Sub,Inter,${subSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,1,${Math.round(subSize / 8)},3,2,${margin},${margin},${subBottom},1`,
    // opaque dark box behind the plate text (BorderStyle 3: Outline = box padding)
    `Style: Plate,Inter,${plateSize},&H00FFFFFF,&H00FFFFFF,&H00231A12,&H00231A12,-1,0,0,0,100,100,0,0,3,${Math.round(plateH * 0.28)},0,2,${margin},${margin},${plateBottom},1`,
  ];
  const events = lines
    .filter((l) => l.end > l.start && l.start < total)
    .map((l) => `Dialogue: 0,${assTime(l.start)},${assTime(Math.min(l.end, total))},Sub,,0,0,0,,${escapeText(l.text)}`);
  events.push(`Dialogue: 1,${assTime(0)},${assTime(total)},Plate,,0,0,0,,${escapeText(plate)}`);
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    ...styles,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\n');
}
