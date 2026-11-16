# Changelog

## 1.2.0 — 2026-11-13

Panel rows now carry the same names as the workspace's session list, not the head
of the first message.

### Session titles

- Read the **last** `session/title` event of the session log — the provider-written
  summary the workspace itself shows — instead of stopping at the first title plus
  first user message. The old early stop captured the deterministic fallback title
  (`fallbackMaxWords` cut of the first message), so a row like
  `检查一下，我用过一个搜索工` could never become `检查搜索工具密钥`.
- `GET /turn-timeline/index` no longer trusts the `listSessions()` header title: it
  is the fallback head or missing entirely. Every row is folded from the log and
  cached per session.
- Cached titles are invalidated when a new `session/title` arrives, because the
  provider rewrites the fallback a moment after the first message. A panel opened
  early now updates instead of freezing on the fallback.
- The resolve racing with a title write does not cache its stale result.
- `GET /turn-timeline/session/<id>` prefers the same folded title.
- Verified offline against the workspace projection cache: 18/18 sessions with a
  stored title now match the workspace list (the old fold matched 1/18).

## 1.1.0 — 2026-11-12

The panel now shows what is *still owed*, not only what already happened.

### Unclosed items ledger

- New read-only `GET /turn-timeline/ledger`: reads `<workspace>/50-knowledge/OPEN-ITEMS.md`
  plus every `10-sessions/<dir>/NOTES.md`, and returns open/closed items per workspace
  with counts, stale markers and parse errors. Cached 30 s, degrades to empty on failure.
- `lib/ledger.js` — pure parser, zero dependencies, no DSH runtime imports, so it is unit
  testable with plain node. Parses only fenced `ledger` blocks; a bad line becomes an
  error record instead of a silent guess. A repeated id counts once, global pool wins.
- New `GET /turn-timeline/ledger/file?cwd=&path=`: opens a ledger source in the panel.
  Only `50-knowledge/OPEN-ITEMS.md` and `10-sessions/*/NOTES.md` are allowed, with a
  path-escape check — the panel never becomes a generic file reader.
- Panel: a "未关闭项" bar (counts by kind, stale count, parse-error count), expandable to
  one row per item; clicking a row opens its source file as rendered markdown. The
  workspace selector now carries each workspace's open count.
- Deliberately **no session-row badges**: a DSH sessionId has no reliable mapping to a
  `10-sessions/<dir>` folder name, and a wrong badge is worse than none.

## 1.0.0 — 2026-11-05

First stable release. The panel is feature-complete for its purpose: index a
workspace's sessions into task stretches, show what each turn produced, jump to
it, preview it, and let the user arrange the list.

### Timeline

- Left-sidebar `main` panel + `sidebar.panellist` row (clock icon), registered
  through the plugin slot API; panel state survives re-mounts.
- Sessions of every workspace on the machine, grouped by workspace, filtered by
  the workspace selector and the filter box.
- Session titles resolved on the host from the log (`session/title`, else the
  first user message), cached for the life of the process — re-entering the
  panel no longer falls back to serial ids.
- Turns folded into task stretches: a new stretch starts when a turn touches
  files the previous stretch did not.
- Per-turn file chips from two sources: file-tool arguments (`write`, `edit`,
  …) and turn-rewind's change ledger (checkpoint *N* vs *N+1*), which also
  covers shell-created files.
- Subagent sessions kept behind a toggle; they are read-only while their parent
  is offline.

### Jump, preview, zoom

- Left click on a chip jumps to the turn (anchor matched by the turn's user
  text), highlights it, and opens the file in the right sidebar.
- Right click previews inside the panel: markdown rendered, code syntax-coloured
  with line numbers, images inline.
- Graceful ladder for opening a file: better-sidebar editor → right-sidebar
  resource → inline preview; every step reports why it failed instead of
  failing silently.
- `A− / A+` panel zoom (0.8–1.9, remembered); **Ctrl + wheel** zooms the right
  sidebar pane (0.6–2.4, remembered).

### Arrangement (0.2.0)

- Folders: create, rename (double-click), delete (sessions return to Unfiled).
- Drag a session onto a folder to file it; drop on Unfiled to clear it.
- Per-session custom names and a removed flag; removed sessions wait in the
  "Not in timeline" pool and can be added back.
- Persisted in `$DSH_HOME/storages/turn-timeline-v1.json`; atomic
  temp-file + rename writes. No session content is copied.

### Fixes worth remembering

- Client plugins must reach other packages' services through `ctx.inject(...)`;
  `ctx.get(...)` does not exist on the client context, and a swallowed error
  there silently disabled every click.
- The right sidebar is per session and only paints when that session owns the
  main area; a global panel owning `main` makes it record-but-not-draw.
- `git` missing on the host made turn-rewind fail every checkpoint; the ledger
  was therefore always empty, which looked like "no files produced".

## 0.1.x

Iteration on top of the first working build: entry ordering, always-visible
preview, `⧉` push-to-right-sidebar, rendered previews, zoom, subagent folding,
title caching.
