import React, { useState, useCallback, useMemo, useEffect } from "react";
import { DollarSign, Save, Loader, Landmark, CreditCard, Info, Calendar, Trash2, Plus, Wallet } from "lucide-react";
import { savePayment } from "../../../services/paymentsApi";
import { fetchNextReceipt } from "../../../services/initialBalancesApi";
import { fetchExternalServices, saveExternalServicePayment, type ExternalServiceItem } from "../../../services/externalServicesApi";
import { fetchServiceProviders } from "../../../services/personsApi";
import { fetchMembers } from "../../../services/membersApi";
import { saveDebt, fetchBalanceByMember, fetchDebtsByMember } from "../../../services/debtsApi";
import { saveServiceRecord } from "../../../services/serviceRecordsApi";
import Banner from "../../../components/ui/Banner";
import Comprobante, { type ComprobanteData } from "../../../components/comprobante/Comprobante";
import { saveComprobante } from "../../../services/comprobantesApi";
import { fetchReceiptCopiesConfig, fetchReceiptConcepts, type ReceiptCopiesDefaults } from "../../../services/receiptCopiesConfigApi";
import PersonSearch from "../../../components/person/PersonSearch";
import ProviderPersonModal from "./ProviderPersonModal";
import type { Person, Member } from "../../../models/members";
import DateInput from "../../../components/ui/DateInput";
import { toCurrency, todayLocal, formatCurrency, toDisplayDate } from "../../../utils/format";
import "../NewMovement/NewMovement.css";
import "./NewExpense.css";

const HABERES_CONCEPTS = ["Adelanto de haberes", "Pago de haberes"];

const FALLBACK_EXPENSE_CONCEPTS = [
  "Servicios Varios",
  "Pago de servicio externo",
  "Adelanto de haberes",
  "Pago de haberes",
  "Otros",
];

type FieldErrors = {
  concepto?: string;
  fecha?: string;
  importe?: string;
  persona?: string;
};

