# Changelog

**DE** · [EN](#english) · [RU](#русский)

---

## Deutsch

### [Unreleased]

- —

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
