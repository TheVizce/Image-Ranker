# Image Ranker – Hinweise für Claude

## Dieses Tool
- IndexedDB `ImageRankerDB` (Daten des Rankers) und `ranker-sync` (Sync-Hilfsdaten), localStorage-Präfix `ranker.`. Dateien teils mit CRLF-Zeilenenden: beibehalten.
- Sync liegt in `ranker-sync.js`: Ordner `image-ranker/` (64 Teildateien), `collections: images, matches, tagDefinitions (array), packs (map)`, Felder `settings`, `tabs`. Bilddateien gehen als Pakete (~10 MB, Format „IRP1“) ins private Repo `TheVizce/ranker-bilder`. Am Handy standardmäßig aus.
- Der Ranker speichert an vielen Stellen direkt: `ranker-sync.js` prüft deshalb regelmäßig und beim Verlassen auf Änderungen. Neue Datenarten trotzdem in `getState`/`applyState` ergänzen.
- `ranker-inbox.js` nimmt Aufträge aus dem Babe Organizer an (IndexedDB `tool-transfer`). Doppelte vermeiden: nur über `linkTo`, BO-ID, eindeutigen Profil-Link, Bild-Hash oder URL zuordnen, unklare Fälle überspringen.
- Anderes Bild wählen: Knopf „Anderes Bild wählen“ in der Detailansicht öffnet den Babe Organizer mit `#e=<boId>&pick=<Ranker-ID>&tab=<Reiter>`. Der BO schickt einen Auftrag mit `replaceImage: true` und `linkTo`; `ranker-inbox.js` tauscht nur Bild, Fingerabdruck und Vorschaubild, Elo, Duelle und Eigenschaften bleiben.
- Der Link „Im Babe Organizer öffnen“ ist ein eigener Knopf in der Detailansicht und gehört **nicht** in die normale Linkliste eines Bildes. Deep-Link `#bo=<id>`.

## Gemeinsame Regeln für alle Tools unter thevizce.github.io

Alle Tools laufen unter derselben Adresse und teilen sich Speicher. Übersicht, Speicheranzeige und Sync-Einstellungen: Repo `startseite` (https://thevizce.github.io/startseite/).

**Speicher**
- localStorage ist für alle Tools gemeinsam (~5 MB). Nur kleine Daten (deutlich unter 500 KB) mit dem eigenen Präfix, nie `localStorage.clear()`.
- Größere Daten in die eigene IndexedDB (Name unten). Fremde Datenbanken nie beschreiben.
- Speicherfehler sichtbar anzeigen. JSON-Export/Import muss weiter funktionieren.
- Formatänderungen: alte Daten beim Start automatisch übernehmen, alte Schlüssel erst danach entfernen.
- Vor Änderungen am Speicher dem Nutzer kurz Befund und empfohlene Variante nennen, danach eine kurze Umstiegs-Anleitung gegen Datenverlust geben.

**GitHub-Sync (`/startseite/sync-v1.js`)**
- Das Tool gleicht über `ToolSync.create({...})` mit dem privaten Repo `TheVizce/tool-daten` ab. Token und Repo trägt der Nutzer nur auf der Startseite ein (`localStorage["toolsync.config"]`). Keine eigenen Token-Felder oder eigenen GitHub-Uploads bauen.
- Nach jedem erfolgreichen Speichern muss `SYNC.changed()` aufgerufen werden (Stelle unten). Neue Speicherwege ebenfalls daran anschließen.
- Neue Datenfelder oder Listen müssen in `get`/`apply` und in `collections`/`fields` ergänzt werden, sonst werden sie nicht abgeglichen oder gehen beim Übernehmen aus der Cloud verloren.
- Einträge in Listen brauchen eine stabile `id` (bzw. das angegebene ID-Feld). IDs nie neu vergeben, nicht umbenennen.
- Ein Eintrag gelöscht = Löschung wird gemerkt. Daten nicht durch Löschen + Neuanlegen „umbauen“.
- `sync-v1.js` nicht kopieren und nicht im Tool-Repo ändern. Änderungen daran nur im Repo `startseite`, abwärtskompatibel; Inkompatibles als `sync-v2.js`.
- Das ☁︎-Feld unten links (mit ⌂ zur Startseite) kommt aus dem Sync. Keinen eigenen Zurück-Knopf bauen, der dort kollidiert.

**Sonst**
- iPhone: Kopfzeilen mit `env(safe-area-inset-top)` und `viewport-fit=cover` beibehalten.
- Direkte Pushes auf `main` sind erlaubt. Nicht gleichzeitig aus zwei Chats am selben Tool arbeiten.
- Neue Tools oder neue Datenbanken in `startseite/index.html` (Liste `TOOLS`) eintragen.
