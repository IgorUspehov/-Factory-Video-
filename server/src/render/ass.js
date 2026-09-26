/**
 * Builds an ASS subtitle file for the project's text lines and the Free watermark.
 * libass is used instead of drawtext: the ffmpeg-static 7.0.2 build ships without drawtext.
 */

/** Fonts shipped in server/fonts (OFL). Everything else falls back to Inter. */
const FONTS = new Set(['Inter', 'Montserrat', 'Bebas Neue', 'Playfair Display']);
const NO_CYRILLIC = new Set(['Bebas Neue']);

const pad = (n, w = 2) => String(n).padStart(w, '0');
function assTime(sec) {
  const cs = Math.max(0, Math.round(sec * 100));
  return `${Math.floor(cs / 360000)}:${pad(Math.floor(cs / 6000) % 60)}:${pad(Math.floor(cs / 100) % 60)}.${pad(cs % 100)}`;
}

/** #RRGGBB → &HAABBGGRR (alpha 00 = opaque). */
function assColor(hex, alpha = 0) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  const rgb = m ? m[1] : 'FFFFFF';
  return `&H${pad(alpha.toString(16).toUpperCase())}${rgb.slice(4, 6)}${rgb.slice(2, 4)}${rgb.slice(0, 2)}`.toUpperCase();
}

const escapeText = (s) => String(s).replace(/\\/g, '/').replace(/[{}]/g, '').replace(/\r?\n/g, '\\N');

export function buildAss({ project, width, height, total, watermark }) {
  const style = project.style ?? {};
  const lines = (project.lyrics ?? []).filter((l) => String(l.text ?? '').trim() && Number(l.end) > Number(l.start) && Number(l.start) < total);
  if (!lines.length && !watermark) return null;

  const font = FONTS.has(style.font) ? style.font : 'Inter';
  const mode = project.textMode ?? 'titles';
  const size = Math.round(Math.min(width, height) * (mode === 'slogan' ? 0.085 : mode === 'lyrics' ? 0.058 : 0.068));
  const align = mode === 'slogan' ? 5 : 2;
  const marginV = mode === 'slogan' ? 0 : Math.round(height * 0.1);
  const margin = Math.round(width * 0.06);
  const primary = assColor(style.text ?? '#FFFFFF');
  const outline = assColor('#000000', 0x60);
  const shadow = assColor(style.accent ?? '#FF6A1A', 0x20);

  const styles = [
    `Style: Text,${font},${size},${primary},${primary},${outline},${shadow},-1,0,0,0,100,100,0,0,1,${Math.max(2, Math.round(size / 18))},${Math.max(2, Math.round(size / 16))},${align},${margin},${margin},${marginV},1`,
    `Style: Mark,Inter,${Math.round(Math.min(width, height) * 0.032)},${assColor('#FFFFFF', 0x50)},${assColor('#FFFFFF', 0x50)},${assColor('#000000', 0xa0)},${assColor('#000000', 0xff)},-1,0,0,0,100,100,0,0,1,1,0,3,${Math.round(width * 0.035)},${Math.round(width * 0.035)},${Math.round(height * 0.03)},1`,
  ];
  const events = lines.map((l) => {
    const start = Number(l.start);
    const end = Math.min(Number(l.end), total);
    const fade = Math.round(Math.min(250, ((end - start) * 1000) / 4));
    const needsFallback = NO_CYRILLIC.has(font) && /[Ѐ-ӿ]/.test(l.text);
    return `Dialogue: 0,${assTime(start)},${assTime(end)},Text,,0,0,0,,{\\fad(${fade},${fade})${needsFallback ? '\\fnInter' : ''}}${escapeText(l.text)}`;
  });
  if (watermark) events.push(`Dialogue: 1,${assTime(0)},${assTime(total)},Mark,,0,0,0,,Factory Video`);

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
