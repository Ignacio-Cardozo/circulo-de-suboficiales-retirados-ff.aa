import React, { useState, useEffect, useMemo } from "react";
import { ExternalLink, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";
import TablePagination from "../../../components/TablePagination/TablePagination";
import FiltersPanel from "../../../components/filters/FiltersPanel";
import MonthFilter from "../../../components/filters/MonthFilter";
import YearFilter from "../../../components/filters/YearFilter";
import ServiceRecordModal from "../../../components/service/ServiceRecordModal";
import SpecialServiceMovementsModal from "../../../components/service/SpecialServiceMovementsModal";
import SpecialServiceRecordDetailModal from "../../Calendario/SpecialServiceRecordDetailModal";
import { fetchServiceRecords, type ServiceRecordItem } from "../../../services/serviceRecordsApi";
import {
    fetchSpecialServiceRecords,
    type SpecialServiceRecordItem,
} from "../../../services/specialServiceRecordsApi";
import { toCurrency, formatRecordDate } from "../../../utils/format";
import "../TreasuryTables.css";
import "./ServiceHistory.css";

/** Fila de la grilla: un servicio común (pago único) o un servicio especial (varios movimientos). */
type HistoryRow =
    | {
          kind: "comun";
          key: string;
          /** Fecha usada para ordenar y filtrar por año/mes. */
          filterDate: string;
          record: ServiceRecordItem;
      }
    | {
          kind: "especial";
          key: string;
          filterDate: string;
          record: SpecialServiceRecordItem;
      };

function toCommonRow(record: ServiceRecordItem): HistoryRow {
    return { kind: "comun", key: `c-${record.id}`, filterDate: record.date, record };
}

function toSpecialRow(record: SpecialServiceRecordItem): HistoryRow {
    // Los servicios especiales no tienen un único pago: se ubican por la fecha del servicio.
    return {
        kind: "especial",
        key: `e-${record.id}`,
        filterDate: (record.service_date ?? record.date).split("T")[0],
        record,
    };
}

function getServiceName(row: HistoryRow): string {
    return (row.kind === "comun" ? row.record.service_name : row.record.special_service_name) ?? "—";
}

function getTitular(row: HistoryRow): string {
    const r = row.record;
    if (r.member_nombre) return `${r.member_nombre}${r.member_numero_de_socio ? ` (Nº ${r.member_numero_de_socio})` : ""}`;
    return r.person_nombre ?? "—";
}

function getDetail(row: HistoryRow): string {
    return row.kind === "comun" ? row.record.detail ?? "" : row.record.special_service_detail ?? "";
}

const ServiceHistory: React.FC = () => {
    const [rows, setRows] = useState<HistoryRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchText, setSearchText] = useState("");
    const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
    const [selectedYears, setSelectedYears] = useState<number[]>([]);
    const [showCommon, setShowCommon] = useState(true);
    const [showSpecial, setShowSpecial] = useState(true);
    const [showFilters, setShowFilters] = useState(true);
    const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
    const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(15);
    const [selectedRecord, setSelectedRecord] = useState<ServiceRecordItem | null>(null);
    const [selectedSpecialRecord, setSelectedSpecialRecord] = useState<SpecialServiceRecordItem | null>(null);
    const [movementsRecord, setMovementsRecord] = useState<SpecialServiceRecordItem | null>(null);

    const availableYears = useMemo(() => {
        const years = new Set<number>();
        for (const r of rows) { const d = new Date(r.filterDate + "T12:00:00"); years.add(d.getFullYear()); }
        return [...years].sort((a, b) => b - a);
    }, [rows]);

    useEffect(() => {
        let mounted = true;
        Promise.all([fetchServiceRecords(), fetchSpecialServiceRecords()])
            .then(([common, special]) => {
                if (!mounted) return;
                setRows([...common.map(toCommonRow), ...special.map(toSpecialRow)]);
                setIsLoading(false);
            })
            .catch((err) => { if (mounted) { setError(err.message || "Error al cargar registros de servicios."); setIsLoading(false); } });
        return () => { mounted = false; };
    }, []);

    // Mantiene la fila al día cuando se edita o cancela un servicio especial desde su detalle.
    const updateSpecialRow = (record: SpecialServiceRecordItem) => {
        setSelectedSpecialRecord(record);
        setRows((prev) => prev.map((row) => (row.kind === "especial" && row.record.id === record.id ? toSpecialRow(record) : row)));
    };

    const filteredRows = useMemo(() => {
        const search = searchText.toLowerCase().trim();
        const hasYear = selectedYears.length > 0;
        const hasMonth = selectedMonths.length > 0;
        return rows
            .filter((r) => {
                if (r.kind === "comun" && !showCommon) return false;
                if (r.kind === "especial" && !showSpecial) return false;
                const d = new Date(r.filterDate + "T12:00:00");
                if (hasYear && !selectedYears.includes(d.getFullYear())) return false;
                if (hasMonth && !selectedMonths.includes(d.getMonth())) return false;
                if (search) {
                    const matchSearch =
                        getServiceName(r).toLowerCase().includes(search) ||
                        getTitular(r).toLowerCase().includes(search) ||
                        getDetail(r).toLowerCase().includes(search);
                    if (!matchSearch) return false;
                }
                return true;
            })
            .sort((a, b) => b.filterDate.localeCompare(a.filterDate));
    }, [rows, searchText, selectedMonths, selectedYears, showCommon, showSpecial]);

    const totalItems = filteredRows.length;
    const totalPages = Math.ceil(totalItems / rowsPerPage);

    const filterDeps = `${searchText}|${selectedMonths.join(',')}|${selectedYears.join(',')}|${showCommon}|${showSpecial}`;
    const [prevFilterDeps, setPrevFilterDeps] = useState(filterDeps);
    if (filterDeps !== prevFilterDeps) {
        setPrevFilterDeps(filterDeps);
        setCurrentPage(1);
    }

    const safePage = Math.min(Math.max(1, currentPage), totalPages || 1);
    const startIndex = (safePage - 1) * rowsPerPage;
    const paginatedRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);
    const toggleMonth = (m: number) => setSelectedMonths((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
    const toggleYear = (y: number) => setSelectedYears((prev) => prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y]);
    const clearFilters = () => { setSearchText(""); setSelectedMonths([]); setSelectedYears([]); setShowCommon(true); setShowSpecial(true); };

    if (isLoading) return <div className="dashboard-loading">Cargando historial de servicios...</div>;
    if (error) return <div className="dashboard-loading" style={{ color: "var(--danger)" }}>Error: {error}</div>;

    return (
        <div className="treasury-container">
            <FiltersPanel
                showFilters={showFilters}
                onToggleFilters={() => setShowFilters((v) => !v)}
                onClearFilters={clearFilters}
                topContent={
                    <div className="filter-group" style={{ flex: 1, minWidth: 0 }}>
                        <span className="filter-group-label">Buscar</span>
                        <div className="search-wrapper" style={{ width: "100%", minWidth: 0, marginRight: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                            <input autoComplete="off" type="text" className="search-input" placeholder="Buscar por servicio, titular o detalle..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
                        </div>
                    </div>
                }
            >
                <div className="filters-bottom-left">
                    <div className="filter-group">
                        <span className="filter-group-label">Tipo</span>
                        <div className="filter-btns">
                            <button className={`filter-btn ${showCommon ? "active" : ""}`} onClick={() => setShowCommon((v) => !v)}>Común</button>
                            <button className={`filter-btn ${showSpecial ? "active" : ""}`} onClick={() => setShowSpecial((v) => !v)}>Especial</button>
                        </div>
                    </div>
                    <YearFilter availableYears={availableYears} selectedYears={selectedYears} onToggleYear={toggleYear} isOpen={yearDropdownOpen} onToggleOpen={() => setYearDropdownOpen((v) => !v)} />
                    <MonthFilter selectedMonths={selectedMonths} onToggleMonth={toggleMonth} isOpen={monthDropdownOpen} onToggleOpen={() => setMonthDropdownOpen((v) => !v)} />
                </div>
            </FiltersPanel>

            <div className="table-card">
                <div className="table-wrapper">
                    <table className="treasury-table service-history-table">
                        <thead>
                            <tr><th>Tipo</th><th>Fecha pago</th><th>Fecha servicio</th><th>Servicio</th><th>Titular</th><th>Importe</th><th>Movimientos</th></tr>
                        </thead>
                        <tbody>
                            {paginatedRows.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>No se encontraron registros de servicios con los filtros aplicados.</td></tr>
                            ) : (
                                paginatedRows.map((row) => (
                                    <tr
                                        key={row.key}
                                        className="clickable-row"
                                        onClick={() => {
                                            if (row.kind === "comun") setSelectedRecord(row.record);
                                            else setSelectedSpecialRecord(row.record);
                                        }}
                                    >
                                        <td>
                                            <span className={`service-kind-badge ${row.kind === "comun" ? "is-common" : "is-special"}`}>
                                                {row.kind === "comun" ? "Común" : "Especial"}
                                            </span>
                                        </td>
                                        {/* Los especiales se pagan en varios movimientos: sólo se muestra la fecha del servicio. */}
                                        <td>{row.kind === "comun" ? formatRecordDate(row.record.date) : "—"}</td>
                                        <td>{row.record.service_date ? formatRecordDate(row.record.service_date) : "—"}</td>
                                        <td>{getServiceName(row)}</td>
                                        <td>{getTitular(row)}</td>
                                        <td className="amount-ingreso">{toCurrency(row.record.amount)}</td>
                                        <td>
                                            {row.kind === "comun" ? (
                                                row.record.movement_id && (
                                                    <Link
                                                        className="link-btn"
                                                        to={`/tesoreria/movimientos/detalle/${row.record.movement_id}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        Ver <ExternalLink size={12} />
                                                    </Link>
                                                )
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="link-btn"
                                                    onClick={(e) => { e.stopPropagation(); setMovementsRecord(row.record); }}
                                                >
                                                    Movimientos <ListChecks size={12} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <TablePagination currentPage={currentPage} totalItems={totalItems} rowsPerPage={rowsPerPage} itemLabel="registros de servicios" onPageChange={setCurrentPage} onRowsPerPageChange={(r) => { setRowsPerPage(r); setCurrentPage(1); }} />
            </div>

            <ServiceRecordModal
                record={selectedRecord}
                onClose={() => setSelectedRecord(null)}
                showMovementLink
                showTitularLink
            />

            {selectedSpecialRecord && (
                <SpecialServiceRecordDetailModal
                    key={selectedSpecialRecord.id}
                    record={selectedSpecialRecord}
                    onClose={() => setSelectedSpecialRecord(null)}
                    onUpdated={updateSpecialRow}
                    onCancelled={updateSpecialRow}
                />
            )}

            {movementsRecord && (
                <SpecialServiceMovementsModal
                    key={movementsRecord.id}
                    record={movementsRecord}
                    onClose={() => setMovementsRecord(null)}
                />
            )}
        </div>
    );
};

export default ServiceHistory;
