import React, { useEffect, useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import TablePagination from "../../components/TablePagination/TablePagination";
import SortIcon from "../../components/ui/SortIcon";
import "../Treasury/TreasuryTables.css";
import { usePersonsListStore } from "../../store/personsListStore";
import type { Person } from "../../models/members";
import { compareText, nextSortDir, SORT_HINT, type SortDir } from "../../utils/sort";

type PersonSortField =
  | "nombre"
  | "tipoDoc"
  | "documento"
  | "domicilio"
  | "telefono"
  | "brindaServicios";

function comparePersons(
  a: Person,
  b: Person,
  field: PersonSortField,
  dir: 1 | -1,
): number {
  if (field === "brindaServicios") {
    const av = a.brindaServicios ? 1 : 0;
    const bv = b.brindaServicios ? 1 : 0;
    return (av - bv) * dir;
  }
  return compareText(a[field], b[field], dir);
}

const Persons: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const allPersons = usePersonsListStore((s) => s.allPersons);
  const searchText = usePersonsListStore((s) => s.searchText);
  const currentPage = usePersonsListStore((s) => s.currentPage);
  const rowsPerPage = usePersonsListStore((s) => s.rowsPerPage);
  const isLoading = usePersonsListStore((s) => s.isLoading);
  const error = usePersonsListStore((s) => s.error);
  const loadPersons = usePersonsListStore((s) => s.loadPersons);
  const setSearchText = usePersonsListStore((s) => s.setSearchText);
  const setCurrentPage = usePersonsListStore((s) => s.setCurrentPage);
  const setRowsPerPage = usePersonsListStore((s) => s.setRowsPerPage);

  const [sortField, setSortField] = useState<PersonSortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  useEffect(() => {
    void loadPersons();
  }, [loadPersons, location.key]);

  const filtered = useMemo(() => {
    const s = searchText.toLowerCase().trim();
    if (!s) return allPersons;
    return allPersons.filter(
      (p) =>
        p.nombre.toLowerCase().includes(s) ||
        p.documento.includes(s) ||
        p.telefono.includes(s),
    );
  }, [allPersons, searchText]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (!sortField || !sortDir) {
      return list.sort((a, b) => compareText(a.nombre, b.nombre, 1));
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return list.sort((a, b) => comparePersons(a, b, sortField, dir));
  }, [filtered, sortField, sortDir]);

  const handleSort = (field: PersonSortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir("asc");
      setCurrentPage(1);
      return;
    }
    const next = nextSortDir(sortDir);
    setSortField(next === null ? null : field);
    setSortDir(next);
    setCurrentPage(1);
  };

  const dirFor = (field: PersonSortField): SortDir =>
    sortField === field ? sortDir : null;

  const ariaSortFor = (field: PersonSortField) => {
    const dir = dirFor(field);
    if (dir === "asc") return "ascending" as const;
    if (dir === "desc") return "descending" as const;
    return "none" as const;
  };

  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const paginated = sorted.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="treasury-container">
      <div className="treasury-header-row">
        <h2></h2>
        <button
          className="header-btn"
          onClick={() => navigate("/terceros/nuevo")}
        >
          <UserPlus size={16} />
          Agregar tercero
        </button>
      </div>

      <div className="filters-bar">
        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input autoComplete="off"
            type="text"
            className="search-input"
            placeholder="Buscar por nombre, documento o teléfono..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
      </div>

      <div className="table-card">
        <div className="table-wrapper">
          <table className="treasury-table">
            <colgroup>
              <col className="column-nombre" />
              <col style={{ width: 120 }} />
              <col style={{ width: 140 }} />
              <col className="column-domicilio" />
              <col style={{ width: 140 }} />
              <col style={{ width: 100 }} />
            </colgroup>
            <thead>
              <tr>
                <th
                  className="sortable-th"
                  onClick={() => handleSort("nombre")}
                  aria-sort={ariaSortFor("nombre")}
                  title={SORT_HINT}
                >
                  Nombre <SortIcon dir={dirFor("nombre")} />
                </th>
                <th
                  className="sortable-th"
                  onClick={() => handleSort("tipoDoc")}
                  aria-sort={ariaSortFor("tipoDoc")}
                  title={SORT_HINT}
                >
                  Tipo Doc. <SortIcon dir={dirFor("tipoDoc")} />
                </th>
                <th
                  className="sortable-th"
                  onClick={() => handleSort("documento")}
                  aria-sort={ariaSortFor("documento")}
                  title={SORT_HINT}
                >
                  Documento <SortIcon dir={dirFor("documento")} />
                </th>
                <th
                  className="sortable-th"
                  onClick={() => handleSort("domicilio")}
                  aria-sort={ariaSortFor("domicilio")}
                  title={SORT_HINT}
                >
                  Domicilio <SortIcon dir={dirFor("domicilio")} />
                </th>
                <th
                  className="sortable-th"
                  onClick={() => handleSort("telefono")}
                  aria-sort={ariaSortFor("telefono")}
                  title={SORT_HINT}
                >
                  Teléfono <SortIcon dir={dirFor("telefono")} />
                </th>
                <th
                  className="sortable-th"
                  onClick={() => handleSort("brindaServicios")}
                  aria-sort={ariaSortFor("brindaServicios")}
                  title={SORT_HINT}
                >
                  Servicios <SortIcon dir={dirFor("brindaServicios")} />
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>
                    Cargando terceros...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>
                    {error}
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>
                    No se encontraron terceros.
                  </td>
                </tr>
              ) : (
                paginated.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/terceros/editar/${p.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{p.nombre}</td>
                    <td>{p.tipoDoc}</td>
                    <td>{p.documento}</td>
                    <td>{p.domicilio}</td>
                    <td>{p.telefono}</td>
                    <td>{p.brindaServicios ? <span className="badge badge-servicio">Proveedor</span> : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          currentPage={safePage}
          totalItems={totalItems}
          rowsPerPage={rowsPerPage}
          itemLabel="terceros"
          onPageChange={(p) => setCurrentPage(Math.min(Math.max(1, p), totalPages))}
          onRowsPerPageChange={setRowsPerPage}
        />
      </div>
    </div>
  );
};

export default Persons;
