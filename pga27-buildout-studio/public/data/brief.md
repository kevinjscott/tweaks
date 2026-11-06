# 2027 PGA Championship buildout — source package

## Read this first
- Venue: **Fields Ranch East at PGA Frisco**, Frisco, Texas; master title says **Omni PGA Frisco Resort – East Course**. The pale west-course hole numbers in the aerial are not the blue East-course event routing.
- Event week: **May 17–23, 2027**; championship rounds Thursday–Sunday **May 20–23**. Official source checked November 6, 2026: https://www.pgachampionship.com/tickets-2027 and https://www.pgamediacenter.com/events/2027-pga-championship . Event dates are calendar dates in America/Chicago (CDT during May).
- These are **temporary event overlay / operational drawings, NOT construction drawings**. General conditions p2 explicitly require vendor verification, engineering/permits and survey; elevations are estimates. Use this package for planning/visualization, not stamped CAD, load design or exact site staking.
- Master: September 15, 2026, internal use only. Overlay: v2.3, 76 pages, print PDF uploaded October 27, 2026. Materials workbook: v2.2, modified June 9, 2026. Subfolder drawings: August 5–6, 2024, older concepts/options.
- **Major version conflict:** workbook drawing/location numbers do NOT consistently match v2.3 sheet numbers. For example #16 fairway suites is workbook zone 10.2 but current sheet 11.2/11.3; workbook #12 market zone 8.3 but current sheet 9.2. A location code is not a hole number. Never join current sheets to BOM solely by numeric code.
- `bom.json` / `.csv`: all 825 physical worksheet rows preserved, with row_kind (`item`, `subtotal`, `section`, `header`, `title`, `blank`). There are 772 item rows. **Only item rows are additive**. Totals/count rows are preserved, not extra procurement. Original cells A:J are in raw_values; quantities/units retain full precision. No vendor, pricing or dated installation columns supplied, so these remain null.
- `structures.json`: 179 individual scheduled structure/tent instances (94 A-frame + 85 frame-tent instances), plus 45 supplemental current-plan area/structure records. Supplemental areas can encompass scheduled structures: they are NOT additional procurement quantities. Original schedule dimensions survive in schedule_dimensions_ft when current drawings supersede them. Building floors are known only where explicit plans show them; other levels remain null.
- Positions use **4000×3112 px master-plan.jpg**, top-left origin, x right, y down. Normalized coordinates are relative to the entire image including the title strip. Text-label anchors are approximate, not roof centroids; many small tents have shared, explicitly labeled approximate zone anchors. Unknown positions are null. Do not spread shared anchors into fabricated positions. reference/master-labels.json preserves vector label text/positions for further matching.
- Metric→feet uses exact 1 ft = 0.3048m. A listed footprint is the rectangular product of printed nominal width×length, NOT a surveyed polygon, platform/deck area or roof extent. Printed third structure dimension is nominal height, not necessarily ridge/overall height. Variable heights remain null with the source spec retained. Orientations, roof pitches and terrain remain unknown.

## Source links and exclusions
Root: https://drive.google.com/drive/folders/1ZCAW3YQ4JF9wJMy00pG9VqBaSzN7I2vM
- Master PDF: https://drive.google.com/file/d/1FiC5BQswsmWSdiZBYZ8NsKVXranOBLLQ/view
- Materials: https://drive.google.com/file/d/1GjHz3_gVBPL5uLNiWCJWySaJii3GATXM/view
- Overlay print: https://drive.google.com/file/d/1UGCxbMVKV9FPDnpWhbjBZmFiBwlJMcgN/view
- Older entrance/shop drawings: https://drive.google.com/drive/folders/1lo7ZGNBo-u7YqPoTvBKla9j7Ih9zN4jV
- Older media options: https://drive.google.com/drive/folders/1Mf3lymn618EgXbEshDnYwYTUIvWmhutq
- Archived Plans deliberately skipped (old 2020). 80MB master JPG not downloaded; the matching dated vector master PDF was rendered instead. Larger non-print v2.3 PDF not downloaded; its content was not byte/page compared, so equivalence is not asserted. Print version has all 76 indexed pages.
- “29 Ryder Cup_GPC Concept” is another event, intentionally excluded from PGA geometry/BOM: https://docs.google.com/spreadsheets/d/1Ns_KgMs4z2hRgHTS8HOmc7GpwM04tEn1adfdnbdQ7vo/edit
- “Untitled document” is NOT empty: brief championship staffing/sales notes, including PGA Championship 1 manager (24 months), 1 coordinator (12 months). It contains no specific construction geometry or dates; do not treat staffing durations as this build schedule.

## Site-wide layout and routing
Master has north arrow and 0–1000ft graphic scale; no surveyed GIS origin, latitude/longitude grid or CRS supplied. The aerial spans East and West courses, resort/district and nearby schools/neighborhoods. Blue hole numbers mark East course; pale numbers mark West course.
- North/west entrance and terminal near Panther Creek High School; separate west bus slips, ticket/security scans, accessibility services, check-ins and merch gate lead toward the Shops.
- Practice range/media/volunteer area is east of entrance/school. District/clubhouse/ranch hospitality and resort are along the northern edge; East course runs south through holes 1–7, east/northeast through 8–13, southeast/southwest 14–15, then returns via 16–18.
- Roads labeled on the master include **Championship Drive**, **Legacy Drive**, **Teel Parkway**, **Fields Parkway**; preserve road-closure and westbound-only annotations instead of generating new traffic routing.
- Gates/terminals include main entrance/terminal, high-school gate, hotel gate, corporate gate/terminal, media terminal/scan gate, neighborhood gate, broadcast entrance/terminal, vendor-compound scans and ADA entry/shuttles.
- Player/spectator bridges, cart-bypass and no-carts zones, future cart-path connection and planned hike/bike extension are shown; these are constraints/options, not all approved new construction. Master includes a 32ft×12ft spectator-bridge label and a hike/bike addition option marked 240LF; exact approved bridge count and geometry remain unresolved.
- Operations compounds include vendor/production kitchens, Arena/PGA storage and dining, Patina ops, power/chillers/HVAC, cold storage, fuel, water/waste, ecology, deliveries and broadcast trucks. Master separately labels Teel compound areas (3.4ac and 2.75ac) and broadcast subareas (2.0ac and 2.6ac); these are labels, not additive land totals.

