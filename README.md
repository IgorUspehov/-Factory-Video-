# Factory Video

**DE** · [EN](#english) · [RU](#русский)

Stand der Dokumentation / Documentation as of / Документация актуальна на: **2026-09-27**, Version 0.4.1.

---

## Deutsch

### Zweck

Factory Video ist eine Engine zum Bauen von Videos aus Blöcken: **Audio → Visual → Text → Stil → Schnitt → Fertiges Video**. Ziele: Musikvideo zum Track (Suno u. a.), Business-Promo, Reels/Shorts. Formate: 9:16, 16:9, 1:1.
Das LLM ist nur Orchestrator (Blockreihenfolge, Texte). Inhalte kommen aus Bibliotheken und Uploads der Nutzer.

Das Repository enthält das **Frontend** (Wurzelverzeichnis) und seit 0.2.0 das **Backend** (`server/`).

- Repository: https://github.com/IgorUspehov/-Factory-Video- (Branch `main`)
- Frontend in Produktion: https://factory-video.onrender.com
- Backend in Produktion: https://factory-video-api.onrender.com (laut Eigentümer angelegt; `/api/health` antwortet mit 200).

### Voraussetzungen

- Frontend: Node.js + npm; Mindestversion nicht festgelegt (kein `engines`-Feld im Wurzel-`package.json`): **UNKNOWN**.
- Backend: Node.js ≥ 22.9 (`engines` in `server/package.json`, `server/.node-version` = 22). FFmpeg/FFprobe kommen als npm-Pakete mit, keine Systeminstallation nötig.
- Lokal gebaut und geprüft mit Node 22.23.2 / npm 10.9.8 unter Linux x64.

### Stack

**Frontend** (`package.json`): react / react-dom ^18.3.1, react-router-dom ^6.30.6, @xyflow/react ^12.12.0, lucide-react ^1.48.0, vite ^5.4.21, @vitejs/plugin-react ^4.7.0, typescript ^5.9.3, tailwindcss ^3.4.19, postcss ^8.5.28, autoprefixer ^10.6.1.

**Backend** (`server/package.json`, reines JavaScript, ESM, ohne Build-Schritt):

| Paket | Version | Zweck |
|---|---|---|
| express | ^5.2.1 | HTTP-API |
| multer | ^2.4.0 | Datei-Uploads |
| bcryptjs | ^3.0.3 | Passwort-Hashes |
| jsonwebtoken | ^9.0.3 | JWT |
| cors | ^2.8.6 | CORS |
| ffmpeg-static | ^5.3.0 | FFmpeg 7.0.2 (Binary) |
| ffprobe-static | ^3.1.0 | FFprobe (Binary) |
| music-tempo | ^1.0.3 | Tempo- und Beat-Erkennung |

### Architektur

#### Frontend

```
src/
  main.tsx, App.tsx   Einstieg, Routen (lazy), Header/Footer
  types.ts            Project, User, AudioTrack, MediaItem, RenderState …
  config/pricing.ts   Preise (Platzhalter), renderCost()
  i18n/               de.ts, en.ts (Typ Dict), ru.ts, index.tsx
  lib/                api.ts (API-Client), mock.ts, cache.ts, auth.tsx, pwa.tsx, project.ts, …
  components/         Header, Footer, RenderPlayer, Waveform, …
  editor/             EditorContext, nodes/BlockNode, panels/*, AssistantPanel
  pages/              Landing, Auth, Start, Editor, Projects, Library, Export, Account, NotFound
```

- Routen: `/`, `/login`, `/register` öffentlich; `/start`, `/editor/:projectId`, `/projects`, `/library`, `/export/:projectId`, `/account` geschützt (Gäste → `/login` und zurück).
- API-Client `src/lib/api.ts`: Basis-URL aus `VITE_API_URL`, Header `Authorization: Bearer <token>`. Ist `VITE_API_URL` leer, bei Netzwerkfehler oder HTTP 502/503/504 schaltet er für die Sitzung auf Mocks um (`src/lib/mock.ts`, Footer zeigt „Demo-Modus“). Projekte werden zusätzlich in `localStorage` gecacht.
- i18n DE (Standard) / EN / RU, typisierte Schlüssel. PWA: Manifest, Icons, `public/sw.js` (nur im Production-Build registriert). Link-Vorschau: Open-Graph-/Twitter-Tags in `index.html`, Bild `public/og-image.jpg` (1200×675).
- localStorage-Schlüssel: `fv_token`, `fv_lang`, `fv_projects`, `fv_uploads`, `fv_mock_users`, `fv_mock_jobs`, `fv_mock_history`.

#### Backend (`server/`)

```
server/
  src/index.js           Start, Graceful Shutdown, Wiederaufnahme offener Render-Jobs
  src/app.js             Express-Routen (Vertrag = src/lib/api.ts des Frontends)
  src/config.js          ENV, pricing (Spiegel von src/config/pricing.ts), Limits
  src/db.js              JSON-Dateien in DATA_DIR/db (users, projects, uploads, jobs, analyses)
  src/auth.js            Registrierung/Login (bcrypt, JWT 30 Tage), Middleware
  src/storage/           Speicherschicht: index.js (Auswahl), local.js (lokale Platte)
  src/media.js           ffprobe, PCM-Dekodierung, Download erlaubter Remote-Dateien (Cache)
  src/analyze.js         Beat-Analyse (Worker-Thread, eine Analyse gleichzeitig)
  src/analyze-worker.js  music-tempo + Peaks
  src/library.js         Bibliothek: Pexels oder statische Liste
  src/libraryData.js     Spiegel von src/lib/libraryData.ts des Frontends
  src/assistant.js       regelbasierter Assistent (DE/EN/RU)
  src/render/queue.js    Render-Warteschlange im Prozess, 1 Job gleichzeitig
  src/render/pipeline.js FFmpeg-Pipeline
  src/render/ass.js      Text und Wasserzeichen als ASS-Untertitel
  fonts/                 Inter, Montserrat, Bebas Neue, Playfair Display (TTF, OFL, mit Lizenztexten)
  scripts/smoke.mjs      End-to-End-Smoke-Test
```

**Endpunkte**

| Methode und Pfad | Antwort / Verhalten |
|---|---|
| `GET /api/health` | 200 `{ ok, queue }` |
| `POST /api/auth/register` | 201 `{ token }`; 400 `invalid_email` / `weak_password`; 409 `exists` |
| `POST /api/auth/login` | `{ token }`; 401 `invalid_credentials` |
| `POST /api/auth/logout` | `{ ok: true }` (JWT ist zustandslos, der Client verwirft den Token) |
| `POST /api/auth/forgot` | 202 (Platzhalter, kein E-Mail-Versand) |
| `GET /api/me` | `{ id, email, plan, credits, renewsAt }`; neu: `free`, 10 Credits |
| `POST /api/billing/checkout`, `GET /api/billing/portal` | 501 `billing_not_implemented` (Etappe 4) |
| `GET /api/billing/history` | echte Render-Historie des Nutzers |
| `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id` | CRUD, an den Nutzer gebunden (fremde Projekte → 404) |
| `POST /api/upload/audio` | MP3/WAV/M4A, ≤ 20 MB, Feld `rightsConfirmed=true` Pflicht (sonst 400 `rights_not_confirmed`), Prüfung mit ffprobe |
| `POST /api/upload/media` | JPG/PNG/WEBP, MP4/MOV/WEBM/M4V, ≤ 200 MB, Prüfung mit ffprobe |
| `POST /api/upload/depth` | Tiefenkarte (PNG, ≤ 8 MB, ≤ 2048 px) für die Parallaxe; nur eigene Karten werden beim Rendern verwendet |
| `POST /api/audio/analyze` | `{ duration, bpm, beats[], peaks[] }` für eigenen Upload oder Bibliothekstrack; Ergebnis gecacht |
| `GET /api/library/audio?mood=&niche=` | statische Trackliste |
| `GET /api/library/media?q=&kind=&orientation=&page=&lang=&mood=&niche=` | Pexels-Suche (Fotos + Videos, mit `credit` = Urheber) oder statische Liste; eine Seite pro Aufruf, leere Liste = keine weiteren Seiten; Header `X-Library-Source` |
| `POST /api/render` | `{ jobId, cost }`; Kosten nach `renderCost`; 402 `insufficient_credits`; 400 `empty_project` / `too_long` (> 300 s) |
| `GET /api/render/:jobId` | `{ status, progress, url, expiresAt, watermark }` |
| `GET /api/render/:jobId/link` | neue signierte Link-Gültigkeit von 7 Tagen |
| `POST /api/assistant` | `{ suggestion }`, regelbasiert, Sprache aus `lang` |
| `GET /files/uploads/…`, `GET /files/renders/…?exp=&sig=` | Dateien; Renders nur mit gültiger HMAC-Signatur (sonst 403) |

Fehlerformat: `{ error: <code>, message }` — der Frontend-Client liest `error`.

**Render-Pipeline** (`server/src/render/pipeline.js`)
- Formate: 9:16 → 720×1280, 16:9 → 1280×720, 1:1 → 720×720; 30 fps; H.264 (libx264 `veryfast`, CRF 21) + AAC 160 kbit/s, `+faststart`.
- Dauer aus der Timeline; bei `beatSync` wird jeder Schnitt auf den nächsten Beat verschoben (Clip ≥ 0,5 s). Ohne Clips: Hintergrundfarbe, Länge = Audio (max. 30 s), wie im Frontend.
- Fotos: `scale`+`crop`, bei Ken Burns `zoompan` (abwechselnd Zoom-in/-out). Videos: `scale`+`crop`, bei Bedarf in Schleife.
- Übergänge: cut = direkt, fade/zoom/slide = `xfade` (`fade`/`zoomin`/`slideleft`), Dauer ≤ 0,5 s.
- Das Video wird in Teilstücken gerendert (Clip-Körper und Übergänge, je max. 2 Eingänge, Text bereits eingebrannt) und per concat-Demuxer ohne Neukodierung verbunden; danach wird das Audio gemuxt. So bleibt der Speicher unabhängig von der Clip-Anzahl.
- Audio: `loudnorm` (I = −14 LUFS, TP = −1,5 dB), auf Videolänge gekürzt/aufgefüllt, Fade-in/-out nach Stil. Ohne Musik: stille AAC-Spur.
- Text: Zeilen mit Start/Ende, Farben aus dem Stil (Text = Füllung, Akzent = Schatten), Fade 250 ms; Position je Modus (Songtext/Titel unten, Slogan Mitte).
- Free: Wasserzeichen „Factory Video“ unten rechts im Video selbst.
- Fortschritt aus `-progress` von FFmpeg → 0–95 % Teilstücke, 95–99 % Mux, 100 % fertig.

**Warteschlange**: im Serverprozess, FIFO, 1 Job gleichzeitig, Timeout 20 min pro FFmpeg-Aufruf. Credits werden beim Start abgezogen und bei Fehlern erstattet. Offene Jobs werden nach einem Neustart erneut eingereiht.

**Speicherschicht** (`server/src/storage`): Schnittstelle `put(key, srcPath)`, `localPath(key)`, `remove(key)`, `publicUrl(key)`, `signedUrl(key, expiresAt)`, `verify(key, exp, sig)`. Aktuell `local.js` (DATA_DIR/files); für Etappe 3 wird ein R2-Treiber mit gleicher Schnittstelle in `storage/index.js` eingesetzt.

**Remote-Dateien**: Der Server lädt Bibliotheks- und Pexels-Dateien nur von einer Positivliste von Hosts (Unsplash, Pexels, SoundHelix, test-videos.co.uk, MDN, samplelib) und cacht sie in DATA_DIR/cache.

### Editor-Oberfläche (seit 0.3.0)

- Leiste **„Was als Nächstes?“** über der Leinwand: ① Musik hinzufügen → ② Fotos oder Videos hinzufügen → ③ Video erstellen, mit Häkchen; der aktuelle Schritt ist hervorgehoben, ein Klick öffnet den passenden Block. Sind 1 und 2 erledigt, erscheint die große Schaltfläche „Video erstellen“; während des Renderns zeigt die Leiste den Fortschritt groß an, danach „Video ansehen“.
- Blöcke größer (Titel 14 px, Beschreibung 13 px) mit einer Zeile in einfacher Sprache unter dem Titel; Standardanordnung 3 × 2, „Anordnen“ ordnet in 3 Spalten (unter 768 px: 2).
- Alle Schaltflächen mit Beschriftung und Tooltip (`title`), schwierige Optionen mit grauer Erklärung darunter. Optionale Einstellungen liegen im Bereich **„Erweitert“**: Stil komplett (bis auf „Schnitt im Takt“), Feineinstellung des Schnitts; „Marke“ in der Seitenleiste unter „Erweitert“.
- Eigenschaften-Panel: Standardbreite 33 % des Fensters (min. 380 px, max. 60 %), am linken Rand per Maus verstellbar, Breite in `localStorage` (`fv_panel_width`); Grundschrift 15 px, Schaltflächen ≥ 44 px. Mobil: Bottom-Sheet mit 85 % Höhe.
- Nach dem Rendern öffnet sich der Player automatisch als großes Fenster (MP4 herunterladen, Link kopieren, Export-Seite, Schließen) — nur für Renders, die in dieser Sitzung gestartet wurden.
- Medienbibliothek (Picker im Visual-Block und Seite `/library`): Suchfeld, Filter Fotos/Videos, Ausrichtung passend zum Projektformat (9:16 → Hochformat), Nachladen beim Scrollen, Stimmung/Nische als schnelle Vorschläge, Urheber (Pexels) klein auf der Vorschau, Leiste der ausgewählten Elemente.

**Videolänge** (`lengthMode` im Projekt, Logik in `server/src/shared/timeline.js`, von Frontend und Backend gemeinsam genutzt):
- `track` — so lang wie der Track (Standard für „Musikvideo“); `15` / `30` / `60` — feste Länge; `timeline` — Summe der Schnitt-Längen (Standard für Promo und Reels).
- Bei `track` und festen Längen werden die Clips gleichmäßig über die Länge verteilt; die Bilddauer entspricht ungefähr dem Durchschnitt der Schnitt-Längen, zu wenige Clips wiederholen sich der Reihe nach; bei „Schnitt im Takt“ sitzen die Schnitte auf dem nächsten Beat.
- Über 300 s: Hinweis im Editor mit „Auf 5:00 kürzen“ (`lengthMode = 300`); das Backend antwortet sonst mit 400 `too_long`.
- Kosten = `renderCost(plannedDuration(project))` — dieselbe Funktion im Frontend (Anzeige) und im Backend (Abrechnung).

### 2.5D-Parallaxe und Effekte im Takt (seit 0.4.0)

**Tiefenkarten im Browser.** Schalter „Tiefe (2.5D)“ oben im Visual-Block. Beim Einschalten lädt der Browser einmalig transformers.js (zur Laufzeit vom CDN jsDelivr, feste Version 4.3.0, `dist/transformers.min.js`; keine npm-Abhängigkeit) und das offene Modell **Depth Anything V2 Small** (`onnx-community/depth-anything-v2-small`, ONNX, 8-Bit quantisiert, Datei `model_quantized.onnx` 27,3 MB, Lizenz **Apache-2.0** laut Modellkarte) von Hugging Face sowie ONNX Runtime Web (WASM) vom CDN jsDelivr; beides landet im Browser-Cache. Jedes Foto wird auf höchstens 1280 px (lange Seite) verkleinert, die Tiefe berechnet (hell = nah), eine Vordergrund-Schwelle nach Otsu bestimmt (zwischen 40. und 85. Perzentil) und die Karte als Graustufen-PNG an `POST /api/upload/depth` gesendet; das Medien-Element bekommt `depth: { id, url, threshold }`. Fortschritt „Tiefe wird berechnet: 3 von 15“, Abzeichen auf fertigen Fotos. Videos werden übersprungen.

**Parallaxe im Render** (`parallaxSource` in `server/src/render/pipeline.js`). Gewählte Methode: **zwei Ebenen mit weicher Tiefenmaske** statt `displace`. `displace` bräuchte pro Bild eine zeitabhängige Verschiebungskarte (`geq` pro Pixel und Bild) — auf 0,5 CPU viel zu langsam. Stattdessen werden **einmal pro Foto** zwei Ebenen als PNG vorbereitet (`prepareParallaxLayers`, ≈ 0,5 s, ≈ 150 MB): der leicht vergrößerte Vordergrund mit weicher Alpha-Maske aus der Tiefenkarte (Schwelle + Weichzeichnung) und der Hintergrund, in dem die Fläche des Vordergrunds aus der Umgebung aufgefüllt ist (normalisierte Faltung: Weichzeichnung(Bild × Hintergrundgewicht) ÷ Weichzeichnung(Hintergrundgewicht)) — so zeigt die beim Verschieben freigelegte Kante Hintergrundfarben statt eines Doppelbilds. Pro Teilstück werden beide Ebenen einmal dekodiert und mit `loop` wiederholt; pro Bild laufen nur ein Zuschnitt des Hintergrunds (kleine Drift) und ein Overlay des Vordergrunds (≈ 3× größere Drift) — keine Skalierung pro Bild. Richtung wechselt je Aufnahme. Dauer, Übergänge und Schnitte im Takt bleiben unverändert (dieselbe Teilstück-Logik). Ohne Tiefenkarte (Modell nicht geladen, altes Browser, fremde oder verlorene Datei) → Ken Burns ohne Fehler; Videoclips → nie Parallaxe.

**Effekte im Takt** (`beatFxChain`, Voreinstellungen in `server/src/shared/effects.js`, gemeinsam mit dem Frontend). Voreinstellungen Keine / Sanft / Mittel / Energisch, Standard nach Stimmung (ruhig → Sanft, energetisch → Energisch, Premium → Sanft, Corporate → Keine). Effekte auf den Beats der Analyse: Zoom-„Punch“ und Wackeln (`zoompan`), Blitz (`eq`), Farbpuls (`hue`), kurzer RGB-Glitch (`rgbashift` nur um den Beat aktiv). Sanft = leichter Punch + Farbpuls auf jedem 2. Beat; Mittel = Punch auf jedem Beat, leichtes Wackeln, Blitz auf jedem 2. Beat; Energisch = zusätzlich stärker und Glitch auf jedem 4. Beat. In jedes Teilstück werden nur die Beats geschrieben, die es berühren (kurze Ausdrücke). Ohne Track oder Beats keine Effekte. Die Effekte sind im MP4, Text und Wasserzeichen bleiben ruhig (werden danach eingebrannt). Auswahl neben der Videolänge (Schnitt- und Ausgabe-Panel) und im Stil-Panel; Kurzanzeige im Stil-Block.

### Umgebungsvariablen (Backend, `server/.env.example`)

| Variable | Bedeutung |
|---|---|
| `PORT` | HTTP-Port (Standard 8080) |
| `DATA_DIR` | Datenverzeichnis: JSON-DB, Dateien, Cache (Standard `./data`) |
| `JWT_SECRET` | Schlüssel für JWT und Link-Signaturen; in Produktion Pflicht |
| `FRONTEND_ORIGIN` | erlaubte CORS-Origin(s), kommagetrennt |
| `PEXELS_API_KEY` | optional; ohne Schlüssel liefert `/api/library/media` die statische Liste |
| `PUBLIC_URL` | öffentliche Basis-URL für Datei-Links; fehlt sie, wird Renders `RENDER_EXTERNAL_URL` genutzt |

Frontend: `VITE_API_URL` = URL des Backends (wird beim Build eingesetzt).

### Lokal starten

```bash
# Frontend
npm install
npm run dev                      # http://localhost:5173 (ohne VITE_API_URL: Mocks)

# Backend
cd server
npm install
cp .env.example .env             # Werte anpassen
npm start                        # http://localhost:8080
npm run smoke                    # End-to-End-Test mit eigenem Server, temporärem DATA_DIR und Pexels-Attrappe
node scripts/fake-pexels.mjs     # Pexels-Attrappe auf :18999 (PEXELS_API_BASE=http://127.0.0.1:18999)

# Frontend gegen lokales Backend
VITE_API_URL=http://localhost:8080 npm run dev
```

### Deployment

- **Frontend**: Render Static Site, Projekt „My project“, https://factory-video.onrender.com; Build `npm ci && npm run build`, Publish `./dist`, Rewrite `/*` → `/index.html`, Autodeploy bei Push auf `main`.
- **Backend**: zweiter Dienst `factory-video-api` in `render.yaml` (Typ web, Runtime node, rootDir `server`, Build `npm ci`, Start `npm start`, Health-Check `/api/health`; ENV: `JWT_SECRET` generiert, `PEXELS_API_KEY` und `PUBLIC_URL` manuell, `FRONTEND_ORIGIN=https://factory-video.onrender.com`, `DATA_DIR=./data`). Der Dienst läuft unter https://factory-video-api.onrender.com; ob dort `PEXELS_API_KEY` gesetzt ist: **UNKNOWN**.
- Danach im Static Site `VITE_API_URL` auf die URL des API-Dienstes setzen und neu deployen; sonst läuft das Frontend weiter auf Mocks.
- Instanztyp / Plan des API-Dienstes: **UNKNOWN**.

### Aktueller Stand

- 0.4.0 (2026-09-27): 2.5D-Parallaxe (Tiefenmodell im Browser) und Effekte im Takt. Lokal geprüft: `npx tsc --noEmit`, `npm run build`; `npm run smoke` (165/165; neu: Upload der Tiefenkarte, Render mit Tiefenkarten, alle Voreinstellungen, Fallback ohne Tiefenkarte, fremde Tiefenkarte, Messungen 30 s / 3 min); Headless Chrome mit **echtem Modell** im Browser (11/11): 3 Fotos → Tiefe 3 von 3, Voreinstellung „Energisch“, Track 1:50 → MP4 = Track, keine JS-Fehler. Bilder aus dem MP4: `docs/screenshots/0.4.0/`. Auf Render nicht geprüft: **UNKNOWN**.
- 0.3.0 (2026-09-27): Editor-Überarbeitung nach dem ersten Test des Eigentümers in Produktion. Lokal geprüft: `npx tsc --noEmit`, `npm run build`; `npm run smoke` (99/99); Headless Chrome gegen lokales Backend mit Pexels-Attrappe (`server/scripts/fake-pexels.mjs`): 21/21 — u. a. Musikvideo mit 1:50-Track → MP4 110,03 s = Track, 3 gezielt gewählte Fotos landen genau so im Projekt (auch wenn eine ältere, langsamere Suche danach antwortet), Suche „singer stage“ liefert Ergebnisse, Nachladen beim Scrollen, Player öffnet sich nach dem Rendern selbst, Panel 475 px (33 % von 1440) und verstellbar, mobil Bottom-Sheet 85 %, keine JS-Fehler. Screenshots: `docs/screenshots/0.3.0/` (Bibliothek dort mit der Pexels-Attrappe, daher „Fixture Photographer“). Gegen die echte Pexels-API nicht geprüft (kein Schlüssel verfügbar): **UNKNOWN**.
- Etappe 0 ✔, Etappe 1 ✔, Etappe 2 (Backend-MVP) ✔; beide Dienste laufen auf Render (Frontend und API).
- Geprüft (lokal, 2026-09-26):
  - `npx tsc --noEmit` und `npm run build` (Frontend) ohne Fehler.
  - `npm run smoke`: 80/80 Prüfungen bestanden — u. a. Registrierung/Login, Audio-Upload mit und ohne `rightsConfirmed`, Analyse (synthetischer 120-BPM-Track → 120 BPM), Foto- und Video-Upload, Projekt-CRUD mit Nutzerbindung, Renders in 9:16, 16:9, 1:1 mit fade/slide/cut/zoom (Auflösung, H.264 + AAC, Dauer = Timeline ± 0,1 s, Wasserzeichen), Link-Signatur und -Erneuerung, 402 bei zu wenig Credits, Billing 501, Bibliothek, Assistent.
  - Headless Chrome: echtes Frontend gegen echtes Backend (Registrierung → Assistent → Bibliothekstrack analysiert → 3 Fotos → Render → Export-Seite) ohne JS- und CORS-Fehler, ohne Fallback auf Mocks.

### Messungen (lokal: 4× Intel N100, 8 GB RAM)

| Messung | Ergebnis |
|---|---|
| 30-s-Video, 9:16, 10 Fotos, Ken Burns, fade, Audio, Text, Wasserzeichen | 33 416 ms Renderzeit, Spitze RSS Server + FFmpeg 367 MB |
| 30-s-Video, 9:16, 60 Clips à 0,5 s, fade | 58 954 ms, Spitze 332 MB |
| Beat-Analyse SoundHelix-Track (6:12 min) | ≈ 2,4 s; Kindprozess bis ≈ 330 MB, danach frei; Serverprozess bleibt bei ≈ 58 MB (seit 0.4.0) |
| 30-s-Video, 9:16, 10 Fotos, **Parallaxe + „Energisch“**, Schnitt im Takt (0.4.0) | 18 661 ms, Spitze RSS Server + FFmpeg 279 MB |
| 3-min-Video, 9:16, 10 Fotos, **Parallaxe + „Energisch“**, Schnitt im Takt (0.4.0) | 98 762 ms, Spitze 286 MB |
| Tiefenkarte im Browser (Headless Chrome, WASM, 1 Foto ≤ 1280 px) | ≈ 9 800–10 800 ms pro Foto (nach dem Laden des Modells) |
| Download beim ersten Einschalten von „Tiefe“ | Modell 27,3 MB + ONNX-Runtime (WASM) 5,6 (komprimiert; 26,9 entpackt) MB + transformers.js 166 kB (Brotli, jsDelivr); danach aus dem Browser-Cache |
| Vorherige Pipeline-Variante (alle Clips in einem xfade-Graphen) | 30 s / 10 Clips: 1119 MB; 60 Clips: ≈ 3,9 GB (FFmpeg allein) — deshalb verworfen |

Renderzeiten und Speicher auf Render: **UNKNOWN** (abhängig vom Instanztyp).

### Getroffene Entscheidungen

- FFmpeg nativ über `ffmpeg-static` + `ffprobe-static`, ohne Docker (Eigentümer).
- **Beat-Erkennung: music-tempo** — reines JavaScript ohne native Abhängigkeiten oder Web-Audio-API (läuft in Node), MIT-Lizenz, liefert Tempo **und** Beat-Zeitpunkte (Beat-Tracking nach Dixons BeatRoot), was für Schnitte im Takt nötig ist. Andere JS-Bibliotheken (z. B. web-audio-beat-detector, realtime-bpm-analyzer) setzen die Web-Audio-API des Browsers voraus oder liefern nur BPM. Parameter (22,05 kHz, Hop 221, FFT 1024) auf synthetischen Tracks 75–160 BPM gewählt; Tempo > 160 BPM wird halbiert (energiereichere Beat-Phase bleibt). Analyse in einem kurzlebigen Kindprozess (seit 0.4.0; vorher Worker-Thread, dessen Speicher im Serverprozess blieb), eine gleichzeitig, Beats für die ersten 300 s.
- Text über libass (ASS-Untertitel) statt `drawtext`: der `ffmpeg-static`-Build 7.0.2 enthält kein `drawtext` (benötigt libharfbuzz), aber `ass`. Abweichung von der Vorgabe „drawtext“.
- Render in Teilstücken + concat (siehe oben) statt eines großen xfade-Graphen — wegen des gemessenen Speicherbedarfs.
- Bibliothek: Pexels API (Fotos + Videos), Stimmung/Nische → Suchbegriffe; ohne Schlüssel oder bei Pexels-Fehlern die statische Liste des Frontends.
- Warteschlange im selben Node-Prozess, 1 Job gleichzeitig (Eigentümer).
- Dateien bis Etappe 3 auf lokaler Platte in DATA_DIR, Speicherschicht austauschbar (Eigentümer).
- Assistent regelbasiert, ohne LLM (Eigentümer; Anbieter nicht gewählt).
- JSON-Dateien als Datenbank (atomisches Schreiben, im Speicher gehalten).
- Render-Kosten serverseitig aus dem gespeicherten Projekt berechnet; die vom Client gesendete Dauer wird ignoriert.
- Links auf Renders: HMAC-signiert, 7 Tage; Uploads: unsignierte, nicht erratbare UUID-Pfade.
- Frontend: Aus Mock- und Echtbetrieb resultierende Anpassungen siehe CHANGELOG 0.2.0.

- Längen- und Kostenlogik einmal in `server/src/shared/timeline.js` (JS + `.d.ts`); das Frontend importiert sie direkt (`src/lib/project.ts`, `src/config/pricing.ts`), damit Anzeige und Abrechnung nie auseinanderlaufen.
- Pexels-Suche: der eingegebene Text wird unverändert gesendet, mit `locale` = Oberflächensprache (`de-DE` / `en-US` / `ru-RU`). Die Pexels-API unterstützt laut Dokumentation mehrsprachige Suche über `locale`; ein eigenes Wörterbuch würde nur häufige Wörter abdecken und Phrasen verfälschen. Schnelle Vorschläge (Stimmung/Nische) senden feste englische Begriffe mit `en-US`.
- Ausrichtung der Bibliothek folgt dem Projektformat (9:16 → `portrait`, 16:9 → `landscape`, 1:1 → `square`), abschaltbar.
- Vor jedem Render wird das Projekt gespeichert (ausstehende Änderungen und laufende Speicherung abgewartet), weil das Backend den gespeicherten Stand rendert.
- Ursache des Fehlers „es werden andere Fotos hinzugefügt“ siehe CHANGELOG 0.3.0.

- transformers.js wird zur Laufzeit von jsDelivr geladen statt als npm-Paket (Eigentümer, 2026-09-27): das Paket zog `onnxruntime-node` (548 MB) mit, das der Browser nie nutzt. Gemessen: `npm ci` im Wurzelverzeichnis 58 s / `node_modules` 903 MB → 20 s / 143 MB; `dist/` 776 kB ohne ungenutzte WASM-Kopie (vorher 26,9 MB).

### Einschränkungen

- **DATA_DIR geht bei jedem Redeploy auf Render verloren** (kein persistenter Datenträger). Bis Etappe 3 (R2) akzeptiert: Nutzer, Projekte, Uploads und Renders verschwinden dann; ausgegebene JWT werden ungültig, falls `JWT_SECRET` neu generiert wird.
- Nur eine Serverinstanz möglich (JSON-Dateien + Warteschlange im Prozess).
- Das Frontend bietet 12 Schriften an, der Render kennt 4 (Inter, Montserrat, Bebas Neue, Playfair Display); alle anderen werden im Video als Inter gerendert — im Stil-Panel mit „*“ markiert. Bebas Neue hat keine kyrillischen Glyphen → kyrillische Zeilen in Inter.
- Qualität der mehrsprachigen Pexels-Suche (DE/RU) mit echtem Schlüssel: **UNKNOWN**. Ohne Schlüssel durchsucht die Suche nur Titel, Stimmung und Nische der statischen Liste.
- Panel-Breite verstellbar nur ab 1024 px Fensterbreite; der Player öffnet sich automatisch nur für Renders aus der aktuellen Sitzung.
- Bestehende Projekte behalten ihre Blockpositionen; die neue 3 × 2-Anordnung gibt es über „Anordnen“.
- Beat-Erkennung: langsame Tracks können als doppeltes Tempo erkannt werden (synthetischer 75-BPM-Track → 150 BPM). Das tatsächliche Tempo der SoundHelix-Bibliothekstracks ist **UNKNOWN**; gemessen: 132–148 BPM.
- Die Werte `bpm` und `duration` in der Bibliotheksliste (`src/lib/libraryData.ts`, `server/src/libraryData.js`) sind Platzhalter aus Etappe 1 und weichen teils von den Dateien ab (z. B. Track 1: 124 vs. gemessen 135 BPM; Track 6: 307 s vs. 279,6 s). `/api/audio/analyze` liefert die gemessenen Werte.
- Text wird auf Render nur mit den mitgelieferten Schriften über fontconfig/libass gerendert; ob fontconfig auf Render ohne Systemschriften sauber läuft: **UNKNOWN** (lokal geprüft).
- Abmelden macht den JWT nicht ungültig (zustandslos, 30 Tage gültig). „Passwort vergessen“ versendet nichts. Keine E-Mail-Bestätigung, kein Rate-Limiting.
- Checkout/Portal liefern 501; das Frontend zeigt dann eine allgemeine Fehlermeldung.
- Pexels-Namensnennung: Fotograf und „Pexels“ klein auf der Vorschau in der Bibliothek, nicht im fertigen Video; ob das den Pexels-Richtlinien genügt: **UNKNOWN**.
- Upload-Dateien sind ohne Anmeldung abrufbar, wenn man die URL kennt (UUID-Pfad).
- Lizenzen der statischen Bibliotheksinhalte für den Produktiveinsatz: **UNKNOWN**. Preise in `src/config/pricing.ts` sind Platzhalter.
- Maximale Videolänge 300 s; Timeout 20 min pro FFmpeg-Schritt.
- Parallaxe: zwei Ebenen (Vorder-/Hintergrund), keine echte 3D-Rekonstruktion; hinter dem Vordergrund bleibt ein weicher Schatten der Figur sichtbar, an Kanten eine leichte Unschärfe. Qualität hängt von der Tiefenkarte ab (z. B. Gegenlicht, Spiegelungen).
- Tiefe braucht das Browser-Modell: erster Download 27,3 MB + 5,6 (komprimiert; 26,9 entpackt) MB, Rechenzeit pro Foto auf schwachen Handys: **UNKNOWN** (gemessen nur im Desktop-Headless-Chrome). Bilder ohne CORS-Freigabe können nicht gelesen werden → Ken Burns.
- Tiefenkarten liegen wie alle Uploads in DATA_DIR und gehen beim Redeploy verloren. Beim nächsten Öffnen des Editors (Parallaxe an) prüft das Frontend die Karten und berechnet fehlende neu; ein Render dazwischen nutzt Ken Burns.
- Render-Zeit und Speicher auf Render (0,5 CPU, 512 MB): **UNKNOWN**; lokal gemessene Werte siehe Tabelle.
- Tiefe braucht im Browser Zugriff auf cdn.jsdelivr.net (transformers.js, ONNX-Runtime-WASM) und huggingface.co (Modell). Sind sie blockiert oder offline, erscheint der Hinweis im Visual-Block und die Fotos bekommen Ken Burns.

### Nächste Schritte

1. Auf Render: prüfen, ob `PEXELS_API_KEY` gesetzt ist, und die Pexels-Suche (DE/RU) mit echtem Schlüssel testen; Render-Zeiten und Speicher dort messen.
2. Etappe 3: Videos und Uploads in Cloudflare R2 (R2-Treiber für `server/src/storage`), Links, Verlauf; Datenbank statt JSON-Dateien (Wahl **UNKNOWN**).
3. Etappe 4: Polar (Credits/Abo, Webhooks), Checkout und Portal statt 501.
4. Parallaxe und Effekte auf Render messen (0,5 CPU, 512 MB).
5. Etappe 5: Integration mit Website-SDK (webstudio-sdk-muenchen.com) über API.
6. Offen: Schriftauswahl im Frontend auf die 4 Render-Schriften begrenzen oder weitere TTF ergänzen (Entscheidung Eigentümer); Bibliotheks-`bpm`/`duration` durch Messwerte ersetzen (Entscheidung Eigentümer).

---

<a id="english"></a>

## English

### Purpose

Factory Video is an engine for building videos from blocks: **Audio → Visual → Text → Style → Montage → Final video**. Goals: music video for a track (Suno etc.), business promo, Reels/Shorts. Formats: 9:16, 16:9, 1:1.
The LLM is only an orchestrator (block order, copy). Content comes from libraries and user uploads.

The repository contains the **frontend** (root) and, since 0.2.0, the **backend** (`server/`).

- Repository: https://github.com/IgorUspehov/-Factory-Video- (branch `main`)
- Frontend in production: https://factory-video.onrender.com
- Backend in production: https://factory-video-api.onrender.com (created by the owner; `/api/health` returns 200).

### Requirements

- Frontend: Node.js + npm; no minimum version defined (no `engines` field in the root `package.json`): **UNKNOWN**.
- Backend: Node.js ≥ 22.9 (`engines` in `server/package.json`, `server/.node-version` = 22). FFmpeg/FFprobe ship as npm packages; no system install needed.
- Built and checked locally with Node 22.23.2 / npm 10.9.8 on Linux x64.

### Stack

**Frontend** (`package.json`): react / react-dom ^18.3.1, react-router-dom ^6.30.6, @xyflow/react ^12.12.0, lucide-react ^1.48.0, vite ^5.4.21, @vitejs/plugin-react ^4.7.0, typescript ^5.9.3, tailwindcss ^3.4.19, postcss ^8.5.28, autoprefixer ^10.6.1.

**Backend** (`server/package.json`, plain JavaScript, ESM, no build step):

| Package | Version | Purpose |
|---|---|---|
| express | ^5.2.1 | HTTP API |
| multer | ^2.4.0 | file uploads |
| bcryptjs | ^3.0.3 | password hashes |
| jsonwebtoken | ^9.0.3 | JWT |
| cors | ^2.8.6 | CORS |
| ffmpeg-static | ^5.3.0 | FFmpeg 7.0.2 (binary) |
| ffprobe-static | ^3.1.0 | FFprobe (binary) |
| music-tempo | ^1.0.3 | tempo and beat detection |

### Architecture

#### Frontend

```
src/
  main.tsx, App.tsx   entry, routes (lazy), header/footer
  types.ts            Project, User, AudioTrack, MediaItem, RenderState …
  config/pricing.ts   prices (placeholders), renderCost()
  i18n/               de.ts, en.ts (Dict type), ru.ts, index.tsx
  lib/                api.ts (API client), mock.ts, cache.ts, auth.tsx, pwa.tsx, project.ts, …
  components/         Header, Footer, RenderPlayer, Waveform, …
  editor/             EditorContext, nodes/BlockNode, panels/*, AssistantPanel
  pages/              Landing, Auth, Start, Editor, Projects, Library, Export, Account, NotFound
```

- Routes: `/`, `/login`, `/register` public; `/start`, `/editor/:projectId`, `/projects`, `/library`, `/export/:projectId`, `/account` protected (guests → `/login` and back).
- API client `src/lib/api.ts`: base URL from `VITE_API_URL`, header `Authorization: Bearer <token>`. If `VITE_API_URL` is empty, on a network error or on HTTP 502/503/504 it switches to mocks for the session (`src/lib/mock.ts`, footer shows "Demo mode"). Projects are also cached in `localStorage`.
- i18n DE (default) / EN / RU, typed keys. PWA: manifest, icons, `public/sw.js` (registered in production builds only). Link preview: Open Graph / Twitter tags in `index.html`, image `public/og-image.jpg` (1200×675).
- localStorage keys: `fv_token`, `fv_lang`, `fv_projects`, `fv_uploads`, `fv_mock_users`, `fv_mock_jobs`, `fv_mock_history`.

#### Backend (`server/`)

```
server/
  src/index.js           start, graceful shutdown, re-queue of open render jobs
  src/app.js             Express routes (contract = frontend src/lib/api.ts)
  src/config.js          env, pricing (mirror of src/config/pricing.ts), limits
  src/db.js              JSON files in DATA_DIR/db (users, projects, uploads, jobs, analyses)
  src/auth.js            register/login (bcrypt, JWT 30 days), middleware
  src/storage/           storage layer: index.js (driver choice), local.js (local disk)
  src/media.js           ffprobe, PCM decoding, download of allow-listed remote files (cached)
  src/analyze.js         beat analysis (worker thread, one at a time)
  src/analyze-worker.js  music-tempo + peaks
  src/library.js         library: Pexels or static list
  src/libraryData.js     mirror of the frontend's src/lib/libraryData.ts
  src/assistant.js       rule-based assistant (DE/EN/RU)
  src/render/queue.js    in-process render queue, 1 job at a time
  src/render/pipeline.js FFmpeg pipeline
  src/render/ass.js      text and watermark as ASS subtitles
  fonts/                 Inter, Montserrat, Bebas Neue, Playfair Display (TTF, OFL, with licence texts)
  scripts/smoke.mjs      end-to-end smoke test
```

**Endpoints**

| Method and path | Response / behaviour |
|---|---|
| `GET /api/health` | 200 `{ ok, queue }` |
| `POST /api/auth/register` | 201 `{ token }`; 400 `invalid_email` / `weak_password`; 409 `exists` |
| `POST /api/auth/login` | `{ token }`; 401 `invalid_credentials` |
| `POST /api/auth/logout` | `{ ok: true }` (JWT is stateless; the client drops the token) |
| `POST /api/auth/forgot` | 202 (stub, no email sent) |
| `GET /api/me` | `{ id, email, plan, credits, renewsAt }`; new user: `free`, 10 credits |
| `POST /api/billing/checkout`, `GET /api/billing/portal` | 501 `billing_not_implemented` (stage 4) |
| `GET /api/billing/history` | the user's real render history |
| `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id` | CRUD bound to the user (other users' projects → 404) |
| `POST /api/upload/audio` | MP3/WAV/M4A, ≤ 20 MB, field `rightsConfirmed=true` required (else 400 `rights_not_confirmed`), checked with ffprobe |
| `POST /api/upload/media` | JPG/PNG/WEBP, MP4/MOV/WEBM/M4V, ≤ 200 MB, checked with ffprobe |
| `POST /api/upload/depth` | depth map (PNG, ≤ 8 MB, ≤ 2048 px) for parallax; only the user's own maps are used when rendering |
| `POST /api/audio/analyze` | `{ duration, bpm, beats[], peaks[] }` for an own upload or a library track; result cached |
| `GET /api/library/audio?mood=&niche=` | static track list |
| `GET /api/library/media?q=&kind=&orientation=&page=&lang=&mood=&niche=` | Pexels search (photos + videos, with `credit` = author) or static list; one page per call, empty list = no more pages; header `X-Library-Source` |
| `POST /api/render` | `{ jobId, cost }`; cost by `renderCost`; 402 `insufficient_credits`; 400 `empty_project` / `too_long` (> 300 s) |
| `GET /api/render/:jobId` | `{ status, progress, url, expiresAt, watermark }` |
| `GET /api/render/:jobId/link` | new signed link valid for 7 days |
| `POST /api/assistant` | `{ suggestion }`, rule-based, language from `lang` |
| `GET /files/uploads/…`, `GET /files/renders/…?exp=&sig=` | files; renders only with a valid HMAC signature (else 403) |

Error format: `{ error: <code>, message }` — the frontend client reads `error`.

**Render pipeline** (`server/src/render/pipeline.js`)
- Formats: 9:16 → 720×1280, 16:9 → 1280×720, 1:1 → 720×720; 30 fps; H.264 (libx264 `veryfast`, CRF 21) + AAC 160 kbit/s, `+faststart`.
- Duration from the timeline; with `beatSync` every cut is moved to the nearest beat (clip ≥ 0.5 s). Without clips: background colour, length = audio (max. 30 s), as in the frontend.
- Photos: `scale`+`crop`, with Ken Burns `zoompan` (alternating zoom in/out). Videos: `scale`+`crop`, looped if needed.
- Transitions: cut = direct, fade/zoom/slide = `xfade` (`fade`/`zoomin`/`slideleft`), duration ≤ 0.5 s.
- The video is rendered in pieces (clip bodies and transitions, max. 2 inputs each, text already burned in) and joined with the concat demuxer without re-encoding; then the audio is muxed. Memory therefore does not depend on the number of clips.
- Audio: `loudnorm` (I = −14 LUFS, TP = −1.5 dB), trimmed/padded to the video length, fade in/out per style. Without music: silent AAC track.
- Text: lines with start/end, colours from the style (text = fill, accent = shadow), 250 ms fades; position per mode (lyrics/titles bottom, slogan centre).
- Free: watermark "Factory Video" bottom right, inside the video.
- Progress from FFmpeg `-progress` → 0–95 % pieces, 95–99 % mux, 100 % done.

**Queue**: inside the server process, FIFO, 1 job at a time, 20 min timeout per FFmpeg call. Credits are deducted on start and refunded on failure. Open jobs are re-queued after a restart.

**Storage layer** (`server/src/storage`): interface `put(key, srcPath)`, `localPath(key)`, `remove(key)`, `publicUrl(key)`, `signedUrl(key, expiresAt)`, `verify(key, exp, sig)`. Currently `local.js` (DATA_DIR/files); for stage 3 an R2 driver with the same interface is plugged into `storage/index.js`.

**Remote files**: the server downloads library and Pexels files only from an allow-list of hosts (Unsplash, Pexels, SoundHelix, test-videos.co.uk, MDN, samplelib) and caches them in DATA_DIR/cache.

### Editor interface (since 0.3.0)

- **"What to do next"** bar above the canvas: ① Add music → ② Add photos or videos → ③ Build the video, with check marks; the current step is highlighted and a click opens the matching block. Once 1 and 2 are done a large "Build video" button appears; while rendering the bar shows the progress in large type, afterwards "Watch video".
- Larger blocks (title 14 px, description 13 px) with one plain-language line under the title; default layout 3 × 2, "Arrange" lays out in 3 columns (below 768 px: 2).
- Every button has a label and a tooltip (`title`); tricky options have a grey explanation below. Optional settings live in an **"Advanced"** section: the whole style (except "Cut on the beat") and montage fine-tuning; "Brand" in the sidebar sits under "Advanced".
- Properties panel: default width 33 % of the window (min. 380 px, max. 60 %), resizable by dragging its left edge, width stored in `localStorage` (`fv_panel_width`); base font 15 px, buttons ≥ 44 px. Mobile: bottom sheet at 85 % height.
- When a render finishes, a large player opens automatically (download MP4, copy link, export page, close) — only for renders started in the current session.
- Media library (picker in the Visual block and the `/library` page): search field, photos/videos filter, orientation matching the project format (9:16 → portrait), loading more on scroll, mood/niche as quick suggestions, author (Pexels) in small print on the preview, strip of selected items.

**Video length** (`lengthMode` in the project, logic in `server/src/shared/timeline.js`, shared by frontend and backend):
- `track` — as long as the track (default for "music video"); `15` / `30` / `60` — fixed length; `timeline` — sum of the montage lengths (default for promo and reels).
- With `track` and fixed lengths the clips are spread evenly over the length; each shot lasts about the average montage clip length, too few clips repeat in order; with "Cut on the beat" the cuts sit on the nearest beat.
- Over 300 s: notice in the editor with "Cut to 5:00" (`lengthMode = 300`); otherwise the backend answers 400 `too_long`.
- Cost = `renderCost(plannedDuration(project))` — the same function in the frontend (display) and the backend (billing).

### 2.5D parallax and beat effects (since 0.4.0)

**Depth maps in the browser.** Switch "Depth (2.5D)" at the top of the Visual block. When switched on, the browser loads transformers.js once (at runtime from the jsDelivr CDN, pinned version 4.3.0, `dist/transformers.min.js`; not an npm dependency) and the open model **Depth Anything V2 Small** (`onnx-community/depth-anything-v2-small`, ONNX, 8-bit quantized, file `model_quantized.onnx` 27.3 MB, licence **Apache-2.0** according to the model card) from Hugging Face plus ONNX Runtime Web (WASM) from the jsDelivr CDN; both end up in the browser cache. Each photo is scaled to at most 1280 px (long side), depth is computed (bright = near), a foreground threshold is chosen with Otsu's method (kept between the 40th and 85th percentile) and the map is sent as a greyscale PNG to `POST /api/upload/depth`; the media item gets `depth: { id, url, threshold }`. Progress "Preparing depth: 3 of 15", badge on finished photos. Videos are skipped.

**Parallax in the render** (`parallaxSource` in `server/src/render/pipeline.js`). Chosen method: **two layers with a soft depth mask** instead of `displace`. `displace` would need a time-dependent displacement map per frame (`geq` per pixel and frame) — far too slow on 0.5 CPU. Instead, **once per photo** two layers are prepared as PNG (`prepareParallaxLayers`, ≈ 0.5 s, ≈ 150 MB): the slightly enlarged foreground with a soft alpha mask from the depth map (threshold + blur), and the background in which the foreground area is filled from its surroundings (normalised convolution: blur(image × background weight) ÷ blur(background weight)) — so the edge uncovered by the movement shows background colours instead of a double image. Per piece both layers are decoded once and repeated with `loop`; per frame only a crop of the background (small drift) and an overlay of the foreground (≈ 3× larger drift) run — no per-frame scaling. The direction changes per shot. Duration, transitions and beat-synced cuts are unchanged (same piece logic). Without a depth map (model not loaded, old browser, foreign or lost file) → Ken Burns without errors; video clips → never parallax.

**Beat effects** (`beatFxChain`, presets in `server/src/shared/effects.js`, shared with the frontend). Presets None / Soft / Medium / Energetic, default by mood (calm → Soft, energetic → Energetic, premium → Soft, corporate → None). Effects on the analysed beats: zoom punch and shake (`zoompan`), flash (`eq`), colour pulse (`hue`), short RGB glitch (`rgbashift` enabled only around the beat). Soft = light punch + colour pulse on every 2nd beat; Medium = punch on every beat, slight shake, flash on every 2nd beat; Energetic = stronger, plus glitch on every 4th beat. Each piece only contains the beats that touch it (short expressions). No track or beats → no effects. The effects are in the MP4; text and watermark stay still (burned in afterwards). Picker next to the video length (Montage and Output panels) and in the Style panel; short label in the Style block.

### Environment variables (backend, `server/.env.example`)

| Variable | Meaning |
|---|---|
| `PORT` | HTTP port (default 8080) |
| `DATA_DIR` | data directory: JSON DB, files, cache (default `./data`) |
| `JWT_SECRET` | key for JWTs and link signatures; required in production |
| `FRONTEND_ORIGIN` | allowed CORS origin(s), comma-separated |
| `PEXELS_API_KEY` | optional; without it `/api/library/media` returns the static list |
| `PUBLIC_URL` | public base URL for file links; if missing, Render's `RENDER_EXTERNAL_URL` is used |

Frontend: `VITE_API_URL` = backend URL (inlined at build time).

### Run locally

```bash
# frontend
npm install
npm run dev                      # http://localhost:5173 (without VITE_API_URL: mocks)

# backend
cd server
npm install
cp .env.example .env             # adjust values
npm start                        # http://localhost:8080
npm run smoke                    # end-to-end test with its own server, a temporary DATA_DIR and a Pexels stand-in
node scripts/fake-pexels.mjs     # Pexels stand-in on :18999 (PEXELS_API_BASE=http://127.0.0.1:18999)

# frontend against the local backend
VITE_API_URL=http://localhost:8080 npm run dev
```

### Deployment

- **Frontend**: Render Static Site, project "My project", https://factory-video.onrender.com; build `npm ci && npm run build`, publish `./dist`, rewrite `/*` → `/index.html`, auto-deploy on push to `main`.
- **Backend**: second service `factory-video-api` in `render.yaml` (type web, runtime node, rootDir `server`, build `npm ci`, start `npm start`, health check `/api/health`; env: `JWT_SECRET` generated, `PEXELS_API_KEY` and `PUBLIC_URL` set manually, `FRONTEND_ORIGIN=https://factory-video.onrender.com`, `DATA_DIR=./data`). The service runs at https://factory-video-api.onrender.com; whether `PEXELS_API_KEY` is set there: **UNKNOWN**.
- Afterwards set `VITE_API_URL` on the static site to the API service URL and redeploy; otherwise the frontend keeps running on mocks.
- Instance type / plan of the API service: **UNKNOWN**.

### Current state

- 0.4.0 (2026-09-27): 2.5D parallax (depth model in the browser) and beat effects. Verified locally: `npx tsc --noEmit`, `npm run build`; `npm run smoke` (165/165; new: depth map upload, render with depth maps, all presets, fallback without depth map, foreign depth map, measurements 30 s / 3 min); headless Chrome with the **real model** in the browser (11/11): 3 photos → depth 3 of 3, preset "Energetic", 1:50 track → MP4 = track, no JS errors. Frames from the MP4: `docs/screenshots/0.4.0/`. Not verified on Render: **UNKNOWN**.
- 0.3.0 (2026-09-27): editor rework after the owner's first test in production. Verified locally: `npx tsc --noEmit`, `npm run build`; `npm run smoke` (99/99); headless Chrome against the local backend with a Pexels stand-in (`server/scripts/fake-pexels.mjs`): 21/21 — incl. music video with a 1:50 track → MP4 of 110.03 s = track, 3 specifically picked photos end up exactly in the project (even when an older, slower search answers afterwards), search "singer stage" returns results, loading more on scroll, the player opens by itself after rendering, panel 475 px (33 % of 1440) and resizable, mobile bottom sheet 85 %, no JS errors. Screenshots: `docs/screenshots/0.3.0/` (library shown with the Pexels stand-in, hence "Fixture Photographer"). Not verified against the real Pexels API (no key available): **UNKNOWN**.
- Stage 0 ✔, stage 1 ✔, stage 2 (backend MVP) ✔; both services run on Render (frontend and API).
- Verified (locally, 2026-09-26):
  - `npx tsc --noEmit` and `npm run build` (frontend) without errors.
  - `npm run smoke`: 80/80 checks passed — incl. register/login, audio upload with and without `rightsConfirmed`, analysis (synthetic 120 BPM track → 120 BPM), photo and video upload, project CRUD bound to the user, renders in 9:16, 16:9, 1:1 with fade/slide/cut/zoom (resolution, H.264 + AAC, duration = timeline ± 0.1 s, watermark), link signature and refresh, 402 on insufficient credits, billing 501, library, assistant.
  - Headless Chrome: real frontend against the real backend (sign-up → wizard → library track analysed → 3 photos → render → export page) without JS or CORS errors and without falling back to mocks.

### Measurements (local: 4× Intel N100, 8 GB RAM)

| Measurement | Result |
|---|---|
| 30 s video, 9:16, 10 photos, Ken Burns, fade, audio, text, watermark | 33 416 ms render time, peak RSS server + FFmpeg 367 MB |
| 30 s video, 9:16, 60 clips of 0.5 s, fade | 58 954 ms, peak 332 MB |
| Beat analysis of a SoundHelix track (6:12 min) | ≈ 2.4 s; child process up to ≈ 330 MB, released afterwards; server process stays at ≈ 58 MB (since 0.4.0) |
| 30 s video, 9:16, 10 photos, **parallax + "Energetic"**, cut on the beat (0.4.0) | 18 661 ms, peak RSS server + FFmpeg 279 MB |
| 3 min video, 9:16, 10 photos, **parallax + "Energetic"**, cut on the beat (0.4.0) | 98 762 ms, peak 286 MB |
| Depth map in the browser (headless Chrome, WASM, 1 photo ≤ 1280 px) | ≈ 9,800–10,800 ms per photo (after the model is loaded) |
| Download when "Depth" is first switched on | model 27.3 MB + ONNX Runtime (WASM) 5.6 (compressed; 26.9 unpacked) MB + transformers.js 166 kB (Brotli, jsDelivr); afterwards from the browser cache |
| Earlier pipeline variant (all clips in one xfade graph) | 30 s / 10 clips: 1119 MB; 60 clips: ≈ 3.9 GB (FFmpeg alone) — therefore dropped |

Render times and memory on Render: **UNKNOWN** (depend on the instance type).

### Decisions made

- FFmpeg natively via `ffmpeg-static` + `ffprobe-static`, no Docker (owner).
- **Beat detection: music-tempo** — pure JavaScript without native dependencies or the Web Audio API (runs in Node), MIT licence, returns the tempo **and** beat timestamps (beat tracking after Dixon's BeatRoot), which beat-synced cuts need. Other JS libraries (e.g. web-audio-beat-detector, realtime-bpm-analyzer) require the browser's Web Audio API or return BPM only. Parameters (22.05 kHz, hop 221, FFT 1024) chosen on synthetic 75–160 BPM tracks; tempos > 160 BPM are halved (the beat phase with more energy is kept). Analysis in a short-lived child process (since 0.4.0; previously a worker thread whose memory stayed in the server process), one at a time, beats for the first 300 s.
- Text via libass (ASS subtitles) instead of `drawtext`: the `ffmpeg-static` 7.0.2 build has no `drawtext` (it needs libharfbuzz) but has `ass`. Deviation from the "drawtext" requirement.
- Rendering in pieces + concat (see above) instead of one large xfade graph — because of the measured memory use.
- Library: Pexels API (photos + videos), mood/niche → search terms; without a key or on Pexels errors the frontend's static list.
- Queue inside the same Node process, 1 job at a time (owner).
- Files on local disk in DATA_DIR until stage 3, replaceable storage layer (owner).
- Rule-based assistant, no LLM (owner; no provider chosen).
- JSON files as the database (atomic writes, kept in memory).
- Render cost computed on the server from the stored project; the duration sent by the client is ignored.
- Links to renders: HMAC-signed, 7 days; uploads: unsigned, unguessable UUID paths.
- Frontend adjustments resulting from mock vs. real operation: see CHANGELOG 0.2.0.

- Length and cost logic lives once in `server/src/shared/timeline.js` (JS + `.d.ts`); the frontend imports it directly (`src/lib/project.ts`, `src/config/pricing.ts`) so display and billing can never diverge.
- Pexels search: the typed text is sent unchanged, with `locale` = UI language (`de-DE` / `en-US` / `ru-RU`). According to its documentation the Pexels API supports multilingual search via `locale`; an own dictionary would only cover common words and distort phrases. Quick suggestions (mood/niche) send fixed English terms with `en-US`.
- Library orientation follows the project format (9:16 → `portrait`, 16:9 → `landscape`, 1:1 → `square`), can be switched off.
- Before every render the project is saved (pending changes and a running save are awaited), because the backend renders the saved state.
- Cause of the "different photos get added" bug: see CHANGELOG 0.3.0.

- transformers.js is loaded at runtime from jsDelivr instead of as an npm package (owner, 2026-09-27): the package pulled in `onnxruntime-node` (548 MB), which the browser never uses. Measured: root `npm ci` 58 s / `node_modules` 903 MB → 20 s / 143 MB; `dist/` 776 kB without the unused WASM copy (previously 26.9 MB).

### Limitations

- **DATA_DIR is lost on every redeploy on Render** (no persistent disk). Accepted until stage 3 (R2): users, projects, uploads and renders disappear; issued JWTs become invalid if `JWT_SECRET` is regenerated.
- Only one server instance is possible (JSON files + in-process queue).
- The frontend offers 12 fonts, the renderer knows 4 (Inter, Montserrat, Bebas Neue, Playfair Display); all others are rendered as Inter in the video — marked with "*" in the Style panel. Bebas Neue has no Cyrillic glyphs → Cyrillic lines use Inter.
- Quality of multilingual Pexels search (DE/RU) with a real key: **UNKNOWN**. Without a key the search only matches title, mood and niche of the static list.
- The panel width can be dragged only from 1024 px window width; the player opens automatically only for renders from the current session.
- Existing projects keep their block positions; the new 3 × 2 layout is available via "Arrange".
- Beat detection: slow tracks may be detected at double tempo (synthetic 75 BPM track → 150 BPM). The true tempo of the SoundHelix library tracks is **UNKNOWN**; measured: 132–148 BPM.
- The `bpm` and `duration` values in the library list (`src/lib/libraryData.ts`, `server/src/libraryData.js`) are stage-1 placeholders and partly differ from the files (e.g. track 1: 124 vs. measured 135 BPM; track 6: 307 s vs. 279.6 s). `/api/audio/analyze` returns the measured values.
- On Render, text is rendered only with the bundled fonts via fontconfig/libass; whether fontconfig works cleanly on Render without system fonts: **UNKNOWN** (verified locally).
- Logout does not invalidate the JWT (stateless, valid for 30 days). "Forgot password" sends nothing. No email verification, no rate limiting.
- Checkout/portal return 501; the frontend then shows a generic error message.
- Pexels attribution: photographer and "Pexels" in small print on the library preview, not in the finished video; whether that satisfies the Pexels guidelines: **UNKNOWN**.
- Uploaded files can be fetched without login if the URL is known (UUID path).
- Licences of the static library content for production use: **UNKNOWN**. Prices in `src/config/pricing.ts` are placeholders.
- Maximum video length 300 s; 20 min timeout per FFmpeg step.
- Parallax: two layers (foreground/background), no real 3D reconstruction; a soft shadow of the figure remains visible behind the foreground, with a slight blur at the edges. Quality depends on the depth map (e.g. backlight, reflections).
- Depth needs the browser model: first download 27.3 MB + 5.6 (compressed; 26.9 unpacked) MB, computation time per photo on weak phones: **UNKNOWN** (measured only in desktop headless Chrome). Images without CORS permission cannot be read → Ken Burns.
- Depth maps live in DATA_DIR like all uploads and are lost on redeploy. The next time the editor is opened (parallax on) the frontend checks the maps and recomputes missing ones; a render in between uses Ken Burns.
- Render time and memory on Render (0.5 CPU, 512 MB): **UNKNOWN**; locally measured values see the table.
- Depth needs browser access to cdn.jsdelivr.net (transformers.js, ONNX Runtime WASM) and huggingface.co (model). If they are blocked or offline, the Visual block shows a notice and photos get Ken Burns.

### Next steps

1. On Render: check whether `PEXELS_API_KEY` is set and test the Pexels search (DE/RU) with a real key; measure render time and memory there.
2. Stage 3: videos and uploads in Cloudflare R2 (R2 driver for `server/src/storage`), links, history; a database instead of JSON files (choice **UNKNOWN**).
3. Stage 4: Polar (credits/subscription, webhooks), checkout and portal instead of 501.
4. Measure parallax and effects on Render (0.5 CPU, 512 MB).
5. Stage 5: integration with Website-SDK (webstudio-sdk-muenchen.com) via API.
6. Open: limit the frontend font choice to the 4 render fonts or add more TTFs (owner's decision); replace the library `bpm`/`duration` with measured values (owner's decision).

---

<a id="русский"></a>

## Русский

### Назначение

Factory Video — движок сборки видеороликов из блоков: **Аудио → Визуал → Текст → Стиль → Монтаж → Готовый ролик**. Цели: клип под трек (Suno и др.), промо для бизнеса, Reels/Shorts. Форматы: 9:16, 16:9, 1:1.
LLM — только оркестратор (порядок блоков, тексты). Контент — из библиотек и загрузок пользователя.

В репозитории **фронтенд** (корень) и, начиная с 0.2.0, **бэкенд** (`server/`).

- Репозиторий: https://github.com/IgorUspehov/-Factory-Video- (ветка `main`)
- Фронтенд в продакшене: https://factory-video.onrender.com
- Бэкенд в продакшене: https://factory-video-api.onrender.com (создан владельцем; `/api/health` отвечает 200).

### Требования

- Фронтенд: Node.js + npm; минимальная версия не задана (в корневом `package.json` нет `engines`): **UNKNOWN**.
- Бэкенд: Node.js ≥ 22.9 (`engines` в `server/package.json`, `server/.node-version` = 22). FFmpeg/FFprobe ставятся npm-пакетами, системная установка не нужна.
- Локально собрано и проверено на Node 22.23.2 / npm 10.9.8, Linux x64.

### Стек

**Фронтенд** (`package.json`): react / react-dom ^18.3.1, react-router-dom ^6.30.6, @xyflow/react ^12.12.0, lucide-react ^1.48.0, vite ^5.4.21, @vitejs/plugin-react ^4.7.0, typescript ^5.9.3, tailwindcss ^3.4.19, postcss ^8.5.28, autoprefixer ^10.6.1.

**Бэкенд** (`server/package.json`, чистый JavaScript, ESM, без сборки):

| Пакет | Версия | Назначение |
|---|---|---|
| express | ^5.2.1 | HTTP API |
| multer | ^2.4.0 | загрузка файлов |
| bcryptjs | ^3.0.3 | хэши паролей |
| jsonwebtoken | ^9.0.3 | JWT |
| cors | ^2.8.6 | CORS |
| ffmpeg-static | ^5.3.0 | FFmpeg 7.0.2 (бинарник) |
| ffprobe-static | ^3.1.0 | FFprobe (бинарник) |
| music-tempo | ^1.0.3 | определение темпа и битов |

### Архитектура

#### Фронтенд

```
src/
  main.tsx, App.tsx   вход, маршруты (lazy), шапка/футер
  types.ts            Project, User, AudioTrack, MediaItem, RenderState …
  config/pricing.ts   цены (плейсхолдеры), renderCost()
  i18n/               de.ts, en.ts (тип Dict), ru.ts, index.tsx
  lib/                api.ts (API-клиент), mock.ts, cache.ts, auth.tsx, pwa.tsx, project.ts, …
  components/         Header, Footer, RenderPlayer, Waveform, …
  editor/             EditorContext, nodes/BlockNode, panels/*, AssistantPanel
  pages/              Landing, Auth, Start, Editor, Projects, Library, Export, Account, NotFound
```

- Маршруты: `/`, `/login`, `/register` открытые; `/start`, `/editor/:projectId`, `/projects`, `/library`, `/export/:projectId`, `/account` защищённые (гость → `/login` и обратно).
- API-клиент `src/lib/api.ts`: базовый URL из `VITE_API_URL`, заголовок `Authorization: Bearer <token>`. Если `VITE_API_URL` пуст, при сетевой ошибке или HTTP 502/503/504 — переключение на моки до конца сессии (`src/lib/mock.ts`, в футере «Демо-режим»). Проекты дополнительно кэшируются в `localStorage`.
- i18n DE (по умолчанию) / EN / RU, типизированные ключи. PWA: манифест, иконки, `public/sw.js` (регистрируется только в production-сборке). Превью ссылки: теги Open Graph / Twitter в `index.html`, картинка `public/og-image.jpg` (1200×675).
- Ключи localStorage: `fv_token`, `fv_lang`, `fv_projects`, `fv_uploads`, `fv_mock_users`, `fv_mock_jobs`, `fv_mock_history`.

#### Бэкенд (`server/`)

```
server/
  src/index.js           запуск, корректное завершение, возврат незавершённых задач рендера в очередь
  src/app.js             маршруты Express (контракт = src/lib/api.ts фронтенда)
  src/config.js          env, pricing (копия src/config/pricing.ts), лимиты
  src/db.js              JSON-файлы в DATA_DIR/db (users, projects, uploads, jobs, analyses)
  src/auth.js            регистрация/вход (bcrypt, JWT на 30 дней), middleware
  src/storage/           слой хранения: index.js (выбор драйвера), local.js (локальный диск)
  src/media.js           ffprobe, декодирование PCM, загрузка разрешённых внешних файлов (кэш)
  src/analyze.js         анализ битов (worker-поток, по одному)
  src/analyze-worker.js  music-tempo + пики
  src/library.js         библиотека: Pexels или статический список
  src/libraryData.js     копия src/lib/libraryData.ts фронтенда
  src/assistant.js       помощник на правилах (DE/EN/RU)
  src/render/queue.js    очередь рендера в процессе, 1 задача одновременно
  src/render/pipeline.js конвейер FFmpeg
  src/render/ass.js      текст и водяной знак как субтитры ASS
  fonts/                 Inter, Montserrat, Bebas Neue, Playfair Display (TTF, OFL, с текстами лицензий)
  scripts/smoke.mjs      сквозной smoke-тест
```

**Эндпоинты**

| Метод и путь | Ответ / поведение |
|---|---|
| `GET /api/health` | 200 `{ ok, queue }` |
| `POST /api/auth/register` | 201 `{ token }`; 400 `invalid_email` / `weak_password`; 409 `exists` |
| `POST /api/auth/login` | `{ token }`; 401 `invalid_credentials` |
| `POST /api/auth/logout` | `{ ok: true }` (JWT без состояния, клиент удаляет токен) |
| `POST /api/auth/forgot` | 202 (заглушка, письма не отправляются) |
| `GET /api/me` | `{ id, email, plan, credits, renewsAt }`; новый пользователь: `free`, 10 кредитов |
| `POST /api/billing/checkout`, `GET /api/billing/portal` | 501 `billing_not_implemented` (этап 4) |
| `GET /api/billing/history` | реальная история рендеров пользователя |
| `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id` | CRUD с привязкой к пользователю (чужие проекты → 404) |
| `POST /api/upload/audio` | MP3/WAV/M4A, ≤ 20 МБ, поле `rightsConfirmed=true` обязательно (иначе 400 `rights_not_confirmed`), проверка ffprobe |
| `POST /api/upload/media` | JPG/PNG/WEBP, MP4/MOV/WEBM/M4V, ≤ 200 МБ, проверка ffprobe |
| `POST /api/upload/depth` | карта глубины (PNG, ≤ 8 МБ, ≤ 2048 px) для параллакса; при рендере используются только свои карты |
| `POST /api/audio/analyze` | `{ duration, bpm, beats[], peaks[] }` для своей загрузки или трека библиотеки; результат кэшируется |
| `GET /api/library/audio?mood=&niche=` | статический список треков |
| `GET /api/library/media?q=&kind=&orientation=&page=&lang=&mood=&niche=` | поиск Pexels (фото + видео, с `credit` = автор) или статический список; одна страница за вызов, пустой список = страниц больше нет; заголовок `X-Library-Source` |
| `POST /api/render` | `{ jobId, cost }`; стоимость по `renderCost`; 402 `insufficient_credits`; 400 `empty_project` / `too_long` (> 300 с) |
| `GET /api/render/:jobId` | `{ status, progress, url, expiresAt, watermark }` |
| `GET /api/render/:jobId/link` | новая подписанная ссылка на 7 дней |
| `POST /api/assistant` | `{ suggestion }`, на правилах, язык из `lang` |
| `GET /files/uploads/…`, `GET /files/renders/…?exp=&sig=` | файлы; рендеры только с действующей HMAC-подписью (иначе 403) |

Формат ошибок: `{ error: <код>, message }` — клиент фронтенда читает `error`.

**Конвейер рендера** (`server/src/render/pipeline.js`)
- Форматы: 9:16 → 720×1280, 16:9 → 1280×720, 1:1 → 720×720; 30 fps; H.264 (libx264 `veryfast`, CRF 21) + AAC 160 кбит/с, `+faststart`.
- Длительность — из таймлайна; при `beatSync` каждая склейка сдвигается на ближайший бит (клип ≥ 0,5 с). Без клипов — фон цвета стиля, длина = аудио (макс. 30 с), как во фронтенде.
- Фото: `scale`+`crop`, при Ken Burns — `zoompan` (попеременно приближение/отдаление). Видео: `scale`+`crop`, при необходимости зацикливание.
- Переходы: cut — прямая склейка, fade/zoom/slide — `xfade` (`fade`/`zoomin`/`slideleft`), длительность ≤ 0,5 с.
- Видео рендерится частями (тела клипов и переходы, в каждой части не больше 2 входов, текст уже вшит) и склеивается concat-демультиплексором без перекодирования; затем добавляется звук. Поэтому память не зависит от числа клипов.
- Аудио: `loudnorm` (I = −14 LUFS, TP = −1,5 дБ), обрезка/дополнение до длины видео, fade in/out по стилю. Без музыки — беззвучная дорожка AAC.
- Текст: строки с началом/концом, цвета из стиля (текст — заливка, акцент — тень), появление/исчезание 250 мс; позиция по режиму (текст песни/титры — внизу, слоган — по центру).
- Free: водяной знак «Factory Video» внизу справа — в самом видео.
- Прогресс из `-progress` FFmpeg → 0–95 % части, 95–99 % сборка, 100 % готово.

**Очередь**: внутри процесса сервера, FIFO, 1 задача одновременно, таймаут 20 мин на вызов FFmpeg. Кредиты списываются при запуске и возвращаются при ошибке. Незавершённые задачи после перезапуска снова ставятся в очередь.

**Слой хранения** (`server/src/storage`): интерфейс `put(key, srcPath)`, `localPath(key)`, `remove(key)`, `publicUrl(key)`, `signedUrl(key, expiresAt)`, `verify(key, exp, sig)`. Сейчас `local.js` (DATA_DIR/files); на этапе 3 в `storage/index.js` подключается драйвер R2 с тем же интерфейсом.

**Внешние файлы**: сервер скачивает файлы библиотеки и Pexels только с разрешённых хостов (Unsplash, Pexels, SoundHelix, test-videos.co.uk, MDN, samplelib) и кэширует их в DATA_DIR/cache.

### Интерфейс редактора (с 0.3.0)

- Полоса **«Что делать дальше»** над холстом: ① Добавь музыку → ② Добавь фото или видео → ③ Собери ролик, с галочками; текущий шаг подсвечен, клик открывает нужный блок. Когда шаги 1 и 2 выполнены, появляется большая кнопка «Собрать ролик»; во время рендера полоса крупно показывает прогресс, после — «Смотреть ролик».
- Блоки крупнее (заголовок 14 px, описание 13 px) с одной строкой простым языком под заголовком; раскладка по умолчанию 3 × 2, «Упорядочить» раскладывает в 3 колонки (меньше 768 px — в 2).
- У каждой кнопки есть подпись и подсказка (`title`); под сложными опциями — серое пояснение. Необязательные настройки — в разделе **«Дополнительно»**: весь «Стиль» (кроме «Склейки под бит») и тонкая настройка «Монтажа»; «Бренд» в боковом меню спрятан под «Дополнительно».
- Панель свойств: ширина по умолчанию 33 % окна (мин. 380 px, макс. 60 %), левый край тянется мышью, ширина хранится в `localStorage` (`fv_panel_width`); базовый шрифт 15 px, кнопки ≥ 44 px. На мобильном — нижняя шторка на 85 % высоты.
- Когда рендер готов, автоматически открывается крупный плеер (скачать MP4, скопировать ссылку, страница экспорта, закрыть) — только для рендеров, запущенных в текущей сессии.
- Медиатека (выбор в блоке «Визуал» и страница `/library`): поле поиска, фильтр «Фото / Видео», ориентация под формат проекта (9:16 → вертикальные), подгрузка при прокрутке, настроение/ниша как быстрые подсказки, автор (Pexels) мелким текстом на превью, полоса выбранных элементов.

**Длина ролика** (`lengthMode` в проекте, логика в `server/src/shared/timeline.js`, общая для фронтенда и бэкенда):
- `track` — длина трека (по умолчанию для «Клипа под трек»); `15` / `30` / `60` — фиксированная длина; `timeline` — сумма длительностей монтажа (по умолчанию для промо и Reels).
- При `track` и фиксированной длине кадры распределяются равномерно; каждый кадр держится примерно среднюю длительность из монтажа, если кадров мало — они повторяются по кругу; при «Склейке под бит» склейки попадают на ближайший бит.
- Больше 300 с: предупреждение в редакторе с кнопкой «Обрезать до 5:00» (`lengthMode = 300`); иначе бэкенд отвечает 400 `too_long`.
- Стоимость = `renderCost(plannedDuration(project))` — одна и та же функция во фронтенде (показ) и бэкенде (списание).

### 2.5D-параллакс и эффекты под бит (с 0.4.0)

**Карты глубины в браузере.** Переключатель «Объём (2.5D)» наверху блока «Визуал». При включении браузер один раз загружает transformers.js (во время работы с CDN jsDelivr, фиксированная версия 4.3.0, `dist/transformers.min.js`; не npm-зависимость) и открытую модель **Depth Anything V2 Small** (`onnx-community/depth-anything-v2-small`, ONNX, 8-битная квантизация, файл `model_quantized.onnx` 27,3 МБ, лицензия **Apache-2.0** по карточке модели) с Hugging Face, а также ONNX Runtime Web (WASM) с CDN jsDelivr; всё кэшируется браузером. Каждое фото уменьшается до 1280 px по длинной стороне, считается глубина (светлое = близко), порог переднего плана выбирается методом Оцу (в пределах 40–85-го перцентиля), карта отправляется PNG в оттенках серого на `POST /api/upload/depth`; медиа-элемент получает `depth: { id, url, threshold }`. Прогресс «Готовим объём: 3 из 15», значок на готовых фото. Видео пропускаются.

**Параллакс при рендере** (`parallaxSource` в `server/src/render/pipeline.js`). Выбран метод **двух слоёв с мягкой маской глубины**, а не `displace`. `displace` требует на каждый кадр свою карту смещения (`geq` на каждый пиксель каждого кадра) — на 0,5 CPU слишком медленно. Вместо этого **один раз на фото** готовятся два слоя в PNG (`prepareParallaxLayers`, ≈ 0,5 с, ≈ 150 МБ): слегка увеличенный передний план с мягкой альфа-маской из карты глубины (порог + размытие) и фон, в котором область переднего плана заполнена из окружения (нормализованная свёртка: размытие(изображение × вес фона) ÷ размытие(вес фона)), — поэтому открывающийся при сдвиге край показывает цвета фона, а не двойное изображение. В каждой части оба слоя декодируются один раз и повторяются через `loop`; на каждом кадре — только обрезка фона (малый дрейф) и наложение переднего плана (дрейф ≈ в 3 раза больше), без масштабирования на каждом кадре. Направление меняется от кадра к кадру. Длительность, переходы и склейки под бит не меняются (та же логика частей). Нет карты глубины (модель не загрузилась, старый браузер, чужой или потерянный файл) → Ken Burns без ошибок; видео-клипы → параллакс никогда.

**Эффекты под бит** (`beatFxChain`, пресеты в `server/src/shared/effects.js`, общие с фронтендом). Пресеты Нет / Мягко / Средне / Энергично, по умолчанию по настроению (спокойное → Мягко, энергичное → Энергично, премиум → Мягко, корпоративное → Нет). Эффекты на битах из анализа: «удар» приближения и тряска (`zoompan`), вспышка (`eq`), цветовая пульсация (`hue`), короткий RGB-глитч (`rgbashift` включается только около бита). Мягко — лёгкий удар и пульсация на каждой 2-й доле; Средне — удар на каждой доле, лёгкая тряска, вспышка на каждой 2-й; Энергично — сильнее и глитч на каждой 4-й доле. В каждую часть попадают только касающиеся её биты (короткие выражения). Нет трека или битов → нет эффектов. Эффекты вшиты в MP4; текст и водяной знак не дрожат (накладываются после). Выбор — рядом с длиной ролика (панели «Монтаж» и «Готовый ролик») и в панели «Стиль»; кратко — в сводке блока «Стиль».

### Переменные окружения (бэкенд, `server/.env.example`)

| Переменная | Значение |
|---|---|
| `PORT` | HTTP-порт (по умолчанию 8080) |
| `DATA_DIR` | каталог данных: JSON-БД, файлы, кэш (по умолчанию `./data`) |
| `JWT_SECRET` | ключ для JWT и подписи ссылок; в продакшене обязателен |
| `FRONTEND_ORIGIN` | разрешённые CORS-источники через запятую |
| `PEXELS_API_KEY` | необязательно; без ключа `/api/library/media` отдаёт статический список |
| `PUBLIC_URL` | публичный базовый URL для ссылок на файлы; если не задан — используется `RENDER_EXTERNAL_URL` от Render |

Фронтенд: `VITE_API_URL` = URL бэкенда (вшивается при сборке).

### Запуск локально

```bash
# фронтенд
npm install
npm run dev                      # http://localhost:5173 (без VITE_API_URL — моки)

# бэкенд
cd server
npm install
cp .env.example .env             # заполнить значения
npm start                        # http://localhost:8080
npm run smoke                    # сквозной тест со своим сервером, временным DATA_DIR и имитацией Pexels
node scripts/fake-pexels.mjs     # имитация Pexels на :18999 (PEXELS_API_BASE=http://127.0.0.1:18999)

# фронтенд против локального бэкенда
VITE_API_URL=http://localhost:8080 npm run dev
```

### Деплой

- **Фронтенд**: Render Static Site, проект «My project», https://factory-video.onrender.com; сборка `npm ci && npm run build`, публикация `./dist`, Rewrite `/*` → `/index.html`, автодеплой при push в `main`.
- **Бэкенд**: второй сервис `factory-video-api` в `render.yaml` (type web, runtime node, rootDir `server`, сборка `npm ci`, запуск `npm start`, health check `/api/health`; env: `JWT_SECRET` генерируется, `PEXELS_API_KEY` и `PUBLIC_URL` задаются вручную, `FRONTEND_ORIGIN=https://factory-video.onrender.com`, `DATA_DIR=./data`). Сервис работает на https://factory-video-api.onrender.com; задан ли там `PEXELS_API_KEY` — **UNKNOWN**.
- После этого в статическом сайте задать `VITE_API_URL` = URL API-сервиса и передеплоить; иначе фронтенд продолжит работать на моках.
- Тип инстанса / тариф API-сервиса: **UNKNOWN**.

### Текущее состояние

- 0.4.0 (2026-09-27): 2.5D-параллакс (модель глубины в браузере) и эффекты под бит. Проверено локально: `npx tsc --noEmit`, `npm run build`; `npm run smoke` (165/165; новое: загрузка карты глубины, рендер с картами глубины, все пресеты, фолбэк без карты, чужая карта, замеры 30 с / 3 мин); headless Chrome с **настоящей моделью** в браузере (11/11): 3 фото → объём 3 из 3, пресет «Энергично», трек 1:50 → MP4 = треку, нет JS-ошибок. Кадры из MP4: `docs/screenshots/0.4.0/`. На Render не проверено: **UNKNOWN**.
- 0.3.0 (2026-09-27): переработка редактора по итогам первого теста владельца на проде. Проверено локально: `npx tsc --noEmit`, `npm run build`; `npm run smoke` (99/99); headless Chrome против локального бэкенда с имитацией Pexels (`server/scripts/fake-pexels.mjs`): 21/21 — в том числе клип с треком 1:50 → MP4 110,03 с = трек, 3 конкретно выбранных фото попадают в проект именно они (даже если после них отвечает более старый медленный поиск), поиск «singer stage» возвращает результаты, подгрузка при прокрутке, плеер открывается сам после рендера, панель 475 px (33 % от 1440) и тянется, на мобильном шторка 85 %, нет JS-ошибок. Скриншоты: `docs/screenshots/0.3.0/` (медиатека снята с имитацией Pexels, поэтому «Fixture Photographer»). Против настоящего Pexels API не проверено (ключа нет): **UNKNOWN**.
- Этап 0 ✔, этап 1 ✔, этап 2 (бэкенд MVP) ✔; оба сервиса работают на Render (фронтенд и API).
- Проверено (локально, 2026-09-26):
  - `npx tsc --noEmit` и `npm run build` (фронтенд) без ошибок.
  - `npm run smoke`: пройдено 80/80 проверок — в том числе регистрация/вход, загрузка аудио с `rightsConfirmed` и без него, анализ (синтетический трек 120 BPM → 120 BPM), загрузка фото и видео, CRUD проектов с привязкой к пользователю, рендеры 9:16, 16:9, 1:1 с fade/slide/cut/zoom (разрешение, H.264 + AAC, длительность = таймлайн ± 0,1 с, водяной знак), подпись и обновление ссылки, 402 при нехватке кредитов, billing 501, библиотека, помощник.
  - Headless Chrome: настоящий фронтенд против настоящего бэкенда (регистрация → опросник → анализ трека из библиотеки → 3 фото → рендер → страница экспорта) без JS- и CORS-ошибок и без переключения на моки.

### Замеры (локально: 4× Intel N100, 8 ГБ ОЗУ)

| Замер | Результат |
|---|---|
| Ролик 30 с, 9:16, 10 фото, Ken Burns, fade, аудио, текст, водяной знак | 33 416 мс рендера, пик RSS сервер + FFmpeg 367 МБ |
| Ролик 30 с, 9:16, 60 клипов по 0,5 с, fade | 58 954 мс, пик 332 МБ |
| Анализ битов трека SoundHelix (6:12 мин) | ≈ 2,4 с; дочерний процесс до ≈ 330 МБ, затем освобождается; процесс сервера остаётся ≈ 58 МБ (с 0.4.0) |
| Ролик 30 с, 9:16, 10 фото, **параллакс + «Энергично»**, склейка под бит (0.4.0) | 18 661 мс, пик RSS сервер + FFmpeg 279 МБ |
| Ролик 3 мин, 9:16, 10 фото, **параллакс + «Энергично»**, склейка под бит (0.4.0) | 98 762 мс, пик 286 МБ |
| Карта глубины в браузере (headless Chrome, WASM, 1 фото ≤ 1280 px) | ≈ 9 800–10 800 мс на фото (после загрузки модели) |
| Загрузка при первом включении «Объёма» | модель 27,3 МБ + ONNX Runtime (WASM) 5,6 (в сжатом виде; 26,9 распакованная) МБ + transformers.js 166 кБ (Brotli, jsDelivr); дальше из кэша браузера |
| Прежний вариант конвейера (все клипы в одном графе xfade) | 30 с / 10 клипов: 1119 МБ; 60 клипов: ≈ 3,9 ГБ (только FFmpeg) — поэтому отказались |

Время рендера и память на Render: **UNKNOWN** (зависят от типа инстанса).

### Принятые решения

- FFmpeg нативно через `ffmpeg-static` + `ffprobe-static`, без Docker (владелец).
- **Определение бита: music-tempo** — чистый JavaScript без нативных зависимостей и без Web Audio API (работает в Node), лицензия MIT, возвращает темп **и** время каждого бита (beat tracking по BeatRoot Диксона), что нужно для склеек под бит. Другие JS-библиотеки (например, web-audio-beat-detector, realtime-bpm-analyzer) требуют Web Audio API браузера или дают только BPM. Параметры (22,05 кГц, шаг 221, FFT 1024) подобраны на синтетических треках 75–160 BPM; темп > 160 BPM делится пополам (остаётся фаза битов с большей энергией). Анализ в короткоживущем дочернем процессе (с 0.4.0; раньше worker-поток, память которого оставалась в процессе сервера), по одному, биты — за первые 300 с.
- Текст через libass (субтитры ASS) вместо `drawtext`: в сборке `ffmpeg-static` 7.0.2 нет `drawtext` (нужна libharfbuzz), но есть `ass`. Отступление от требования «drawtext».
- Рендер частями + concat (см. выше) вместо одного большого графа xfade — из-за измеренного расхода памяти.
- Библиотека: Pexels API (фото + видео), настроение/ниша → поисковые запросы; без ключа или при ошибке Pexels — статический список фронтенда.
- Очередь в том же процессе Node, 1 задача одновременно (владелец).
- Файлы до этапа 3 на локальном диске в DATA_DIR, слой хранения заменяемый (владелец).
- Помощник на правилах, без LLM (владелец; провайдер не выбран).
- JSON-файлы вместо БД (атомарная запись, данные в памяти).
- Стоимость рендера считается на сервере по сохранённому проекту; длительность от клиента игнорируется.
- Ссылки на рендеры: подпись HMAC, 7 дней; загрузки: без подписи, по неугадываемому пути с UUID.
- Изменения фронтенда по итогам работы с настоящим бэкендом — в CHANGELOG 0.2.0.

- Логика длины и стоимости — один раз в `server/src/shared/timeline.js` (JS + `.d.ts`); фронтенд импортирует её напрямую (`src/lib/project.ts`, `src/config/pricing.ts`), поэтому показ и списание не расходятся.
- Поиск Pexels: введённый текст отправляется как есть, с `locale` = язык интерфейса (`de-DE` / `en-US` / `ru-RU`). По документации Pexels API поддерживает многоязычный поиск через `locale`; собственный словарь покрыл бы только частые слова и искажал бы фразы. Быстрые подсказки (настроение/ниша) отправляют фиксированные английские запросы с `en-US`.
- Ориентация в медиатеке следует формату проекта (9:16 → `portrait`, 16:9 → `landscape`, 1:1 → `square`), её можно отключить.
- Перед каждым рендером проект сохраняется (с ожиданием отложенных изменений и текущего сохранения), потому что бэкенд рендерит сохранённое состояние.
- Причина ошибки «добавляются не те фото» — см. CHANGELOG 0.3.0.

- transformers.js загружается во время работы с jsDelivr, а не как npm-пакет (владелец, 2026-09-27): пакет тянул `onnxruntime-node` (548 МБ), который браузер не использует. Замерено: `npm ci` в корне 58 с / `node_modules` 903 МБ → 20 с / 143 МБ; `dist/` 776 кБ без неиспользуемой копии WASM (раньше 26,9 МБ).

### Ограничения

- **DATA_DIR теряется при каждом редеплое на Render** (нет постоянного диска). До этапа 3 (R2) это допустимо: пользователи, проекты, загрузки и рендеры пропадают; выданные JWT становятся недействительными, если `JWT_SECRET` сгенерирован заново.
- Возможен только один инстанс сервера (JSON-файлы + очередь в процессе).
- Фронтенд предлагает 12 шрифтов, рендер знает 4 (Inter, Montserrat, Bebas Neue, Playfair Display); остальные в видео заменяются на Inter — в панели «Стиль» они отмечены «*». В Bebas Neue нет кириллицы → кириллические строки набираются Inter.
- Качество многоязычного поиска Pexels (DE/RU) с настоящим ключом — **UNKNOWN**. Без ключа поиск ищет только по названию, настроению и нише статического списка.
- Ширину панели можно тянуть только при ширине окна от 1024 px; плеер открывается автоматически только для рендеров из текущей сессии.
- Существующие проекты сохраняют расположение блоков; новая раскладка 3 × 2 — через «Упорядочить».
- Определение бита: медленные треки могут определяться с удвоенным темпом (синтетический трек 75 BPM → 150 BPM). Истинный темп треков SoundHelix из библиотеки — **UNKNOWN**; измерено 132–148 BPM.
- Значения `bpm` и `duration` в списке библиотеки (`src/lib/libraryData.ts`, `server/src/libraryData.js`) — плейсхолдеры этапа 1 и частично не совпадают с файлами (например, трек 1: 124 против измеренных 135 BPM; трек 6: 307 с против 279,6 с). `/api/audio/analyze` возвращает измеренные значения.
- На Render текст рисуется только поставляемыми шрифтами через fontconfig/libass; работает ли fontconfig на Render без системных шрифтов — **UNKNOWN** (проверено локально).
- Выход не аннулирует JWT (без состояния, действует 30 дней). «Забыли пароль?» ничего не отправляет. Нет подтверждения email и ограничения частоты запросов.
- Checkout/портал отвечают 501; фронтенд показывает общее сообщение об ошибке.
- Атрибуция Pexels: фотограф и «Pexels» мелким текстом на превью в медиатеке, но не в готовом ролике; соответствует ли это правилам Pexels — **UNKNOWN**.
- Загруженные файлы доступны без входа, если известен URL (путь с UUID).
- Лицензии статического контента библиотеки для продакшена — **UNKNOWN**. Цены в `src/config/pricing.ts` — плейсхолдеры.
- Максимальная длина ролика 300 с; таймаут 20 мин на шаг FFmpeg.
- Параллакс: два слоя (передний план / фон), не настоящая 3D-реконструкция; за передним планом остаётся мягкая тень фигуры, на краях — лёгкое размытие. Качество зависит от карты глубины (например, контровой свет, отражения).
- Объёму нужна модель в браузере: первая загрузка 27,3 МБ + 5,6 (в сжатом виде; 26,9 распакованная) МБ, время расчёта на фото на слабых телефонах — **UNKNOWN** (замерено только в десктопном headless Chrome). Изображения без разрешения CORS прочитать нельзя → Ken Burns.
- Карты глубины хранятся в DATA_DIR, как все загрузки, и теряются при редеплое. При следующем открытии редактора (параллакс включён) фронтенд проверяет карты и пересчитывает недостающие; рендер в промежутке использует Ken Burns.
- Время рендера и память на Render (0,5 CPU, 512 МБ) — **UNKNOWN**; локальные замеры — в таблице.
- Для объёма браузеру нужен доступ к cdn.jsdelivr.net (transformers.js, WASM ONNX Runtime) и huggingface.co (модель). Если они заблокированы или нет сети, в блоке «Визуал» появляется сообщение, а фото получают Ken Burns.

### Следующие шаги

1. На Render: проверить, задан ли `PEXELS_API_KEY`, и протестировать поиск Pexels (DE/RU) с настоящим ключом; измерить время рендера и память там.
2. Этап 3: видео и загрузки в Cloudflare R2 (драйвер R2 для `server/src/storage`), ссылки, история; БД вместо JSON-файлов (выбор **UNKNOWN**).
3. Этап 4: Polar (кредиты/подписка, вебхуки), checkout и портал вместо 501.
4. Замерить параллакс и эффекты на Render (0,5 CPU, 512 МБ).
5. Этап 5: интеграция с Website-SDK (webstudio-sdk-muenchen.com) через API.
6. Открыто: ограничить выбор шрифтов во фронтенде четырьмя шрифтами рендера или добавить TTF (решение владельца); заменить `bpm`/`duration` библиотеки измеренными значениями (решение владельца).
