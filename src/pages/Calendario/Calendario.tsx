import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  User,
} from "lucide-react";
import NewSpecialServiceRecordModal from "./NewSpecialServiceRecordModal";
import SpecialServiceRecordDetailModal from "./SpecialServiceRecordDetailModal";
import {
  fetchSpecialServiceRecords,
  type SpecialServiceRecordItem,
} from "../../services/specialServiceRecordsApi";
import { useSpecialServiceStatusesStore } from "../../store/specialServiceStatusesStore";
import { formatRecordDate, toCurrency, todayLocal } from "../../utils/format";
import SpecialServiceStatusBadge from "./SpecialServiceStatusBadge";
import "./Calendario.css";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type CalendarEvent = {
  id: string;
  serviceName: string;
  date: string;
  memberNombre: string | null;
  memberNumero: string | null;
  personNombre: string | null;
  amount: number;
  detail: string | null;
  record: SpecialServiceRecordItem;
};

type StatusFilter = string;

function getEventDate(record: SpecialServiceRecordItem): string | null {
  const raw = record.service_date || record.date;
  if (!raw) return null;
  const iso = raw.split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function parseIso(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month: month - 1, day };
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = parseIso(fromIso);
  const b = parseIso(toIso);
  const from = Date.UTC(a.year, a.month, a.day);
  const to = Date.UTC(b.year, b.month, b.day);
  return Math.round((to - from) / 86400000);
}

function relativeLabel(iso: string, todayIso: string): string {
  const diff = daysBetween(todayIso, iso);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff > 1) return `En ${diff} días`;
  if (diff === -1) return "Ayer";
  return `Hace ${Math.abs(diff)} días`;
}

function getTitular(event: CalendarEvent): string {
  if (event.memberNombre) {
    return `${event.memberNombre}${event.memberNumero ? ` (N\u00BA ${event.memberNumero})` : ""}`;
  }
  return event.personNombre ?? "Sin titular";
}

