# Factory Video

**DE** · [EN](#english) · [RU](#русский)

## Deutsch

**Factory Video** ist eine Engine zum Bauen von Videos aus Blöcken — ein visueller Konstruktor. Du kombinierst die Blöcke Audio → Visual → Text → Stil → Schnitt → Fertiges Video auf einer Node-Leinwand und renderst ein MP4 in 9:16, 16:9 oder 1:1. Die KI ist nur Orchestrator (schlägt Blockreihenfolge und Texte vor); Inhalte stammen aus der Bibliothek und deinen Uploads.

Dieses Repository enthält **nur das Frontend** (React 18, TypeScript, Vite, Tailwind CSS, React Router, Lucide, @xyflow/react). Es ist eine PWA mit Oberfläche auf Deutsch, Englisch und Russisch.

### Starten

```bash
npm install
npm run dev        # Entwicklungsserver auf http://localhost:5173
npm run build      # Typprüfung + Produktions-Build nach dist/
npm run preview    # Build lokal ansehen
```

### Backend / `VITE_API_URL`

Alle Anfragen laufen über `src/lib/api.ts`. Die Basis-URL kommt aus `VITE_API_URL` (siehe `.env.example`), z. B.:

```bash
VITE_API_URL=https://factory-video-api.onrender.com
```

Ist die Variable leer oder das Backend nicht erreichbar, nutzt der Client eingebaute Mocks (Demo-Nutzer: Free-Tarif mit 10 Credits). Projekte werden zusätzlich in `localStorage` gecacht, sodass der Editor auch ohne Backend funktioniert.

---

<a id="english"></a>

## English

**Factory Video** is an engine for building videos from blocks — a visual constructor. You combine Audio → Visual → Text → Style → Montage → Final video on a node canvas and render an MP4 in 9:16, 16:9 or 1:1. The LLM is only an orchestrator (suggests block order and copy); content comes from the library and your own uploads.

This repository contains **the frontend only** (React 18, TypeScript, Vite, Tailwind CSS, React Router, Lucide, @xyflow/react). It is a PWA with a German, English and Russian interface.

### Run

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # type check + production build into dist/
npm run preview    # preview the build locally
```

### Backend / `VITE_API_URL`

All requests go through `src/lib/api.ts`. The base URL is read from `VITE_API_URL` (see `.env.example`), e.g.:

```bash
VITE_API_URL=https://factory-video-api.onrender.com
```

If the variable is empty or the backend is unreachable, the client falls back to built-in mocks (demo user: Free plan with 10 credits). Projects are also cached in `localStorage`, so the editor keeps working without a backend.

---

<a id="русский"></a>

## Русский

**Factory Video** — движок для сборки видеороликов из блоков, визуальный конструктор. Вы соединяете блоки Аудио → Визуал → Текст → Стиль → Монтаж → Готовый ролик на нодовом холсте и рендерите MP4 в 9:16, 16:9 или 1:1. LLM — только оркестратор (подсказывает порядок блоков и тексты); контент берётся из библиотек и загрузок пользователя.

В репозитории **только фронтенд** (React 18, TypeScript, Vite, Tailwind CSS, React Router, Lucide, @xyflow/react). Это PWA с интерфейсом на немецком, английском и русском.

### Запуск

```bash
npm install
npm run dev        # dev-сервер на http://localhost:5173
npm run build      # проверка типов + production-сборка в dist/
npm run preview    # просмотр сборки локально
```

### Бэкенд / `VITE_API_URL`

Все запросы идут через `src/lib/api.ts`. Базовый URL берётся из `VITE_API_URL` (см. `.env.example`), например:

```bash
VITE_API_URL=https://factory-video-api.onrender.com
```

Если переменная пустая или бэкенд недоступен, клиент переключается на встроенные моки (демо-пользователь: тариф Free, 10 кредитов). Проекты дополнительно кэшируются в `localStorage`, поэтому редактор работает и без бэкенда.
