# Factory Video

**DE** · [EN](#english) · [RU](#русский)

Stand der Dokumentation / Documentation as of / Документация актуальна на: **2026-09-26**, Commit `adbf18f` + docs.

---

## Deutsch

### Zweck

Factory Video ist eine Engine zum Bauen von Videos aus Blöcken: **Audio → Visual → Text → Stil → Schnitt → Fertiges Video**. Ziele: Musikvideo zum Track (Suno u. a.), Business-Promo, Reels/Shorts. Formate: 9:16, 16:9, 1:1.
Das LLM ist nur Orchestrator (Blockreihenfolge, Texte). Inhalte kommen aus Bibliotheken und Uploads der Nutzer.
Dieses Repository enthält **nur das Frontend**.

- Repository: https://github.com/IgorUspehov/-Factory-Video- (Branch `main`)
- Produktion: https://factory-video.onrender.com

### Voraussetzungen

- Node.js + npm. Eine Mindestversion ist nicht festgelegt (kein `engines`-Feld in `package.json`): **UNKNOWN**. Lokal gebaut und geprüft mit Node 22.23.2 / npm 10.9.8.
- Node-Version auf Render: **UNKNOWN**.

### Stack (Versionen aus `package.json`)

| Paket | Version |
|---|---|
| react / react-dom | ^18.3.1 |
| react-router-dom | ^6.30.6 |
| @xyflow/react (Node-Editor) | ^12.12.0 |
| lucide-react (Icons) | ^1.48.0 |
| vite | ^5.4.21 |
| @vitejs/plugin-react | ^4.7.0 |
| typescript | ^5.9.3 |
| tailwindcss | ^3.4.19 |
| postcss / autoprefixer | ^8.5.28 / ^10.6.1 |
| @types/react / @types/react-dom / @types/node | ^18.3.31 / ^18.3.7 / ^26.6.3 |

Schriften: Montserrat, Inter, Caveat über `<link>` in `index.html`. Die 12 Stil-Schriften des Editors werden erst im Stil-Panel per `<link>` nachgeladen.

### Architektur

**Struktur `src/`**

```
src/
  main.tsx            Einstieg: Router, I18nProvider, PwaProvider, AuthProvider, SW-Registrierung
  App.tsx             Routen (lazy geladen), Header, Footer (nicht im Editor)
  types.ts            Project, User, AudioTrack, MediaItem, RenderState …
  index.css           Tailwind + Komponentenklassen + React-Flow-Dark-Theme
  config/pricing.ts   Preise (Platzhalter), renderCost()
  i18n/               de.ts, en.ts (Typ Dict), ru.ts, index.tsx (t, translate, formatDate)
  lib/                api.ts, mock.ts, cache.ts, auth.tsx, pwa.tsx, project.ts, labels.ts,
                      libraryData.ts, media.ts, uploads.ts, useRender.ts, useCheckout.ts,
                      useAudioPreview.ts, share.ts
  components/         Header, Footer, Logo, LangSwitcher, InstallButton, Modal, PlanBadge,
                      RequireAuth, RenderPlayer, Waveform, WatermarkNotice, Spinner
  editor/             EditorContext (Projektzustand, Autosave, Render), nodes/BlockNode,
                      panels/ (Audio, Visual, Text, Style, Montage, Output), AssistantPanel
  pages/              Landing, Auth (Login/Register), Start, Editor, Projects, Library,
                      Export, Account, NotFound
```

**Routing** (`src/App.tsx`)

| Route | Seite | Schutz |
|---|---|---|
| `/` | Landing | öffentlich |
| `/login`, `/register` | Auth | öffentlich |
| `/start` | Assistent in 3 Schritten | geschützt |
| `/editor/:projectId` | Node-Editor | geschützt |
| `/projects` | Projektliste | geschützt |
| `/library` | Bibliothek | geschützt |
| `/export/:projectId` | Export | geschützt |
| `/account` | Konto | geschützt |
| `*` | 404 | öffentlich |

Geschützte Routen leiten Gäste auf `/login` um und nach dem Login zurück (`RequireAuth`, `state.from`).

**API-Client und Mocks** (`src/lib/api.ts`, `src/lib/mock.ts`)

- Basis-URL aus `VITE_API_URL`. Header `Authorization: Bearer <token>`.
- Ist `VITE_API_URL` leer, bei Netzwerkfehler oder HTTP 502/503/504 schaltet der Client für den Rest der Sitzung auf Mocks um (`isMockMode()`; im Footer steht dann „Demo-Modus“).
- Endpunkte: `POST /api/auth/register|login|logout|forgot`, `GET /api/me`, `POST /api/billing/checkout`, `GET /api/billing/portal`, `GET /api/billing/history`, `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id`, `POST /api/upload/audio`, `POST /api/upload/media`, `POST /api/audio/analyze`, `GET /api/library/audio`, `GET /api/library/media`, `POST /api/render`, `GET /api/render/:jobId`, `GET /api/render/:jobId/link`, `POST /api/assistant`.
- `POST /api/auth/forgot` wurde im Frontend ergänzt; ob das Backend ihn anbieten wird: **UNKNOWN**.
- Mock-Verhalten: neuer Nutzer = Free mit 10 Credits; Render kostet 1 Credit je angefangene 30 s; Job ist 2 s in der Warteschlange, danach 12 s Rendern; Link gilt 7 Tage; Checkout wird sofort angewendet (Pro: +120 Credits, 30 Tage; Credits-Paket: +50).

**i18n** (`src/i18n`): DE (Standard), EN, RU. `en.ts` definiert den Typ `Dict`; `de.ts` und `ru.ts` müssen dieselbe Struktur haben. Schlüssel sind typisiert (`TKey`), TypeScript meldet fehlende oder falsche Schlüssel. Sprache in `localStorage` (`fv_lang`), `<html lang>` wird gesetzt.

**PWA**: `public/manifest.json`, Icons in `public/icons/`, `public/sw.js` (App-Shell-Cache, Navigation network-first, `/assets/` und `/icons/` cache-first, `/api/` wird nicht gecacht). Der Service Worker wird nur im Production-Build registriert. Button „Zum Home-Bildschirm“ im Header und im Profilmenü; ohne natives Prompt (z. B. iOS) erscheint eine Anleitung.

**localStorage-Schlüssel**

| Schlüssel | Inhalt |
|---|---|
| `fv_token` | Auth-Token |
| `fv_lang` | Sprache |
| `fv_projects` | Projekt-Cache (auch Mock-Speicher) |
| `fv_uploads` | Metadaten eigener Uploads (max. 60) |
| `fv_mock_users` | Mock-Nutzer |
| `fv_mock_jobs` | Mock-Render-Jobs |
| `fv_mock_history` | Mock-Render-Verlauf |

### Lokal starten

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit (App + vite.config) und vite build nach dist/
npm run preview
npm run typecheck  # tsc --noEmit
```

Optional `.env` nach Vorlage `.env.example` mit `VITE_API_URL=…`.

### Deployment

- Render Static Site, Projekt „My project“, URL https://factory-video.onrender.com
- Konfiguration auch in `render.yaml`: Build `npm ci && npm run build`, Publish `./dist`, Rewrite `/*` → `/index.html`, Umgebungsvariable `VITE_API_URL` (`sync: false`).
- Autodeploy bei Push auf `main`.
- `VITE_API_URL` ist aktuell leer → Produktion läuft auf Mocks. Vite setzt die Variable beim Build ein; nach Änderung ist ein neuer Deploy nötig.
- Geprüft am 2026-09-26: `/` und `/editor/x` liefern HTTP 200.

### Aktueller Stand

- Etappe 0 (Setup) ✔, Etappe 1 (Frontend) ✔.
- Kein Backend. Alle Daten liegen im Browser (`localStorage`).
- Geprüft: `npx tsc --noEmit` und `npm run build` ohne Fehler; Headless Chrome: alle 8 Routen × DE/EN/RU ohne JS-Fehler; Durchlauf Registrierung → Assistent → Editor → Render → Export funktioniert; bei 390 px Breite kein horizontales Scrollen.
- Keine automatisierten Tests, kein ESLint im Repository.

### Getroffene Entscheidungen

- Nur Frontend; Backend separat auf Render.com.
- Mock-Fallback im API-Client, Projekte zusätzlich in `localStorage` gecacht.
- Tailwind CSS v3 (PostCSS), Google Fonts nur über `<link>` (kein `@import` in CSS).
- Seiten per `React.lazy` in eigene Chunks aufgeteilt.
- Editor: sechs feste Blöcke (Node-IDs = Blocktyp); Inhalte liegen im Projekt, Nodes zeigen Zusammenfassungen, Bearbeitung im Eigenschaften-Panel rechts (mobil als Bottom-Sheet).
- „Anordnen“: Layering von links nach rechts; unter 768 px Breite in 2 Spalten umgebrochen.
- Autosave 900 ms nach der letzten Änderung, „Speichern“ speichert sofort.
- Render-Kosten: 1 Credit je angefangene 30 s (`renderCost` in `src/config/pricing.ts`).
- Root-`tsconfig.json` enthält die App-Konfiguration, damit `npx tsc --noEmit` den Code wirklich prüft.

### Einschränkungen

- Ohne Backend leben hochgeladene Dateien nur bis zum Neuladen der Seite (Object-URLs); nur Vorschaubilder bleiben erhalten.
- Preise in `src/config/pricing.ts` sind Platzhalter (0 € / 19 € pro Monat / 9 € pro Paket); endgültige Preise: **UNKNOWN**.
- Mock-Login akzeptiert jede E-Mail mit Passwort ≥ 6 Zeichen und legt das Konto an; Passwörter werden nicht geprüft.
- Mock-Projekte sind nicht nutzergebunden: alle Mock-Nutzer im selben Browser sehen dieselben Projekte.
- Mock-Render liefert immer dasselbe Beispielvideo (test-videos.co.uk); das Wasserzeichen ist nur eine Überlagerung im Player.
- Der Assistent liefert im Mock vorgefertigte Antworten.
- Bibliotheksinhalte sind externe URLs (Unsplash, SoundHelix, test-videos.co.uk, MDN, samplelib.com). Ob ihre Lizenzen den Produktiveinsatz erlauben: **UNKNOWN**.
- Das Kundenportal von Polar ist nicht angebunden (Mock leitet auf `/account?portal=1`).

### Nächste Schritte

2. Backend-MVP: Upload von Audio/Medien, Render-Warteschlange, FFmpeg (loudnorm, Beat-Erkennung, Schnitte im Takt, Ken Burns, Text, Fade).
3. Videos in Cloudflare R2, Links, Verlauf.
4. Monetarisierung über Polar (Credits/Abo, Wasserzeichen im Free-Tarif).
5. Integration mit Website-SDK (webstudio-sdk-muenchen.com) über API.

Offene Fragen vor Etappe 2:
- FFmpeg auf Render: Docker oder nativ, Zeitlimits für Render — **UNKNOWN**.
- Bibliothek für Beat-Erkennung — **UNKNOWN**.
- Stock-Quelle für Videos (Pexels/Unsplash) — **UNKNOWN**.

---

<a id="english"></a>

## English

### Purpose

Factory Video is an engine for building videos from blocks: **Audio → Visual → Text → Style → Montage → Final video**. Goals: music video for a track (Suno etc.), business promo, Reels/Shorts. Formats: 9:16, 16:9, 1:1.
The LLM is only an orchestrator (block order, copy). Content comes from libraries and user uploads.
This repository contains **the frontend only**.

- Repository: https://github.com/IgorUspehov/-Factory-Video- (branch `main`)
- Production: https://factory-video.onrender.com

### Requirements

- Node.js + npm. No minimum version is defined (no `engines` field in `package.json`): **UNKNOWN**. Built and checked locally with Node 22.23.2 / npm 10.9.8.
- Node version on Render: **UNKNOWN**.

### Stack (versions from `package.json`)

| Package | Version |
|---|---|
| react / react-dom | ^18.3.1 |
| react-router-dom | ^6.30.6 |
| @xyflow/react (node editor) | ^12.12.0 |
| lucide-react (icons) | ^1.48.0 |
| vite | ^5.4.21 |
| @vitejs/plugin-react | ^4.7.0 |
| typescript | ^5.9.3 |
| tailwindcss | ^3.4.19 |
| postcss / autoprefixer | ^8.5.28 / ^10.6.1 |
| @types/react / @types/react-dom / @types/node | ^18.3.31 / ^18.3.7 / ^26.6.3 |

Fonts: Montserrat, Inter, Caveat via `<link>` in `index.html`. The 12 style fonts of the editor are loaded via `<link>` only when the Style panel opens.

### Architecture

**`src/` structure**

```
src/
  main.tsx            entry: Router, I18nProvider, PwaProvider, AuthProvider, SW registration
  App.tsx             routes (lazy-loaded), Header, Footer (not in the editor)
  types.ts            Project, User, AudioTrack, MediaItem, RenderState …
  index.css           Tailwind + component classes + React Flow dark theme
  config/pricing.ts   prices (placeholders), renderCost()
  i18n/               de.ts, en.ts (Dict type), ru.ts, index.tsx (t, translate, formatDate)
  lib/                api.ts, mock.ts, cache.ts, auth.tsx, pwa.tsx, project.ts, labels.ts,
                      libraryData.ts, media.ts, uploads.ts, useRender.ts, useCheckout.ts,
                      useAudioPreview.ts, share.ts
  components/         Header, Footer, Logo, LangSwitcher, InstallButton, Modal, PlanBadge,
                      RequireAuth, RenderPlayer, Waveform, WatermarkNotice, Spinner
  editor/             EditorContext (project state, autosave, render), nodes/BlockNode,
                      panels/ (Audio, Visual, Text, Style, Montage, Output), AssistantPanel
  pages/              Landing, Auth (Login/Register), Start, Editor, Projects, Library,
                      Export, Account, NotFound
```

**Routing** (`src/App.tsx`)

| Route | Page | Access |
|---|---|---|
| `/` | Landing | public |
| `/login`, `/register` | Auth | public |
| `/start` | 3-step wizard | protected |
| `/editor/:projectId` | Node editor | protected |
| `/projects` | Project list | protected |
| `/library` | Library | protected |
| `/export/:projectId` | Export | protected |
| `/account` | Account | protected |
| `*` | 404 | public |

Protected routes send guests to `/login` and back after login (`RequireAuth`, `state.from`).

**API client and mocks** (`src/lib/api.ts`, `src/lib/mock.ts`)

- Base URL from `VITE_API_URL`. Header `Authorization: Bearer <token>`.
- If `VITE_API_URL` is empty, on a network error or on HTTP 502/503/504 the client switches to mocks for the rest of the session (`isMockMode()`; the footer then shows "Demo mode").
- Endpoints: `POST /api/auth/register|login|logout|forgot`, `GET /api/me`, `POST /api/billing/checkout`, `GET /api/billing/portal`, `GET /api/billing/history`, `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id`, `POST /api/upload/audio`, `POST /api/upload/media`, `POST /api/audio/analyze`, `GET /api/library/audio`, `GET /api/library/media`, `POST /api/render`, `GET /api/render/:jobId`, `GET /api/render/:jobId/link`, `POST /api/assistant`.
- `POST /api/auth/forgot` was added by the frontend; whether the backend will provide it: **UNKNOWN**.
- Mock behaviour: new user = Free with 10 credits; a render costs 1 credit per started 30 s; a job is queued for 2 s, then renders for 12 s; the link is valid for 7 days; checkout is applied immediately (Pro: +120 credits, 30 days; credit pack: +50).

**i18n** (`src/i18n`): DE (default), EN, RU. `en.ts` defines the `Dict` type; `de.ts` and `ru.ts` must match its shape. Keys are typed (`TKey`), so TypeScript reports missing or wrong keys. Language is stored in `localStorage` (`fv_lang`), `<html lang>` is updated.

**PWA**: `public/manifest.json`, icons in `public/icons/`, `public/sw.js` (app-shell cache, network-first navigation, cache-first for `/assets/` and `/icons/`, `/api/` is never cached). The service worker is registered only in the production build. "Add to home screen" button in the header and the profile menu; without a native prompt (e.g. iOS) an instruction dialog is shown.

**localStorage keys**

| Key | Content |
|---|---|
| `fv_token` | auth token |
| `fv_lang` | language |
| `fv_projects` | project cache (also the mock store) |
| `fv_uploads` | metadata of own uploads (max. 60) |
| `fv_mock_users` | mock users |
| `fv_mock_jobs` | mock render jobs |
| `fv_mock_history` | mock render history |

### Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit (app + vite.config) and vite build into dist/
npm run preview
npm run typecheck  # tsc --noEmit
```

Optional `.env` based on `.env.example` with `VITE_API_URL=…`.

### Deployment

- Render Static Site, project "My project", URL https://factory-video.onrender.com
- Configuration also in `render.yaml`: build `npm ci && npm run build`, publish `./dist`, rewrite `/*` → `/index.html`, env var `VITE_API_URL` (`sync: false`).
- Auto-deploy on push to `main`.
- `VITE_API_URL` is currently empty → production runs on mocks. Vite inlines the variable at build time; a change requires a new deploy.
- Checked on 2026-09-26: `/` and `/editor/x` return HTTP 200.

### Current state

- Stage 0 (setup) ✔, stage 1 (frontend) ✔.
- No backend. All data lives in the browser (`localStorage`).
- Verified: `npx tsc --noEmit` and `npm run build` without errors; headless Chrome: all 8 routes × DE/EN/RU without JS errors; the flow sign-up → wizard → editor → render → export works; no horizontal scroll at 390 px width.
- No automated tests, no ESLint in the repository.

### Decisions made

- Frontend only; backend separately on Render.com.
- Mock fallback in the API client, projects additionally cached in `localStorage`.
- Tailwind CSS v3 (PostCSS), Google Fonts only via `<link>` (no `@import` in CSS).
- Pages split into chunks via `React.lazy`.
- Editor: six fixed blocks (node id = block type); content lives in the project, nodes show summaries, editing happens in the properties panel on the right (bottom sheet on mobile).
- "Arrange": layering from left to right; below 768 px width wrapped into 2 columns.
- Autosave 900 ms after the last change, "Save" saves immediately.
- Render cost: 1 credit per started 30 s (`renderCost` in `src/config/pricing.ts`).
- The root `tsconfig.json` holds the app configuration so that `npx tsc --noEmit` actually checks the code.

### Limitations

- Without a backend, uploaded files only live until the page is reloaded (object URLs); only preview thumbnails persist.
- Prices in `src/config/pricing.ts` are placeholders (€0 / €19 per month / €9 per pack); final prices: **UNKNOWN**.
- Mock login accepts any email with a password of ≥ 6 characters and creates the account; passwords are not checked.
- Mock projects are not tied to a user: all mock users in the same browser see the same projects.
- Mock render always returns the same sample video (test-videos.co.uk); the watermark is only an overlay in the player.
- The assistant returns canned answers in mock mode.
- Library content consists of external URLs (Unsplash, SoundHelix, test-videos.co.uk, MDN, samplelib.com). Whether their licences allow production use: **UNKNOWN**.
- The Polar customer portal is not connected (the mock redirects to `/account?portal=1`).

### Next steps

2. Backend MVP: audio/media upload, render queue, FFmpeg (loudnorm, beat detection, beat-synced cuts, Ken Burns, text, fade).
3. Videos in Cloudflare R2, links, history.
4. Monetisation via Polar (credits/subscription, watermark on Free).
5. Integration with Website-SDK (webstudio-sdk-muenchen.com) via API.

Open questions before stage 2:
- FFmpeg on Render: Docker or native, render time limits — **UNKNOWN**.
- Beat detection library — **UNKNOWN**.
- Stock video source (Pexels/Unsplash) — **UNKNOWN**.

---

<a id="русский"></a>

## Русский

### Назначение

Factory Video — движок сборки видеороликов из блоков: **Аудио → Визуал → Текст → Стиль → Монтаж → Готовый ролик**. Цели: клип под трек (Suno и др.), промо для бизнеса, Reels/Shorts. Форматы: 9:16, 16:9, 1:1.
LLM — только оркестратор (порядок блоков, тексты). Контент — из библиотек и загрузок пользователя.
В репозитории **только фронтенд**.

- Репозиторий: https://github.com/IgorUspehov/-Factory-Video- (ветка `main`)
- Прод: https://factory-video.onrender.com

### Требования

- Node.js + npm. Минимальная версия не задана (в `package.json` нет поля `engines`): **UNKNOWN**. Локально собрано и проверено на Node 22.23.2 / npm 10.9.8.
- Версия Node на Render: **UNKNOWN**.

### Стек (версии из `package.json`)

| Пакет | Версия |
|---|---|
| react / react-dom | ^18.3.1 |
| react-router-dom | ^6.30.6 |
| @xyflow/react (нодовый редактор) | ^12.12.0 |
| lucide-react (иконки) | ^1.48.0 |
| vite | ^5.4.21 |
| @vitejs/plugin-react | ^4.7.0 |
| typescript | ^5.9.3 |
| tailwindcss | ^3.4.19 |
| postcss / autoprefixer | ^8.5.28 / ^10.6.1 |
| @types/react / @types/react-dom / @types/node | ^18.3.31 / ^18.3.7 / ^26.6.3 |

Шрифты: Montserrat, Inter, Caveat — через `<link>` в `index.html`. 12 шрифтов для стиля ролика подгружаются через `<link>` только при открытии панели «Стиль».

### Архитектура

**Структура `src/`**

```
src/
  main.tsx            вход: Router, I18nProvider, PwaProvider, AuthProvider, регистрация SW
  App.tsx             маршруты (lazy), Header, Footer (кроме редактора)
  types.ts            Project, User, AudioTrack, MediaItem, RenderState …
  index.css           Tailwind + классы компонентов + тёмная тема React Flow
  config/pricing.ts   цены (плейсхолдеры), renderCost()
  i18n/               de.ts, en.ts (тип Dict), ru.ts, index.tsx (t, translate, formatDate)
  lib/                api.ts, mock.ts, cache.ts, auth.tsx, pwa.tsx, project.ts, labels.ts,
                      libraryData.ts, media.ts, uploads.ts, useRender.ts, useCheckout.ts,
                      useAudioPreview.ts, share.ts
  components/         Header, Footer, Logo, LangSwitcher, InstallButton, Modal, PlanBadge,
                      RequireAuth, RenderPlayer, Waveform, WatermarkNotice, Spinner
  editor/             EditorContext (состояние проекта, автосохранение, рендер), nodes/BlockNode,
                      panels/ (Audio, Visual, Text, Style, Montage, Output), AssistantPanel
  pages/              Landing, Auth (Login/Register), Start, Editor, Projects, Library,
                      Export, Account, NotFound
```

**Роутинг** (`src/App.tsx`)

| Маршрут | Страница | Доступ |
|---|---|---|
| `/` | Лендинг | открытый |
| `/login`, `/register` | Вход / регистрация | открытый |
| `/start` | Опросник из 3 шагов | защищённый |
| `/editor/:projectId` | Нодовый редактор | защищённый |
| `/projects` | Список проектов | защищённый |
| `/library` | Библиотека | защищённый |
| `/export/:projectId` | Экспорт | защищённый |
| `/account` | Аккаунт | защищённый |
| `*` | 404 | открытый |

Защищённые маршруты отправляют гостя на `/login` и после входа возвращают обратно (`RequireAuth`, `state.from`).

**API-клиент и моки** (`src/lib/api.ts`, `src/lib/mock.ts`)

- Базовый URL из `VITE_API_URL`. Заголовок `Authorization: Bearer <token>`.
- Если `VITE_API_URL` пуст, при сетевой ошибке или HTTP 502/503/504 клиент до конца сессии переключается на моки (`isMockMode()`; в футере тогда «Демо-режим»).
- Эндпоинты: `POST /api/auth/register|login|logout|forgot`, `GET /api/me`, `POST /api/billing/checkout`, `GET /api/billing/portal`, `GET /api/billing/history`, `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id`, `POST /api/upload/audio`, `POST /api/upload/media`, `POST /api/audio/analyze`, `GET /api/library/audio`, `GET /api/library/media`, `POST /api/render`, `GET /api/render/:jobId`, `GET /api/render/:jobId/link`, `POST /api/assistant`.
- `POST /api/auth/forgot` добавлен фронтендом; будет ли он в бэкенде — **UNKNOWN**.
- Поведение моков: новый пользователь — Free, 10 кредитов; рендер стоит 1 кредит за каждые начатые 30 с; задача 2 с в очереди, затем 12 с рендера; ссылка действует 7 дней; оплата применяется сразу (Pro: +120 кредитов, 30 дней; пакет кредитов: +50).

**i18n** (`src/i18n`): DE (по умолчанию), EN, RU. `en.ts` задаёт тип `Dict`; `de.ts` и `ru.ts` обязаны иметь ту же структуру. Ключи типизированы (`TKey`), TypeScript ловит отсутствующие и неверные ключи. Язык хранится в `localStorage` (`fv_lang`), выставляется `<html lang>`.

**PWA**: `public/manifest.json`, иконки в `public/icons/`, `public/sw.js` (кэш оболочки, навигация network-first, `/assets/` и `/icons/` cache-first, `/api/` не кэшируется). Service worker регистрируется только в production-сборке. Кнопка «На главный экран» в шапке и в меню профиля; без нативного запроса (например, iOS) показывается инструкция.

**Ключи localStorage**

| Ключ | Содержимое |
|---|---|
| `fv_token` | токен авторизации |
| `fv_lang` | язык |
| `fv_projects` | кэш проектов (он же хранилище моков) |
| `fv_uploads` | метаданные своих загрузок (до 60) |
| `fv_mock_users` | мок-пользователи |
| `fv_mock_jobs` | мок-задачи рендера |
| `fv_mock_history` | мок-история рендеров |

### Запуск локально

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit (приложение + vite.config) и vite build в dist/
npm run preview
npm run typecheck  # tsc --noEmit
```

По желанию — `.env` по образцу `.env.example` с `VITE_API_URL=…`.

### Деплой

- Render Static Site, проект «My project», адрес https://factory-video.onrender.com
- Конфигурация продублирована в `render.yaml`: сборка `npm ci && npm run build`, публикация `./dist`, Rewrite `/*` → `/index.html`, переменная `VITE_API_URL` (`sync: false`).
- Автодеплой при push в `main`.
- `VITE_API_URL` сейчас пустой → прод работает на моках. Vite вшивает переменную при сборке; после изменения нужен новый деплой.
- Проверено 2026-09-26: `/` и `/editor/x` отвечают HTTP 200.

### Текущее состояние

- Этап 0 (сетап) ✔, этап 1 (фронтенд) ✔.
- Бэкенда нет. Все данные — в браузере (`localStorage`).
- Проверено: `npx tsc --noEmit` и `npm run build` без ошибок; headless Chrome: все 8 маршрутов × DE/EN/RU без JS-ошибок; сценарий регистрация → опросник → редактор → рендер → экспорт работает; при ширине 390 px нет горизонтальной прокрутки.
- Автотестов и ESLint в репозитории нет.

### Принятые решения

- Только фронтенд; бэкенд отдельно на Render.com.
- Фолбэк на моки в API-клиенте, проекты дополнительно кэшируются в `localStorage`.
- Tailwind CSS v3 (PostCSS), Google Fonts только через `<link>` (без `@import` в CSS).
- Страницы разбиты на чанки через `React.lazy`.
- Редактор: шесть фиксированных блоков (id ноды = тип блока); данные хранятся в проекте, ноды показывают сводку, редактирование — в панели свойств справа (на мобильном — нижняя шторка).
- «Упорядочить»: раскладка слоями слева направо; при ширине меньше 768 px — перенос в 2 колонки.
- Автосохранение через 900 мс после последнего изменения, «Сохранить» — сразу.
- Стоимость рендера: 1 кредит за каждые начатые 30 с (`renderCost` в `src/config/pricing.ts`).
- Корневой `tsconfig.json` содержит настройки приложения, чтобы `npx tsc --noEmit` реально проверял код.

### Ограничения

- Без бэкенда загруженные файлы живут только до перезагрузки страницы (object URL); сохраняются лишь превью.
- Цены в `src/config/pricing.ts` — плейсхолдеры (0 € / 19 € в месяц / 9 € за пакет); итоговые цены: **UNKNOWN**.
- Мок-вход принимает любой email с паролем от 6 символов и создаёт аккаунт; пароли не проверяются.
- Мок-проекты не привязаны к пользователю: все мок-пользователи в одном браузере видят одни и те же проекты.
- Мок-рендер всегда отдаёт одно и то же демо-видео (test-videos.co.uk); водяной знак — только наложение в плеере.
- Помощник в режиме моков отвечает заготовками.
- Контент библиотеки — внешние URL (Unsplash, SoundHelix, test-videos.co.uk, MDN, samplelib.com). Разрешают ли их лицензии использование в продакшене — **UNKNOWN**.
- Портал клиента Polar не подключён (мок ведёт на `/account?portal=1`).

### Следующие шаги

2. Бэкенд MVP: загрузка аудио/медиа, очередь рендера, FFmpeg (loudnorm, определение бита, склейки под бит, Ken Burns, текст, fade).
3. Видео в Cloudflare R2, ссылки, история.
4. Монетизация через Polar (кредиты/подписка, водяной знак во Free).
5. Интеграция с Website-SDK (webstudio-sdk-muenchen.com) через API.

Открытые вопросы до этапа 2:
- FFmpeg на Render: Docker или нативно, лимиты времени рендера — **UNKNOWN**.
- Библиотека определения бита — **UNKNOWN**.
- Сток-источник видео (Pexels/Unsplash) — **UNKNOWN**.
