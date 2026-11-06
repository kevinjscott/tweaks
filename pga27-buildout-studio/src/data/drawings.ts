import idx from "./image-index.json";

export interface Drawing {
  file: string;
  title: string;
  page: number | null;
  kind: "master" | "overlay" | "concept";
}

const extras: Drawing[] = [
  { file: "master-plan.jpg", title: "Master plan: complete Sep 15, 2026 aerial site layout (4000 x 3112 px)", page: null, kind: "master" },
  { file: "entrance-a.jpg", title: "2024 full entrance and shop area concept", page: null, kind: "concept" },
  { file: "entrance-1.jpg", title: "2024 entrance detail 1", page: null, kind: "concept" },
  { file: "entrance-2.jpg", title: "2024 entrance detail 2", page: null, kind: "concept" },
  { file: "shops.jpg", title: "2024 shop structural / floor annotations (superseded dimensions)", page: null, kind: "concept" },
  { file: "media-options.jpg", title: "2024 alternative media locations / options", page: null, kind: "concept" },
  { file: "media-1.jpg", title: "2024 media layout option 1 (30 x 65 m)", page: null, kind: "concept" },
  { file: "media-2.jpg", title: "2024 media layout option 2 (30 x 65 m)", page: null, kind: "concept" },
];

export const DRAWINGS: Drawing[] = [
  ...extras.slice(0, 1),
  ...(idx.images as { file: string; original_pdf_page: number; description: string }[]).map((i) => ({
    file: i.file.replace("images/", ""),
    title: i.description,
    page: i.original_pdf_page,
    kind: "overlay" as const,
  })),
  ...extras.slice(1),
];
