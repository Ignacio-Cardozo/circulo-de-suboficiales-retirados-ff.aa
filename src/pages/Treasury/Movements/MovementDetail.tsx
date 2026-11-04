import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader, Edit3, Trash2, X, Eye, FileText, Ban } from "lucide-react";
import { fetchMovementById, setMovementAnulado, type Movement, type ServiceRecordLink, type CementerioMovimientoLink } from "../../../services/movementsApi";
import { fetchMemberById } from "../../../services/membersApi";
import { fetchDebtByMovement, fetchBalanceByMember, type DebtWithDetails } from "../../../services/debtsApi";
import type { Member } from "../../../models/members";
import ServiceRecordModal from "../../../components/service/ServiceRecordModal";
import Comprobante from "../../../components/comprobante/Comprobante";
import SpecialServiceRecordDetailModal from "../../Calendario/SpecialServiceRecordDetailModal";
import type { SpecialServiceRecordItem } from "../../../services/specialServiceRecordsApi";
import { toCurrency, formatPeriodsDisplay, formatRecordDate } from "../../../utils/format";
import "../TreasuryTables.css";
import "../ServiceHistory/ServiceHistory.css";
import "../../Calendario/Calendario.css";
import "./MovementDetail.css";

const MovementDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [movement, setMovement] = useState<Movement | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [paidMemberNames, setPaidMemberNames] = useState<{ id: string; nombre: string }[]>([]);
    const [selectedServiceRecord, setSelectedServiceRecord] = useState<ServiceRecordLink | null>(null);
    const [selectedSpecialServiceRecord, setSelectedSpecialServiceRecord] = useState<SpecialServiceRecordItem | null>(null);
    const [showComprobante, setShowComprobante] = useState(false);
    const [linkedDebt, setLinkedDebt] = useState<DebtWithDetails | null>(null);
    const [haberesMember, setHaberesMember] = useState<Member | null>(null);
    const [haberesBalance, setHaberesBalance] = useState<number | null>(null);
    const [haberesLoading, setHaberesLoading] = useState(false);

    useEffect(() => {
        if (!id) return;
        let mounted = true;
        fetchMovementById(id)
            .then((m) => {
                if (mounted) {
                    setMovement(m);
                    setLoading(false);
                    setLinkedDebt(null);
                    setHaberesMember(null);
                    setHaberesBalance(null);
                    setHaberesLoading(false);
                    if (m.linked_due?.paid_members?.length) {
                        Promise.all(m.linked_due.paid_members.map((pid: string) => fetchMemberById(pid).catch(() => null)))
                            .then((members) => {
                                if (mounted) {
                                    const valid = members.filter((mem): mem is NonNullable<typeof mem> => mem !== null);
                                    setPaidMemberNames(valid.map((mem) => ({ id: mem.id, nombre: mem.nombre })));
                                }
                            }).catch(() => {});
                    }
                    const conceptKey = (m.concept ?? "").toLowerCase();
                    if (conceptKey === "adelanto de haberes" || conceptKey === "pago de haberes") {
                        setHaberesLoading(true);
                        fetchDebtByMovement(m.id)
                            .then(async (debts) => {
                                const debt = debts[0] ?? null;
                                if (!mounted) return;
                                setLinkedDebt(debt);
                                if (debt?.member_id) {
                                    const [member, balance] = await Promise.all([
                                        fetchMemberById(debt.member_id).catch(() => null),
                                        fetchBalanceByMember(debt.member_id).catch(() => 0),
                                    ]);
                                    if (mounted) {
                                        setHaberesMember(member);
                                        setHaberesBalance(balance);
                                        setHaberesLoading(false);
                                    }
                                } else {
                                    if (mounted) setHaberesLoading(false);
                                }
                            })
                            .catch(() => {
                                if (mounted) {
                                    setLinkedDebt(null);
                                    setHaberesLoading(false);
                                }
                            });
                    }
                }
            })
            .catch((err) => { if (mounted) { setError(err instanceof Error ? err.message : "Error al cargar movimiento"); setLoading(false); } });
        return () => { mounted = false; };
    }, [id]);

    const handleDelete = useCallback(async () => {
        if (!id) return;
        setDeleting(true);
        setError(null);
        try { await setMovementAnulado(id, true); navigate("/tesoreria/movimientos"); }
        catch (err) { setError(err instanceof Error ? err.message : "Error al anular"); setDeleting(false); }
    }, [id, navigate]);

    if (loading) return <div className="dashboard-loading"><Loader size={24} className="spin" /> Cargando movimiento...</div>;
    if (error && !movement) return <div className="dashboard-loading" style={{ color: "var(--rojo-alerta)" }}>{error}</div>;
    if (!movement) return <div className="dashboard-loading" style={{ color: "var(--rojo-alerta)" }}>Movimiento no encontrado</div>;

    const typeLabel = movement.type === "ingreso" ? "Ingreso" : movement.type === "egreso" ? "Egreso" : "Transferencia";
    const modeLabel = movement.mode === "efectivo" ? "Efectivo" : "Transferencia";
    const hasLinkedDue = !!movement.linked_due;
    const hasServiceRecords = (movement.linked_service_records?.length ?? 0) > 0;
    const hasCementerioMovimientos = (movement.linked_cementerio_movimientos?.length ?? 0) > 0;
    const hasSpecialServiceRecords = (movement.linked_special_service_records?.length ?? 0) > 0;
    const hasAnyLinked = hasLinkedDue || hasServiceRecords || hasCementerioMovimientos || hasSpecialServiceRecords;
    const isHaberesConcept = (movement.concept ?? "").toLowerCase() === "adelanto de haberes" || (movement.concept ?? "").toLowerCase() === "pago de haberes";

    return (
        <div className="movement-detail-container">
            <button className="btn-back" onClick={() => navigate("/tesoreria/movimientos")}>
                <ArrowLeft size={18} /> Volver a Movimientos
            </button>

            {error && (
                <div className="error-banner">{error}<button type="button" className="success-close" onClick={() => setError(null)}><X size={16} /></button></div>
            )}

            {movement.anulado && (
                <div className="anulado-banner">
                    <Ban size={18} /> ESTE MOVIMIENTO ESTÁ ANULADO. No se cuenta en los totales ni en las cuotas vinculadas.
                </div>
            )}

            <div className={`movement-detail-card${movement.anulado ? " is-anulado" : ""}`}>
                <div className="movement-detail-header">
                    <h2>Detalle del Movimiento</h2>
                    {!confirmDelete && (
                        <div className="movement-detail-actions">
                            {movement.comprobante != null && (
                                <div className="comprobante-action-group">
                                    <button className="btn-comprobante" onClick={() => setShowComprobante(true)}><FileText size={16} /> Ver Comprobante</button>
                                </div>
                            )}
                            {!movement.anulado && (
                                <button className="btn-edit" onClick={() => navigate(`/tesoreria/nuevo-movimiento/${movement.id}`)}><Edit3 size={16} /> Editar</button>
                            )}
                            {!movement.anulado && (
                                <button className="btn-delete" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /> Anular</button>
                            )}
                        </div>
                    )}
                </div>

                {confirmDelete && (
                    <div className="delete-confirm-box">
                        <p>{hasAnyLinked ? "Este movimiento está asociado a registros vinculados (cuotas, servicios y/o cementerio). Al anularlo no se contará en los totales ni en las cuotas/servicios vinculados, pero el registro se conservará marcado como anulado." : "¿Estás seguro de anular este movimiento? El registro se conservará pero no se contará en los totales."}</p>
                        <div className="delete-confirm-actions">
                            <button className="btn-cancel" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancelar</button>
                            <button className="btn-delete-confirm" onClick={handleDelete} disabled={deleting}>{deleting ? "Anulando..." : "Sí, anular"}</button>
                        </div>
                    </div>
                )}

                <div className="movement-detail-grid">
                    <div className="detail-field"><span className="detail-label">ID / Comprobante</span><span className="detail-value mono">{movement.id}{movement.comprobante ? ` / ${String(movement.comprobante.receipt_number).padStart(6, "0")}` : ""}</span></div>
                    <div className="detail-field"><span className="detail-label">Fecha</span><span className="detail-value">{formatRecordDate(movement.date)}</span></div>
                    <div className="detail-field full-width"><span className="detail-label">Detalle</span><span className="detail-value">{movement.detail || "\u2014"}</span></div>
                    <div className="detail-field"><span className="detail-label">Tipo</span><span className={`badge ${movement.type === "ingreso" ? "badge-ingreso" : movement.type === "egreso" ? "badge-egreso" : "badge-transferencia"}`}>{typeLabel}</span></div>
                    <div className="detail-field"><span className="detail-label">Modalidad</span><span className="detail-value">{modeLabel}</span></div>
                    <div className="detail-field"><span className="detail-label">Importe</span><span className={`detail-value ${movement.type === "ingreso" ? "amount-ingreso" : "amount-egreso"}`}>{movement.type === "ingreso" ? "+" : "-"} {toCurrency(movement.amount)}</span></div>
                    {movement.concept && <div className="detail-field"><span className="detail-label">Concepto</span><span className="detail-value">{movement.concept}</span></div>}

                    {hasLinkedDue && (
                        <>
                            <div className="detail-field separator-row" style={{ gridColumn: "1 / -1" }}><hr /></div>
                            <div className="detail-field" style={{ gridColumn: "1 / -1" }}><span className="detail-label due-label">Cuota vinculada</span><span className={`badge ${movement.linked_due!.type === "socio" ? "badge-ingreso" : "badge-egreso"}`}>{movement.linked_due!.type === "socio" ? "Cuota Socio" : "Cuota Cementerio"}</span></div>
                            {movement.linked_due!.period && movement.linked_due!.period.length > 0 && movement.linked_due!.type === "socio" && <div className="detail-field"><span className="detail-label">Periodo</span><span className="detail-value">{formatPeriodsDisplay(movement.linked_due!.period)}</span></div>}
                            {movement.linked_due!.member_nombre && <div className="detail-field"><span className="detail-label">Socio</span><span className="detail-value">{movement.linked_due!.member_nombre} <button className="btn-view-detail" type="button" onClick={() => navigate(`/socios/detalle/${movement.linked_due!.member_id}`)}><Eye size={14} /> Ver detalles</button></span></div>}
                            {movement.linked_due!.person_nombre && <div className="detail-field"><span className="detail-label">Tercero</span><span className="detail-value">{movement.linked_due!.person_nombre} <button className="btn-view-detail" type="button" onClick={() => navigate(`/terceros/detalle/${movement.linked_due!.person_id}`)}><Eye size={14} /> Ver detalles</button></span></div>}
                            {movement.linked_due!.family_group && <div className="detail-field"><span className="detail-label">Grupo familiar</span><span className="detail-value">Nº {movement.linked_due!.family_group}</span></div>}
                            {paidMemberNames.length > 1 && (
                                <div className="detail-field full-width">
                                    <span className="detail-label">Miembros incluidos</span>
                                    <div className="paid-members-list">{paidMemberNames.map((pm) => <span key={pm.id} className="paid-member-chip">{pm.nombre}</span>)}</div>
                                </div>
                            )}
                        </>
                    )}

                    {hasServiceRecords && (
                        <>
                            <div className="detail-field separator-row" style={{ gridColumn: "1 / -1" }}><hr /></div>
                            <div className="detail-field" style={{ gridColumn: "1 / -1" }}><span className="detail-label due-label">Servicios vinculados</span></div>
                            <div style={{ gridColumn: "1 / -1" }}>
                                <table className="treasury-table" style={{ minWidth: 0 }}>
                                    <thead><tr>{movement.type !== "egreso" && <th>Servicio</th>}<th>Titular</th><th>Importe</th><th>Fecha</th></tr></thead>
                                    <tbody>
                                        {movement.linked_service_records!.map((sr: ServiceRecordLink) => (
                                            <tr key={sr.id} className="clickable-row" onClick={() => setSelectedServiceRecord(sr)}>
                                                {movement.type !== "egreso" && <td>{sr.service_name ?? "\u2014"}</td>}
                                                <td>{sr.member_nombre ? `${sr.member_nombre}${sr.member_numero_de_socio ? ` (N\u00BA ${sr.member_numero_de_socio})` : ""}` : sr.person_nombre ?? "\u2014"}</td>
                                                <td className="amount-ingreso">{toCurrency(sr.amount)}</td>
                                                <td>{formatRecordDate(sr.date)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {hasSpecialServiceRecords && (
                        <>
                            <div className="detail-field separator-row" style={{ gridColumn: "1 / -1" }}><hr /></div>
                            <div className="detail-field" style={{ gridColumn: "1 / -1" }}><span className="detail-label due-label">Servicios especiales vinculados</span></div>
                            <div style={{ gridColumn: "1 / -1" }}>
                                <table className="treasury-table" style={{ minWidth: 0 }}>
                                    <thead><tr><th>Servicio</th><th>Titular</th><th>Importe</th><th>Fecha</th></tr></thead>
                                    <tbody>
                                        {movement.linked_special_service_records!.map((record) => (
                                            <tr key={record.id} className="clickable-row" onClick={() => setSelectedSpecialServiceRecord(record)}>
                                                <td>{record.special_service_name ?? "\u2014"}</td>
                                                <td>{record.member_nombre ? `${record.member_nombre}${record.member_numero_de_socio ? ` (N\u00BA ${record.member_numero_de_socio})` : ""}` : record.person_nombre ?? "\u2014"}</td>
                                                <td className={record.amount >= 0 ? "amount-ingreso" : "amount-egreso"}>{toCurrency(record.amount)}</td>
                                                <td>{formatRecordDate(record.date)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {hasCementerioMovimientos && (
                        <>
                            <div className="detail-field separator-row" style={{ gridColumn: "1 / -1" }}><hr /></div>
                            <div className="detail-field" style={{ gridColumn: "1 / -1" }}><span className="detail-label due-label">Cementerio - Detalle por nicho</span></div>
                            <div style={{ gridColumn: "1 / -1" }}>
                                <table className="treasury-table" style={{ minWidth: 0 }}>
                                    <thead><tr><th>Nicho</th><th>Tipo</th><th>Ocupante</th><th>Años pagados</th><th>Importe</th><th>Fecha pago</th></tr></thead>
                                    <tbody>
                                        {movement.linked_cementerio_movimientos!.map((cm: CementerioMovimientoLink) => (
                                            <tr key={cm.id}>
                                                <td style={{ fontWeight: 600 }}>{cm.nicho}</td>
                                                <td>{cm.tipo ?? "\u2014"}</td>
                                                <td>{cm.ocupante ?? "\u2014"}</td>
                                                <td><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{cm.anios_pagados.map((y) => <span key={y} className="paid-member-chip" style={{ background: "#e0f2fe", color: "#0369a1" }}>{y}</span>)}</div></td>
                                                <td className="amount-ingreso">{toCurrency(cm.importe)}</td>
                                                <td>{formatRecordDate(cm.fecha_pago)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {isHaberesConcept && linkedDebt && (
                        <>
                            <div className="detail-field separator-row" style={{ gridColumn: "1 / -1" }}><hr /></div>
                            <div className="detail-field" style={{ gridColumn: "1 / -1" }}>
                                <span className="detail-label due-label">Cuenta corriente vinculada</span>
                                <span className={`badge ${movement.type === "ingreso" ? "badge-ingreso" : "badge-egreso"}`}>{movement.concept}</span>
                            </div>
                            {haberesMember ? (
                                <>
                                    {haberesMember.numeroDeSocio && <div className="detail-field"><span className="detail-label">N° de socio</span><span className="detail-value">{haberesMember.numeroDeSocio}</span></div>}
                                    <div className="detail-field">
                                        <span className="detail-label">Socio</span>
                                        <span className="detail-value">
                                            {haberesMember.nombre} <button className="btn-view-detail" type="button" onClick={() => navigate(`/socios/detalle/${haberesMember.id}`)}><Eye size={14} /> Ver detalles</button>
                                        </span>
                                    </div>
                                </>
                            ) : linkedDebt.member_nombre ? (
                                <div className="detail-field">
                                    <span className="detail-label">Socio</span>
                                    <span className="detail-value">
                                        {linkedDebt.member_nombre}
                                        {linkedDebt.member_id && (
                                            <button className="btn-view-detail" type="button" onClick={() => navigate(`/socios/detalle/${linkedDebt.member_id}`)}><Eye size={14} /> Ver detalles</button>
                                        )}
                                    </span>
                                </div>
                            ) : (
                                <div className="detail-field">
                                    <span className="detail-label">Titular</span>
                                    <span className="detail-value">
                                        {linkedDebt.person_nombre ?? "\u2014"}
                                        {linkedDebt.person_id && (
                                            <button className="btn-view-detail" type="button" onClick={() => navigate(`/terceros/detalle/${linkedDebt.person_id}`)}><Eye size={14} /> Ver detalles</button>
                                        )}
                                    </span>
                                </div>
                            )}
                            {linkedDebt.description && <div className="detail-field full-width"><span className="detail-label">Descripción</span><span className="detail-value">{linkedDebt.description}</span></div>}
                            <div className="detail-field">
                                <span className="detail-label">Importe</span>
                                <span className={`detail-value ${linkedDebt.amount >= 0 ? "amount-ingreso" : "amount-egreso"}`}>{toCurrency(linkedDebt.amount)}</span>
                            </div>
                            <div className="detail-field">
                                <span className="detail-label">Cuenta corriente</span>
                                <span className={`detail-value ${haberesBalance == null ? "" : haberesBalance > 0 ? "amount-ingreso" : haberesBalance < 0 ? "amount-egreso" : ""}`}>
                                    {haberesBalance == null ? (haberesLoading ? "Cargando..." : "\u2014") : toCurrency(haberesBalance)}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <ServiceRecordModal
                record={selectedServiceRecord}
                onClose={() => setSelectedServiceRecord(null)}
                onNavigateToTitular={(memberId, personId) => {
                    if (memberId) navigate(`/socios/detalle/${memberId}`);
                    else if (personId) navigate(`/terceros/detalle/${personId}`);
                }}
            />

            {selectedSpecialServiceRecord && (
                <SpecialServiceRecordDetailModal
                    key={selectedSpecialServiceRecord.id}
                    record={selectedSpecialServiceRecord}
                    onClose={() => setSelectedSpecialServiceRecord(null)}
                    onUpdated={(record) => {
                        setSelectedSpecialServiceRecord(record);
                        setMovement((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      linked_special_service_records: prev.linked_special_service_records?.map((item) =>
                                          item.id === record.id ? record : item
                                      ),
                                  }
                                : prev
                        );
                    }}
                    onCancelled={(record) => {
                        setSelectedSpecialServiceRecord(record);
                        setMovement((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      anulado: true,
                                      linked_special_service_records: prev.linked_special_service_records?.map((item) =>
                                          item.id === record.id ? record : item
                                      ),
                                  }
                                : prev
                        );
                    }}
                    onNavigateToMovement={(movementId) => navigate(`/tesoreria/movimientos/detalle/${movementId}`)}
                    onNavigateToTitular={(memberId, personId) => {
                        if (memberId) navigate(`/socios/detalle/${memberId}`);
                        else if (personId) navigate(`/terceros/detalle/${personId}`);
                    }}
                />
            )}

            {showComprobante && movement.comprobante != null && (
                <Comprobante
                    data={{
                        receipt_number: movement.comprobante.receipt_number,
                        type: movement.type as "ingreso" | "egreso",
                        date: movement.date,
                        detail: movement.comprobante.detail || movement.detail || "",
                        conceptDetail: movement.type === "egreso" && movement.concept?.toLowerCase() === "servicios varios" ? "Pago por servicio brindado" : undefined,
                        amount: movement.amount,
                        origin: movement.mode === "efectivo" ? "Caja Chica" : "Banco",
                        payerName: movement.comprobante.payer_name ?? movement.linked_due?.member_nombre ?? movement.linked_due?.person_nombre ?? undefined,
                        copies_to_print: movement.comprobante.copies_to_print,
                        paymentMethod: movement.mode === "efectivo" ? "Efectivo" : "Transferencia",
                        anulado: movement.anulado ?? false,
                    }}
                    onClose={() => setShowComprobante(false)}
                />
            )}
        </div>
    );
};

export default MovementDetail;
