import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, User, ExternalLink, Calendar, History, Loader } from "lucide-react";
import type { Cementerio, Member, Person } from "../../../models/members";
import {
    fetchCementeriosByNicho,
    updateCementerioRecord,
    fetchCementerioMovimientosByNicho,
    type CementerioDetalleRecord,
} from "../../../services/cementeriosApi";
import { fetchActiveMembers, fetchPersons } from "../../../services/membersApi";
import "./Cementerio.css";

const PAGA_POR_OPTS = [
    { value: "", label: "" },
    { value: "TES", label: "TES (TESORERIA)" },
    { value: "HAB", label: "HAB (HABERES)" },
] as const;
const TIPO_OPTS = [
    { value: "", label: "VACIO (POSIBLE RETIRADO)" },
    { value: "F", label: "F (FERETRO)" },
    { value: "VF", label: "VF (VACIO FERETRO)" },
    { value: "B", label: "B (BOLSA)" },
    { value: "U", label: "U (URNA)" },
    { value: "UV", label: "UV (VACIO URNA)" },
] as const;

const parseYear = (v: string): number | null => {
    if (!v) return null;
    const m = v.match(/(\d{4})/);
    if (m) return parseInt(m[1], 10);
    return null;
};

const calcularReducir = (tipo: string, fechaFallecimiento: string): string => {
    if (tipo.toUpperCase() !== "F") return "NO";
    const year = parseYear(fechaFallecimiento);
    if (year === null) return "NO";
    const currentYear = new Date().getFullYear();
    return currentYear - year >= 25 ? "SI" : "NO";
};

type SelectOption = { value: string; label: string };

type FieldProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    isSelect?: boolean;
    options?: readonly (string | SelectOption)[];
    icon?: React.ReactNode;
    inputId?: string;
};

const ReadOnlyField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{label}</label>
        <div className="field-input" style={{ background: "#f8fafc", cursor: "default" }}>
            {value || "—"}
        </div>
    </div>
);

