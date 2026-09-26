# CLAUDE.md

## DE
1. Vor jeder Arbeit `README.md` und `CHANGELOG.md` lesen.
2. Nichts erfinden. Fehlen Daten: `UNKNOWN` schreiben und beim Eigentümer nachfragen.
3. Nach jeder Änderung `README.md` (Stand, Entscheidungen, nächste Schritte) und `CHANGELOG.md` aktualisieren.
4. Die Realität dokumentieren, nicht den Plan.
5. UI-Texte nur über i18n (`src/i18n`, DE/EN/RU); keine Sprachen in einer Zeichenkette mischen.
6. Vor jedem Commit: `npx tsc --noEmit` und `npm run build` ohne Fehler.
7. Entscheidungen trifft der Eigentümer; der Ausführende schlägt Varianten vor.

## EN
1. Before any work, read `README.md` and `CHANGELOG.md`.
2. Do not invent anything. If data is missing, write `UNKNOWN` and ask the owner.
3. After every change, update `README.md` (state, decisions, next steps) and `CHANGELOG.md`.
4. Document reality, not the plan.
5. UI texts only through i18n (`src/i18n`, DE/EN/RU); never mix languages in one string.
6. Before every commit: `npx tsc --noEmit` and `npm run build` without errors.
7. The owner makes decisions; the executor proposes options.

## RU
1. Перед работой прочитать `README.md` и `CHANGELOG.md`.
2. Ничего не додумывать. Если данных нет — писать `UNKNOWN` и спрашивать владельца.
3. После каждого изменения обновлять `README.md` (состояние, решения, следующие шаги) и `CHANGELOG.md`.
4. Фиксировать реальность, а не план.
5. Тексты интерфейса — только через i18n (`src/i18n`, DE/EN/RU); не смешивать языки в одной строке.
6. Перед коммитом: `npx tsc --noEmit` и `npm run build` без ошибок.
7. Решения принимает владелец; исполнитель предлагает варианты.
