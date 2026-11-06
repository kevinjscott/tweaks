/** Transcribed from the source package brief.md ("Important dimensions and revision differences", caveats, gaps). */
export interface DimConflict {
  facility: string;
  workbook: string;
  current: string;
  sheet: string;
  note?: string;
  structureIds?: string[];
}

export const DIMENSION_CONFLICTS: DimConflict[] = [
  { facility: "PGA Shops", workbook: "40 × 115 × 4 m (workbook / older drawing)", current: "40 × 120 × 4 m", sheet: "v2.3 p10 (master agrees)", structureIds: ["s-095-1"], note: "Latest p10 notes 12,375 sf with wooden beams 16 in. on center and a 2,450 sf area rated to 10,000 lbs. The 2024 drawing labels 11,920 / 1,650 / 2,872 sf instead. No load assumptions inferred." },
  { facility: "Media Center", workbook: "30 × 60 × 4 m (2024 options: 30 × 65 × 4 m)", current: "30 × 60 × 4 m", sheet: "v2.3 p14", structureIds: ["s-066-1"] },
  { facility: "Media kitchen", workbook: "9 × 12 × 3 m", current: "9 × 15 × 3 m", sheet: "v2.3 p14", structureIds: ["s-068-1"] },
  { facility: "#12 Market", workbook: "15 × 25 × 3.4 m", current: "20 × 30 × 3.4 m", sheet: "v2.3 p46 (workbook zone 8.3 → sheet 9.2)", structureIds: ["s-012-1"] },
  { facility: "14G north / 15T suites", workbook: "20 × 20 × 7.4 m / 15 × 40 × 7.4 m (old 14G south)", current: "20 × 30 × 7.4 m / 20 × 40 × 7.4 m", sheet: "v2.3 p49–50", structureIds: ["s-023-1", "s-024-1"], note: "Identity correspondence between old and new suites is provisional." },
  { facility: "#16 fairway suites", workbook: "15 × 65 × 7.4 m", current: "15 × 70 × 7.4 m, 2 levels, 14 suites per level", sheet: "v2.3 p55 (workbook zone 10.2 → sheet 11.2/11.3)", structureIds: ["s-014-1"] },
  { facility: "16 green village", workbook: "20 × 35 × 7.4 m", current: "45 × 35 × 7.4 m, 2 levels, 7 suites per level", sheet: "v2.3 p57", structureIds: ["s-027-1"] },
  { facility: "17 tee village", workbook: "20 × 35 × 7.4 m", current: "45 × 35 × 7.4 m, 2 levels, 7 suites per level", sheet: "v2.3 p58", structureIds: ["s-036-1"] },
  { facility: "Partner Hospitality (Pavilion)", workbook: "20 × 55 × 7.4 m", current: "same nominal size, 2 levels", sheet: "v2.3 p59", structureIds: ["s-072-1"] },
  { facility: "17 green village", workbook: "20 × 30 × 7.4 m", current: "same nominal size, 2 levels, 6 suites per level", sheet: "v2.3 p61", structureIds: ["s-034-1"] },
  { facility: "Fan Zone / Tito's", workbook: "not reliably mapped by name in workbook", current: "35 × 35 × 4 m / 15 × 25 × 3.4–4 m", sheet: "v2.3 p32", structureIds: ["area-001", "area-002"] },
];

export const NUMBERING_CONFLICTS = [
  "Workbook v2.2 drawing/zone codes (column C) do NOT consistently match v2.3 sheet numbers. A location code is not a hole number. Never join sheets to the BOM by numeric code alone.",
  "Example: #16 fairway suites = workbook zone 10.2 but current sheets 11.2/11.3; #12 market = workbook zone 8.3 but current sheet 9.2.",
  "Old and new facility names and numbering disagree; place source revision and confidence next to every edit.",
  "Scheduled instances that share a labelled zone anchor are NOT individually positioned: the Studio packs them around the anchor for display only.",
];

export const DATA_GAPS = [
  "No native CAD (DWG/DXF/Revit/IFC), terrain, surveyed georeferencing or CRS. Master plan has a north arrow and a 0–1000 ft scale bar only.",
  "No exact rotations, vertices, ridge heights, roof profiles, setbacks, clearances or utility routing. Rotation is shown as 0° (unknown).",
  "Printed third dimension is a nominal height, not necessarily overall height. Floors are known only where plans show them.",
  "Install, handover, inspection and strike dates and dependencies: not supplied. No priced BOM, vendors or construction programme.",
  "45 supplemental area records may encompass scheduled structures; they are not additional procurement quantities.",
  "Grandstand seat counts are plan labels, not a BOM procurement total; depth and height are unknown.",
  "These are temporary event overlay / operational drawings, NOT construction drawings. Vendor verification, engineering, permits and survey are required.",
];

export const VENUE = {
  name: "Fields Ranch East at PGA Frisco",
  resort: "Omni PGA Frisco Resort – East Course",
  city: "Frisco, Texas",
  event: "2027 PGA Championship",
  eventWeek: "May 17–23, 2027",
  championshipRounds: "Thursday–Sunday, May 20–23, 2027",
  timezone: "America/Chicago (CDT)",
  sources: [
    { label: "Master plan (aerial overlay)", detail: "Sep 15, 2026 · internal use only" },
    { label: "Overlay drawings", detail: "v2.3 · 76 pages · print PDF Oct 27, 2026" },
    { label: "Materials schedule", detail: "27PGA Materials Schedule v2.2 · modified Jun 9, 2026" },
    { label: "Entrance / shop / media concepts", detail: "Aug 5–6, 2024 · older options, reference only" },
  ],
  roads: ["Championship Drive", "Legacy Drive", "Teel Parkway", "Fields Parkway"],
};
