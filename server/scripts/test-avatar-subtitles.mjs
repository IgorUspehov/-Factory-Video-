#!/usr/bin/env node
// Subtitle splitting/style and speech detection of own recordings (no network, no cost).  node scripts/test-avatar-subtitles.mjs
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { measureLoudness, speechSpan, trimToSpeech } from '../src/avatar/audio.js';
import { buildAvatarAss, subtitleLines } from '../src/avatar/subtitles.js';
import { splitPhrases } from '../src/avatar/text.js';
import { FFMPEG, probe } from '../src/media.js';

const sh = promisify(execFile);
let failed = 0;
const check = (n, ok, x = '') => (ok || failed++, console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`));
const words = (l) => l.split(' ').length;

// ---- 2-4 words per line
const samples = [
  'Привет! Меня зовут Игорь. Я делаю сайты и системы учёта клиентов для местного бизнеса в Мюнхене.',
  'Hi, I am Ihor, and I build websites and customer systems for local businesses in Munich. Write me on Telegram.',
  'Hallo! Ich heiße Ihor. Ich entwickle Websites und Kundenverwaltungssysteme für lokale Unternehmen in München.',
  'Один два три четыре пять шесть семь восемь девять десять одиннадцать.',
  'Всё работает просто. Вы выбираете свою отрасль, мы собираем сайт и кабинет для заявок на немецком, английском и русском языках.',
];
for (const [i, t] of samples.entries()) {
  const lines = splitPhrases(t);
  check(`sample ${i + 1}: every line has 2–4 words`, lines.every((l) => words(l) >= 2 && words(l) <= 4), lines.map(words).join(','));
  check(`sample ${i + 1}: no words lost or reordered`, lines.join(' ') === t.replace(/\s+/g, ' ').trim());
}
check('one-word sentence stays as it is', JSON.stringify(splitPhrases('Да.')) === '["Да."]');
check('a short interjection joins the next clause', splitPhrases('Привет! Меня зовут Игорь.')[0] === 'Привет! Меня зовут Игорь.');
check('long clause is cut evenly (9 words -> 3+3+3)', splitPhrases('раз два три четыре пять шесть семь восемь девять').map(words).join() === '3,3,3');
check('5 words -> 3+2, never 4+1', splitPhrases('раз два три четыре пять').map(words).join() === '3,2');
check('breaks prefer punctuation', splitPhrases('Первая часть, вторая часть').join('|') === 'Первая часть,|вторая часть');
check('empty text -> no lines', splitPhrases('   ').length === 0);

// ---- no line ends on a short function word (в, с, к, и, а, но, на …) — it moves to the next line
const WEAK = new Set(['в', 'во', 'с', 'со', 'к', 'ко', 'о', 'об', 'у', 'за', 'из', 'от', 'до', 'по', 'на', 'при', 'про', 'для', 'без', 'и', 'а', 'но', 'да', 'или', 'что', 'как', 'если', 'то', 'не', 'a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'and', 'or', 'but', 'und', 'oder', 'aber', 'in', 'mit', 'zu', 'von', 'für', 'auf', 'der', 'die', 'das']);
const lastWord = (l) => l.split(' ').at(-1);
const endsWeak = (l) => WEAK.has(lastWord(l).toLowerCase());
const weakTexts = [
  'Привет! Меня зовут Игорь. Я делаю сайты и системы учёта клиентов для местного бизнеса в Мюнхене.',
  'Если у вас кафе, мастерская или небольшая клиника, то сайт с онлайн-записью помогает получать новых клиентов каждый день, даже когда вы заняты.',
  'Я иду в магазин, а потом к другу на дачу и по дороге купил хлеб с маслом для всех.',
  'Мы делаем сайт для кафе и для клиники, но не для всех и не на любой срок работы.',
  'Hi, I am Ihor, and I build websites for local businesses in the center of Munich and in the area.',
  'Ich entwickle Websites und Kundenverwaltungssysteme für lokale Unternehmen in München und der Umgebung mit Herz.',
];
for (const [i, t] of weakTexts.entries()) {
  const ls = splitPhrases(t);
  const bad = ls.slice(0, -1).filter(endsWeak);
  check(`text ${i + 1}: no line (except the last) ends on a short word`, bad.length === 0, bad.length ? JSON.stringify(bad) : '');
  check(`text ${i + 1}: still 2–4 words per line, nothing lost`, ls.every((l) => words(l) >= 2 && words(l) <= 4) && ls.join(' ') === t.replace(/\s+/g, ' ').trim(), ls.map(words).join(','));
}
// "и не на любой срок." cannot be split into lines of 2–4 words that avoid ending on a short word: the short-word rule wins
const tail = splitPhrases('Мы делаем сайт для кафе и для клиники, но не для всех и не на любой срок.');
check('unsolvable tail: the short-word rule wins over the 2-word minimum, nothing is lost', tail.slice(0, -1).every((l) => !endsWeak(l)) && tail.every((l) => words(l) <= 4) && tail.join(' ') === 'Мы делаем сайт для кафе и для клиники, но не для всех и не на любой срок.', JSON.stringify(tail.slice(-2)));
check('the short word starts the next line', JSON.stringify(splitPhrases('Я делаю сайты и системы учёта клиентов для местного бизнеса.')) === JSON.stringify(['Я делаю сайты', 'и системы учёта клиентов', 'для местного бизнеса.']));
check('a word with punctuation after it is a real clause end and stays', splitPhrases('Привет, и, конечно, да.').every((l) => l.length > 0) && splitPhrases('Он ушёл, а я остался дома.')[0] === 'Он ушёл,');
check('a two-word line ending on a short word moves as a whole (no 1-word leftover)', !splitPhrases('Он идёт к другу домой пешком быстро').some((l) => words(l) === 1));
check('the final line may end on a short word (nothing to move it to)', splitPhrases('Это был наш дом и').at(-1).endsWith('и'));
check('a short word is only moved, never dropped or duplicated', (() => { const t = 'Я в и на за с'; return splitPhrases(t).join(' ') === t; })());

// ---- timing
const chunks = [{ text: 'Привет! Меня зовут Игорь. Я делаю сайты.', duration: 6, start: 1 }];
const lines = subtitleLines(chunks);
check('lines fill the chunk exactly, from its start', Math.abs(lines[0].start - 1) < 1e-9 && Math.abs(lines.at(-1).end - 7) < 1e-9);
check('lines follow each other without gaps or overlaps', lines.every((l, i) => i === 0 || Math.abs(l.start - lines[i - 1].end) < 1e-9));
const two = subtitleLines([{ text: 'Раз два три.', duration: 2 }, { text: 'Четыре пять шесть.', duration: 3 }]);
check('chunks without start run one after another', Math.abs(two[1].start - 2) < 1e-9 && Math.abs(two[1].end - 5) < 1e-9);
const long = subtitleLines([{ text: 'Это длинная фраза про сайты. Да.', duration: 10 }]);
check('a sentence pause gives the line before it more time', long[0].end - long[0].start > 4);

// ---- style: big and bold
const ass = buildAvatarAss({ lines, total: 8 });
const sub = /Style: Sub,Inter,(\d+),[^,]*,[^,]*,[^,]*,[^,]*,(-?\d+)/.exec(ass);
check('subtitle font is large (≥ 8.5 % of the width) and bold', Number(sub[1]) >= 0.085 * 1080 && sub[2] === '-1', `size ${sub[1]} px`);
check('the plate stays', ass.includes('Telegram @Ihor_Kriazhev') && ass.includes('Style: Plate'));
check('Inter Bold is shipped for libass', (await import('node:fs')).existsSync(new URL('../fonts/inter-700.ttf', import.meta.url)));

// ---- speech detection / trimming
const dir = await mkdtemp(path.join(os.tmpdir(), 'span-'));
try {
  const f = path.join(dir, 'rec.wav');
  // 1.5 s silence, 3 s tone, 0.8 s pause, 2 s tone, 2 s silence
  await sh(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-f', 'lavfi', '-i', 'sine=frequency=300:sample_rate=44100:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=300:sample_rate=44100:duration=2',
    '-filter_complex', '[0:a]atrim=duration=1.5[s1];[0:a]atrim=duration=0.8[s2];[0:a]atrim=duration=2[s3];[s1][1:a][s2][2:a][s3]concat=n=5:v=0:a=1[a]', '-map', '[a]', f]);
  const span = await speechSpan(f);
  check('speech starts after the leading silence', Math.abs(span.start - 1.5) < 0.15, `${span.start.toFixed(2)} s`);
  check('speech ends before the trailing silence (pause inside is kept)', Math.abs(span.end - 7.3) < 0.15, `${span.end.toFixed(2)} s`);
  const t = await trimToSpeech(f, path.join(dir, 'trim.wav'));
  const info = await probe(t.file);
  check('trimmed file: mono, shorter, speech inside with a little room', info.duration < 8 && Math.abs(info.duration - (5.8 + 0.5)) < 0.3 && Math.abs(t.lead - 0.2) < 0.01 && Math.abs(t.speech - 5.8) < 0.2, `${info.duration.toFixed(2)} s, lead ${t.lead.toFixed(2)}, speech ${t.speech.toFixed(2)}`);
  // ---- loudness: every recording ends up at -14 LUFS, quiet ones are raised, loud ones lowered
  // speech-like test signal: noise in the voice band (≤ 4 kHz), modulated like syllables (4 Hz), with silence around it
  const noise = async (name, amp) => {
    const f = path.join(dir, name);
    const voice = (d) => `anoisesrc=color=pink:amplitude=${amp}:sample_rate=44100:duration=${d},lowpass=f=4000,tremolo=f=4:d=0.7`;
    await sh(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-f', 'lavfi', '-i', voice(3), '-f', 'lavfi', '-i', voice(2),
      '-filter_complex', '[0:a]atrim=duration=1,asplit=3[s1][s2][s3];[s1][1:a][s2][2:a][s3]concat=n=5:v=0:a=1[a]', '-map', '[a]', f]);
    return f;
  };
  for (const [label, amp, expectBefore] of [['quiet (like the owner\'s -25 LUFS)', 0.3, (i) => i < -22 && i > -34], ['very quiet', 0.03, (i) => i < -40], ['loud', 0.9, (i) => i > -22]]) {
    const f = await noise(`n-${amp}.wav`, amp);
    const before = (await measureLoudness(f)).I;
    const t3 = await trimToSpeech(f, path.join(dir, `n-${amp}-out.wav`));
    const after = await measureLoudness(t3.file);
    check(`loudness, ${label}: input measured as expected`, expectBefore(before) && Math.abs(t3.lufsBefore - before) < 1.5, `${before.toFixed(1)} LUFS`);
    check(`loudness, ${label}: output is -14 LUFS (±0.7)`, Math.abs(after.I + 14) <= 0.7 && Math.abs(t3.lufsAfter - after.I) < 0.3, `${after.I.toFixed(2)} LUFS`);
    check(`loudness, ${label}: true peak stays below -0.9 dBTP`, after.TP <= -0.9, `${after.TP.toFixed(2)} dBTP`);
  }
  const outInfo = await probe(path.join(dir, 'n-0.3-out.wav'));
  check('normalised file is still mono 16-bit WAV at 32 kHz', outInfo.audio?.codec === 'pcm_s16le', JSON.stringify(outInfo.audio));
  const noTrim = path.join(dir, 'tight.wav');
  await sh(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=4', noTrim]);
  const t2 = await trimToSpeech(noTrim, path.join(dir, 'tight2.wav'));
  check('a recording without silence keeps its length', Math.abs(t2.duration - 4) < 0.1 && t2.lead < 0.01, `${t2.duration.toFixed(2)} s`);
  const silent = path.join(dir, 'silent.wav');
  await sh(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '5', silent]);
  check('a silent recording is rejected', await speechSpan(silent).then(() => false, (e) => e.message === 'recording_silent'));
} catch (e) {
  failed++;
  console.log('FAIL  exception:', e.stack?.split('\n').slice(0, 3).join(' | '));
} finally {
  await rm(dir, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