const NewExpense: React.FC = () => {
  const [cajaOrigen, setCajaOrigen] = useState<"caja_chica" | "banco">("caja_chica");
  const [concepto, setConcepto] = useState(FALLBACK_EXPENSE_CONCEPTS[0]);
  const [fecha, setFecha] = useState(todayLocal());
  const [importeStr, setImporteStr] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [externalServices, setExternalServices] = useState<ExternalServiceItem[]>([]);
  const [selectedExtService, setSelectedExtService] = useState<string>("");
  const [receiptCopiesDefaults, setReceiptCopiesDefaults] = useState<ReceiptCopiesDefaults>({});
  const [egresoConcepts, setEgresoConcepts] = useState<string[]>(FALLBACK_EXPENSE_CONCEPTS);

  const [serviceProviders, setServiceProviders] = useState<Person[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Person | null>(null);
  const [providerSearch, setProviderSearch] = useState("");
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [providersFetched, setProvidersFetched] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  const [accountState, setAccountState] = useState<{ memberId: string; balance: number | null; lastChange: string | null } | null>(null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [comprobanteData, setComprobanteData] = useState<ComprobanteData | null>(null);
  const [showComprobante, setShowComprobante] = useState(false);

  const mode = cajaOrigen === "caja_chica" ? "efectivo" : "transferencia";
  const originLabel = cajaOrigen === "caja_chica" ? "Caja Chica" : "Banco";
  const formaPagoLabel = mode === "efectivo" ? "Efectivo" : "Transferencia";
  const isServiciosVarios = concepto?.toLowerCase() === "servicios varios";
  const isHaberesConcept = concepto === "Adelanto de haberes" || concepto === "Pago de haberes";

  const accountForCurrent = isHaberesConcept && selectedMember && accountState && accountState.memberId === selectedMember.id ? accountState : null;
  const accountBalance = accountForCurrent?.balance ?? null;
  const accountLastChange = accountForCurrent?.lastChange ?? null;
  const accountLoading = isHaberesConcept && !!selectedMember && !accountForCurrent;

  useEffect(() => {
    if (egresoConcepts.length > 0 && !egresoConcepts.includes(concepto)) {
      setConcepto(egresoConcepts[0]);
    }
  }, [egresoConcepts, concepto]);

  useEffect(() => {
    if (concepto === "Pago de servicio externo" && externalServices.length === 0) {
      fetchExternalServices()
        .then((svcs) => setExternalServices(svcs.filter((s) => s.active)))
        .catch(() => {});
    }
  }, [concepto, externalServices.length]);

  useEffect(() => {
    if (isServiciosVarios && !providersFetched) {
      fetchServiceProviders()
        .then((providers) => { setServiceProviders(providers); setProvidersFetched(true); })
        .catch(() => { setServiceProviders([]); setProvidersFetched(true); });
    }
  }, [concepto, providersFetched, isServiciosVarios]);

  useEffect(() => {
    let mounted = true;
    fetchMembers()
      .then((data) => { if (mounted) { setMembers(Array.isArray(data) ? data : []); setMembersLoading(false); } })
      .catch(() => { if (mounted) setMembersLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const memberId = selectedMember?.id;
    if (!isHaberesConcept || !memberId) return;
    let mounted = true;
    Promise.all([fetchBalanceByMember(memberId), fetchDebtsByMember(memberId)])
      .then(([bal, debts]) => {
        if (mounted) {
          setAccountState({
            memberId,
            balance: bal ?? null,
            lastChange: debts.length > 0 ? debts[0].date : null,
          });
        }
      })
      .catch(() => {
        if (mounted) setAccountState({ memberId, balance: null, lastChange: null });
      });
    return () => { mounted = false; };
  }, [isHaberesConcept, selectedMember?.id]);

  useEffect(() => {
    Promise.all([
      fetchReceiptCopiesConfig(),
      fetchReceiptConcepts(),
    ]).then(([cfg, concepts]) => {
      if (cfg) setReceiptCopiesDefaults(cfg.defaults);
      const egresoNames = concepts
        .filter((c) => c.type === "egreso" && c.active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => c.name);
      if (egresoNames.length > 0) setEgresoConcepts(egresoNames);
    }).catch(() => {});
  }, []);

  const importeNum = useMemo(() => {
    const cleaned = importeStr.replace(/[^0-9,]/g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  }, [importeStr]);

  const providerResults = useMemo(() => {
    if (providerSearch.trim() === "") {
      return selectedProvider ? [] : serviceProviders;
    }
    const s = providerSearch.toLowerCase().trim();
    return serviceProviders.filter((p) =>
      p.nombre.toLowerCase().includes(s) ||
      p.documento.includes(s)
    );
  }, [providerSearch, serviceProviders, selectedProvider]);

  const memberResults = useMemo(() => {
    const source = isHaberesConcept
      ? members.filter((m) => m.cobraIAF === "HAB IAF")
      : members;
    if (memberSearch.trim() === "") {
      return selectedMember ? [] : source;
    }
    const s = memberSearch.toLowerCase().trim();
    return source.filter((m) =>
      m.nombre.toLowerCase().includes(s) ||
      m.documento.includes(s) ||
      m.numeroDeSocio.includes(s)
    );
  }, [memberSearch, members, selectedMember, isHaberesConcept]);

  const handleProviderSaved = useCallback((person: Person) => {
    const saved = { ...person, brindaServicios: true };
    setServiceProviders((prev) => {
      const exists = prev.some((p) => p.id === saved.id || (saved.documento && p.documento === saved.documento));
      return exists ? prev.map((p) => (p.id === saved.id || p.documento === saved.documento ? saved : p)) : [...prev, saved];
    });
    setSelectedProvider(saved);
    setProviderSearch(saved.nombre);
    setShowProviderDropdown(false);
    setProvidersFetched(true);
    setErrors((prev) => { const next = { ...prev }; delete next.persona; return next; });
    setTouched((prev) => { const next = { ...prev }; delete next.persona; return next; });
  }, []);

  const validate = useCallback((): FieldErrors => {
    const errs: FieldErrors = {};
    if (!concepto) errs.concepto = "Seleccioná un concepto";
    if (concepto === "Pago de servicio externo" && !selectedExtService) errs.concepto = "Seleccioná un servicio externo";
    if (isServiciosVarios && !selectedProvider) errs.persona = "Seleccioná un tercero que brinde servicios";
    if (isHaberesConcept && !selectedMember) errs.persona = "Seleccioná un socio";
    if (!fecha) errs.fecha = "Ingresá una fecha";
    if (!importeNum || importeNum <= 0) errs.importe = "Ingresá un importe válido mayor a cero";
    return errs;
  }, [concepto, fecha, importeNum, selectedExtService, selectedProvider, selectedMember, isServiciosVarios, isHaberesConcept]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const errs = validate();
      setErrors(errs);
      setTouched({ concepto: true, fecha: true, importe: true });
      if (Object.keys(errs).length > 0) return;

      setSaving(true);
      setApiError(null);
      setSuccess(false);

      try {
        const receiptNumber = await fetchNextReceipt("egreso");
        const svcName = externalServices.find((s) => s.id === selectedExtService)?.name;
        const detail = concepto === "Pago de servicio externo" && svcName
          ? `Pago servicio externo: ${svcName}${descripcion ? ` - ${descripcion}` : ""}`
          : isServiciosVarios && selectedProvider
          ? `Pago a ${selectedProvider.nombre}${descripcion ? `: ${descripcion}` : ""}`
          : isHaberesConcept && selectedMember
          ? `${concepto} a ${selectedMember.nombre}${descripcion ? `: ${descripcion}` : ""}`
          : `${concepto}${descripcion ? `: ${descripcion}` : ""}`;

        const payment = await savePayment({
          date: fecha,
          detail,
          amount: importeNum,
          type: "egreso",
          mode,
          concept: concepto,
        });

        if (concepto === "Pago de servicio externo" && selectedExtService) {
          const fechaDate = new Date(fecha + "T12:00:00");
          const month = fechaDate.getMonth() + 1;
          const year = fechaDate.getFullYear();
          await saveExternalServicePayment(selectedExtService, month, year, importeNum, payment.id);
        }

        if (isServiciosVarios && selectedProvider) {
          await saveServiceRecord({
            service_id: null,
            person_id: selectedProvider.id,
            movement_id: payment.id,
            amount: importeNum,
            date: fecha,
            detail: descripcion || null,
          });
        }

        if (isHaberesConcept && selectedMember) {
          await saveDebt({
            member_id: selectedMember.id,
            person_id: null,
            type: concepto === "Adelanto de haberes" ? "adelanto_haberes" : "pago_haberes",
            description: detail,
            amount: -importeNum,
            movement_id: payment.id,
            date: fecha,
          });
        }

        await saveComprobante({
          movement_id: payment.id,
          receipt_number: receiptNumber,
          copies_to_print: receiptCopiesDefaults[concepto] ?? 1,
          detail: detail,
          concept: concepto,
          payer_name: concepto === "Pago de servicio externo" && svcName ? svcName : isServiciosVarios && selectedProvider ? selectedProvider.nombre : isHaberesConcept && selectedMember ? selectedMember.nombre : null,
        });

        setComprobanteData({
          receipt_number: receiptNumber,
          type: "egreso",
          date: fecha,
          detail,
          amount: importeNum,
          origin: originLabel,
          payerName: concepto === "Pago de servicio externo" && svcName ? svcName : isServiciosVarios && selectedProvider ? selectedProvider.nombre : isHaberesConcept && selectedMember ? selectedMember.nombre : undefined,
          conceptDetail: isServiciosVarios && selectedProvider
            ? (descripcion ? `Pago por servicio brindado: ${descripcion}` : "Pago por servicio brindado")
            : undefined,
          copies_to_print: receiptCopiesDefaults[concepto] ?? 1,
          paymentMethod: formaPagoLabel,
        });
        setSuccess(true);
        setImporteStr("");
        setDescripcion("");
        setSelectedProvider(null);
        setProviderSearch("");
        setShowProviderDropdown(false);
        setSelectedMember(null);
        setMemberSearch("");
        setShowMemberDropdown(false);
        setErrors({});
        setTouched({});
        setApiError(null);
      } catch (err) {
        setApiError(err instanceof Error ? err.message : "Error al guardar el egreso");
      } finally {
        setSaving(false);
      }
    },
    [validate, concepto, descripcion, fecha, importeNum, mode, selectedExtService, selectedProvider, selectedMember, externalServices, originLabel, isServiciosVarios, isHaberesConcept]
  );

  const handleClearForm = useCallback(() => {
    setCajaOrigen("caja_chica");
    setConcepto(egresoConcepts[0]);
    setFecha(todayLocal());
    setImporteStr("");
    setDescripcion("");
    setSelectedExtService("");
    setSelectedProvider(null);
    setProviderSearch("");
    setShowProviderDropdown(false);
    setSelectedMember(null);
    setMemberSearch("");
    setShowMemberDropdown(false);
    setErrors({});
    setTouched({});
    setApiError(null);
    setSuccess(false);
  }, [egresoConcepts]);

  return (
    <form className="new-movement-container" onSubmit={handleSubmit} noValidate>
      {success && (
        <Banner
          type="success"
          message={`Egreso registrado correctamente${comprobanteData ? ` — Comprobante N° ${String(comprobanteData.receipt_number).padStart(6, "0")}` : ""}`}
          onClose={() => { setSuccess(false); setComprobanteData(null); }}
          actionLabel={comprobanteData ? "Ver Comprobante" : undefined}
          onAction={comprobanteData ? () => setShowComprobante(true) : undefined}
        />
      )}
      {apiError && <Banner type="error" message={apiError} onClose={() => setApiError(null)} />}

      <div className="new-movement-layout">
        <div className="new-movement-form-section">
          <div className="card-custom">
            <h3 className="card-title">Datos del Egreso</h3>

            <div className="form-grid">
              <div className="form-group">
                <label>
                  Origen del Movimiento <span className="required">*</span>
                </label>
                <select autoComplete="off"
                  className="form-control"
                  value={cajaOrigen}
                  onChange={(e) => setCajaOrigen(e.target.value as "caja_chica" | "banco")}
                >
                  <option value="caja_chica">Caja Chica</option>
                  <option value="banco">Banco</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  Forma de Pago <span className="required">*</span>
                </label>
                <div className="input-with-icon">
                  <input autoComplete="off" type="text" className="form-control" value={formaPagoLabel} readOnly />
                  <CreditCard size={18} className="input-icon" />
                </div>
              </div>

              <div className="form-group">
                <label>
                  Concepto <span className="required">*</span>
                </label>
                <select autoComplete="off"
                  className={`form-control${touched.concepto && errors.concepto ? " input-error" : ""}`}
                  value={concepto}
                  onChange={(e) => {
                    setConcepto(e.target.value);
                    if (e.target.value?.toLowerCase() !== "servicios varios") {
                      setSelectedProvider(null);
                      setProviderSearch("");
                      setShowProviderDropdown(false);
                    }
                    if (!HABERES_CONCEPTS.includes(e.target.value)) {
                      setSelectedMember(null);
                      setMemberSearch("");
                      setShowMemberDropdown(false);
                    }
                    if (e.target.value) setErrors((prev) => { const next = { ...prev }; delete next.concepto; return next; });
                  }}
                  onBlur={() => { if (!concepto) setTouched((prev) => ({ ...prev, concepto: true })); }}
                >
                  {egresoConcepts.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {touched.concepto && errors.concepto && (
                  <span className="field-error">{errors.concepto}</span>
                )}
              </div>

              {concepto === "Pago de servicio externo" && (
                <div className="form-group">
                  <label>
                    Servicio externo <span className="required">*</span>
                  </label>
                  <select autoComplete="off"
                    className="form-control"
                    value={selectedExtService}
                    onChange={(e) => setSelectedExtService(e.target.value)}
                  >
                    <option value="">Seleccionar servicio...</option>
                    {externalServices.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {isServiciosVarios && (
                <div className="form-group full-width">
                  <label>
                    Tercero que brinda el servicio <span className="required">*</span>
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ flex: 2, minWidth: 0 }}>
                      <PersonSearch
                        type="persona"
                        searchValue={providerSearch}
                        onSearchChange={(v) => { setProviderSearch(v); setShowProviderDropdown(true); if (selectedProvider && v !== selectedProvider.nombre) setSelectedProvider(null); }}
                        results={providerResults}
                        selected={selectedProvider}
                        onSelect={(p) => { setSelectedProvider(p as Person); setProviderSearch((p as Person).nombre); setShowProviderDropdown(false); setErrors((prev) => { const next = { ...prev }; delete next.persona; return next; }); }}
                        onClear={() => { setSelectedProvider(null); setProviderSearch(""); setTouched((prev) => ({ ...prev, persona: true })); setErrors((prev) => ({ ...prev, persona: "Seleccioná un tercero que brinde servicios" })); }}
                        showDropdown={showProviderDropdown}
                        onShowDropdown={setShowProviderDropdown}
                        loading={!providersFetched}
                        error={errors.persona}
                        touched={touched.persona}
                        onBlur={() => { if (!selectedProvider) setTouched((prev) => ({ ...prev, persona: true })); }}
                      />
                    </div>
                    <button
                      type="button"
                      className="add-service-btn"
                      style={{ flex: 1, minWidth: 0, width: "auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, whiteSpace: "nowrap", padding: "0 10px", height: 38, fontSize: 13, fontWeight: 600, lineHeight: 1, overflow: "hidden" }}
                      title="Agregar o modificar tercero"
                      onClick={() => setShowProviderModal(true)}
                    >
                      <Plus size={15} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Tercero</span>
                    </button>
                  </div>
                </div>
              )}

              {isHaberesConcept && (
                <div className="form-group full-width">
                  <label>
                    Socio <span className="required">*</span>
                  </label>
                  <PersonSearch
                    type="socio"
                    searchValue={memberSearch}
                    onSearchChange={(v) => { setMemberSearch(v); setShowMemberDropdown(true); if (selectedMember && v !== selectedMember.nombre) setSelectedMember(null); }}
                    results={memberResults}
                    selected={selectedMember}
                    onSelect={(p) => { setSelectedMember(p as Member); setMemberSearch((p as Member).nombre); setShowMemberDropdown(false); setErrors((prev) => { const next = { ...prev }; delete next.persona; return next; }); }}
                    onClear={() => { setSelectedMember(null); setMemberSearch(""); setTouched((prev) => ({ ...prev, persona: true })); setErrors((prev) => ({ ...prev, persona: "Seleccioná un socio" })); }}
                    showDropdown={showMemberDropdown}
                    onShowDropdown={setShowMemberDropdown}
                    loading={membersLoading}
                    error={errors.persona}
                    touched={touched.persona}
                    onBlur={() => { if (!selectedMember) setTouched((prev) => ({ ...prev, persona: true })); }}
                  />
                </div>
              )}

              <div className="form-group">
                <DateInput
                  label="Fecha"
                  required
                  value={fecha}
                  onChange={(v) => { setFecha(v); setErrors((prev) => { const next = { ...prev }; delete next.fecha; return next; }); }}
                  id="expense-date"
                  error={errors.fecha}
                  touched={touched.fecha}
                  onBlur={() => { if (!fecha) setTouched((prev) => ({ ...prev, fecha: true })); }}
                />
              </div>

              <div className="form-group">
                <label>
                  Importe <span className="required">*</span>
                </label>
                <div className="input-with-icon">
                  <input autoComplete="off"
                    type="text"
                    className={`form-control${touched.importe && errors.importe ? " input-error" : ""}`}
                    placeholder="0,00"
                    value={importeStr}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9,]/g, "");
                      setImporteStr(cleaned);
                      if (parseFloat(cleaned.replace(",", ".")) > 0) {
                        setErrors((prev) => { const next = { ...prev }; delete next.importe; return next; });
                      }
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, importe: true }))}
                  />
                  <DollarSign size={18} className="input-icon" />
                </div>
                {touched.importe && errors.importe && (
                  <span className="field-error">{errors.importe}</span>
                )}
              </div>

              <div className="form-group full-width">
                <label>Descripción / Observaciones</label>
                <textarea autoComplete="off"
                  className="form-control text-area"
                  placeholder="Detalle del egreso..."
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  maxLength={200}
                />
                <span className="char-counter">{descripcion.length}/200</span>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={handleClearForm}>
                <Trash2 size={16} /> Limpiar
              </button>
              <button type="submit" className="btn-save" disabled={saving}>
                {saving ? <Loader size={18} className="spin" /> : <Save size={18} />}
                {saving ? "Guardando..." : "Guardar Egreso"}
              </button>
            </div>
          </div>
        </div>

        <div className="new-movement-sidebar-section">
          <div className="card-custom summary-card">
            <h3 className="card-title">Resumen del Egreso</h3>
            <div className="summary-list">
              <div className="summary-item">
                <div className="summary-label">
                  <Landmark size={16} /> <span>Origen</span>
                </div>
                <div className="summary-value">{originLabel}</div>
              </div>
              <div className="summary-item">
                <div className="summary-label">
                  <CreditCard size={16} /> <span>Forma de Pago</span>
                </div>
                <div className="summary-value">{formaPagoLabel}</div>
              </div>
              <div className="summary-item">
                <div className="summary-label">
                  <Info size={16} /> <span>Concepto</span>
                </div>
                <div className="summary-value">
                  {concepto || "\u2014"}
                  {concepto === "Pago de servicio externo" && selectedExtService && (
                    <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>
                      {externalServices.find((s) => s.id === selectedExtService)?.name}
                    </span>
                  )}
                  {isServiciosVarios && selectedProvider && (
                    <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>
                      {selectedProvider.nombre}
                    </span>
                  )}
                  {isHaberesConcept && selectedMember && (
                    <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>
                      {selectedMember.nombre}
                    </span>
                  )}
                </div>
              </div>
              <div className="summary-item">
                <div className="summary-label">
                  <Calendar size={16} /> <span>Fecha</span>
                </div>
                <div className="summary-value">{fecha || "\u2014"}</div>
              </div>
              <div className="summary-item">
                <div className="summary-label">
                  <DollarSign size={16} /> <span>Importe</span>
                </div>
                <div className="summary-value highlight-red">
                  {importeNum > 0 ? toCurrency(importeNum) : "\u2014"}
                </div>
              </div>
            </div>

            <div className="summary-total summary-total-expense">
              <span>Total a Registrar</span>
              <span className="total-amount total-amount-expense">
                {importeNum > 0 ? toCurrency(importeNum) : "\u2014"}
              </span>
            </div>
          </div>

          {isHaberesConcept && selectedMember && (
            <div className="card-custom summary-card">
              <h3 className="card-title">Información de cuenta corriente</h3>
              <div className="summary-list">
                <div className="summary-item">
                  <div className="summary-label">
                    <Info size={16} /> <span>N° de socio</span>
                  </div>
                  <div className="summary-value">{selectedMember.numeroDeSocio || "\u2014"}</div>
                </div>
                <div className="summary-item">
                  <div className="summary-label">
                    <Wallet size={16} /> <span>Cuenta corriente</span>
                  </div>
                  <div className="summary-value">
                    {accountLoading ? <Loader size={14} className="spin" /> : accountBalance !== null ? formatCurrency(accountBalance) : "\u2014"}
                  </div>
                </div>
                <div className="summary-item">
                  <div className="summary-label">
                    <Calendar size={16} /> <span>Último cambio</span>
                  </div>
                  <div className="summary-value">
                    {accountLoading ? <Loader size={14} className="spin" /> : accountLastChange ? toDisplayDate(accountLastChange) : "\u2014"}
                  </div>
                </div>
              </div>
              {accountBalance !== null && importeNum > 0 && (
                <div className="account-check-hint" style={{ marginTop: 8 }}>
                  Tras registrar este egreso, la cuenta quedará en {formatCurrency(accountBalance - importeNum)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showProviderModal && (
        <ProviderPersonModal
          isOpen={showProviderModal}
          onClose={() => setShowProviderModal(false)}
          onPersonSaved={handleProviderSaved}
        />
      )}

      {showComprobante && comprobanteData && (
        <Comprobante data={comprobanteData} onClose={() => setShowComprobante(false)} />
      )}
    </form>
  );
};

export default NewExpense;
