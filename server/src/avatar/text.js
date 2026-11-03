/** Chatterbox accepts at most 300 characters per request; stay below it. */
export const TTS_MAX_CHARS = 280;

const SENTENCE = /[^.!?…。]+(?:[.!?…。]+["»”)]*|$)/g;

/** Splits a text into sentences (keeps the punctuation). */
export function sentences(text) {
  return (String(text).replace(/\s+/g, ' ').trim().match(SENTENCE) ?? []).map((s) => s.trim()).filter(Boolean);
}

/** Hard split of one over-long sentence at commas/semicolons, then at spaces. */
function splitLong(sentence, max) {
  const out = [];
  let rest = sentence;
  while (rest.length > max) {
    let cut = Math.max(rest.lastIndexOf(',', max), rest.lastIndexOf(';', max), rest.lastIndexOf(':', max));
    if (cut < max * 0.4) cut = rest.lastIndexOf(' ', max);
    if (cut < 1) cut = max;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** Packs whole sentences into chunks of at most `max` characters (one TTS request each). */
export function splitForTts(text, max = TTS_MAX_CHARS) {
  const chunks = [];
  let cur = '';
  for (const s of sentences(text).flatMap((x) => (x.length > max ? splitLong(x, max) : [x]))) {
    if (cur && cur.length + 1 + s.length > max) {
      chunks.push(cur);
      cur = s;
    } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** Splits a chunk into subtitle phrases of at most `max` characters, preferring punctuation, then spaces. */
export function splitPhrases(text, max = 38) {
  const out = [];
  for (const s of sentences(text)) {
    let rest = s;
    while (rest.length > max) {
      let cut = Math.max(rest.lastIndexOf(',', max), rest.lastIndexOf(';', max), rest.lastIndexOf(':', max), rest.lastIndexOf('—', max));
      if (cut < max * 0.45) cut = rest.lastIndexOf(' ', max);
      if (cut < 1) cut = max;
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}
