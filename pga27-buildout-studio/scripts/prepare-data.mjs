// Builds the slim, typed-friendly JSON used by the app from the full source package in public/data.
// Run: node scripts/prepare-data.mjs
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "public/data");
const out = path.join(root, "src/data");
fs.mkdirSync(out, { recursive: true });

const structuresRaw = JSON.parse(fs.readFileSync(path.join(src, "structures.json"), "utf8"));
const bomRaw = JSON.parse(fs.readFileSync(path.join(src, "bom.json"), "utf8"));

const zoneBom = {};
const structures = structuresRaw.structures.map((s) => {
  const zoneIds = s.zone_bom_item_ids ?? [];
  let zoneKey = null;
  if (zoneIds.length) {
    zoneKey = zoneIds.join(",");
    if (!zoneBom[zoneKey]) zoneBom[zoneKey] = zoneIds;
  }
  const keys = Object.keys(zoneBom);
  const zoneIdx = zoneKey ? keys.indexOf(zoneKey) : null;
  const pos = s.position ?? {};
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    zone: s.zone_hole?.schedule_v2_2_zone ?? null,
    sheet: s.zone_hole?.overlay_v2_3_sheet ?? null,
    hole: s.zone_hole?.hole ?? null,
    px: pos.x_px ?? null,
    py: pos.y_px ?? null,
    posMethod: pos.method ?? "unknown",
    wFt: s.width_ft ?? null,
    lFt: s.length_ft ?? null,
    hFt: s.height_ft ?? null,
    footprintSqFt: s.footprint_sq_ft ?? null,
    levels: s.levels ?? null,
    dimSource: s.dimension_source ?? null,
    raw: s.raw_dimensions ?? null,
    bomIds: s.bom_item_ids ?? [],
    zoneBom: zoneIdx,
    status: s.source_status ?? null,
    instance: s.instance ?? null,
    srcQty: s.source_quantity ?? null,
    image: s.overlay_image ? path.basename(s.overlay_image) : null,
    revision: s.revision_note ?? null,
    notes: s.notes ?? null,
    sched: s.schedule_dimensions_ft
      ? {
          wFt: s.schedule_dimensions_ft.width_ft ?? null,
          lFt: s.schedule_dimensions_ft.length_ft ?? null,
          hFt: s.schedule_dimensions_ft.height_ft ?? null,
        }
      : null,
    seats: s.seats ?? null,
    rows: s.seating_rows ?? null,
  };
});

const items = bomRaw.rows
  .filter((r) => r.row_kind === "item")
  .map((r) => {
    const sp = r.spec_dimensions ?? {};
    return {
      id: r.id,
      item: String(r.item ?? ""),
      category: r.category,
      area: r.structure_area,
      qty: r.quantity,
      unit: r.unit,
      type: sp.type ?? null,
      dims: sp.dimensions ?? null,
      color: sp.color ?? null,
      valance: sp.valance ?? null,
      slider: sp.slider ?? null,
      sizeLf: sp.size_or_linear_ft ?? null,
      areaSf: sp.area_sq_ft ?? null,
      heightRaw: sp.height_raw ?? null,
      widthRaw: sp.width_raw ?? null,
      notes: r.notes ?? null,
      sheet: r.source_sheet,
      row: r.source_row,
    };
  });

const kinds = {};
for (const r of bomRaw.rows) kinds[r.row_kind] = (kinds[r.row_kind] ?? 0) + 1;

fs.writeFileSync(path.join(out, "structures.json"), JSON.stringify({ geometryWarning: structuresRaw.geometry_warning, imageDims: structuresRaw.image_dimensions_px, structures, zoneBom: Object.values(zoneBom) }));
fs.writeFileSync(path.join(out, "bom.json"), JSON.stringify({ source: bomRaw.source, schemaNote: bomRaw.schema_note, physicalRows: bomRaw.rows.length, kinds, items }));
console.log("structures", structures.length, "items", items.length, "zoneBom groups", Object.keys(zoneBom).length);
