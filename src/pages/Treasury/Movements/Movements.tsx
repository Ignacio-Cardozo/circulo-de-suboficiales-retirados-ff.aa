import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TablePagination from "../../../components/TablePagination/TablePagination";
import FiltersPanel from "../../../components/filters/FiltersPanel";
import MonthFilter from "../../../components/filters/MonthFilter";
import YearFilter from "../../../components/filters/YearFilter";
import { fetchMovements, type Movement } from "../../../services/movementsApi";
import { fetchInitialBalances } from "../../../services/initialBalancesApi";
import { fetchCementerioMovimientosByNicho } from "../../../services/cementeriosApi";
import { formatCurrency, formatRecordDate } from "../../../utils/format";
import { ariaSortFor, nextSortDir, SORT_HINT, type SortDir, type SortField } from "./sorting";
import SortIcon from "./SortIcon";
import "../TreasuryTables.css";

const COMPROBANTE_DIGITS = 6;

interface MovementRow {
  id: string; date: string; fecha: string; hora: string;
  tipo: string; modalidad: string; concepto: string;
  comprobante: string;
  ingreso: string; egreso: string;
  saldoBanco: string | null; saldoCajaChica: string | null;
  dateObj: Date; created_at: string; anulado: boolean;
  comprobanteNum: number | null;
  montoIngreso: number | null;
  montoEgreso: number | null;
  saldoBancoNum: number | null;
  saldoCajaChicaNum: number | null;
}

const formatComprobante = (receiptNumber: number | null | undefined) =>
  receiptNumber != null ? String(receiptNumber).padStart(COMPROBANTE_DIGITS, "0") : "\u2014";

/** Escribe el input del filtro como numero de 6 digitos con zero-fill a la izquierda (39 -> 000039) */
const padComprobanteInput = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(-COMPROBANTE_DIGITS);
  return digits ? digits.padStart(COMPROBANTE_DIGITS, "0") : "";
};

const compareNullable = (a: number | null, b: number | null, dir: 1 | -1) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * dir;
};

function compareRows(a: MovementRow, b: MovementRow, field: SortField, dir: 1 | -1): number {
  switch (field) {
    case "fecha": {
      const r = a.date.localeCompare(b.date) * dir;
      if (r !== 0) return r;
      return a.created_at.localeCompare(b.created_at) * dir;
    }
    case "comprobante": return compareNullable(a.comprobanteNum, b.comprobanteNum, dir);
    case "tipo": return a.tipo.localeCompare(b.tipo, "es", { sensitivity: "base" }) * dir;
    case "modalidad": return a.modalidad.localeCompare(b.modalidad, "es", { sensitivity: "base" }) * dir;
    case "concepto": return a.concepto.localeCompare(b.concepto, "es", { sensitivity: "base" }) * dir;
    case "ingreso": return compareNullable(a.montoIngreso, b.montoIngreso, dir);
    case "egreso": return compareNullable(a.montoEgreso, b.montoEgreso, dir);
    case "saldoBanco": return compareNullable(a.saldoBancoNum, b.saldoBancoNum, dir);
    case "saldoCajaChica": return compareNullable(a.saldoCajaChicaNum, b.saldoCajaChicaNum, dir);
  }
}

