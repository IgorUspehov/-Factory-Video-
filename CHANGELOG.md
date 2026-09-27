# Changelog

**DE** · [EN](#english) · [RU](#русский)

---

## Deutsch

### [Unreleased]

- —

### [0.4.0] — 2026-09-27

„Belebung“ der Bilder — nur mit freien Werkzeugen und offenen Modellen.

- **2.5D-Parallaxe:** Tiefenkarten im Browser mit Depth Anything V2 Small (`onnx-community/depth-anything-v2-small`, ONNX q8, 27,3 MB, Apache-2.0) über transformers.js 4.3 (WASM, lazy geladen, Browser-Cache); Otsu-Schwelle, PNG ≤ 1280 px, neuer Endpunkt `POST /api/upload/depth`, Feld `depth` am Medien-Element. Render: zwei Ebenen pro Foto einmal vorbereitet (Vordergrund mit weicher Maske, Hintergrund aus der Umgebung aufgefüllt), pro Bild nur Zuschnitt + Overlay mit unterschiedlicher Drift. Ohne Tiefenkarte → Ken Burns; Videos ohne Parallaxe. Verlorene Tiefenkarten (Redeploy) werden beim Öffnen des Editors erkannt und neu berechnet.
- **Effekte im Takt:** Voreinstellungen Keine / Sanft / Mittel / Energisch (Standard nach Stimmung), Zoom-Punch, Wackeln, Blitz, Farbpuls, RGB-Glitch auf den analysierten Beats, im MP4; gemeinsame Definition `server/src/shared/effects.js`.
- UI: Schalter „Tiefe (2.5D)“ oben im Visual-Block mit Erklärung, Fortschritt „Tiefe wird berechnet: 3 von 15“, Abzeichen auf Fotos mit Tiefe; Effekt-Auswahl neben der Videolänge (Schnitt, Ausgabe) und im Stil-Panel, Kurzanzeige im Stil-Block.
- Beat-Analyse läuft jetzt in einem Kindprozess (Serverprozess bleibt bei ≈ 58 MB statt ≈ 270 MB nach einer Analyse).
- Export-Seite: falscher Hinweis „Dateien liegen in Cloudflare R2“ ersetzt (Link gültig bis Datum, Dateien vorübergehend auf dem Server).
- Prüfung: Smoke-Test 165/165 (neu: Tiefenkarten-Upload, Render mit Tiefenkarten, alle Voreinstellungen, Fallbacks, 30 s / 3 min mit Parallaxe + „Energisch“: 18,7 s / 98,8 s, Spitze 279 / 286 MB); Headless Chrome mit echtem Modell 11/11; Bilder in `docs/screenshots/0.4.0/`.

### [0.3.0] — 2026-09-27

Editor-Überarbeitung nach dem ersten Test des Eigentümers in Produktion.

- Verständlichkeit: Leiste „Was als Nächstes?“ (3 Schritte mit Häkchen, großer Button „Video erstellen“, großer Fortschritt), größere Blöcke mit Beschreibung in einfacher Sprache, Tooltips und Erklärungen an Schaltflächen und Schaltern, optionale Einstellungen unter „Erweitert“ (Stil, Feineinstellung des Schnitts, „Marke“ in der Seitenleiste).
- Eigenschaften-Panel: 33 % Breite (380 px – 60 %), per Maus verstellbar, Breite gespeichert; Schrift 15 px, Schaltflächen ≥ 44 px; mobil Bottom-Sheet 85 %.
- Videolänge: neues Projektfeld `lengthMode` (`track` / 15 / 30 / 60 / `timeline`); Musikvideo standardmäßig = Tracklänge, Clips gleichmäßig verteilt und bei Bedarf wiederholt, Schnitte im Takt; Button „Auf den ganzen Track strecken“; Hinweis und „Auf 5:00 kürzen“ über 300 s. Gemeinsame Logik `server/src/shared/timeline.js` für Frontend und Backend (Dauer, Clip-Folge, `renderCost`).
- Bibliothek: Freitextsuche (Pexels mit `locale` der Oberfläche), Filter Fotos/Videos, Ausrichtung nach Projektformat, Seiten beim Scrollen, Urheber auf der Vorschau; Backend-Parameter `q`, `orientation`, `page`, `lang`; ein fehlgeschlagener Pexels-Teilaufruf führt nicht mehr zur statischen Liste.
- **Fehlerbehebung „es werden andere Fotos hinzugefügt“.** Ursache: Der Bibliotheks-Picker startete bei jeder Filteränderung eine neue Anfrage, ohne ältere zu verwerfen, und leerte das Raster zwischendurch. Eine spätere Antwort einer älteren Anfrage (z. B. die langsame ungefilterte Suche mit ~10 Pexels-Aufrufen, oder die statische Liste nach einem Pexels-Fehler) ersetzte das Raster, während der Nutzer schon wählte — Klicks landeten auf anderen Kacheln, und die Auswahl wurde nur als IDs gespeichert und beim Bestätigen im gerade sichtbaren Raster nachgeschlagen. Behebung: Suchgenerationen (veraltete Antworten werden verworfen), die Auswahl speichert die angeklickten Elemente selbst und zeigt sie als Leiste. Reproduziert und geprüft in Headless Chrome mit Pexels-Attrappe (verzögerte Antworten).
- Fehlerbehebung: Vor dem Rendern werden ausstehende Änderungen gespeichert (sonst renderte das Backend einen älteren Stand, wenn direkt nach einer Änderung gestartet wurde).
- Player: öffnet sich nach dem Rendern automatisch (Herunterladen, Link kopieren, Export-Seite, Schließen).
- Stil-Panel markiert Schriften, die im Video als Inter gerendert werden.
- Test-Werkzeuge: `server/scripts/fake-pexels.mjs`, `PEXELS_API_BASE`; Smoke-Test 99/99 (neu: Länge = Track, Kostengleichheit Frontend/Backend, `too_long`, Pexels-Suche/Seiten/Credit).

### [0.2.0] — 2026-09-26

Backend-MVP (Etappe 2) in `server/` und Anpassungen des Frontends.

- Dokumentation: `README.md`, `CHANGELOG.md`, `CLAUDE.md` (DE/EN/RU) — Commit `4982d90`.
- Backend (Node 22, ESM, Express 5): Auth (bcrypt, JWT), `/api/me`, Projekt-CRUD mit Nutzerbindung, Uploads (Audio mit Pflichtfeld `rightsConfirmed`, Foto/Video, Prüfung per ffprobe), `/api/audio/analyze` (music-tempo im Worker-Thread), Bibliothek (Pexels oder statische Liste), Render-Warteschlange (1 Job) mit FFmpeg-Pipeline (720p-Formate, 30 fps, H.264 + AAC, Ken Burns, xfade-Übergänge, Schnitte im Takt, Text und Wasserzeichen über libass, loudnorm, Fades), signierte Links (7 Tage), regelbasierter Assistent, Billing-Platzhalter (501) und echte Render-Historie, `/api/health`.
- Speicherschicht `server/src/storage` (lokale Platte, austauschbar gegen R2).
- Schriften Inter, Montserrat, Bebas Neue, Playfair Display (OFL, mit Lizenztexten) in `server/fonts`.
- Smoke-Test `server/scripts/smoke.mjs`: 80/80 bestanden.
- `render.yaml`: zweiter Dienst `factory-video-api`.
- Frontend-Korrektur (Vertrag): `api.uploadAudio(file, rightsConfirmed)` sendet jetzt das Feld `rightsConfirmed`; `AudioPanel` übergibt den Wert der Checkbox.
- Frontend-Korrektur: `RenderPlayer` legt das Wasserzeichen nur noch im Mock-Modus über das Video, weil das Backend es ins MP4 einbrennt.
- Prüfung: `npx tsc --noEmit` und `npm run build` ohne Fehler; Headless Chrome: Frontend gegen lokales Backend ohne Fehler.

### [0.1.0] — 2026-09-26 — Commit `adbf18f`

Erste Version des Frontends.

- Seiten: `/` Landing, `/login`, `/register`, `/start` (Assistent in 3 Schritten), `/editor/:projectId` (React-Flow-Editor mit Blöcken Audio, Visual, Text, Stil, Schnitt, Fertiges Video), `/projects`, `/library`, `/export/:projectId`, `/account`, 404.
- Stack: React 18.3.1, TypeScript 5.9.3, Vite 5.4.21, Tailwind CSS 3.4.19, React Router 6.30.6, Lucide React 1.48.0, @xyflow/react 12.12.0.
- API-Client `src/lib/api.ts` mit `VITE_API_URL` und Mock-Fallback (`src/lib/mock.ts`), Projekt-Cache in `localStorage`.
- i18n DE (Standard) / EN / RU, PWA (Manifest, Icons, Service Worker, Button „Zum Home-Bildschirm“).
- Prüfung: `npx tsc --noEmit` ohne Fehler, `npm run build` erfolgreich; Headless Chrome: 8 Routen × 3 Sprachen ohne JS-Fehler.
- `render.yaml` für Render Static Site (Build `npm ci && npm run build`, Publish `./dist`, Rewrite `/*` → `/index.html`, `VITE_API_URL`).

---

<a id="english"></a>

## English

### [Unreleased]

- —

### [0.4.0] — 2026-09-27

Bringing images to life — free tools and open models only.

- **2.5D parallax:** depth maps in the browser with Depth Anything V2 Small (`onnx-community/depth-anything-v2-small`, ONNX q8, 27.3 MB, Apache-2.0) via transformers.js 4.3 (WASM, lazy-loaded, browser cache); Otsu threshold, PNG ≤ 1280 px, new endpoint `POST /api/upload/depth`, `depth` field on the media item. Render: two layers prepared once per photo (foreground with a soft mask, background filled from its surroundings), per frame only crop + overlay with different drift. No depth map → Ken Burns; videos never get parallax. Lost depth maps (redeploy) are detected when the editor opens and recomputed.
- **Beat effects:** presets None / Soft / Medium / Energetic (default by mood), zoom punch, shake, flash, colour pulse, RGB glitch on the analysed beats, in the MP4; shared definition `server/src/shared/effects.js`.
- UI: "Depth (2.5D)" switch at the top of the Visual block with an explanation, progress "Preparing depth: 3 of 15", badge on photos with depth; effects picker next to the video length (Montage, Output) and in the Style panel, short label in the Style block.
- Beat analysis now runs in a child process (the server process stays at ≈ 58 MB instead of ≈ 270 MB after an analysis).
- Export page: false note "files are stored in Cloudflare R2" replaced (link valid until date, files stored temporarily on the server).
- Verification: smoke test 165/165 (new: depth map upload, render with depth maps, all presets, fallbacks, 30 s / 3 min with parallax + "Energetic": 18.7 s / 98.8 s, peak 279 / 286 MB); headless Chrome with the real model 11/11; frames in `docs/screenshots/0.4.0/`.

### [0.3.0] — 2026-09-27

Editor rework after the owner's first test in production.

- Clarity: "What to do next" bar (3 steps with check marks, large "Build video" button, large progress), larger blocks with a plain-language description, tooltips and explanations on buttons and switches, optional settings under "Advanced" (style, montage fine-tuning, "Brand" in the sidebar).
- Properties panel: 33 % width (380 px – 60 %), resizable with the mouse, width stored; 15 px text, buttons ≥ 44 px; mobile bottom sheet at 85 %.
- Video length: new project field `lengthMode` (`track` / 15 / 30 / 60 / `timeline`); music videos default to the track length, clips spread evenly and repeated if needed, cuts on the beat; "Stretch to the whole track" button; notice and "Cut to 5:00" above 300 s. Shared logic `server/src/shared/timeline.js` for frontend and backend (duration, clip sequence, `renderCost`).
- Library: free-text search (Pexels with the UI `locale`), photos/videos filter, orientation by project format, pages on scroll, author on the preview; backend parameters `q`, `orientation`, `page`, `lang`; one failed Pexels sub-request no longer falls back to the static list.
- **Fix "different photos get added".** Cause: the library picker started a new request on every filter change without discarding older ones and emptied the grid in between. A late response of an older request (e.g. the slow unfiltered search with ~10 Pexels calls, or the static list after a Pexels error) replaced the grid while the user was already picking — clicks landed on other tiles, and the selection was stored only as ids and looked up in whatever grid was visible at confirm time. Fix: search generations (stale responses are dropped), the selection stores the clicked items themselves and shows them in a strip. Reproduced and verified in headless Chrome with a Pexels stand-in (delayed responses).
- Fix: pending edits are saved before rendering (otherwise the backend rendered an older state when a render was started right after a change).
- Player: opens automatically after rendering (download, copy link, export page, close).
- Style panel marks fonts that are rendered as Inter in the video.
- Test tooling: `server/scripts/fake-pexels.mjs`, `PEXELS_API_BASE`; smoke test 99/99 (new: length = track, identical cost frontend/backend, `too_long`, Pexels search/paging/credit).

### [0.2.0] — 2026-09-26

Backend MVP (stage 2) in `server/` and frontend adjustments.

- Documentation: `README.md`, `CHANGELOG.md`, `CLAUDE.md` (DE/EN/RU) — commit `4982d90`.
- Backend (Node 22, ESM, Express 5): auth (bcrypt, JWT), `/api/me`, project CRUD bound to the user, uploads (audio with required `rightsConfirmed` field, photo/video, validated with ffprobe), `/api/audio/analyze` (music-tempo in a worker thread), library (Pexels or static list), render queue (1 job) with an FFmpeg pipeline (720p formats, 30 fps, H.264 + AAC, Ken Burns, xfade transitions, beat-synced cuts, text and watermark via libass, loudnorm, fades), signed links (7 days), rule-based assistant, billing stubs (501) and real render history, `/api/health`.
- Storage layer `server/src/storage` (local disk, replaceable by R2).
- Fonts Inter, Montserrat, Bebas Neue, Playfair Display (OFL, with licence texts) in `server/fonts`.
- Smoke test `server/scripts/smoke.mjs`: 80/80 passed.
- `render.yaml`: second service `factory-video-api`.
- Frontend fix (contract): `api.uploadAudio(file, rightsConfirmed)` now sends the `rightsConfirmed` field; `AudioPanel` passes the checkbox value.
- Frontend fix: `RenderPlayer` overlays the watermark only in mock mode, because the backend burns it into the MP4.
- Verification: `npx tsc --noEmit` and `npm run build` without errors; headless Chrome: frontend against the local backend without errors.

### [0.1.0] — 2026-09-26 — commit `adbf18f`

First version of the frontend.

- Pages: `/` landing, `/login`, `/register`, `/start` (3-step wizard), `/editor/:projectId` (React Flow editor with Audio, Visual, Text, Style, Montage, Final video blocks), `/projects`, `/library`, `/export/:projectId`, `/account`, 404.
- Stack: React 18.3.1, TypeScript 5.9.3, Vite 5.4.21, Tailwind CSS 3.4.19, React Router 6.30.6, Lucide React 1.48.0, @xyflow/react 12.12.0.
- API client `src/lib/api.ts` with `VITE_API_URL` and mock fallback (`src/lib/mock.ts`), project cache in `localStorage`.
- i18n DE (default) / EN / RU, PWA (manifest, icons, service worker, "Add to home screen" button).
- Verification: `npx tsc --noEmit` without errors, `npm run build` succeeded; headless Chrome: 8 routes × 3 languages without JS errors.
- `render.yaml` for Render Static Site (build `npm ci && npm run build`, publish `./dist`, rewrite `/*` → `/index.html`, `VITE_API_URL`).

---

<a id="русский"></a>

## Русский

### [Unreleased]

- —

### [0.4.0] — 2026-09-27

«Оживление» картинок — только бесплатными инструментами и открытыми моделями.

- **2.5D-параллакс:** карты глубины в браузере моделью Depth Anything V2 Small (`onnx-community/depth-anything-v2-small`, ONNX q8, 27,3 МБ, Apache-2.0) через transformers.js 4.3 (WASM, ленивая загрузка, кэш браузера); порог Оцу, PNG ≤ 1280 px, новый эндпоинт `POST /api/upload/depth`, поле `depth` у медиа-элемента. Рендер: два слоя готовятся один раз на фото (передний план с мягкой маской, фон, заполненный из окружения), на каждом кадре — только обрезка и наложение с разным дрейфом. Нет карты глубины → Ken Burns; видео без параллакса. Потерянные карты глубины (редеплой) обнаруживаются при открытии редактора и пересчитываются.
- **Эффекты под бит:** пресеты Нет / Мягко / Средне / Энергично (по умолчанию по настроению), удар приближения, тряска, вспышка, цветовая пульсация, RGB-глитч на битах из анализа, вшиты в MP4; общее определение `server/src/shared/effects.js`.
- Интерфейс: переключатель «Объём (2.5D)» наверху блока «Визуал» с пояснением, прогресс «Готовим объём: 3 из 15», значок на фото с глубиной; выбор эффектов рядом с длиной ролика («Монтаж», «Готовый ролик») и в панели «Стиль», кратко в сводке блока «Стиль».
- Анализ битов теперь в дочернем процессе (процесс сервера остаётся ≈ 58 МБ вместо ≈ 270 МБ после анализа).
- Страница экспорта: ложный текст «Файлы хранятся в Cloudflare R2» заменён (ссылка действует до даты, файлы временно хранятся на сервере).
- Проверка: smoke-тест 165/165 (новое: загрузка карты глубины, рендер с картами глубины, все пресеты, фолбэки, 30 с / 3 мин с параллаксом + «Энергично»: 18,7 с / 98,8 с, пик 279 / 286 МБ); headless Chrome с настоящей моделью 11/11; кадры в `docs/screenshots/0.4.0/`.

### [0.3.0] — 2026-09-27

Переработка редактора по итогам первого теста владельца на проде.

- Понятность: полоса «Что делать дальше» (3 шага с галочками, большая кнопка «Собрать ролик», крупный прогресс), блоки крупнее с описанием простым языком, подсказки и пояснения у кнопок и переключателей, необязательные настройки в разделе «Дополнительно» («Стиль», тонкая настройка «Монтажа», «Бренд» в боковом меню).
- Панель свойств: ширина 33 % (380 px – 60 %), тянется мышью, ширина сохраняется; шрифт 15 px, кнопки ≥ 44 px; на мобильном — шторка на 85 %.
- Длина ролика: новое поле проекта `lengthMode` (`track` / 15 / 30 / 60 / `timeline`); для клипа по умолчанию = длина трека, кадры распределяются равномерно и при необходимости повторяются, склейки под бит; кнопка «Растянуть на весь трек»; предупреждение и «Обрезать до 5:00» при длине больше 300 с. Общая логика `server/src/shared/timeline.js` для фронтенда и бэкенда (длительность, последовательность кадров, `renderCost`).
- Медиатека: поиск по своим словам (Pexels с `locale` языка интерфейса), фильтр «Фото / Видео», ориентация по формату проекта, подгрузка страниц при прокрутке, автор на превью; параметры бэкенда `q`, `orientation`, `page`, `lang`; сбой одного из запросов к Pexels больше не переключает на статический список.
- **Исправлена ошибка «добавляются не те фото».** Причина: медиатека при каждом изменении фильтра запускала новый запрос, не отбрасывая старые, и между ними очищала сетку. Поздний ответ более старого запроса (например, медленный поиск без фильтров из ~10 запросов к Pexels или статический список после ошибки Pexels) заменял сетку, когда пользователь уже выбирал, — клики попадали на другие плитки, а выбор хранился только как id и при подтверждении искался в той сетке, что видна в этот момент. Исправление: поколения запросов (устаревшие ответы отбрасываются), выбор хранит сами нажатые элементы и показывает их полосой. Воспроизведено и проверено в headless Chrome с имитацией Pexels (задержанные ответы).
- Исправлено: перед рендером сохраняются отложенные изменения (иначе бэкенд рендерил старое состояние, если рендер запускали сразу после правки).
- Плеер: открывается автоматически после рендера (скачать, скопировать ссылку, страница экспорта, закрыть).
- Панель «Стиль» отмечает шрифты, которые в ролике заменяются на Inter.
- Инструменты тестов: `server/scripts/fake-pexels.mjs`, `PEXELS_API_BASE`; smoke-тест 99/99 (новое: длина = трек, одинаковая стоимость фронтенд/бэкенд, `too_long`, поиск/страницы/автор Pexels).

### [0.2.0] — 2026-09-26

Бэкенд MVP (этап 2) в `server/` и правки фронтенда.

- Документация: `README.md`, `CHANGELOG.md`, `CLAUDE.md` (DE/EN/RU) — коммит `4982d90`.
- Бэкенд (Node 22, ESM, Express 5): авторизация (bcrypt, JWT), `/api/me`, CRUD проектов с привязкой к пользователю, загрузки (аудио с обязательным полем `rightsConfirmed`, фото/видео, проверка ffprobe), `/api/audio/analyze` (music-tempo в worker-потоке), библиотека (Pexels или статический список), очередь рендера (1 задача) с конвейером FFmpeg (форматы 720p, 30 fps, H.264 + AAC, Ken Burns, переходы xfade, склейки под бит, текст и водяной знак через libass, loudnorm, fade), подписанные ссылки (7 дней), помощник на правилах, заглушки оплаты (501) и реальная история рендеров, `/api/health`.
- Слой хранения `server/src/storage` (локальный диск, заменяется на R2).
- Шрифты Inter, Montserrat, Bebas Neue, Playfair Display (OFL, с текстами лицензий) в `server/fonts`.
- Smoke-тест `server/scripts/smoke.mjs`: 80/80 пройдено.
- `render.yaml`: второй сервис `factory-video-api`.
- Исправление фронтенда (контракт): `api.uploadAudio(file, rightsConfirmed)` теперь отправляет поле `rightsConfirmed`; `AudioPanel` передаёт значение чекбокса.
- Исправление фронтенда: `RenderPlayer` накладывает водяной знак только в режиме моков, потому что бэкенд вшивает его в MP4.
- Проверка: `npx tsc --noEmit` и `npm run build` без ошибок; headless Chrome: фронтенд против локального бэкенда без ошибок.

### [0.1.0] — 2026-09-26 — коммит `adbf18f`

Первая версия фронтенда.

- Страницы: `/` лендинг, `/login`, `/register`, `/start` (опросник из 3 шагов), `/editor/:projectId` (редактор на React Flow с блоками Аудио, Визуал, Текст, Стиль, Монтаж, Готовый ролик), `/projects`, `/library`, `/export/:projectId`, `/account`, 404.
- Стек: React 18.3.1, TypeScript 5.9.3, Vite 5.4.21, Tailwind CSS 3.4.19, React Router 6.30.6, Lucide React 1.48.0, @xyflow/react 12.12.0.
- API-клиент `src/lib/api.ts` с `VITE_API_URL` и фолбэком на моки (`src/lib/mock.ts`), кэш проектов в `localStorage`.
- i18n DE (по умолчанию) / EN / RU, PWA (манифест, иконки, service worker, кнопка «На главный экран»).
- Проверка: `npx tsc --noEmit` без ошибок, `npm run build` успешно; headless Chrome: 8 маршрутов × 3 языка без JS-ошибок.
- `render.yaml` для Render Static Site (сборка `npm ci && npm run build`, публикация `./dist`, Rewrite `/*` → `/index.html`, `VITE_API_URL`).
