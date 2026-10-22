import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, User, Loader, Plus, X, Eye, Pencil, UserMinus } from "lucide-react";
import { fetchMemberById, saveMember } from "../../../services/membersApi";
import { fetchDuesByMember, saveDue, fetchFamilyMembers } from "../../../services/duesApi";
import { fetchCementeriosByOwner, fetchCementerioMovimientosByMovement } from "../../../services/cementeriosApi";
import PeriodPicker from "../../../components/period/PeriodPicker";
import AccountSection from "../../../components/account/AccountSection";
import CollapsibleCard from "../../../components/ui/CollapsibleCard";
import { formatCurrency, formatPeriodsDisplay, todayLocal } from "../../../utils/format";
import type { Member } from "../../../models/members";
import type { DueWithDetails } from "../../../services/duesApi";
import "../../Treasury/TreasuryTables.css";
import "./Detalle.css";

const DetalleSocio: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canModify = true;
  const [member, setMember] = useState<Member | null>(null);
  const [dues, setDues] = useState<DueWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNichos, setHasNichos] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showBajaModal, setShowBajaModal] = useState(false);
  const [bajaConFecha, setBajaConFecha] = useState(false);
  const [bajaFecha, setBajaFecha] = useState("");
  const [bajaFallecido, setBajaFallecido] = useState(false);
  const [bajaMotivo, setBajaMotivo] = useState("");
  const [savingBaja, setSavingBaja] = useState(false);
  const [bajaError, setBajaError] = useState<string | null>(null);
  const [periods, setPeriods] = useState<string[]>([]);
  const [paidPeriods, setPaidPeriods] = useState<Set<string>>(new Set());
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [familyMembers, setFamilyMembers] = useState<Member[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<Set<string>>(new Set());
  const [savingMark, setSavingMark] = useState(false);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    Promise.all([fetchMemberById(id), fetchDuesByMember(id)])
      .then(([m, d]) => { if (mounted) { setMember(m); setDues(d); setLoading(false); } })
      .catch((err) => { if (mounted) { setError(err instanceof Error ? err.message : "Error al cargar datos"); setLoading(false); } });
    fetchCementeriosByOwner(id, true)
      .then((c) => { if (mounted) setHasNichos(c.length > 0); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [id]);

  const socioDues = useMemo(() => dues.filter((d) => d.type === "socio"), [dues]);
  const cementerioDues = useMemo(() => dues.filter((d) => d.type === "cementerio"), [dues]);

  const cementerioMovementIds = useMemo(() => {
    if (cementerioDues.length === 0) return [];
    return [...new Set(cementerioDues.filter((d) => d.movement_id).map((d) => d.movement_id!))];
  }, [cementerioDues]);

  const [cementerioAsync, setCementerioAsync] = useState<{ movement_id: string; receipt_number: number | null; nichos: string; dues: typeof cementerioDues; amount: number; payment_date: string; period: string[] | null; anulado: boolean }[]>([]);

  useEffect(() => {
    if (cementerioMovementIds.length === 0) return;
    let mounted = true;
    Promise.all(
      cementerioMovementIds.map(async (mid) => {
        try {
          const movimientos = await fetchCementerioMovimientosByMovement(mid);
          const nichos = [...new Set(movimientos.map((m) => m.nicho))].join(", ");
          const relatedDues = cementerioDues.filter((d) => d.movement_id === mid);
          const totalAmount = relatedDues.reduce((sum, d) => sum + (d.amount ?? 0), 0);
          return {
            movement_id: mid,
            receipt_number: relatedDues[0]?.receipt_number ?? null,
            nichos,
            dues: relatedDues,
            amount: totalAmount,
            payment_date: relatedDues[0]?.payment_date ?? "",
            period: relatedDues.flatMap((d) => d.period ?? []),
            anulado: relatedDues.some((d) => d.anulado),
          };
        } catch {
          const relatedDues = cementerioDues.filter((d) => d.movement_id === mid);
          return {
            movement_id: mid,
            receipt_number: relatedDues[0]?.receipt_number ?? null,
            nichos: "—",
            dues: relatedDues,
            amount: relatedDues.reduce((sum, d) => sum + (d.amount ?? 0), 0),
            payment_date: relatedDues[0]?.payment_date ?? "",
            period: relatedDues.flatMap((d) => d.period ?? []),
            anulado: relatedDues.some((d) => d.anulado),
          };
        }
      })
    ).then((groups) => {
      if (mounted) setCementerioAsync(groups.sort((a, b) => b.payment_date.localeCompare(a.payment_date)));
    });
    return () => { mounted = false; };
  }, [cementerioDues, cementerioMovementIds]);

  const cementerioGrouped = cementerioMovementIds.length === 0 ? [] : cementerioAsync;

  const familyGroupPrefix = useMemo(() => {
    if (!member?.nroFamilia) return null;
    return member.nroFamilia.split("/")[0];
  }, [member]);

  const openModal = useCallback(async () => {
    if (!id) return;
    setPeriods([]);
    setPeriodYear(new Date().getFullYear());
    setSelectedFamily(new Set(id ? [id] : []));
    setShowModal(true);
    const allPaid = new Set<string>();
    try {
      const allDues = await fetchDuesByMember(id);
      for (const d of allDues) {
        if (d.anulado) continue;
        if (d.period) d.period.forEach((p) => allPaid.add(p));
      }
    } catch {}
    setPaidPeriods(allPaid);
    if (familyGroupPrefix) {
      try { const fMembers = await fetchFamilyMembers(id); setFamilyMembers(fMembers.filter((m) => !m.fallecido && !m.fechaBaja)); }
      catch { setFamilyMembers([]); }
    } else { setFamilyMembers([]); }
  }, [id, familyGroupPrefix]);

  const handleConfirm = useCallback(async () => {
    if (!id || periods.length === 0) return;
    setSavingMark(true);
    try {
      await saveDue({
        type: "socio", payment_date: todayLocal(), period: periods, member_id: id,
        family_group: familyGroupPrefix ?? undefined,
        paid_members: familyGroupPrefix ? Array.from(selectedFamily) : undefined,
      });
      setShowModal(false);
      const updated = await fetchDuesByMember(id);
      setDues(updated);
    } catch (err) { setError(err instanceof Error ? err.message : "Error al marcar cuota"); }
    finally { setSavingMark(false); }
  }, [id, periods, familyGroupPrefix, selectedFamily]);

  const openBajaModal = () => {
    if (!member) return;
    setBajaConFecha(true);
    setBajaFecha(member.fechaBaja || todayLocal());
    setBajaFallecido(member.fallecido);
    setBajaMotivo(member.motivoBaja);
    setBajaError(null);
    setShowBajaModal(true);
  };

  const handleSaveBaja = async () => {
    if (!member) return;
    setSavingBaja(true);
    setBajaError(null);
    try {
      await saveMember({
        ...member,
        fechaBaja: bajaConFecha ? bajaFecha : "",
        fallecido: bajaFallecido,
        motivoBaja: bajaMotivo,
      });
      const updated = await fetchMemberById(member.id);
      setMember(updated);
      setShowBajaModal(false);
    } catch (err) {
      setBajaError(err instanceof Error ? err.message : "Error al dar de baja al socio");
    } finally {
      setSavingBaja(false);
    }
  };

  if (loading) return <div className="dashboard-loading"><Loader size={24} className="spin" /> Cargando socio...</div>;
  if (error || !member) return <div className="dashboard-loading" style={{ color: "var(--rojo-alerta)" }}>{error || "Socio no encontrado"}</div>;

  return (
    <div className="detalle-container">
      <div className="detalle-actions-row">
        <button className="btn-back" onClick={() => navigate("/socios")}><ArrowLeft size={18} /> Volver a Socios</button>
        {canModify && <button className="btn-register-period" onClick={() => navigate(`/socios/editar/${id}`)}><Pencil size={16} /> Editar socio</button>}
        {canModify && <button className="btn-register-period btn-baja" onClick={openBajaModal}><UserMinus size={16} /> Dar de baja</button>}
      </div>

      <div className="detalle-card">
        <div className="detalle-header">
          <div className="detalle-avatar"><User size={40} /></div>
          <div className="detalle-title"><h2>{member.nombre}</h2><span className="detalle-sub">Nº Socio {member.numeroDeSocio}{member.fechaBaja && <span style={{ marginLeft: 8, color: "#dc2626", fontWeight: 700 }}>(Dado de baja)</span>}</span></div>
        </div>
        <div className="detalle-groups">
          <CollapsibleCard title="Datos personales">
            <div className="detalle-info-grid detalle-group-body">
              <div className="info-item"><span className="info-label">Sexo</span><span>{member.sexo || "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Fecha de nacimiento</span><span>{member.fechaNac || "\u2014"}{member.edad ? ` (${member.edad})` : ""}</span></div>
              <div className="info-item"><span className="info-label">Documento</span><span>{member.tipoDoc} {member.documento}</span></div>
              <div className="info-item"><span className="info-label">CUIL</span><span>{member.cuil || "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Teléfono</span><span>{member.telefono || "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Email</span><span>{member.email || "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Domicilio</span><span>{member.domicilio || "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Código postal</span><span>{member.codPostal || "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Localidad</span><span>{member.localidad || "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Residencia</span><span>{member.residencia || "\u2014"}</span></div>
            </div>
          </CollapsibleCard>

          {member.militar && (
            <CollapsibleCard title="Datos militares">
              <div className="detalle-info-grid detalle-group-body">
                <div className="info-item"><span className="info-label">Fuerza</span><span>{member.fuerza || "\u2014"}</span></div>
                <div className="info-item"><span className="info-label">Grado</span><span>{member.grado || "\u2014"}</span></div>
                <div className="info-item"><span className="info-label">Estado</span><span>{member.estado || "\u2014"}</span></div>
              </div>
            </CollapsibleCard>
          )}

          <CollapsibleCard title="Datos del circulo">
            <div className="detalle-info-grid detalle-group-body">
              <div className="info-item"><span className="info-label">Tipo de socio</span><span>{member.tipoSocio || "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Militar</span><span>{member.militar ? "Sí" : "No"}</span></div>
              <div className="info-item"><span className="info-label">Asistencial</span><span>{member.asistencial ? "Sí" : "No"}</span></div>
              <div className="info-item"><span className="info-label">Plan de salud</span><span>{member.planSalud ? "Sí" : "No"}</span></div>
              <div className="info-item"><span className="info-label">Cobra IAF</span><span>{member.cobraIAF || "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Paga por</span><span>{member.pagaPor || "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Depositar en</span><span>{member.depositarEn || "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Cementerio</span><span>{member.cementerio || "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Fallecido</span><span>{member.fallecido ? "Sí" : "No"}</span></div>
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Altas y bajas">
            <div className="detalle-info-grid detalle-group-body">
              <div className="info-item"><span className="info-label">Fecha de ingreso</span><span>{member.fechaIngreso || "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Fecha de baja</span><span>{member.fechaBaja || "\u2014"}{member.fechaBaja && member.motivoBaja ? ` (${member.motivoBaja})` : ""}</span></div>
              <div className="info-item"><span className="info-label">Motivo de baja</span><span>{member.motivoBaja || "\u2014"}</span></div>
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Grupo familiar y representantes">
            <div className="detalle-info-grid detalle-group-body">
              <div className="info-item"><span className="info-label">Nro. de familia</span><span>{member.nroFamilia || "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Nro. familia de fallecidos</span><span>{member.nroFamAFall || "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Apoderado 1</span><span>{member.apoderado1 ? `${member.apoderado1.nombre}${member.apoderado1.documento ? ` — ${member.apoderado1.tipoDoc} ${member.apoderado1.documento}` : ""}` : "\u2014"}</span></div>
              <div className="info-item"><span className="info-label">Apoderado 2</span><span>{member.apoderado2 ? `${member.apoderado2.nombre}${member.apoderado2.documento ? ` — ${member.apoderado2.tipoDoc} ${member.apoderado2.documento}` : ""}` : "\u2014"}</span></div>
            </div>
          </CollapsibleCard>
        </div>
      </div>

      <div className="detalle-card">
        <div className="detalle-section-header">
          <h3 className="detalle-section-title">Cuotas de Socio</h3>
          {canModify && <button className="btn-register-period" onClick={openModal}><Plus size={16} /> Modificar registro cuotas</button>}
        </div>
        {socioDues.length === 0 ? <p className="detalle-empty">No tiene cuotas de socio registradas.</p> : (
          <div className="table-wrapper">
            <table className="treasury-table">
              <thead><tr><th>Periodo</th><th>Fecha de Pago</th><th>Importe</th><th>Pago</th><th>Movimiento</th><th></th></tr></thead>
              <tbody>
                {socioDues.map((d) => {
                  const isSelf = d.member_id === member.id;
                  const isFamilyPaid = !isSelf && d.paid_members?.includes(member.id ?? "");
                  return (
                    <tr key={d.id} className={d.anulado ? "row-anulado" : ""}>
                      <td>{formatPeriodsDisplay(d.period)}{d.anulado ? <span className="badge badge-anulado">ANULADO</span> : null}</td>
                      <td>{d.payment_date}</td>
                      <td className="amount-ingreso">{d.amount != null ? formatCurrency(d.amount) : "\u2014"}</td>
                      <td>{isSelf ? <span className="due-badge due-badge-self">Propio</span> : isFamilyPaid ? <span className="due-badge due-badge-family" title={`Pagado por ${d.member_nombre ?? "familiar"}`}>Familiar</span> : <span className="due-badge due-badge-other">\u2014</span>}</td>
                      <td>{d.receipt_number ? String(d.receipt_number).padStart(6, "0") : d.movement_id ? d.movement_id.slice(0, 8) + "\u2026" : "\u2014"}</td>
                      <td>{d.movement_id && <button className="btn-view-detail" type="button" onClick={() => navigate(`/tesoreria/movimientos/detalle/${d.movement_id}`)}><Eye size={14} /> Ver detalles</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {hasNichos && (
      <div className="detalle-card">
        <h3 className="detalle-section-title">Cuotas de Cementerio</h3>
        {cementerioDues.length === 0 ? <p className="detalle-empty">No tiene cuotas de cementerio registradas.</p> : (
          <div className="table-wrapper">
            <table className="treasury-table">
              <thead><tr><th>Nicho(s)</th><th>Periodo</th><th>Fecha de Pago</th><th>Importe</th><th>Movimiento</th><th></th></tr></thead>
              <tbody>
                {cementerioGrouped.map((g) => (
                  <tr key={g.movement_id} className={g.anulado ? "row-anulado" : ""}>
                    <td style={{ fontWeight: 600 }}>{g.nichos}</td>
                    <td>{formatPeriodsDisplay(g.period && g.period.length > 0 ? g.period : null)}{g.anulado ? <span className="badge badge-anulado">ANULADO</span> : null}</td>
                    <td>{g.payment_date}</td>
                    <td className="amount-ingreso">{g.amount > 0 ? formatCurrency(g.amount) : "\u2014"}</td>
                    <td>{g.receipt_number ? String(g.receipt_number).padStart(6, "0") : g.movement_id ? g.movement_id.slice(0, 8) + "\u2026" : "\u2014"}</td>
                    <td>{g.movement_id && <button className="btn-view-detail" type="button" onClick={() => navigate(`/tesoreria/movimientos/detalle/${g.movement_id}`)}><Eye size={14} /> Ver detalles</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      <AccountSection memberId={id} />

      {showModal && canModify && (
        <div className="family-picker-overlay">
          <div className="family-picker-modal">
            <div className="family-picker-modal-header">
              <h4>Registrar periodo como pago</h4>
              <button className="modal-close-btn" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="modal-member-info">
                <User size={20} />
                <div><strong>{member.nombre}</strong><span className="modal-member-sub">Nº Socio {member.numeroDeSocio}</span></div>
              </div>
              {familyGroupPrefix && familyMembers.length > 1 && (
                <div className="modal-family-section">
                  <p className="family-member-hint">Grupo familiar N° {familyGroupPrefix} — {familyMembers.length} integrantes{familyMembers.length > 3 ? ` (a partir del 4to: exento por convenio)` : ""}</p>
                  {familyMembers.map((fm) => {
                    const sorted = [...familyMembers].sort((a, b) => {
                      const na = parseInt((a.nroFamilia ?? "").split("/").pop() ?? "0", 10) || 0;
                      const nb = parseInt((b.nroFamilia ?? "").split("/").pop() ?? "0", 10) || 0;
                      return na - nb;
                    });
                    const exempt = sorted.findIndex((m) => m.id === fm.id) >= 3;
                    return (
                      <label key={fm.id} className="family-member-item">
                        <input autoComplete="off" type="checkbox" checked={selectedFamily.has(fm.id)} onChange={() => setSelectedFamily((prev) => { const next = new Set(prev); if (next.has(fm.id)) next.delete(fm.id); else next.add(fm.id); return next; })} />
                        <span>{fm.nombre}</span>
                        <span className="family-member-socio">Nº {fm.numeroDeSocio}</span>
                        {exempt && <span className="family-tag tag-exento">EXENTO</span>}
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="config-form">
                <div className="config-field">
                  <label>Período</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                    <PeriodPicker
                      periodYear={periodYear}
                      onYearChange={setPeriodYear}
                      periods={periods}
                      onTogglePeriod={(val) => setPeriods((prev) => prev.includes(val) ? prev.filter((p) => p !== val) : [...prev, val].sort())}
                      disabledPeriods={paidPeriods}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="family-picker-actions">
              <button className="btn-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-save" onClick={handleConfirm} disabled={savingMark || periods.length === 0}>{savingMark ? "Guardando..." : "Registrar"}</button>
            </div>
          </div>
        </div>
      )}

      {showBajaModal && canModify && (
        <div
          className="family-picker-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowBajaModal(false);
          }}
        >
          <div className="family-picker-modal">
            <div className="family-picker-modal-header">
              <h4>Dar de baja al socio</h4>
              <button className="modal-close-btn" onClick={() => setShowBajaModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="modal-member-info">
                <User size={20} />
                <div><strong>{member.nombre}</strong><span className="modal-member-sub">Nº Socio {member.numeroDeSocio}</span></div>
              </div>
              <div className="config-form">
                <div className="config-field">
                  <label className="baja-checkbox">
                    <input autoComplete="off"
                      type="checkbox"
                      checked={bajaConFecha}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setBajaConFecha(checked);
                        if (checked && !bajaFecha) setBajaFecha(todayLocal());
                        if (!checked) setBajaFecha("");
                      }}
                    />
                    Fecha de baja
                  </label>
                  {bajaConFecha && (
                    <input autoComplete="off"
                      type="date"
                      className="config-input"
                      value={bajaFecha}
                      onChange={(e) => setBajaFecha(e.target.value)}
                    />
                  )}
                </div>
                <div className="config-field">
                  <label className="baja-checkbox">
                    <input autoComplete="off"
                      type="checkbox"
                      checked={bajaFallecido}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setBajaFallecido(checked);
                        if (checked) {
                          setBajaConFecha(true);
                          if (!bajaFecha) setBajaFecha(todayLocal());
                          setBajaMotivo("fallecimiento");
                        }
                      }}
                    />
                    Fallecido
                  </label>
                </div>
                <div className="config-field">
                  <label>Motivo de baja</label>
                  <input autoComplete="off"
                    type="text"
                    className="config-input"
                    value={bajaMotivo}
                    onChange={(e) => setBajaMotivo(e.target.value)}
                  />
                </div>
              </div>
              {bajaError && <div className="baja-error">{bajaError}</div>}
            </div>
            <div className="family-picker-actions">
              <button className="btn-cancel" onClick={() => setShowBajaModal(false)} disabled={savingBaja}>Cancelar</button>
              <button className="btn-save" onClick={handleSaveBaja} disabled={savingBaja}>{savingBaja ? "Guardando..." : "Dar de baja"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetalleSocio;