## Important dimensions and revision differences
| Facility | Workbook / older drawing | Current verified drawing |
|---|---|---|
| PGA Shops | 40×115×4m | 40×120×4m, overlay p10; master agrees |
| Media Center | workbook 30×60×4m; 2024 options 30×65×4m | 30×60×4m p14 |
| Media kitchen | 9×12×3m workbook / 2024 | 9×15×3m p14 |
| #12 Market | 15×25×3.4m | 20×30×3.4m p46 |
| 14G north / 15T suites | 20×20×7.4m / 15×40×7.4m (old 14G south) | 20×30×7.4m / 20×40×7.4m p49–50; identity correspondence provisional |
| #16 fairway suites | 15×65×7.4m | 15×70×7.4m p55, two levels, 14 suites per level |
| 16 green village | 20×35×7.4m | 45×35×7.4m p57, two levels, 7 suites per level |
| 17 tee village | 20×35×7.4m | 45×35×7.4m p58, two levels, 7 suites per level |
| Partner Hospitality | 20×55×7.4m | same nominal size p59, two levels |
| 17 green village | 20×30×7.4m | same nominal size p61, two levels, 6 suites per level |
| Fan Zone / Tito’s | not reliably mapped by same name in workbook | 35×35×4m / 15×25×3.4–4m p32 |

Latest p10 Shops reinforcement notes: 12,375sf with wooden beams 16 inches on center and a 2,450sf area rated to 10,000lbs. Older 2024 shop drawing instead labels 11,920sf, 1,650sf and 2,872sf areas. These are different revisions; no load assumptions should be inferred.
Grandstand seating labels (not a BOM procurement total): #1 tee 414 seats/68ft/12 rows; #8 green 542/95ft/12; #9 green 414/85ft/9; #18 green 1,370/130ft/21; shared 9/18 754/98ft/15; #16 green 414/68ft/12; #17 green 621/102ft/12. Depths and heights are unknown.

## Key dates / phases
1. August 5–6, 2024: entrance/shop/media concept options (reference only).
2. June 9, 2026: workbook v2.2 metadata modification date, not a construction milestone.
3. September 15, 2026: master date and overlay page timestamps.
4. October 27, 2026: print v2.3 Drive modification date, not necessarily drawing issue date.
5. May 17–23, 2027 event week; May 20–23 championship competition.
6. Install, handover, inspection, strike dates and dependencies: **unknown / not supplied**. General conditions require removal after the event. No invented phased dates are included.

## Gaps and safe app defaults
The 76-page print overlay is image-only (pdftotext yields no text); dimensions were checked visually on selected key sheets, not exhaustively OCR-transcribed. OCR installation was unavailable because the package repositories returned errors. All retained detail images remain available for additional inspection. No native DWG/DXF/Revit/IFC/3D terrain, surveyed georeferencing, exact structure rotations/vertices, ridge heights, roof profiles, setbacks/clearances or utilities routing were supplied. No priced BOM, contracted vendors or construction programme. Elevation/staking markers combine sheet.coordinate number with height above existing grade; they are NOT GIS coordinates. FFE labels and contours lack a confirmed datum. Some stair schedule sizes literally contain ##/### placeholders. Old and new facility names and numbering disagree; place source revision/confidence next to every edit. A draft Three.js scene should overlay the master aerial, render dimensioned primitives only where placement is known, expose unplaced assets, and require explicit confirmation for geometry/BOM reconciliation. Generated CAD must say “planning concept — not for construction.”