const Movements: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const nichoFilter = searchParams.get("nicho") || "";
  const memberIdFilter = searchParams.get("memberId") || "";
  const personIdFilter = searchParams.get("personId") || "";

  const [rawMovements, setRawMovements] = useState<Movement[]>([]);
  const [initialBanco, setInitialBanco] = useState(0);
  const [initialCajaChica, setInitialCajaChica] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const [showSaldoColumns, setShowSaldoColumns] = useState(true);
  const [cajaBanco, setCajaBanco] = useState(true);
  const [cajaChica, setCajaChica] = useState(true);
  const [filtroIngreso, setFiltroIngreso] = useState(true);
  const [filtroEgreso, setFiltroEgreso] = useState(true);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [nichoMovementIds, setNichoMovementIds] = useState<Set<string> | null>(null);
  const [comprobanteDesde, setComprobanteDesde] = useState("");
  const [comprobanteHasta, setComprobanteHasta] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const m of rawMovements) {
      const d = new Date(m.date + "T12:00:00");
      years.add(d.getFullYear());
    }
    return [...years].sort((a, b) => b - a);
  }, [rawMovements]);

  const [prevNichoFilter, setPrevNichoFilter] = useState(nichoFilter);
  if (prevNichoFilter !== nichoFilter) {
    setPrevNichoFilter(nichoFilter);
    setNichoMovementIds(null);
  }

  useEffect(() => {
    if (!nichoFilter) return;
    let mounted = true;
    fetchCementerioMovimientosByNicho(
      nichoFilter,
      memberIdFilter || null,
      personIdFilter || null,
    )
      .then((records) => {
        if (!mounted) return;
        const ids = new Set(records.map((r) => r.movement_id).filter(Boolean) as string[]);
        setNichoMovementIds(ids);
      })
      .catch(() => { if (mounted) setNichoMovementIds(new Set()); });
    return () => { mounted = false; };
  }, [nichoFilter, memberIdFilter, personIdFilter]);

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchMovements(), fetchInitialBalances()])
      .then(([data, balances]) => {
        if (!mounted) return;
        setRawMovements(data);
        setInitialBanco(balances?.banco ?? 0);
        setInitialCajaChica(balances?.caja_chica ?? 0);
        if (data.length > 0) {
          const now = new Date();
          setSelectedMonths([now.getMonth()]);
          setSelectedYears([now.getFullYear()]);
        } else {
          const now = new Date();
          setSelectedMonths([now.getMonth()]);
          setSelectedYears([now.getFullYear()]);
        }
        setIsLoading(false);
      })
      .catch((err) => { if (mounted) { setError(err.message || "Error al cargar movimientos."); setIsLoading(false); } });
    return () => { mounted = false; };
  }, []);

  const { movementsWithSaldo, finalBanco, finalCajaChica } = useMemo(() => {
    let rb = initialBanco;
    let rc = initialCajaChica;
    const items: MovementRow[] = [];
    for (const m of rawMovements) {
      if (!m.anulado) {
        if (m.type === "ingreso") { if (m.mode === "transferencia") rb += m.amount; if (m.mode === "efectivo") rc += m.amount; }
        else if (m.type === "egreso") { if (m.mode === "transferencia") rb -= m.amount; if (m.mode === "efectivo") rc -= m.amount; }
      }
      const fecha = formatRecordDate(m.date);
      let hora = "";
      if (m.created_at) {
        const d = new Date(m.created_at);
        hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
      const saldoBancoNum = m.mode === "transferencia" ? rb : null;
      const saldoCajaChicaNum = m.mode === "efectivo" ? rc : null;
      items.push({
        id: m.id, date: m.date, fecha, hora,
        tipo: m.type === "ingreso" ? "Ingreso" : m.type === "egreso" ? "Egreso" : "Transferencia",
        modalidad: m.mode === "efectivo" ? "Efectivo" : "Transferencia",
        concepto: m.detail ?? "",
        comprobante: formatComprobante(m.comprobante?.receipt_number),
        comprobanteNum: m.comprobante?.receipt_number ?? null,
        ingreso: m.type === "ingreso" ? formatCurrency(m.amount) : "-",
        egreso: m.type === "egreso" ? formatCurrency(m.amount) : "-",
        montoIngreso: m.type === "ingreso" ? m.amount : null,
        montoEgreso: m.type === "egreso" ? m.amount : null,
        saldoBanco: saldoBancoNum !== null ? formatCurrency(saldoBancoNum) : null,
        saldoCajaChica: saldoCajaChicaNum !== null ? formatCurrency(saldoCajaChicaNum) : null,
        saldoBancoNum,
        saldoCajaChicaNum,
        dateObj: new Date(m.date + "T12:00:00"),
        created_at: m.created_at ?? "",
        anulado: m.anulado ?? false,
      });
    }
    return { movementsWithSaldo: items, finalBanco: rb, finalCajaChica: rc };
  }, [rawMovements, initialBanco, initialCajaChica]);

  const comprobanteMin = useMemo(() => {
    const desde = comprobanteDesde ? parseInt(comprobanteDesde, 10) : null;
    const hasta = comprobanteHasta ? parseInt(comprobanteHasta, 10) : null;
    if (desde !== null && hasta !== null) return Math.min(desde, hasta);
    return desde ?? hasta;
  }, [comprobanteDesde, comprobanteHasta]);

  const comprobanteMax = useMemo(() => {
    const desde = comprobanteDesde ? parseInt(comprobanteDesde, 10) : null;
    const hasta = comprobanteHasta ? parseInt(comprobanteHasta, 10) : null;
    if (desde !== null && hasta !== null) return Math.max(desde, hasta);
    return hasta ?? desde;
  }, [comprobanteDesde, comprobanteHasta]);

  const filteredMovements = useMemo(() => {
    const search = searchText.toLowerCase().trim();
    const hasYear = selectedYears.length > 0;
    const hasMonth = selectedMonths.length > 0;
    return movementsWithSaldo
      .filter((m) => {
        if (nichoMovementIds && !nichoMovementIds.has(m.id)) return false;
        if (hasYear || hasMonth) {
          const d = m.dateObj;
          if (hasYear && !selectedYears.includes(d.getFullYear())) return false;
          if (hasMonth && !selectedMonths.includes(d.getMonth())) return false;
        }
        if (comprobanteMin !== null || comprobanteMax !== null) {
          if (m.comprobanteNum === null) return false;
          if (comprobanteMin !== null && m.comprobanteNum < comprobanteMin) return false;
          if (comprobanteMax !== null && m.comprobanteNum > comprobanteMax) return false;
        }
        const modeMatch = (cajaBanco && m.modalidad === "Transferencia") || (cajaChica && m.modalidad === "Efectivo");
        if (!cajaBanco && !cajaChica) return false;
        if (!modeMatch) return false;
        if (search && !m.concepto.toLowerCase().includes(search) && !m.comprobante.toLowerCase().includes(search)) return false;
        if (m.tipo === "Transferencia") return false;
        if (m.tipo === "Ingreso" && !filtroIngreso) return false;
        if (m.tipo === "Egreso" && !filtroEgreso) return false;
        return true;
      })
  }, [movementsWithSaldo, searchText, selectedMonths, selectedYears, cajaBanco, cajaChica, filtroIngreso, filtroEgreso, nichoMovementIds, comprobanteMin, comprobanteMax]);

  const sortedMovements = useMemo(() => {
    if (!sortField || !sortDir) return filteredMovements;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filteredMovements].sort((a, b) => compareRows(a, b, sortField, dir));
  }, [filteredMovements, sortField, sortDir]);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const totalItems = sortedMovements.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage);

  const filterDeps = `${searchText}|${selectedMonths.join(',')}|${selectedYears.join(',')}|${cajaBanco}|${cajaChica}|${filtroIngreso}|${filtroEgreso}|${comprobanteDesde}|${comprobanteHasta}|${sortField ?? ''}|${sortDir ?? ''}`;
  const [prevFilterDeps, setPrevFilterDeps] = useState(filterDeps);
  if (filterDeps !== prevFilterDeps) {
    setPrevFilterDeps(filterDeps);
    setCurrentPage(1);
  }

  const safePage = Math.min(Math.max(1, currentPage), totalPages || 1);
  const startIndex = (safePage - 1) * rowsPerPage;
  const paginatedMovements = sortedMovements.slice(startIndex, startIndex + rowsPerPage);

  const toggleMonth = (m: number) => setSelectedMonths((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  const toggleYear = (y: number) => setSelectedYears((prev) => prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y]);

  const handleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir("asc");
      return;
    }
    const next = nextSortDir(sortDir);
    setSortField(next === null ? null : field);
    setSortDir(next);
  };

  const clearFilters = () => {
    const now = new Date();
    setSearchText("");
    setSelectedMonths([now.getMonth()]);
    setSelectedYears([now.getFullYear()]);
    setCajaBanco(true);
    setCajaChica(true);
    setFiltroIngreso(true);
    setFiltroEgreso(true);
    setComprobanteDesde("");
    setComprobanteHasta("");
    setSearchParams({});
  };

  if (isLoading) return <div className="dashboard-loading">Cargando movimientos...</div>;
  if (error) return <div className="dashboard-loading" style={{ color: "var(--danger)" }}>Error: {error}</div>;

  const ultimoSaldoBanco = formatCurrency(finalBanco);
  const ultimoSaldoCajaChica = formatCurrency(finalCajaChica);

  return (
    <div className="treasury-container">
      <FiltersPanel
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((v) => !v)}
        onClearFilters={clearFilters}
        showSaldos={showSaldoColumns}
        onToggleSaldos={() => setShowSaldoColumns((v) => !v)}
        showSaldosLabel="Saldos"
        nichoFilter={nichoFilter}
        onClearNichoFilter={() => setSearchParams({})}
        topContent={
          <div className="filter-group" style={{ flex: 1, minWidth: 0 }}>
            <span className="filter-group-label">Buscar</span>
            <div className="search-wrapper" style={{ width: "100%", minWidth: 0, marginRight: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input autoComplete="off" type="text" className="search-input" placeholder="Buscar..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            </div>
          </div>
        }
      >
        <div className="filters-bottom-left">
          <div className="filter-group">
            <span className="filter-group-label">Tipo</span>
            <div className="filter-btns">
              <button className={`filter-btn ${filtroIngreso ? "active" : ""}`} onClick={() => setFiltroIngreso((v) => !v)}>Ingreso</button>
              <button className={`filter-btn ${filtroEgreso ? "active" : ""}`} onClick={() => setFiltroEgreso((v) => !v)}>Egreso</button>
            </div>
          </div>
          <YearFilter availableYears={availableYears} selectedYears={selectedYears} onToggleYear={toggleYear} isOpen={yearDropdownOpen} onToggleOpen={() => setYearDropdownOpen((v) => !v)} />
          <MonthFilter selectedMonths={selectedMonths} onToggleMonth={toggleMonth} isOpen={monthDropdownOpen} onToggleOpen={() => setMonthDropdownOpen((v) => !v)} />
          <div className="filter-group">
            <span className="filter-group-label" title="Se completa con ceros a la izquierda. Ej: 39 se muestra como 000039.">Nº de comprobante</span>
            <div className="num-range-inputs">
              <input
                autoComplete="off"
                inputMode="numeric"
                type="text"
                className="num-input"
                placeholder="Desde"
                aria-label="Numero de comprobante desde"
                value={comprobanteDesde}
                onChange={(e) => setComprobanteDesde(padComprobanteInput(e.target.value))}
              />
              <span className="date-separator">–</span>
              <input
                autoComplete="off"
                inputMode="numeric"
                type="text"
                className="num-input"
                placeholder="Hasta"
                aria-label="Numero de comprobante hasta"
                value={comprobanteHasta}
                onChange={(e) => setComprobanteHasta(padComprobanteInput(e.target.value))}
              />
            </div>
          </div>
        </div>
        <div className="filters-bottom-right">
          <button className={`caja-card-toggle-sm ${cajaBanco ? "active" : "inactive"}`} onClick={() => setCajaBanco((v) => !v)}>
            <span className="caja-card-label">Banco</span>
            <span className="caja-card-value">{ultimoSaldoBanco}</span>
          </button>
          <button className={`caja-card-toggle-sm ${cajaChica ? "active" : "inactive"}`} onClick={() => setCajaChica((v) => !v)}>
            <span className="caja-card-label">Caja Chica</span>
            <span className="caja-card-value">{ultimoSaldoCajaChica}</span>
          </button>
        </div>
      </FiltersPanel>

      <div className="table-card">
        <div className="table-wrapper">
          <table className="treasury-table">
            <thead>
              <tr>
                <th className="sortable-th" onClick={() => handleSort("fecha")} aria-sort={ariaSortFor("fecha", sortField, sortDir)} title={SORT_HINT}>
                  Fecha <SortIcon field="fecha" currentSort={sortField} currentDir={sortDir} />
                </th>
                <th className="sortable-th col-comprobante" onClick={() => handleSort("comprobante")} aria-sort={ariaSortFor("comprobante", sortField, sortDir)} title={SORT_HINT}>
                  Comprobante <SortIcon field="comprobante" currentSort={sortField} currentDir={sortDir} />
                </th>
                <th className="sortable-th" onClick={() => handleSort("tipo")} aria-sort={ariaSortFor("tipo", sortField, sortDir)} title={SORT_HINT}>
                  Tipo <SortIcon field="tipo" currentSort={sortField} currentDir={sortDir} />
                </th>
                <th className="sortable-th" onClick={() => handleSort("modalidad")} aria-sort={ariaSortFor("modalidad", sortField, sortDir)} title={SORT_HINT}>
                  Modalidad <SortIcon field="modalidad" currentSort={sortField} currentDir={sortDir} />
                </th>
                <th className="sortable-th" onClick={() => handleSort("concepto")} aria-sort={ariaSortFor("concepto", sortField, sortDir)} title={SORT_HINT}>
                  Concepto <SortIcon field="concepto" currentSort={sortField} currentDir={sortDir} />
                </th>
                <th className="sortable-th" onClick={() => handleSort("ingreso")} aria-sort={ariaSortFor("ingreso", sortField, sortDir)} title={SORT_HINT}>
                  Ingreso <SortIcon field="ingreso" currentSort={sortField} currentDir={sortDir} />
                </th>
                <th className="sortable-th" onClick={() => handleSort("egreso")} aria-sort={ariaSortFor("egreso", sortField, sortDir)} title={SORT_HINT}>
                  Egreso <SortIcon field="egreso" currentSort={sortField} currentDir={sortDir} />
                </th>
                {showSaldoColumns && (
                  <>
                    <th className="sortable-th" onClick={() => handleSort("saldoBanco")} aria-sort={ariaSortFor("saldoBanco", sortField, sortDir)} title={SORT_HINT}>
                      Saldo Banco <SortIcon field="saldoBanco" currentSort={sortField} currentDir={sortDir} />
                    </th>
                    <th className="sortable-th" onClick={() => handleSort("saldoCajaChica")} aria-sort={ariaSortFor("saldoCajaChica", sortField, sortDir)} title={SORT_HINT}>
                      Saldo Caja Chica <SortIcon field="saldoCajaChica" currentSort={sortField} currentDir={sortDir} />
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedMovements.length === 0 ? (
                <tr><td colSpan={showSaldoColumns ? 9 : 7} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>No se encontraron movimientos con los filtros aplicados.</td></tr>
              ) : (
                paginatedMovements.map((m, idx) => (
                  <tr key={idx} className={`clickable-row${m.anulado ? " row-anulado" : ""}`} onClick={() => navigate(`/tesoreria/movimientos/detalle/${m.id}`)}>
                    <td className="col-fecha">{m.fecha}{m.hora && <span className="col-hora"> {m.hora}</span>}{m.anulado && <span className="badge badge-anulado">ANULADO</span>}</td>
                    <td className="col-comprobante">{m.comprobante}</td>
                    <td><span className={`badge ${m.tipo === "Ingreso" ? "badge-ingreso" : "badge-egreso"}`}>{m.tipo}</span></td>
                    <td>{m.modalidad}</td><td>{m.concepto}</td>
                    <td className="amount-ingreso">{m.ingreso}</td><td className="amount-egreso">{m.egreso}</td>
                    {showSaldoColumns && <><td className="amount-saldo">{m.saldoBanco ?? "\u2014"}</td><td className="amount-saldo">{m.saldoCajaChica ?? "\u2014"}</td></>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination currentPage={currentPage} totalItems={totalItems} rowsPerPage={rowsPerPage} itemLabel="movimientos" onPageChange={setCurrentPage} onRowsPerPageChange={(rows) => { setRowsPerPage(rows); setCurrentPage(1); }} />
      </div>
    </div>
  );
};

export default Movements;
