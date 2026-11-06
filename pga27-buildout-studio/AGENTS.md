<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PGA27 Buildout Studio: project notes for agents

- App: Next.js App Router + TypeScript + react-three-fiber, deployable on Vercel with **Root Directory = this folder**. Run `npm run lint` (tsc) and `npm run build` before committing.
- Never invent data. Unknown dimensions/positions are `null` and shown as "unknown". Keep the caveats (positions approximate, v2.2 zones != v2.3 sheets, not for construction) visible in UI and AI prompts.
- Coordinates: plan metres, x east, y north, origin at the master-plan image centre; three.js uses `(x, 0, -y)`. 1 px = 0.8215 m.
- Scene changes go through `src/lib/scene.ts` ops (`applyOp`) so UI, undo/redo, proposals and AI tools share one code path. New AI tools live in `src/lib/ai/tools.ts` (zod schema + `run`).
- BOM math lives in `src/lib/bom.ts`; never join BOM rows to structures by numeric zone code, use the id links.
- Source data: `public/data/*` (full) -> `npm run prepare-data` -> `src/data/*.json` (slim).
