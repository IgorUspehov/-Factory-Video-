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

const CLAUSE_END = /[.,!?;:…—–]["»”)]*$/;
const SENTENCE_END = /[.!?…]["»”)]*$/;

/**
 * Subtitle lines of 2–4 words (a lone word only when nothing else can be joined to it).
 * Breaks prefer punctuation; one-word clauses join a neighbour; a long clause is cut into lines of equal length.
 */
export function splitPhrases(text, maxWords = 4) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const clauses = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    if (CLAUSE_END.test(w)) {
      clauses.push(cur);
      cur = [];
    }
  }
  if (cur.length) clauses.push(cur);

  // one-word clauses ("Привет!") ride along with a neighbour when the line stays within maxWords
  const merged = [];
  for (const c of clauses) {
    const prev = merged[merged.length - 1];
    if (prev && (c.length === 1 || prev.length === 1) && prev.length + c.length <= maxWords) prev.push(...c);
    else merged.push([...c]);
  }

  const lines = [];
  for (const c of merged) {
    const k = Math.ceil(c.length / maxWords);
    const base = Math.floor(c.length / k);
    const extra = c.length % k;
    let at = 0;
    for (let i = 0; i < k; i++) {
      const size = base + (i < extra ? 1 : 0);
      lines.push(c.slice(at, at + size));
      at += size;
    }
  }
  // a lone word after a longer line: borrow that line's last word (2 + 2 beats 3 + 1)
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].length === 1 && lines[i - 1].length >= 3) lines[i].unshift(lines[i - 1].pop());
  }
  return lines.map((l) => l.join(' '));
}

/** Rough share of speaking time a subtitle line takes: its letters plus the pause that usually follows it. */
export function phraseWeight(line) {
  const letters = line.replace(/[^\p{L}\p{N}]/gu, '').length;
  return Math.max(1, letters) + (SENTENCE_END.test(line) ? 5 : CLAUSE_END.test(line) ? 2.5 : 0);
}
