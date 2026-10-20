# RoomWeave

RoomWeave is a local visual floor-planning application for arranging fictional workshop objects within measured room boundaries. Users can drag objects, nudge them with the keyboard, change dimensions, inspect overlap and clearance notices, and export millimetre-scale SVG plans. It combines a Python/SQLite backend with a JavaScript/SVG canvas, local document storage and undo/redo.

This is a new local application prototype with original synthetic examples and no claimed user base. It shares a small original local-workspace foundation with other personal utility projects; its domain model and workflows are specific to this application. No external service, account or telemetry is required.

## Implemented baseline

Measured room and objects; pointer movement with zoom-aware coordinates; keyboard nudging; fit/200%/300% views; editable clearances; overlap and wall notices; SVG/JSON export; undo/redo; saved revisions.

## Run

Python 3.11+ is required; there are no Python runtime dependencies.

```sh
python3 server.py
# Open http://127.0.0.1:7432
```

Run from the repository root. `--port` changes the port; `--data PATH` chooses the SQLite library (default `.local-data/library.sqlite3`). Use the printed `127.0.0.1` address: Host, Origin and custom-header checks protect local mutations. This server is intended for local use, not internet hosting. Back up your library before experimenting with it.

## Test

```sh
python3 -m unittest discover -s tests -v
# In a separate terminal, run the server with a disposable --data path.
npm ci
npx playwright install chromium
npm run test:ui
```

Browser tests use Node.js 20+ and pinned Playwright. They create synthetic saved documents. Set `BASE_URL` for a custom test server and `UI_SCREENSHOTS` for screenshots outside application source. Chromium requires its normal OS libraries. No hosted CI or other-browser certification is claimed.

## Project structure

- `core.py`: normalization, constraints and domain analysis.
- `server.py`: loopback HTTP boundary and optimistic SQLite revisions.
- `web/`: interface, DOM/SVG rendering, dialogs and edit history.
- `examples/sample.json`: original fictional fixture.
- `tests/`: core regression cases and browser workflows.

## Scope and limits

Objects are axis-aligned rectangles. Overlaps and clearance problems are notices, not blocking constraints; boundary violations are rejected. Clearance uses a simple axis-aligned gap model and is not a building-code, evacuation, accessibility or safety certification. Room shape, doors, rotation, snapping and multi-selection are not implemented. SVG physical size does not establish printer accuracy.

Documents have at most 150 entries; the library supports 100 documents. Request/import size is bounded to 256 KB. Undo/redo is per-tab memory, not durable history. Export drafts before closing; there is no automatic crash recovery yet. Optimistic revisions reject stale saves, but merging conflicts is future work.

## Planned development

[ROADMAP.md](ROADMAP.md) specifies approximately **68–100 hours** of proposed work with acceptance criteria. [QUALITY-PLAN.md](QUALITY-PLAN.md) describes representative review dimensions and transition cases. Estimates are future engineering effort, not completed hours or promised paid work. [CONTRIBUTING.md](CONTRIBUTING.md) explains contribution conventions.

## License

MIT. See [LICENSE](LICENSE).
