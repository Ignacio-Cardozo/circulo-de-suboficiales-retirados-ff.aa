export type SortField =
  | "fecha"
  | "comprobante"
  | "tipo"
  | "modalidad"
  | "concepto"
  | "ingreso"
  | "egreso"
  | "saldoBanco"
  | "saldoCajaChica";

/** null = ordenamiento desactivado (estado natural de la grilla) */
export type SortDir = "asc" | "desc" | null;

export const SORT_HINT = "Ordenar: ascendente \u2192 descendente \u2192 desactivado";

/** Ciclo tri-estado: ascendente -> descendente -> desactivado -> ascendente */
export const nextSortDir = (current: SortDir): SortDir =>
  current === "asc" ? "desc" : current === "desc" ? null : "asc";

export const ariaSortFor = (field: SortField, currentSort: SortField | null, currentDir: SortDir) => {
  if (currentSort !== field || !currentDir) return "none" as const;
  return currentDir === "asc" ? ("ascending" as const) : ("descending" as const);
};
