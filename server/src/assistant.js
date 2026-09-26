/** Rule-based assistant (no LLM provider chosen yet): tips by goal, mood and project state. */

const T = {
  de: {
    goal: {
      clip: 'Für ein Musikvideo: Audio → Visual → Text → Stil → Schnitt. Aktiviere „Schnitt im Takt“ und nutze ein Bild pro 2–4 Beats; die Refrain-Zeilen kommen in den Text-Block.',
      promo: 'Für eine Promo: Starte mit deinem stärksten Foto, dann das Angebot, zum Schluss ein Call-to-Action. Slogan-Vorschlag: „Mit Liebe gemacht. Bereit für dich.“',
      reels: 'Für Reels: Die ersten 2 Sekunden entscheiden — starte mit einem starken Titel, halte Clips bei 1–2 Sekunden und nutze Zoom-Übergänge.',
    },
    mood: {
      calm: 'Stimmung ruhig: Blende als Übergang, Ken Burns an, Clips eher 4–6 Sekunden.',
      energetic: 'Stimmung energetisch: harte Schnitte oder Zoom, Clips 1–2 Sekunden, Schnitt im Takt an.',
      premium: 'Stimmung Premium: wenige, starke Bilder, Blende, eine elegante Serifenschrift.',
      corporate: 'Stimmung Corporate: klare Schrift, Slide-Übergänge, maximal eine Aussage pro Titel.',
    },
    next: {
      audio: 'Nächster Schritt: Füge im Audio-Block einen Track hinzu — das Timing des Videos baut darauf auf.',
      visuals: 'Nächster Schritt: Füge im Visual-Block mindestens 3 Fotos oder Videos hinzu.',
      text: 'Nächster Schritt: Füge im Text-Block ein paar Zeilen hinzu — Titel machen das Video verständlicher.',
      ready: 'Alles ist bereit. Prüfe die Timeline im Schnitt-Block und starte den Render.',
    },
  },
  en: {
    goal: {
      clip: 'For a music video: Audio → Visual → Text → Style → Montage. Enable “Cut on the beat” and use one image per 2–4 beats; put the chorus lines into the Text block.',
      promo: 'For a promo: start with your strongest photo, then the offer, end with a call to action. Slogan suggestion: “Made with care. Ready for you.”',
      reels: 'For Reels: the first 2 seconds decide everything — start with a bold title, keep clips at 1–2 seconds and use Zoom transitions.',
    },
    mood: {
      calm: 'Calm mood: fade transitions, Ken Burns on, clips of about 4–6 seconds.',
      energetic: 'Energetic mood: hard cuts or zoom, clips of 1–2 seconds, cut on the beat on.',
      premium: 'Premium mood: few strong images, fades, one elegant serif font.',
      corporate: 'Corporate mood: clear font, slide transitions, one message per title at most.',
    },
    next: {
      audio: 'Next step: add a track in the Audio block — the timing of the video is built on it.',
      visuals: 'Next step: add at least 3 photos or videos in the Visual block.',
      text: 'Next step: add a few lines in the Text block — titles make the video easier to follow.',
      ready: 'Everything is in place. Check the timeline in the Montage block and start the render.',
    },
  },
  ru: {
    goal: {
      clip: 'Для клипа: Аудио → Визуал → Текст → Стиль → Монтаж. Включите «Склейку под бит» и ставьте один кадр на 2–4 доли; строки припева — в блок «Текст».',
      promo: 'Для промо: начните с самого сильного фото, затем предложение, в конце — призыв к действию. Вариант слогана: «Сделано с душой. Готово для вас.»',
      reels: 'Для Reels: всё решают первые 2 секунды — начните с яркого титра, держите клипы по 1–2 секунды и используйте переходы «Зум».',
    },
    mood: {
      calm: 'Спокойное настроение: переход «Затухание», Ken Burns включён, клипы по 4–6 секунд.',
      energetic: 'Энергичное настроение: резкие склейки или зум, клипы по 1–2 секунды, склейка под бит включена.',
      premium: 'Премиум: немного сильных кадров, затухания, один элегантный шрифт с засечками.',
      corporate: 'Корпоративное: чёткий шрифт, переходы «Сдвиг», не больше одной мысли в титре.',
    },
    next: {
      audio: 'Следующий шаг: добавьте трек в блоке «Аудио» — на нём строится тайминг ролика.',
      visuals: 'Следующий шаг: добавьте минимум 3 фото или видео в блоке «Визуал».',
      text: 'Следующий шаг: добавьте пару строк в блоке «Текст» — с титрами ролик понятнее.',
      ready: 'Всё на месте. Проверьте таймлайн в блоке «Монтаж» и запускайте рендер.',
    },
  },
};

/** `project` (from the DB) wins over the client-sent `context` when both exist. */
export function suggest({ lang, project, context = {} }) {
  const t = T[lang] ?? T.de;
  const goal = project?.goal ?? context.goal;
  const mood = project?.mood ?? context.mood;
  const hasAudio = project ? !!project.audio && project.audio.source !== 'none' : !!context.hasAudio;
  const mediaCount = project ? project.media?.length ?? 0 : Number(context.mediaCount) || 0;
  const lyricsCount = project ? project.lyrics?.length ?? 0 : Number(context.lyricsCount) || 0;

  const parts = [t.goal[goal] ?? t.goal.clip];
  if (t.mood[mood]) parts.push(t.mood[mood]);
  parts.push(!hasAudio ? t.next.audio : mediaCount < 3 ? t.next.visuals : lyricsCount === 0 ? t.next.text : t.next.ready);
  return parts.join('\n\n');
}