## Image index
All images are JPG, detailed sheets about 2000px wide. The master is 4000px wide and <6MB. Total images <30MB. The cover and 13 redundant area-overview pages were omitted; every detailed floor plan and the summary maps are retained. Full original PDFs remain in source/ locally but MUST NOT be attached (oversize).
- `images/master-plan.jpg`: complete September 15, 2026 aerial master/site layout, 4000×3112px.
- `images/overlay-02.jpg`: original PDF page 2, General conditions, elevation/staking keys, constituent colors.
- `images/overlay-04.jpg`: original PDF page 4, Drawing index: entrance, practice range, district, resort, holes 1/7 and 4.
- `images/overlay-05.jpg`: original PDF page 5, Drawing index: holes 6, 9/18, 11/12, 14/15, 16/17 and Teel compounds.
- `images/overlay-06.jpg`: original PDF page 6, Drawing index: concessions, grandstands, restrooms, videoboards, player oases.
- `images/overlay-08.jpg`: original PDF page 8, 1.1 West bus slips, main terminal.
- `images/overlay-09.jpg`: original PDF page 9, 1.2 Ticket offices, scan gates, security, accessibility and check-ins.
- `images/overlay-10.jpg`: original PDF page 10, 1.3 PGA Shops, reinforced floor, loading docks, shop operations, shipping/receiving.
- `images/overlay-12.jpg`: original PDF page 12, 2.1 PGA HQ levels 1 and 2.
- `images/overlay-13.jpg`: original PDF page 13, 2.2 PGA HQ levels 3 and 4.
- `images/overlay-14.jpg`: original PDF page 14, 2.3 Media Center, desks, offices, registration, dining, kitchen and dock.
- `images/overlay-15.jpg`: original PDF page 15, 2.4 Volunteer HQ and pantry.
- `images/overlay-16.jpg`: original PDF page 16, 2.5 Coaching Center / Club Magenta lower level.
- `images/overlay-17.jpg`: original PDF page 17, 2.6 Coaching Center / Club Magenta upper level.
- `images/overlay-18.jpg`: original PDF page 18, 2.7 Choctaw Club / District Icehouse.
- `images/overlay-20.jpg`: original PDF page 20, 3.1 District Market, Choctaw activation, BOH.
- `images/overlay-21.jpg`: original PDF page 21, 3.2 Lounge by Topgolf / SRS Distribution hospitality.
- `images/overlay-22.jpg`: original PDF page 22, 3.3 Caddie dining and player recovery.
- `images/overlay-23.jpg`: original PDF page 23, 3.4 Clubhouse basement.
- `images/overlay-24.jpg`: original PDF page 24, 3.5 Clubhouse level 1.
- `images/overlay-25.jpg`: original PDF page 25, 3.6 Clubhouse level 2.
- `images/overlay-27.jpg`: original PDF page 27, 4.1 Omni main hotel.
- `images/overlay-28.jpg`: original PDF page 28, 4.2 Omni main hotel levels 1 and 2.
- `images/overlay-29.jpg`: original PDF page 29, 4.3 Pavilion.
- `images/overlay-30.jpg`: original PDF page 30, 4.4 Corporate gate and terminal.
- `images/overlay-32.jpg`: original PDF page 32, 5.1 Fan Zone, Tito’s, shade structures and video board.
- `images/overlay-33.jpg`: original PDF page 33, 5.2 #1 Market and BOH.
- `images/overlay-34.jpg`: original PDF page 34, 5.3 PGA Member Club.
- `images/overlay-36.jpg`: original PDF page 36, 6.1 Club 1916 / The Overlook.
- `images/overlay-37.jpg`: original PDF page 37, 6.2 #3 and #6 pouring bars.
- `images/overlay-39.jpg`: original PDF page 39, 7.1 Chase Sapphire Lounge.
- `images/overlay-41.jpg`: original PDF page 41, 8.1 #9 green, Elijah Craig, High Noon, Mich Ultra and grandstands.
- `images/overlay-42.jpg`: original PDF page 42, 8.2 #18 green grandstands.
- `images/overlay-43.jpg`: original PDF page 43, 8.3 Player interview area, Sky/Golf Channel/CBS/ESPN/scoring and dugout grandstand.
- `images/overlay-45.jpg`: original PDF page 45, 9.1 #11 corporate viewing, mini market and pouring bar.
- `images/overlay-46.jpg`: original PDF page 46, 9.2 #12 Market, vendor dining, volunteer oasis, ecology/ShotLink operations.
- `images/overlay-48.jpg`: original PDF page 48, 10.1 #14 pouring bar.
- `images/overlay-49.jpg`: original PDF page 49, 10.2 #14 green and #15 tee suites detail.
- `images/overlay-50.jpg`: original PDF page 50, 10.3 #14 green and #15 tee suites floor plans.
- `images/overlay-51.jpg`: original PDF page 51, 10.4 #15 green viewing.
- `images/overlay-53.jpg`: original PDF page 53, 11.1 #16 Market.
- `images/overlay-54.jpg`: original PDF page 54, 11.2 #16 fairway suites detail.
- `images/overlay-55.jpg`: original PDF page 55, 11.3 #16 fairway suites floor plans.
- `images/overlay-56.jpg`: original PDF page 56, 11.4 #16 green / #17 tee detail, kitchens and shared services.
- `images/overlay-57.jpg`: original PDF page 57, 11.5 #16 green premium suites floor plans.
- `images/overlay-58.jpg`: original PDF page 58, 11.6 #17 tee premium suites floor plans.
- `images/overlay-59.jpg`: original PDF page 59, 11.7 #17 fairway Partner Hospitality floor plans.
- `images/overlay-60.jpg`: original PDF page 60, 11.8 #17 green premium suites, #18 Market and pouring bar detail.
- `images/overlay-61.jpg`: original PDF page 61, 11.9 #17 green premium suites floor plans.
- `images/overlay-63.jpg`: original PDF page 63, 12.1 Vendor compound.
- `images/overlay-64.jpg`: original PDF page 64, 12.2 Broadcast compound.
- `images/overlay-65.jpg`: original PDF page 65, 13.0 Concessions summary map.
- `images/overlay-66.jpg`: original PDF page 66, 14.0 Grandstand summary map.
- `images/overlay-67.jpg`: original PDF page 67, 14.1 #1 tee and #8 green grandstands.
- `images/overlay-68.jpg`: original PDF page 68, 14.2 #16 and #17 green grandstands.
- `images/overlay-69.jpg`: original PDF page 69, 15.0 Restrooms summary map.
- `images/overlay-70.jpg`: original PDF page 70, 15.1 Restrooms at 1/7 fairway and 3 fairway.
- `images/overlay-71.jpg`: original PDF page 71, 15.2 Restrooms at 5 green and 8 tee.
- `images/overlay-72.jpg`: original PDF page 72, 15.3 Restrooms at 11 fairway and 12 green.
- `images/overlay-73.jpg`: original PDF page 73, 15.4 Restrooms at 14 fairway and 15 tee.
- `images/overlay-74.jpg`: original PDF page 74, 15.5 Restrooms at 9/18 tee and practice range south.
- `images/overlay-75.jpg`: original PDF page 75, 16.0 Videoboards summary map.
- `images/overlay-76.jpg`: original PDF page 76, 17.0 Player oases at 5 tee and 14 tee.
- `images/entrance-a.jpg`: 2024 full entrance and shop area concept.
- `images/entrance-1.jpg`: 2024 entrance detail 1.
- `images/entrance-2.jpg`: 2024 entrance detail 2.
- `images/shops.jpg`: 2024 shop structural/floor annotations; superseded dimensions.
- `images/media-options.jpg`: 2024 alternative media locations/options.
- `images/media-1.jpg`: 2024 media layout option 1 (30×65m).
- `images/media-2.jpg`: 2024 media layout option 2 (30×65m).