const Field: React.FC<FieldProps> = ({ label, value, onChange, isSelect, options, icon, inputId }) => {
    const handleDatePicker = (e: React.MouseEvent) => {
        const btn = e.currentTarget as HTMLElement;
        const wrapper = btn.closest(".input-with-icon");
        const input = wrapper?.querySelector(".field-input") as HTMLInputElement | null;
        if (!input) return;
        const prevType = input.type;
        input.type = "date";
        const m = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
        if (m) input.value = `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
        const restore = () => { input.type = prevType; };
        input.addEventListener("change", () => {
            if (input.value) {
                const [y, mo, d] = input.value.split("-");
                onChange(`${d}/${mo}/${y}`);
            }
            restore();
        }, { once: true });
        input.addEventListener("cancel", restore, { once: true });
        input.addEventListener("blur", restore, { once: true });
        input.showPicker();
    };

    const inputEl = isSelect ? (
        <select autoComplete="off"
            className="field-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: "100%" }}
        >
            {options?.map((opt) => {
                const val = typeof opt === "string" ? opt : opt.value;
                const lbl = typeof opt === "string" ? opt : opt.label;
                return <option key={val} value={val}>{lbl}</option>;
            })}
        </select>
    ) : (
        <input autoComplete="off"
            type="text"
            className="field-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: "100%" }}
            id={inputId}
        />
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{label}</label>
            {icon ? (
                <div className="input-with-icon">
                    {inputEl}
                    <button
                        type="button"
                        className="date-picker-btn"
                        onClick={handleDatePicker}
                    >
                        {icon}
                    </button>
                </div>
            ) : inputEl}
        </div>
    );
};

const CementerioDetalle: React.FC = () => {
    const { nicho } = useParams<{ nicho: string }>();
    const navigate = useNavigate();
    const [records, setRecords] = useState<CementerioDetalleRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [arrendatarioFilter, setArrendatarioFilter] = useState<Set<string> | null>(null);
    const [soloMostrarVacios, setSoloMostrarVacios] = useState(false);
    const [movimientosByArrendatario, setMovimientosByArrendatario] = useState<Map<string, boolean>>(new Map());

    const [nombreSearchValue, setNombreSearchValue] = useState("");
    const [nombreResults, setNombreResults] = useState<(Member | Person)[]>([]);
    const [showNombreDropdown, setShowNombreDropdown] = useState(false);
    const [nombreSearchRecordId, setNombreSearchRecordId] = useState<string | null>(null);
    const [nombreSearchLoading, setNombreSearchLoading] = useState(false);
    const nombreSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        document.querySelector(".content")?.classList.add("custom-scroll");
        return () => document.querySelector(".content")?.classList.remove("custom-scroll");
    }, []);

    useEffect(() => {
        if (!nicho) return;
        let mounted = true;
        fetchCementeriosByNicho(nicho)
            .then((items) => {
                if (!mounted) return;
                setRecords(items);
                setIsLoading(false);
            })
            .catch((err) => {
                if (mounted) {
                    setError(err.message || "Error al cargar registros");
                    setIsLoading(false);
                }
            });
        return () => { mounted = false; };
    }, [nicho]);

    useEffect(() => {
        if (!nicho || records.length === 0) return;
        const arrendatarios = new Map<string, { socioId: string | null; personaId: string | null }>();
        for (const r of records) {
            const key = r.personaId ?? r.socioId ?? "__sin_arrendatario__";
            if (!arrendatarios.has(key)) {
                arrendatarios.set(key, { socioId: r.socioId ?? null, personaId: r.personaId ?? null });
            }
        }
        let mounted = true;
        Promise.all(
            [...arrendatarios.entries()].map(([key, ids]) =>
                fetchCementerioMovimientosByNicho(nicho, ids.socioId, ids.personaId)
                    .then((movs) => [key, movs.length > 0] as const)
                    .catch(() => [key, false] as const)
            )
        ).then((results) => {
            if (!mounted) return;
            setMovimientosByArrendatario(new Map(results));
        });
        return () => { mounted = false; };
    }, [nicho, records]);

    const grouped = useMemo(() => {
        const map = new Map<string, CementerioDetalleRecord[]>();
        for (const r of records) {
            const key = r.personaId ?? r.socioId ?? "__sin_arrendatario__";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(r);
        }
        return Array.from(map.entries()).sort((a, b) => {
            const aname = a[1][0]?.personaNombre || "";
            const bname = b[1][0]?.personaNombre || "";
            return aname.localeCompare(bname);
        });
    }, [records]);

    const filteredGrouped = useMemo(() => {
        let result = grouped;
        if (soloMostrarVacios) {
            result = result.filter(([, groupRecords]) =>
                groupRecords.some(r => !r.tipo || r.tipo === "")
            );
        }
        if (arrendatarioFilter) {
            result = result.filter(([, groupRecords]) => {
                const name = groupRecords[0]?.personaNombre || "Sin arrendatario";
                return arrendatarioFilter.has(name);
            });
        }
        return result;
    }, [grouped, arrendatarioFilter, soloMostrarVacios]);

    const handleFieldChange = (id: string, field: keyof Cementerio, value: string | boolean) => {
        setRecords((prev) =>
            prev.map((r) => {
                if (r.id !== id) return r;
                const updated = { ...r, [field]: value };
                if (field === "esSocio") {
                    updated.socioId = value ? r.socioId : null;
                    updated.personaId = value ? null : r.personaId;
                }
                return updated;
            })
        );
        if (field === "esSocio") {
            setNombreSearchValue("");
            setNombreResults([]);
        }
    };

    const handleSave = async (id: string) => {
        const record = records.find((r) => r.id === id);
        if (!record) return;
        if (!window.confirm("¿Guardar cambios en este registro?")) return;
        setSavingId(id);
        try {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: _, reducir, debeAnios, personaNombre, personaDomicilio, ...data } = record;
            await updateCementerioRecord(id, data);
            setSavingId(null);
        } catch (err) {
            setSavingId(null);
            setError(err instanceof Error ? err.message : "Error al guardar");
        }
    };

    const doNombreSearch = useCallback(async (q: string, esSocio: boolean) => {
        if (!q.trim()) { setNombreResults([]); return; }
        setNombreSearchLoading(true);
        try {
            const result = esSocio ? await fetchActiveMembers(q) : await fetchPersons(q);
            setNombreResults(result);
        } catch { setNombreResults([]); }
        finally { setNombreSearchLoading(false); }
    }, []);

    const handleNombreInputChange = (value: string, recordId: string, esSocio: boolean) => {
        setNombreSearchValue(value);
        setNombreSearchRecordId(recordId);
        setShowNombreDropdown(true);
        if (nombreSearchTimer.current) clearTimeout(nombreSearchTimer.current);
        nombreSearchTimer.current = setTimeout(() => doNombreSearch(value, esSocio), 300);
    };

    const handleNombreSelect = (recordId: string, selected: Member | Person) => {
        const isSocio = "numeroDeSocio" in selected;
        setRecords((prev) =>
            prev.map((r) =>
                r.id === recordId
                    ? {
                          ...r,
                          socioId: isSocio ? selected.id : null,
                          personaId: isSocio ? null : selected.id,
                          esSocio: isSocio,
                          personaNombre: selected.nombre,
                          personaDomicilio: isSocio ? (selected as Member).domicilio : (selected as Person).domicilio,
                          telefono: selected.telefono || r.telefono,
                      }
                    : r
            )
        );
        setNombreSearchValue("");
        setNombreResults([]);
        setShowNombreDropdown(false);
        setNombreSearchRecordId(null);
    };

    const handleNombreFocus = (recordId: string, currentName: string) => {
        setNombreSearchRecordId(recordId);
        setNombreSearchValue(currentName);
        setShowNombreDropdown(true);
        if (currentName) doNombreSearch(currentName, records.find((r) => r.id === recordId)?.esSocio ?? false);
    };

    if (isLoading) return <div className="dashboard-loading">Cargando nicho {nicho}...</div>;
    if (error) return <div className="dashboard-loading" style={{ color: "var(--danger)" }}>Error: {error}</div>;

    return (
        <div className="cementerio-detalle">
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <button className="header-btn" onClick={() => navigate("/tesoreria/cementerio")}>
                    <ArrowLeft size={18} /> Volver
                </button>
                <h2 style={{ margin: 0, color: "var(--text)" }}>Nicho {nicho}</h2>
                <span style={{ color: "var(--muted)", fontSize: 14 }}>
                    {records.length} ocupante{records.length !== 1 ? "s" : ""}
                </span>
            </div>

            {records.length > 0 && grouped.length > 1 && (
                <div style={{
                    display: "flex", gap: 8,
                    padding: "10px 14px", background: "#f8fafc",
                    borderRadius: 8, marginTop: 12,
                    alignItems: "center",
                }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>
                        Arrendatario:
                    </span>

                    <label style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                        fontSize: 13, fontWeight: 500,
                        background: soloMostrarVacios ? "var(--azul-institucional)" : "#e2e8f0",
                        color: soloMostrarVacios ? "#fff" : "var(--text)",
                        transition: "all 0.15s",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                    }}>
                        <input autoComplete="off"
                            type="checkbox"
                            checked={soloMostrarVacios}
                            onChange={() => setSoloMostrarVacios(prev => !prev)}
                            style={{ accentColor: "#fff", margin: 0 }}
                        />
                        Solo mostrar vacíos
                    </label>

                    <div style={{
                        display: "flex", gap: 8,
                        overflowX: "auto", flexWrap: "nowrap",
                        flex: 1, paddingBottom: 4,
                    }}>
                        {grouped.map(([, groupRecords]) => {
                            const name = groupRecords[0]?.personaNombre || "Sin arrendatario";
                            const checked = !arrendatarioFilter || arrendatarioFilter.has(name);
                            return (
                                <label
                                    key={name}
                                    style={{
                                        display: "inline-flex", alignItems: "center", gap: 6,
                                        padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                                        fontSize: 13, fontWeight: 500,
                                        background: checked ? "var(--azul-institucional)" : "#e2e8f0",
                                        color: checked ? "#fff" : "var(--text)",
                                        transition: "all 0.15s",
                                        userSelect: "none",
                                        whiteSpace: "nowrap",
                                        flexShrink: 0,
                                    }}
                                >
                                    <input autoComplete="off"
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                            setArrendatarioFilter((prev) => {
                                                const all = new Set(grouped.map(([, g]) => g[0]?.personaNombre || "Sin arrendatario"));
                                                if (!prev) {
                                                    const next = new Set(all);
                                                    next.delete(name);
                                                    return next.size === all.size ? null : next.size === 0 ? null : next;
                                                }
                                                if (prev.has(name)) {
                                                    const next = new Set(prev);
                                                    next.delete(name);
                                                    return next.size === 0 ? null : next;
                                                }
                                                const next = new Set(prev);
                                                next.add(name);
                                                return next.size === all.size ? null : next;
                                            });
                                        }}
                                        style={{ accentColor: "#fff", margin: 0 }}
                                    />
                                    {name}
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}

            {records.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>No hay registros para este nicho.</p>
            ) : (
                filteredGrouped.map(([personaId, groupRecords]) => {
                    const personaNombre = groupRecords[0]?.personaNombre || "Sin arrendatario";
                    const grupoSocioId = groupRecords[0]?.socioId ?? null;
                    const grupoPersonaId = groupRecords[0]?.personaId ?? null;
                    return (
                            <div key={personaId} className="table-card" style={{ margin: "10px 0", padding: 0, overflow: "hidden" }}>
                            <div style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "10px 16px", background: "#f8fafc",
                                borderBottom: "1px solid var(--border)",
                                fontWeight: 700, fontSize: 15, color: "var(--text)",
                            }}>
                                <User size={18} />
                                {personaNombre}
                                <span style={{ fontWeight: 400, fontSize: 13, color: "var(--muted)" }}>
                                    ({groupRecords.length} registro{groupRecords.length !== 1 ? "s" : ""})
                                </span>
                                <div style={{ marginLeft: "auto" }}>
                                    {(() => {
                                        const key = personaId;
                                        const grupoHasMovimientos = movimientosByArrendatario.get(key) ?? false;
                                        return (
                                            <button
                                                className="header-btn"
                                                style={{
                                                    background: grupoHasMovimientos ? "transparent" : "#f1f5f9",
                                                    color: grupoHasMovimientos ? "var(--azul-institucional)" : "var(--muted)",
                                                    border: grupoHasMovimientos ? "1px solid var(--azul-institucional)" : "1px solid var(--border)",
                                                    cursor: grupoHasMovimientos ? "pointer" : "not-allowed",
                                                    opacity: grupoHasMovimientos ? 1 : 0.6,
                                                    fontSize: 13,
                                                }}
                                                disabled={!grupoHasMovimientos}
                                                title={grupoHasMovimientos ? "Ver pagos de este arrendatario" : "No hay pagos registrados"}
                                                onClick={() => {
                                                    if (grupoHasMovimientos && nicho) {
                                                        let url = `/tesoreria/movimientos?nicho=${encodeURIComponent(nicho)}`;
                                                        if (grupoSocioId) url += `&memberId=${encodeURIComponent(grupoSocioId)}`;
                                                        else if (grupoPersonaId) url += `&personId=${encodeURIComponent(grupoPersonaId)}`;
                                                        navigate(url);
                                                    }
                                                }}
                                            >
                                                <History size={14} /> Ver pagos
                                            </button>
                                        );
                                    })()}
                                </div>
                            </div>
                            {groupRecords.map((rec) => (
                                <div key={rec.id} style={{ padding: 16, borderBottom: groupRecords.length <= 1 ? "1px solid var(--border)" : "16px solid var(--border)" }}>
                                    {/* Ocupante (editable) */}
                                    <div style={{
                                        display: "flex", alignItems: "center", gap: 8,
                                        padding: "6px 12px", background: "#f1f5f9",
                                        borderRadius: 6, marginBottom: 16,
                                        fontWeight: 600, fontSize: 14, color: "var(--text)",
                                    }}>
                                        <label htmlFor={`ocupante-${rec.id}`} style={{ fontWeight: 600 }}>Ocupante:</label>
                                        <input
                                            autoComplete="off"
                                            id={`ocupante-${rec.id}`}
                                            type="text"
                                            className="field-input"
                                            value={rec.ocupante}
                                            onChange={(e) => handleFieldChange(rec.id, "ocupante", e.target.value)}
                                            style={{ flex: 1, background: "#fff" }}
                                        />
                                    </div>

                                    {/* Fila 1: Datos del nicho */}
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(7, 1fr)",
                                        gap: 12, marginBottom: 20,
                                    }}>
                                        <Field label="Folio" value={rec.folio} onChange={(v) => handleFieldChange(rec.id, "folio", v)} />
                                        <Field label="Tipo" value={rec.tipo.toUpperCase()} onChange={(v) => handleFieldChange(rec.id, "tipo", v.toUpperCase())} isSelect options={TIPO_OPTS} />
                                        <Field label="Tiene Lápida" value={rec.tieneLapida ? "SI" : "NO"} onChange={(v) => handleFieldChange(rec.id, "tieneLapida", v === "SI")} isSelect options={["NO", "SI"]} />
                                        <Field label="Nro Orden" value={rec.numeroOrden} onChange={(v) => handleFieldChange(rec.id, "numeroOrden", v)} />
                                        <Field label="Fecha Fallecimiento" value={rec.fechaFallecimiento} onChange={(v) => handleFieldChange(rec.id, "fechaFallecimiento", v)} icon={<Calendar size={18} />} inputId="fecha-fallecimiento" />
                                        <Field label="Año de Gracia" value={rec.anioDeGracia} onChange={(v) => handleFieldChange(rec.id, "anioDeGracia", v)} />
                                        <ReadOnlyField label="Reducir" value={calcularReducir(rec.tipo, rec.fechaFallecimiento)} />
                                    </div>

                                    {/* Fila 2: Datos del contrato */}
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(6, 1fr)",
                                        gap: 12, marginBottom: 20,
                                    }}>
                                        <Field label="Contrato Nro" value={rec.contratoNro} onChange={(v) => handleFieldChange(rec.id, "contratoNro", v)} />
                                        <Field label="Contrato por Años" value={rec.contratoPorAnios} onChange={(v) => handleFieldChange(rec.id, "contratoPorAnios", v)} />
                                        <Field label="Año Venc. Contrato" value={rec.anioVencContrato} onChange={(v) => handleFieldChange(rec.id, "anioVencContrato", v)} />
                                        <Field label="Último Pago (año)" value={rec.ultimoPago} onChange={(v) => handleFieldChange(rec.id, "ultimoPago", v)} />
                                        <Field label="Plan de Pago" value={rec.planDePago} onChange={(v) => handleFieldChange(rec.id, "planDePago", v)} />
                                        <Field label="Fecha de Pago" value={rec.fechaDePago} onChange={(v) => handleFieldChange(rec.id, "fechaDePago", v)} icon={<Calendar size={18} />} inputId="fecha-pago" />
                                    </div>

                                    {/* Separador */}
                                    <div style={{ borderTop: "2px solid var(--azul-institucional)", marginBottom: 16 }} />

                                    {/* Subtítulo */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                        <User size={16} style={{ color: "var(--azul-institucional)" }} />
                                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--azul-institucional)" }}>
                                            Datos del Arrendatario
                                        </span>
                                    </div>

                                    {/* Fila 3: Datos del arrendatario (editable) */}
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(5, 1fr)",
                                        gap: 12, marginBottom: 12,
                                    }}>
                                        {/* 1 - Nombre con buscador */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4, position: "relative" }}>
                                            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Nombre</label>
                                            <div className="member-search-wrapper">
                                                <input autoComplete="off"
                                                    type="text"
                                                    className="field-input"
                                                    style={{ width: "100%" }}
                                                    value={nombreSearchRecordId === rec.id ? nombreSearchValue : rec.personaNombre}
                                                    onChange={(e) => handleNombreInputChange(e.target.value, rec.id, rec.esSocio)}
                                                    onFocus={() => handleNombreFocus(rec.id, rec.personaNombre)}
                                                    onBlur={() => setTimeout(() => setShowNombreDropdown(false), 200)}
                                                    placeholder="Buscar arrendatario..."
                                                />
                                                {showNombreDropdown && nombreSearchRecordId === rec.id && (
                                                    <div className="member-dropdown" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10 }}>
                                                        {nombreSearchLoading ? (
                                                            <div className="member-dropdown-item" style={{ justifyContent: "center" }}>
                                                                <Loader size={14} className="spin" /> Buscando...
                                                            </div>
                                                        ) : nombreSearchValue && nombreResults.length === 0 ? (
                                                            <div className="member-dropdown-item" style={{ justifyContent: "center", color: "var(--muted)" }}>
                                                                Sin resultados
                                                            </div>
                                                        ) : (
                                                            nombreResults.map((p) => (
                                                                <button
                                                                    type="button"
                                                                    key={p.id}
                                                                    className="member-dropdown-item"
                                                                    onMouseDown={() => handleNombreSelect(rec.id, p)}
                                                                >
                                                                    <User size={16} />
                                                                    <div className="member-dropdown-info">
                                                                        <span className="member-dropdown-name">{p.nombre}</span>
                                                                        <span className="member-dropdown-detail">
                                                                            {"numeroDeSocio" in p
                                                                                ? `DNI ${p.documento} · Nº ${p.numeroDeSocio}`
                                                                                : `${p.tipoDoc} ${p.documento}`}
                                                                        </span>
                                                                    </div>
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 2 - Es Socio */}
                                        <Field label="Es Socio" value={rec.esSocio ? "SI" : "NO"} onChange={(v) => handleFieldChange(rec.id, "esSocio", v === "SI")} isSelect options={["NO", "SI"]} />

                                        {/* 3 - Domicilio */}
                                        <Field label="Domicilio" value={rec.personaDomicilio} onChange={(v) => setRecords((prev) => prev.map((r) => r.id === rec.id ? { ...r, personaDomicilio: v } : r))} />

                                        {/* 4 - Teléfono */}
                                        <Field label="Teléfono" value={rec.telefono} onChange={(v) => handleFieldChange(rec.id, "telefono", v)} />

                                        {/* 5 - Paga por */}
                                        <Field label="Paga por" value={rec.pagaPor} onChange={(v) => handleFieldChange(rec.id, "pagaPor", v)} isSelect options={PAGA_POR_OPTS} />
                                    </div>

                                    <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                                        {rec.esSocio && rec.socioId ? (
                                            <button
                                                className="header-btn"
                                                style={{ background: "transparent", color: "var(--azul-institucional)", border: "1px solid var(--azul-institucional)" }}
                                                onClick={() => navigate(`/socios/detalle/${rec.socioId}`)}
                                            >
                                                <ExternalLink size={16} /> Ver Socio
                                            </button>
                                        ) : rec.personaId ? (
                                            <button
                                                className="header-btn"
                                                style={{ background: "transparent", color: "var(--azul-institucional)", border: "1px solid var(--azul-institucional)" }}
                                                onClick={() => navigate(`/terceros/editar/${rec.personaId}`)}
                                            >
                                                <ExternalLink size={16} /> Ver Tercero
                                            </button>
                                        ) : null}
                                        <button
                                            className="header-btn"
                                            onClick={() => handleSave(rec.id)}
                                            disabled={savingId === rec.id}
                                        >
                                            <Save size={16} /> {savingId === rec.id ? "Guardando..." : "Guardar"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default CementerioDetalle;
