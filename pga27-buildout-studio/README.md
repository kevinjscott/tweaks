# PGA27 Buildout Studio

A web app for the temporary-overlay buildout of the **2027 PGA Championship at Fields Ranch East, PGA Frisco (Frisco, Texas)**. Event week May 17–23, 2027; championship rounds May 20–23.

It turns the source package (Sep 15, 2026 master plan, Overlay Docs v2.3 sheets, 27PGA Materials Schedule v2.2) into:

| Area | What you get |
| --- | --- |
| **Dashboard** | Counts by structure type, BOM line items, footprints, venue info, data conflicts and known gaps |
| **3D Site** | react-three-fiber scene: master plan as a scaled ground plane plus procedural massing for every structure (tents, frame tents, two-level hospitality, grandstands, PGA Shops, Media Center, gates, restrooms, videoboards, compounds, buildings). Click a structure for details, source sheet, revision notes, linked BOM |
| **Flythroughs** | Preset tours (full site, main entrance → shops, hospitality 14–17, media center), user keyframe tours, playback controls, **WebM video export** (MediaRecorder) |
| **CAD Plan** | Top-down 2D mode with layers by structure type, distance/area measuring, point + grid snapping, dimension annotations, drag/resize/rotate editing, **DXF export**, **GLB export**, **GLB import** |
| **BOM** | Searchable/filterable table of all 772 item rows, grouped by category / v2.2 zone / linked structure, live-recomputed when structures are added, removed or resized, **CSV/XLSX export**, diff against v2.2 |
| **AI Assistant** | Chat panel (Vercel AI Gateway) that operates the scene through typed tools, shows a previewable diff to accept/reject, with full undo/redo |
| **Model picker** | Top 10 models curated from the **live** AI Gateway model list for tool calling + vision + spatial reasoning, plus search over all models |
| **Scenarios** | Named versions of the layout in `localStorage`, JSON import/export/share, side-by-side summary vs the baseline |
| **Drawings** | Browser for all 70 source JPGs (master plan, v2.3 sheets, 2024 concepts) |

