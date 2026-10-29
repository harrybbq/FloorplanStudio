# FloorplanStudio

Paste a floorplan, set its scale, and lay out furniture at real size — rectangles, L-shapes, or any
outline you draw — with overlap warnings when pieces collide with each other or with walls.

**Live:** https://harrybbq.github.io/FloorplanStudio/

Everything runs in the browser and is saved to that browser's `localStorage`; nothing is uploaded.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5180
npm test           # vitest — geometry, shapes, units, catalog matching
npm run build      # typecheck + production build into dist/
```

Pushing to `main` runs the tests, builds, and deploys to GitHub Pages
(`.github/workflows/deploy.yml`). Production assets are served under `/FloorplanStudio/`
(`vite.config.ts`).

## Using it

1. **Load a floorplan** — upload, paste (Ctrl/⌘+V) or drag an image in, or click *Try a sample plan*.
   Large images are downscaled on import so they fit in browser storage.
2. **Calibrate** — click two points on a known distance and enter it (`3m`, `1500`, `10'6"`…).
3. **Add furniture** — *Custom* (type dimensions), *Presets*, *Maker* (draw any outline on a grid),
   *Lookup* (built-in IKEA / B&Q / Tesco catalog), or your *Library*. Click the plan to place it.
4. Optionally **trace walls** so furniture poking through a wall is flagged too.
5. **Measure rooms** (*Room* / `M`): click the corners, then the first corner again (or double-click / Enter).
   Near-level edges snap straight. Each room shows length × width (its smallest bounding rectangle) and area.

**From HouseHunter:** *Plan furniture* on a listing's floorplan opens it here as its own plan
(one per listing and floorplan; clicking again reopens it), with links back to the listing.
The image comes through HouseHunter's local dev server; if that isn't running, you're asked to
copy and paste it. Your furniture library is shared by every plan, so the same sofa can be tried in each flat.
Mark measured rooms as *Whole flat*, *Kitchen* or *Bedroom 2* and **Send to HouseHunter** to fill in that
listing's floorplan sq ft, kitchen and bedroom-2 sizes. HouseHunter shows old → new and saves only if you click Apply.

| Key | Action |
| --- | --- |
| `V` / `C` / `W` / `M` / `A` | Select · Calibrate · Trace walls · Measure a room · Add furniture |
| `R` / `Shift+R` | Rotate the selected piece 15° |
| `F` | Flip it horizontally |
| `D` | Duplicate it |
| Arrows (`Shift` ×10) | Nudge 10 mm (100 mm) |
| `Backspace` / `Delete` | Delete — undo with `Ctrl/⌘+Z` or the toast |
| `Esc` | Cancel the current tool, or deselect |
| Wheel · Middle-drag / `Alt`+drag | Zoom · Pan |

## How it fits together

| Path | What it does |
| --- | --- |
| `src/state/planStore.ts` | Zustand store — every edit goes through `mutatePlan()` / `mutateActive()`, which persist it |
| `src/lib/handoff.ts` | HouseHunter bridge: reads its URL-hash hand-off, fetches the floorplan (relay first), builds the "Send to HouseHunter" link |
| `src/lib/rooms.ts` | Room maths: area, smallest bounding rectangle (length × width), edge straightening |
| `src/lib/storage.ts` | `localStorage` I/O. Each plan's image lives under its own key, so frequent edits stay small |
| `src/lib/footprint.ts` | Shape system: drawable outline + convex parts (L-shapes split in two, custom polygons triangulated) |
| `src/lib/geometry.ts` | Overlap detection (SAT on convex parts, segment tests for walls) |
| `src/lib/units.ts` | Everything is stored in mm; parsing/formatting for metric and imperial |
| `src/lib/furniture/providers.ts` | Dimension lookup chain. Catalog is built in; AI/web lookup activate when `VITE_LLM_ENDPOINT` / `VITE_SCRAPER_ENDPOINT` point at a serverless proxy |
| `src/components/FloorplanCanvas.tsx` | The Konva stage: pan/zoom, tool clicks, furniture rendering |

Positions are stored in the floorplan image's pixel space, so zooming never changes the scale.
