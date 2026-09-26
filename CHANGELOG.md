# Changelog

**DE** · [EN](#english) · [RU](#русский)

---

## Deutsch

### [Unreleased]

- Dokumentation: `README.md`, `CHANGELOG.md`, `CLAUDE.md` (DE/EN/RU). Code unverändert.

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

- Documentation: `README.md`, `CHANGELOG.md`, `CLAUDE.md` (DE/EN/RU). No code changes.

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

- Документация: `README.md`, `CHANGELOG.md`, `CLAUDE.md` (DE/EN/RU). Код не менялся.

### [0.1.0] — 2026-09-26 — коммит `adbf18f`

Первая версия фронтенда.

- Страницы: `/` лендинг, `/login`, `/register`, `/start` (опросник из 3 шагов), `/editor/:projectId` (редактор на React Flow с блоками Аудио, Визуал, Текст, Стиль, Монтаж, Готовый ролик), `/projects`, `/library`, `/export/:projectId`, `/account`, 404.
- Стек: React 18.3.1, TypeScript 5.9.3, Vite 5.4.21, Tailwind CSS 3.4.19, React Router 6.30.6, Lucide React 1.48.0, @xyflow/react 12.12.0.
- API-клиент `src/lib/api.ts` с `VITE_API_URL` и фолбэком на моки (`src/lib/mock.ts`), кэш проектов в `localStorage`.
- i18n DE (по умолчанию) / EN / RU, PWA (манифест, иконки, service worker, кнопка «На главный экран»).
- Проверка: `npx tsc --noEmit` без ошибок, `npm run build` успешно; headless Chrome: 8 маршрутов × 3 языка без JS-ошибок.
- `render.yaml` для Render Static Site (сборка `npm ci && npm run build`, публикация `./dist`, Rewrite `/*` → `/index.html`, `VITE_API_URL`).
