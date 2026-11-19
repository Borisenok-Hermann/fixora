# Hermann's Repair – Reparatur-Kasse

Web-App für den Handy-Reparaturshop Hermann's Repair, Bremen.
© 2026 Dennis Hermann. **Alle Rechte vorbehalten** – siehe `LICENSE`. Nutzung, Kopie oder Weitergabe nur mit schriftlicher Erlaubnis.

Installation auf dem iPhone: Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“.

---

## ⚠️ Für Claude / Entwickler: `index.html` NICHT direkt bearbeiten

`index.html` ist die **gebaute, unleserliche** Fassung. Die lesbare Quelle liegt verschlüsselt in `quelle.enc`,
der frühere Verlauf in `historie.enc`. Der Schlüssel steht **nur** im privaten Claude-Projekt
„Hermann's Aufträge App“, Dokument `claude/quelle-schluessel.md`.

So wird geändert:

```bash
export QUELLE_KEY='…'            # aus dem Projekt-Dokument
bash build/entschluesseln.sh     # -> quelle/index.html (lesbar, wird nicht committet)
# … quelle/index.html bearbeiten und testen (z. B. Kopie von quelle/index.html lokal ausliefern) …
bash build/veroeffentlichen.sh   # baut index.html + verschlüsselt quelle.enc neu
# sw.js: CACHE-Version hochzählen, dann committen und pushen
```

Vor jeder Änderung den neuesten Stand holen (es arbeiten mehrere Chats daran).