> **Planning concept, not for construction.** The source drawings are temporary event overlay drawings. Positions are approximate label anchors, not surveyed; there is no native CAD, terrain, georeferencing or exact rotation. Unknown values stay unknown (shown as `unknown`, never invented). See [Data caveats](#data-caveats).

## Quick start

Requirements: Node.js 22+ (see `.node-version`) and npm.

```bash
cd pga27-buildout-studio
npm install
cp .env.example .env.local   # then set AI_GATEWAY_API_KEY
npm run dev                  # http://localhost:3000
```

Without `AI_GATEWAY_API_KEY` everything except the chat works; the assistant panel shows a setup message instead.

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | `tsc --noEmit` type check |
| `npm run prepare-data` | Rebuilds `src/data/*.json` from the full source files in `public/data` |

### Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | For the assistant | Vercel AI Gateway key (create at <https://vercel.com/ai-gateway>) |
| `VERCEL_OIDC_TOKEN` | Alternative | Provided automatically on Vercel; locally run `vercel env pull` instead of using a key |
| `STUDIO_ACCESS_CODE` | Optional | If set, `/api/chat` requires this code (entered in the Assistant panel). Use it on public deployments to protect your gateway credits |

## Deploying on Vercel

1. Push this folder to its own repo (or keep it in a monorepo).
2. In Vercel: **Add New → Project**, import the repo and set **Root Directory = `pga27-buildout-studio`**.
3. Framework preset: **Next.js** (auto-detected). No build/output overrides are needed.
4. Add `AI_GATEWAY_API_KEY` under **Settings → Environment Variables** (or enable OIDC and skip the key: the AI SDK gateway provider uses the OIDC token automatically on Vercel). Optionally add `STUDIO_ACCESS_CODE`.
5. Deploy. Node 22 is selected from `package.json` `engines`.

Notes: the app serves about 26 MB of static drawings from `public/images`; `/api/models` revalidates hourly; `/api/chat` streams and has `maxDuration = 300`.

## Architecture

```
src/
  app/                     Next.js App Router pages + Route Handlers
    api/chat/route.ts      AI SDK streamText + typed tools via the AI Gateway
    api/models/route.ts    Live model list from the AI Gateway, curated top 10
    api/status/route.ts    Gateway configured? (drives the setup message)
  components/              Dashboard, Site (r3f), Plan (SVG CAD), BOM, Scenarios, AiPanel, ModelPicker…
  data/                    Slim JSON generated from the source package + conflicts/drawings indexes
  lib/
    baseline.ts            Structures -> meters, layers, shared-anchor packing
    scene.ts               Pure scene ops (apply/diff) shared by UI and AI tools
    massing.ts             Procedural three.js massing per structure kind
    bom.ts                 Live BOM engine, diff vs v2.2
    dxf.ts / glb.ts        CAD exporters / GLB import measuring
    tours.ts               Keyframe sampling, preset + authored flythroughs
    ai/tools.ts            The typed tool set the model can call
    ai/models.ts           Ranking of gateway models
    scenarios.ts           ScenarioStore interface + localStorage implementation
  store/studio.ts          zustand store: scene, undo/redo history, proposal, selection, camera, playback
public/images, public/data Source JPGs, BOM/structures/brief copies for download
scripts/prepare-data.mjs   Source JSON -> src/data
```

### Coordinates and scale

Plan coordinates are metres: **x = east, y = north, origin = centre of `master-plan.jpg`** (north is up; the master has a north arrow and a 0–1000 ft scale bar but no CRS). The scale bar spans 371 px per 1000 ft (ticks measured at x = 2899.5 and 3270.5), so **1 px = 0.8215 m** and the 4000 × 3112 px image is about 3.29 × 2.56 km. Rotation is degrees counter-clockwise in plan; the sources give no rotations so baseline is 0° (labelled as an assumption).

### Placement of structures

`structures.json` has approximate label anchors. 151 records share a labelled anchor coordinate with at least one other record (up to 19 tents on one point), so drawing them at that point would stack them. The Studio **packs co-located structures in a shelf layout centred on the shared anchor, for display only**, and records the offset; the inspector says so explicitly. 23 records have no position (16 area records plus 7 scheduled tents) and appear in the sidebar as `place…`: you can drop them at the view centre. 25 placed records have unknown dimensions (buildings, terminals, compounds…): they are drawn as dashed, translucent **symbolic** shapes, never given a footprint. Grandstands only have a plan length, so depth/height use a flagged visual placeholder.

### Live BOM

Quantities come from the 772 `item` rows of v2.2 (subtotal rows are excluded). 171 structure/tent lines are linked to structure instances; the live BOM recomputes:

- **Removed structure** → linked line quantity drops (instance count).
- **Resized structure** → the line shows the new dimensions (`resized`); if instances diverge the line splits.
- **Added structure** → new `STRUCTURES` / `FRAME TENTS` line.
- **Derived estimates** (toggle): for multi-level structures that differ from v2.2, deck sq ft = footprint × levels and railing lf = perimeter × levels. These are rule-based and clearly labelled; stairs, back of house and furniture are **not** estimated.
- Zone-level quantities (fence, decking, stairs, BOH, furniture, gravel) are shared area quantities and are **not** auto-scaled.
- Joins use structure ↔ item ids from the source, never the numeric zone code (v2.2 codes ≠ v2.3 sheets).

### AI assistant

`/api/chat` runs `streamText` against `gateway(modelId)` with the current scene (compact list of all structures, tours and BOM summary) in the system prompt, and optionally a JPEG screenshot of the 3D viewport attached to the user message for vision models. The model can only call typed tools (zod schemas in `src/lib/ai/tools.ts`):

`find_structures`, `locate_place`, `get_structure`, `add_structure`, `move_structure`, `resize_structure`, `rotate_structure`, `delete_structure`, `select_structures`, `set_camera`, `create_flythrough`, `play_flythrough`, `query_bom`, `bom_diff`, `modify_bom`, `measure`.

Tools run server-side against a working copy of the scene so later calls see earlier ones (e.g. add three grandstands then `bom_diff`). Scene-changing tools return a typed `sceneOp`; the client collects them into a **proposal**, previews it in the 3D and plan views (green = added, amber = changed, red = removed) and applies it as **one undoable history entry** on *Accept*. View tools (camera, select, play, measure) run immediately. Undo/redo (`Ctrl/Cmd+Z`, `Shift+Ctrl/Cmd+Z`) covers every change from the UI and the assistant.

Fallbacks: a model without tool calling is replaced by the recommended tool-capable model for that request (with a notice); a model without vision simply gets no screenshot. Gateway auth errors, rate limits and credit problems are surfaced as readable messages.

### Model picker

`/api/models` fetches `https://ai-gateway.vercel.sh/v1/models` (and falls back to `gateway.getAvailableModels()`, then to a minimal offline list). Eligible models must support **tool calling and image input**; snapshot, batch, fast-tier, lite/mini/nano and similar variants are skipped. Models are scored on recency, a price-tier proxy for capability, context size, reasoning support and a frontier-lab bonus, one model line is kept per family and at most two per provider, so the list stays current as the gateway adds models. Each entry has a short note; the whole gateway list is searchable. The default is the newest Claude Sonnet when present (fast and reliable at tool calls), otherwise the top-ranked model.

### CAD exports

- **DXF**: ASCII R12 (opens everywhere, validated with ezdxf), metres, layers `STR-<TYPE>`, `TXT-NAMES`, `DIMS`, `MEASURE`, `UNKNOWN-DIMS`, `TITLE`; footprints as closed polylines (two-level structures get an inner outline), width/length dimension lines, your measurements and a "PLANNING CONCEPT - NOT FOR CONSTRUCTION" title.
- **GLB**: the same procedural massing, one named mesh per structure with `userData` (id, layer, dimensions); optional master-plan ground plane.
- **GLB import**: adds the model as a structure (bounding box → W × L × H in metres, placed at the plan view centre; stored in IndexedDB).

### Storage

Scenarios (structures, tours, BOM adjustments, measurements) are stored in `localStorage` through the `ScenarioStore` interface in `src/lib/scenarios.ts`. To move to Vercel storage later:

1. Add Route Handlers (`/api/scenarios`, `/api/scenarios/[id]`) backed by **Vercel Blob** (one JSON per scenario; simplest) or **Neon Postgres** (a `scenarios` table with a `jsonb` scene column and `updated_at`).
2. Implement `ScenarioStore` with `fetch` calls to those handlers and swap it for `localScenarioStore` in `src/store/studio.ts`.
3. Imported GLB blobs would move from IndexedDB to Blob storage keyed by `modelId`.

The JSON format is versioned (`schema: 1`) and self-contained, so exports remain importable.

## Data caveats

These are surfaced in the UI (top banner, dashboard, inspector, BOM) and given to the model:

- Workbook v2.2 drawing/zone codes do **not** consistently match v2.3 sheet numbers (e.g. #16 fairway suites = zone 10.2 but sheets 11.2/11.3). A zone code is not a hole number. 11 dimension conflicts are listed on the dashboard (PGA Shops 115 → 120 m, #12 Market, 14G/15T suites, 16/17 villages…).
- Where a current drawing supersedes the workbook, structures use the **current** dimensions; the v2.2 values stay visible in the inspector and BOM notes.
- Positions are approximate anchors; no CAD, terrain, georeferencing or exact rotations. Install/strike dates, vendors and prices are not in the source.
- Supplemental area records (45) may encompass scheduled structures and are not extra procurement; grandstand seats are plan labels, not a BOM total.

## Moving to its own repo

The folder is self-contained (own `package.json`, lockfile, `public/`, `src/`). Copy `pga27-buildout-studio/` to a new repository root, or keep it in a monorepo and set the Vercel Root Directory. Nothing refers to files outside the folder.
