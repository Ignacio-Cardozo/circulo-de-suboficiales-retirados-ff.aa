export type SortDir = "asc" | "desc" | null;

export const SORT_HINT = "Ordenar: ascendente \u2192 descendente \u2192 desactivado";

export const nextSortDir = (current: SortDir): SortDir =>
  current === "asc" ? "desc" : current === "desc" ? null : "asc";

export const compareNullable = (
  a: number | null,
  b: number | null,
  dir: 1 | -1,
): number => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * dir;
};

export const compareText = (a: string, b: string, dir: 1 | -1): number =>
  (a || "").localeCompare(b || "", "es", {
    sensitivity: "base",
    numeric: true,
  }) * dir;