## Complete structure and area inventory
Schedule zones below are v2.2; current sheet is explicitly separate. See structures.json for px positions, variants, linked item IDs and all original specs. Unknown = null. Repeated names are separate scheduled instances. Current overlays supersede dimensions only where explicitly verified above.

|ID|Name|Type|Schedule zone / current sheet|W × L × nominal H (ft)|Levels|Nominal footprint sf|
|---|---|---|---|---|---|---|
|s-008-1|#1 MARKET|A-Frame|5.1 / 5.2|65.617 × 131.234 × 11.155|1|8611.181|
|s-009-1|#1 POURING BAR|A-Frame|5.2 / —|9.843 × 49.213 × 9.843|None|484.404|
|s-010-1|#3+5 POURING BAR|A-Frame|6.2 / —|9.843 × 39.37 × 9.843|None|387.519|
|s-011-1|#4 MARKET|A-Frame|6.2 / —|49.213 × 82.021 × 11.155|None|4036.499|
|s-012-1|#12 MARKET|A-Frame|8.3 / 9.2|65.617 × 98.425 × 11.155|None|6458.346|
|s-013-1|#14 MARKET|A-Frame|9.1 / —|49.213 × 82.021 × 11.155|None|4036.499|
|s-014-1|#16 FAIRWAY SUITES|A-Frame|10.2 / 11.3|49.213 × 229.659 × 24.278|2|11302.208|
|s-015-1|#16 MARKET|A-Frame|10.1 / —|65.617 × 98.425 × 11.155|None|6458.353|
|s-016-1|#18 MARKET|A-Frame|10.8 / —|65.617 × 98.425 × 11.155|None|6458.353|
|s-017-1|#18 POURING BAR|A-Frame|2.0 / —|9.843 × 49.213 × 9.843|None|484.404|
|s-018-1|#18 POURING BAR|A-Frame|10.8 / —|9.843 × 49.213 × 9.843|None|484.404|
|s-019-1|8 DUGOUT ENTRY|A-Frame|13.1 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-020-1|14G ENTRY N|A-Frame|9.2 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-021-1|14G ENTRY S|A-Frame|9.2 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-022-1|14G KITCHEN|A-Frame|9.2 / —|32.808 × 49.213 × 11.155|None|1614.58|
|s-023-1|14G SUITES NORTH|A-Frame|9.2 / 10.2|65.617 × 98.425 × 24.278|2|6458.353|
|s-024-1|14G SUITES SOUTH|A-Frame|9.2 / 10.2|65.617 × 131.234 × 24.278|2|8611.181|
|s-025-1|15G ENTRY|A-Frame|9.4 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-026-1|15G POURING BAR|A-Frame|9.4 / —|9.843 × 29.528 × 9.843|None|290.644|
|s-027-1|16 GREEN VILLAGE|A-Frame|10.5 / 11.5|147.638 × 114.829 × 24.278|2|16953.124|
|s-028-1|16+17 KITCHEN A|A-Frame|10.4 / —|49.213 × 49.213 × 11.155|None|2421.919|
|s-029-1|16+17 KITCHEN B|A-Frame|10.4 / —|49.213 × 49.213 × 11.155|None|2421.919|
|s-030-1|16F KITCHEN|A-Frame|10.2 / —|32.808 × 49.213 × 11.155|None|1614.58|
|s-031-1|16F N ENTRY|A-Frame|10.2 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-032-1|16F S ENTRY|A-Frame|10.2 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-033-1|16G ENTRY|A-Frame|10.5 / —|19.685 × 9.843 × 9.843|None|193.759|
|s-034-1|17 GREEN VILLAGE|A-Frame|10.9 / 11.9|65.617 × 98.425 × 24.278|2|6458.353|
|s-035-1|17 PP ENTRY|A-Frame|10.7 / —|19.685 × 9.843 × 9.843|None|193.759|
|s-036-1|17 TEE VILLAGE|A-Frame|10.6 / 11.6|147.638 × 114.829 × 24.278|2|16953.124|
|s-037-1|17G ENTRY|A-Frame|10.9 / —|19.685 × 9.843 × 9.843|None|193.759|
|s-038-1|17G KITCHEN|A-Frame|10.9 / —|39.37 × 39.37 × 9.843|None|1549.997|
|s-039-1|17T ENTRY|A-Frame|10.7 / —|19.685 × 9.843 × 9.843|None|193.759|
|s-040-1|ARENA STORAGE|A-Frame|11.1 / —|65.617 × 114.829 × 13.123|None|7534.734|
|s-041-1|BALL DISTRO|A-Frame|2.0 / —|19.685 × 9.843 × 9.843|None|193.759|
|s-042-1|BALLROOM ENTRY|A-Frame|4.0 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-043-1|CADDIE DINING|A-Frame|3.2 / —|49.213 × 98.425 × 11.155|None|4843.79|
|s-044-1|CADDIE KITCHEN|A-Frame|3.2 / —|29.528 × 29.528 × 9.843|None|871.903|
|s-045-1|CBS INTERVIEW|A-Frame|7.3 / —|19.685 × 19.685 × 9.843|None|387.499|
|s-046-1|CHASE ENTRY|A-Frame|5.3 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-047-1|CHASE SAPPHIRE LOUNGE|A-Frame|5.3 / 7.1|65.617 × 65.617 × null|1|4305.591|
|s-048-1|CHOCTAW ACTIVATION|A-Frame|3.1 / —|19.685 × 39.37 × 9.843|None|774.998|
|s-049-1|CLUB 1916 ENTRY|A-Frame|6.1 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-050-1|CLUB MAGENTA|A-Frame|8.2 / —|49.213 × 73.819 × null|None|3632.854|
|s-051-1|CORP GATE ENTRY|A-Frame|4.4 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-052-1|CORP VS ENTRY|A-Frame|8.1 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-053-1|CORPORATE VIEWING|A-Frame|8.1 / 9.1|32.808 × 164.042 × null|1|5381.89|
|s-054-1|DISTRICT MARKET|A-Frame|3.1 / —|65.617 × 98.425 × 11.155|None|6458.353|
|s-055-1|EAST RANCH ENTRY|A-Frame|4.4 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-056-1|ESPN BET|A-Frame|1.2 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-057-1|ESPN BET MEMBER'S LOUNGE|A-Frame|5.1 / —|39.37 × 78.74 × 9.843|None|3099.994|
|s-058-1|ESPN ENTRY|A-Frame|5.1 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-059-1|ESPN INTERVIEW|A-Frame|7.3 / —|14.436 × 19.685 × 9.843|None|284.173|
|s-060-1|GOSLINGS|A-Frame|7.1 / —|39.37 × 39.37 × 9.843|None|1549.997|
|s-061-1|GROUNDS HOSPITALITY|A-Frame|Other / —|39.37 × 59.055 × 9.843|None|2324.995|
|s-062-1|HIGH NOON|A-Frame|7.1 / —|39.37 × 39.37 × 9.843|None|1549.997|
|s-063-1|HOTEL ENTRY|A-Frame|4.0 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-064-1|INFO/ACCESSIBILITY SERVICES|A-Frame|1.2 / —|19.685 × 9.843 × 9.843|None|193.759|
|s-065-1|MAGENTA ENTRY|A-Frame|8.2 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-066-1|MEDIA CENTER|A-Frame|2.3 / 2.3|98.425 × 196.85 × 13.123|1|19374.961|
|s-067-1|MEDIA ENTRY|A-Frame|2.3 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-068-1|MEDIA KITCHEN|A-Frame|2.3 / 2.3|29.528 × 49.213 × 9.843|1|1453.161|
|s-069-1|MEDIA SCAN GATE|A-Frame|2.0 / —|19.685 × 9.843 × 9.843|None|193.759|
|s-070-1|MICH ULTRA BAR|A-Frame|7.1 / —|9.843 × 49.213 × 9.843|None|484.404|
|s-071-1|NEIGHBORHOOD GATE|A-Frame|9.0 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-072-1|PARTNER PAVILION|A-Frame|10.7 / 11.7|65.617 × 180.446 × 24.278|2|11840.325|
|s-073-1|PATINA CHECK-IN|A-Frame|1.2 / —|39.37 × 49.213 × 9.843|None|1937.516|
|s-074-1|PATINA OPS OFFICE|A-Frame|11.1 / —|9.843 × 29.528 × 9.843|None|290.644|
|s-075-1|PAVILION ENTRY|A-Frame|4.4 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-076-1|PDEV ENTRY|A-Frame|10.7 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-077-1|PGA HISTORY|A-Frame|5.2 / —|49.213 × 32.808 × 11.155|None|1614.58|
|s-078-1|PGA MC ENTRY|A-Frame|5.3 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-079-1|PGA MEMBER CLUB|A-Frame|5.3 / 5.3|65.617 × 65.617 × null|1|4305.591|
|s-080-1|PGA PAVILION|A-Frame|5.2 / —|114.829 × 147.638 × 13.123|None|16953.124|
|s-081-1|PGA STORAGE|A-Frame|11.1 / —|49.213 × 49.213 × 11.155|None|2421.919|
|s-082-1|PGA VOLUNTEER HQ|A-Frame|2.4 / —|82.021 × 82.021 × 11.155|None|6727.444|
|s-083-1|PLAYER INTERVIEW AREA|A-Frame|7.3 / —|32.808 × 57.415 × 11.155|None|1883.671|
|s-084-1|PLAYER RECOVERY|A-Frame|3.2 / —|19.685 × 39.37 × 9.843|None|774.998|
|s-085-1|PRODUCTION KITCHEN|A-Frame|11.1 / —|65.617 × 65.617 × 11.155|None|4305.591|
|s-086-1|RANCH CENTRAL ENTRY|A-Frame|3.0 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-087-1|RANCH WEST ENTRY|A-Frame|3.0 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-088-1|ROLEX ENTRY|A-Frame|10.7 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-089-1|SCAN GATES|A-Frame|1.2 / —|49.213 × 82.021 × 11.155|None|4036.499|
|s-090-1|SCHWAB|A-Frame|5.1 / —|57.415 × 32.808 × 11.155|None|1883.671|
|s-091-1|SCORING|A-Frame|7.3 / —|14.436 × 29.528 × 9.843|None|426.266|
|s-092-1|SKY STUDIO|A-Frame|7.3 / —|19.685 × 19.685 × 9.843|None|387.499|
|s-093-1|STARTER|A-Frame|3.0 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-094-1|STARTER|A-Frame|7.0 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-095-1|THE PGA SHOPS|A-Frame|1.3 / 1.3|131.234 × 393.701 × 13.123|1|51666.957|
|s-096-1|TICKET OFFICE|A-Frame|1.2 / —|39.37 × 39.37 × 9.843|None|1549.997|
|s-097-1|T-MOBILE CHARGE|A-Frame|1.2 / —|19.685 × 9.843 × 9.843|None|193.759|
|s-098-1|VENDOR DINING|A-Frame|8.4 / —|29.528 × 39.37 × 9.843|None|1162.517|
|s-099-1|VENDOR HOSPITALITY|A-Frame|1.3 / —|29.528 × 29.528 × 9.843|None|871.903|
|s-100-1|VOL HQ ENTRY|A-Frame|2.4 / —|9.843 × 9.843 × 9.843|None|96.885|
|s-101-1|WILLIAM HILL|A-Frame|7.1 / —|39.37 × 39.37 × 9.843|None|1549.997|
|s-106-1|#16 MARKET STORAGE|Frame tent|10.1 / —|10.0 × 40.0 × null|None|400.0|
|s-107-1|#18 MARKET STORAGE|Frame tent|10.8 / —|10.0 × 40.0 × null|None|400.0|
|s-108-1|14G PANTRY L1|Frame tent|9.2 / —|10.0 × 30.0 × null|None|300.0|
|s-109-1|14G PANTRY L2|Frame tent|9.2 / —|10.0 × 30.0 × null|None|300.0|
|s-110-1|14G PANTRY U1|Frame tent|9.2 / —|10.0 × 30.0 × null|None|300.0|
|s-111-1|14G PANTRY U2|Frame tent|9.2 / —|10.0 × 30.0 × null|None|300.0|
|s-112-1|16F PANTRY L1|Frame tent|10.2 / —|10.0 × 40.0 × null|None|400.0|
|s-113-1|16F PANTRY U1|Frame tent|10.2 / —|10.0 × 40.0 × null|None|400.0|
|s-114-1|16G PANTRY U1|Frame tent|10.5 / —|10.0 × 30.0 × null|None|300.0|
|s-115-1|ARENA|Frame tent|11.1 / —|10.0 × 10.0 × null|None|100.0|
|s-116-1|ARENA DINING|Frame tent|11.1 / —|30.0 × 50.0 × null|None|1500.0|
|s-117-1|ARENA PREP|Frame tent|11.1 / —|20.0 × 20.0 × null|None|400.0|
|s-118-1|BALL WASH|Frame tent|2.0 / —|10.0 × 10.0 × null|None|100.0|
|s-119-1|BREAK|Frame tent|2.0 / —|10.0 × 10.0 × null|None|100.0|
|s-120-1|BREAK|Frame tent|3.1 / —|10.0 × 10.0 × null|None|100.0|
|s-121-1|BREAK|Frame tent|5.1 / —|10.0 × 10.0 × null|None|100.0|
|s-121-2|BREAK|Frame tent|5.1 / —|10.0 × 10.0 × null|None|100.0|
|s-122-1|BREAK|Frame tent|5.2 / —|10.0 × 10.0 × null|None|100.0|
|s-123-1|BREAK|Frame tent|5.3 / —|10.0 × 10.0 × null|None|100.0|
|s-124-1|BREAK|Frame tent|6.2 / —|10.0 × 10.0 × null|None|100.0|
|s-125-1|BREAK|Frame tent|7.1 / —|10.0 × 10.0 × null|None|100.0|
|s-125-2|BREAK|Frame tent|7.1 / —|10.0 × 10.0 × null|None|100.0|
|s-126-1|BREAK|Frame tent|9.4 / —|10.0 × 10.0 × null|None|100.0|
|s-127-1|BREAK|Frame tent|10.1 / —|10.0 × 10.0 × null|None|100.0|
|s-128-1|BREAK|Frame tent|10.2 / —|10.0 × 10.0 × null|None|100.0|
|s-129-1|BREAK|Frame tent|10.4 / —|10.0 × 10.0 × null|None|100.0|
|s-129-2|BREAK|Frame tent|10.4 / —|10.0 × 10.0 × null|None|100.0|
|s-130-1|BREAK|Frame tent|10.8 / —|10.0 × 10.0 × null|None|100.0|
|s-130-2|BREAK|Frame tent|10.8 / —|10.0 × 10.0 × null|None|100.0|
|s-130-3|BREAK|Frame tent|10.8 / —|10.0 × 10.0 × null|None|100.0|
|s-131-1|CANOPY|Frame tent|1.3 / —|20.0 × 50.0 × null|None|1000.0|
|s-132-1|CANOPY|Frame tent|1.3 / —|20.0 × 20.0 × null|None|400.0|
|s-133-1|CANOPY|Frame tent|2.3 / —|10.0 × 70.0 × null|None|700.0|
|s-134-1|CANOPY|Frame tent|2.4 / —|10.0 × 20.0 × null|None|200.0|
|s-135-1|CANOPY|Frame tent|2.4 / —|10.0 × 60.0 × null|None|600.0|
|s-136-1|CANOPY|Frame tent|3.2 / —|10.0 × 40.0 × null|None|400.0|
|s-137-1|CANOPY|Frame tent|10.4 / —|10.0 × 80.0 × null|None|800.0|
|s-138-1|CANOPY|Frame tent|10.7 / —|10.0 × 40.0 × null|None|400.0|
|s-139-1|CANOPY|Frame tent|10.9 / —|10.0 × 40.0 × null|None|400.0|
|s-140-1|CANOPY|Frame tent|10.9 / —|10.0 × 30.0 × null|None|300.0|
|s-141-1|CANOPY|Frame tent|11.1 / —|10.0 × 30.0 × null|None|300.0|
|s-142-1|CANOPY|Frame tent|11.1 / —|20.0 × 40.0 × null|None|800.0|
|s-143-1|CANOPY|Frame tent|11.1 / —|10.0 × 10.0 × null|None|100.0|
|s-144-1|CANOPY|Frame tent|11.1 / —|10.0 × 40.0 × null|None|400.0|
|s-145-1|CANOPY|Frame tent|11.1 / —|10.0 × 50.0 × null|None|500.0|
|s-145-2|CANOPY|Frame tent|11.1 / —|10.0 × 50.0 × null|None|500.0|
|s-146-1|CANOPY|Frame tent|11.1 / —|20.0 × 60.0 × null|None|1200.0|
|s-147-1|CART CHARGING|Frame tent|11.1 / —|20.0 × 20.0 × null|None|400.0|
|s-148-1|CVS PANTRY 1|Frame tent|8.1 / —|10.0 × 20.0 × null|None|200.0|
|s-149-1|DISTRICT MARKET STORAGE|Frame tent|3.1 / —|10.0 × 40.0 × null|None|400.0|
|s-150-1|DOCK CANOPY|Frame tent|1.3 / —|20.0 × 70.0 × null|None|1400.0|
|s-150-2|DOCK CANOPY|Frame tent|1.3 / —|20.0 × 70.0 × null|None|1400.0|
|s-151-1|EC PANTRY|Frame tent|5.2 / —|10.0 × 30.0 × null|None|300.0|
|s-152-1|ECOLOGY|Frame tent|1.2 / —|20.0 × 20.0 × null|None|400.0|
|s-153-1|ESPN PANTRY|Frame tent|5.1 / —|10.0 × 30.0 × null|None|300.0|
|s-154-1|GRILL|Frame tent|3.1 / —|20.0 × 20.0 × null|None|400.0|
|s-155-1|GRILL|Frame tent|6.2 / —|20.0 × 20.0 × null|None|400.0|
|s-156-1|GRILL|Frame tent|8.3 / —|20.0 × 20.0 × null|None|400.0|
|s-157-1|GRILL|Frame tent|9.1 / —|20.0 × 20.0 × null|None|400.0|
|s-158-1|GRILL|Frame tent|10.1 / —|20.0 × 20.0 × null|None|400.0|
|s-159-1|GRILL|Frame tent|10.8 / —|20.0 × 20.0 × null|None|400.0|
|s-160-1|GRILL|Frame tent|11.1 / —|20.0 × 20.0 × null|None|400.0|
|s-161-1|GRILL TENT|Frame tent|5.1 / —|20.0 × 40.0 × null|None|800.0|
|s-162-1|HN PANTRY|Frame tent|7.1 / —|10.0 × 30.0 × null|None|300.0|
|s-163-1|MAGENTA PANTRY|Frame tent|8.2 / —|10.0 × 30.0 × null|None|300.0|
|s-164-1|PANTRY|Frame tent|3.2 / —|10.0 × 30.0 × null|None|300.0|
|s-165-1|PANTRY|Frame tent|5.3 / —|20.0 × 30.0 × null|None|600.0|
|s-166-1|PANTRY U1|Frame tent|10.9 / —|10.0 × 30.0 × null|None|300.0|
|s-167-1|PARTNER PANTRY U1|Frame tent|10.7 / —|10.0 × 30.0 × null|None|300.0|
|s-168-1|PARTNER PANTRY U2|Frame tent|10.7 / —|10.0 × 40.0 × null|None|400.0|
|s-169-1|RAMP CANOPY|Frame tent|1.3 / —|20.0 × 20.0 × null|None|400.0|
|s-170-1|RON SHOP|Frame tent|11.1 / —|20.0 × 20.0 × null|None|400.0|
|s-171-1|SCAN GATE|Frame tent|11.1 / —|10.0 × 20.0 × null|None|200.0|
|s-172-1|SCAN GATE|Frame tent|11.2 / —|10.0 × 20.0 × null|None|200.0|
|s-173-1|SECURITY OPS DISTR.|Frame tent|1.1 / —|20.0 × 20.0 × null|None|400.0|
|s-174-1|STAFF BREAK|Frame tent|11.1 / —|10.0 × 20.0 × null|None|200.0|
|s-175-1|STORAGE|Frame tent|1.0 / —|15.0 × 15.0 × null|None|225.0|
|s-176-1|STORAGE|Frame tent|5.1 / —|10.0 × 80.0 × null|None|800.0|
|s-177-1|STORAGE|Frame tent|6.2 / —|20.0 × 20.0 × null|None|400.0|
|s-178-1|STORAGE|Frame tent|8.3 / —|20.0 × 20.0 × null|None|400.0|
|s-179-1|STORAGE|Frame tent|9.1 / —|20.0 × 20.0 × null|None|400.0|
|s-180-1|STORAGE|Frame tent|11.1 / —|20.0 × 20.0 × null|None|400.0|
|s-180-2|STORAGE|Frame tent|11.1 / —|20.0 × 20.0 × null|None|400.0|
|s-181-1|TOP TRACER|Frame tent|2.0 / —|20.0 × 20.0 × null|None|400.0|
|s-182-1|VOL HQ PANTRY|Frame tent|2.4 / —|10.0 × 30.0 × null|None|300.0|
|area-001|Fan Zone|hospitality|— / 5.1|114.829 × 114.829 × 13.123|1|13185.699|
|area-002|Tito’s|activation|— / 5.1|49.213 × 82.021 × null|1|4036.466|
|area-003|PGA Headquarters|existing building|— / 2.1/2.2|null × null × null|4|None|
|area-004|PGA Coaching Center / Club Magenta|existing building hospitality|— / 2.5/2.6|null × null × null|2|None|
|area-005|Choctaw Club / District Icehouse|existing building hospitality|— / 2.7|null × null × null|None|None|
|area-006|Lounge by Topgolf / SRS Distribution hospitality|existing building hospitality|— / 3.2|null × null × null|None|None|
|area-007|Clubhouse|existing building|— / 3.4/3.5/3.6|null × null × null|3|None|
|area-008|Omni main hotel|existing building|— / 4.1/4.2|null × null × null|None|None|
|area-009|Panther Creek Pavilion|existing pavilion|— / 4.3|null × null × null|None|None|
|area-010|Corporate Gate / Terminal|access terminal|— / 4.4|null × null × null|None|None|
|area-011|Main Entrance / Main Terminal|access terminal|— / 1.0/1.1/1.2|null × null × null|None|None|
|area-012|Practice range, practice greens and short game|practice area|— / 2.0|null × null × null|None|None|
|area-013|West Ranch House hospitality|existing building hospitality|— / 3.0|null × null × null|None|None|
|area-014|Central Ranch House hospitality|existing building hospitality|— / 3.0|null × null × null|None|None|
|area-015|East Ranch House hospitality|existing building hospitality|— / 4.0|null × null × null|None|None|
|area-016|Club 1916 / The Overlook|existing building hospitality|— / 6.1|null × null × null|None|None|
|area-017|Elijah Craig|activation|— / 8.1|null × null × null|None|None|
|area-018|Hole 9 green grandstand|grandstand|— / 8.1|85 × null × null|None|None|
|area-019|Hole 18 green grandstand|grandstand|— / 8.2|130 × null × null|None|None|
|area-020|Hole 9/18 shared grandstand|grandstand|— / 8.1/8.2|98 × null × null|None|None|
|area-021|Hole 1 tee grandstand|grandstand|— / 14.1|68 × null × null|None|None|
|area-022|Hole 8 green / Dugout grandstand|grandstand|— / 14.1|95 × null × null|None|None|
|area-023|Hole 16 green grandstand|grandstand|— / 14.2|68 × null × null|None|None|
|area-024|Hole 17 green grandstand|grandstand|— / 14.2|102 × null × null|None|None|
|area-025|Vendor compound / Teel Compound 1|operations compound|— / 12.1|null × null × null|None|None|
|area-026|Broadcast compounds / Teel Compound 2|broadcast compound|— / 12.2|null × null × null|None|None|
|area-027|Corporate viewing hole 11|hospitality|— / 9.1|null × null × null|None|None|
|area-028|Player Oasis 5 tee|player tent|— / 17.0|14.436 × 39.37 × 9.843|1|568.345|
|area-029|Player Oasis 14 tee|player tent|— / 17.0|14.436 × 39.37 × 9.843|1|568.345|
|area-030|Restroom bank 1/7 fairway|restrooms|— / 15.1|null × null × null|None|None|
|area-031|Restroom bank 3 fairway|restrooms|— / 15.1|null × null × null|None|None|
|area-032|Restroom bank 5 green|restrooms|— / 15.2|null × null × null|None|None|
|area-033|Restroom bank 8 tee|restrooms|— / 15.2|null × null × null|None|None|
|area-034|Restroom bank 11 fairway|restrooms|— / 15.3|null × null × null|None|None|
|area-035|Restroom bank 12 green|restrooms|— / 15.3|null × null × null|None|None|
|area-036|Restroom bank 14 fairway|restrooms|— / 15.4|null × null × null|None|None|
|area-037|Restroom bank 15 tee|restrooms|— / 15.4|null × null × null|None|None|
|area-038|Restroom bank 9/18 tee|restrooms|— / 15.5|null × null × null|None|None|
|area-039|Restroom bank practice range south|restrooms|— / 15.5|null × null × null|None|None|
|area-040|Videoboards across course|broadcast infrastructure|— / 16.0|null × null × null|None|None|
|area-041|Concessions / mini markets across course|concessions|— / 13.0|null × null × null|None|None|
|area-042|Player / spectator bridges|bridge|— / None|null × null × null|None|None|
|area-043|Neighborhood gate|access gate|— / 10.0|null × null × null|None|None|
|area-044|High school gate|access gate|— / 1.0|null × null × null|None|None|
|area-045|First aid locations|medical|— / None|null × null × null|None|None|