const Calendario: React.FC = () => {
  const navigate = useNavigate();
  const today = todayLocal();
  const now = parseIso(today);

  const [records, setRecords] = useState<SpecialServiceRecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(now.year);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<SpecialServiceRecordItem | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [calendarStatusFilter, setCalendarStatusFilter] = useState<StatusFilter>("all");
  const [upcomingStatusFilter, setUpcomingStatusFilter] = useState<StatusFilter>("all");
  const statuses = useSpecialServiceStatusesStore((state) => state.statuses);
  const loadStatuses = useSpecialServiceStatusesStore((state) => state.load);

  useEffect(() => {
    void loadStatuses();
  }, [loadStatuses]);

  useEffect(() => {
    let mounted = true;
    fetchSpecialServiceRecords()
      .then((data) => {
        if (!mounted) return;
        setRecords(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "Error al cargar los servicios.");
        setIsLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const events = useMemo<CalendarEvent[]>(() => {
    return records
      .map((record) => {
        const date = getEventDate(record);
        if (!date) return null;
        return {
          id: record.id,
          serviceName: record.special_service_name ?? "Servicio especial sin nombre",
          date,
          memberNombre: record.member_nombre,
          memberNumero: record.member_numero_de_socio,
          personNombre: record.person_nombre,
          amount: record.amount,
          detail: record.special_service_detail,
          record,
        } satisfies CalendarEvent;
      })
      .filter((event): event is CalendarEvent => event !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [records]);

  const calendarEvents = useMemo(
    () =>
      calendarStatusFilter === "all"
        ? events
        : events.filter((event) => event.record.status === calendarStatusFilter),
    [events, calendarStatusFilter]
  );

  const yearEvents = useMemo(
    () => calendarEvents.filter((event) => parseIso(event.date).year === year),
    [calendarEvents, year]
  );

  const eventsByMonth = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const event of yearEvents) {
      const month = parseIso(event.date).month;
      const list = map.get(month) ?? [];
      list.push(event);
      map.set(month, list);
    }
    return map;
  }, [yearEvents]);

  const upcomingEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          event.date >= today &&
          (upcomingStatusFilter === "all" ||
            event.record.status === upcomingStatusFilter)
      ),
    [events, today, upcomingStatusFilter]
  );

  const panelMonthEvents = useMemo(() => {
    if (selectedMonth === null) return [];
    return events.filter((event) => {
      const parsed = parseIso(event.date);
      return (
        parsed.year === year &&
        parsed.month === selectedMonth &&
        (upcomingStatusFilter === "all" ||
          event.record.status === upcomingStatusFilter)
      );
    });
  }, [events, year, selectedMonth, upcomingStatusFilter]);

  const showingMonth = selectedMonth !== null;
  const displayedEvents = showingMonth ? panelMonthEvents : upcomingEvents;

  const changeYear = (nextYear: number) => {
    setYear(nextYear);
    setSelectedMonth(null);
  };

  const handleCreated = (record: SpecialServiceRecordItem) => {
    setRecords((prev) => [record, ...prev]);
    const eventDate = getEventDate(record);
    if (eventDate) setYear(parseIso(eventDate).year);
    setSelectedMonth(null);
  };

  const handleUpdated = (record: SpecialServiceRecordItem) => {
    setRecords((prev) => prev.map((item) => (item.id === record.id ? record : item)));
    setSelectedRecord(record);
  };

  const handleCancelled = (record: SpecialServiceRecordItem) => {
    setRecords((prev) => prev.map((item) => (item.id === record.id ? record : item)));
    setSelectedRecord(null);
  };

  if (isLoading) return <div className="dashboard-loading">Cargando servicios...</div>;
  if (error) return <div className="dashboard-loading" style={{ color: "var(--danger)" }}>Error: {error}</div>;

  return (
    <div className="cal-page">
      <div className="cal-layout">
        <section className="cal-panel cal-months-panel">
          <div className="cal-panel-head">
            <div>
              <h3 className="cal-panel-title">Servicios</h3>
              <p className="cal-panel-subtitle">
                {yearEvents.length === 0
                  ? `Sin servicios registrados en ${year}`
                  : `${yearEvents.length} servicio${yearEvents.length === 1 ? "" : "s"} registrado${yearEvents.length === 1 ? "" : "s"} en ${year}`}
              </p>
            </div>
            <div className="cal-panel-actions">
              <button
                type="button"
                className="cal-new-btn"
                onClick={() => setShowNewModal(true)}
              >
                <Plus size={16} /> Agendar servicios
              </button>
              <div className="cal-year-nav">
                <button type="button" className="cal-year-btn" onClick={() => changeYear(year - 1)} aria-label="Año anterior">
                  <ChevronLeft size={18} />
                </button>
                <span className="cal-year-label">{year}</span>
                <button type="button" className="cal-year-btn" onClick={() => changeYear(year + 1)} aria-label="Año siguiente">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="cal-filter-row">
            <label className="cal-filter-label" htmlFor="cal-status-filter">
              Estado
            </label>
            <select
              id="cal-status-filter"
              className="cal-filter-select"
              value={calendarStatusFilter}
              onChange={(e) =>
                setCalendarStatusFilter(e.target.value as StatusFilter)
              }
            >
              <option value="all">Todos los estados</option>
              {statuses.map((status) => (
                <option key={status.key} value={status.key}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div className="cal-months-grid">
            {MONTHS.map((monthName, index) => {
              const monthEvents = eventsByMonth.get(index) ?? [];
              const hasEvents = monthEvents.length > 0;
              const isCurrent = year === now.year && index === now.month;
              const isSelected = selectedMonth === index;
              const preview = monthEvents.slice(0, 2);

              const className = [
                "cal-month-card",
                hasEvents ? "has-events" : "",
                isCurrent ? "is-current" : "",
                isSelected ? "is-selected" : "",
              ].filter(Boolean).join(" ");

              return (
                <button
                  key={monthName}
                  type="button"
                  className={className}
                  onClick={() => setSelectedMonth(isSelected ? null : index)}
                >
                  <div className="cal-month-top">
                    <span className="cal-month-name">{monthName}</span>
                    {isCurrent && <span className="cal-month-tag">Actual</span>}
                  </div>
                  <span className="cal-month-count">
                    {hasEvents
                      ? `${monthEvents.length} servicio${monthEvents.length === 1 ? "" : "s"}`
                      : "Sin servicios"}
                  </span>
                  {hasEvents ? (
                    <ul className="cal-month-preview">
                      {preview.map((event) => (
                        <li key={event.id}>{event.serviceName}</li>
                      ))}
                      {monthEvents.length > preview.length && (
                        <li className="cal-month-more">
                          +{monthEvents.length - preview.length} más
                        </li>
                      )}
                    </ul>
                  ) : (
                    <span className="cal-month-empty">—</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="cal-legend">
            <span className="cal-legend-item">
              <span className="cal-legend-dot has-events" /> Con servicios
            </span>
            <span className="cal-legend-item">
              <span className="cal-legend-dot is-current" /> Mes actual
            </span>
            <span className="cal-legend-hint">Hacé clic en un mes para ver sus servicios.</span>
          </div>
        </section>

        <aside className="cal-side">
          <section className="cal-panel cal-upcoming-panel">
            <div className="cal-panel-head">
              <div>
                <h3 className="cal-panel-title">
                  {showingMonth ? `Servicios de ${MONTHS[selectedMonth]}` : "Próximos servicios"}
                </h3>
                <p className="cal-panel-subtitle">
                  {showingMonth
                    ? `${displayedEvents.length} servicio${displayedEvents.length === 1 ? "" : "s"} en ${year}`
                    : `${upcomingEvents.length} servicio${upcomingEvents.length === 1 ? "" : "s"} por venir`}
                </p>
              </div>
              {showingMonth && (
                <button type="button" className="cal-clear-btn" onClick={() => setSelectedMonth(null)}>
                  Ver próximos
                </button>
              )}
            </div>

            <div className="cal-filter-row">
              <label className="cal-filter-label" htmlFor="upcoming-status-filter">
                Estado
              </label>
              <select
                id="upcoming-status-filter"
                className="cal-filter-select"
                value={upcomingStatusFilter}
                onChange={(e) =>
                  setUpcomingStatusFilter(e.target.value as StatusFilter)
                }
              >
                <option value="all">Todos los estados</option>
                {statuses.map((status) => (
                  <option key={status.key} value={status.key}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="cal-events-list custom-scroll">
              {displayedEvents.length === 0 ? (
                <div className="cal-empty">
                  <Calendar size={22} />
                  <p>
                    {showingMonth
                      ? "No hay servicios registrados en este mes."
                      : "No hay próximos servicios registrados."}
                  </p>
                </div>
              ) : (
                displayedEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="cal-event-card"
                    onClick={() => setSelectedRecord(event.record)}
                  >
                    <div className="cal-event-top">
                      <span className="cal-event-service">
                        <span className="cal-event-icon"><Briefcase size={13} /></span>
                        {event.serviceName}
                      </span>
                      <span className="cal-event-amount">{toCurrency(event.amount)}</span>
                    </div>
                    <div className="cal-event-meta">
                      <span><Calendar size={13} />{formatRecordDate(event.date)}</span>
                      <span className="cal-event-relative">{relativeLabel(event.date, today)}</span>
                    </div>
                    <div className="cal-event-status-row">
                      <SpecialServiceStatusBadge
                        statusKey={event.record.status}
                        statuses={statuses}
                      />
                    </div>
                    <div className="cal-event-titular">
                      <User size={13} />{getTitular(event)}
                    </div>
                    {event.detail && <p className="cal-event-detail">{event.detail}</p>}
                  </button>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>

      {showNewModal && (
        <NewSpecialServiceRecordModal
          isOpen={showNewModal}
          onClose={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}

      {selectedRecord && (
        <SpecialServiceRecordDetailModal
          key={selectedRecord.id}
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onUpdated={handleUpdated}
          onCancelled={handleCancelled}
          onNavigateToMovement={(movementId) => navigate(`/tesoreria/movimientos/detalle/${movementId}`)}
          onNavigateToTitular={(memberId, personId) => {
            if (memberId) navigate(`/socios/detalle/${memberId}`);
            else if (personId) navigate(`/terceros/detalle/${personId}`);
          }}
        />
      )}
    </div>
  );
};

export default Calendario;
