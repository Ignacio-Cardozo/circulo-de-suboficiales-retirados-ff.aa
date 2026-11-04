import React, { useEffect, useMemo, useState } from "react";
import {
    Calendar,
    Check,
    CircleHelp,
    DollarSign,
    ExternalLink,
    FileText,
    Loader,
    Package,
    Pencil,
    Plus,
    Save,
    Trash2,
    User,
    X,
} from "lucide-react";
import Modal from "../../components/ui/Modal";
import DateInput from "../../components/ui/DateInput";
import MoneyInput from "../../components/ui/MoneyInput";
import PersonSearch from "../../components/person/PersonSearch";
import Comprobante, { type ComprobanteData } from "../../components/comprobante/Comprobante";
import { fetchComprobanteByMovementId } from "../../services/comprobantesApi";
import {
    cancelSpecialServiceRecord,
    updateSpecialServiceRecord,
    type SpecialServiceRecordItem,
} from "../../services/specialServiceRecordsApi";
import {
    fetchSpecialServices,
    type SpecialServiceItem,
} from "../../services/specialServicesApi";
import {
    fetchSpecialServiceRecordMovements,
    saveSpecialServiceRecordMovement,
    type MovementDirection,
    type MovementMode,
    type SpecialServiceRecordMovementItem,
} from "../../services/specialServiceRecordMovementsApi";
import type { SpecialServiceMovementTypeItem } from "../../services/specialServiceMovementTypesApi";
import { fetchMembers } from "../../services/membersApi";
import { fetchAllPersons } from "../../services/personsApi";
import { useSpecialServiceStatusesStore } from "../../store/specialServiceStatusesStore";
import { useSpecialServiceMovementTypesStore } from "../../store/specialServiceMovementTypesStore";
import { useSpecialServiceWorkflow } from "../../store/specialServiceWorkflowStore";
import {
    formatNumberInput,
    formatRecordDate,
    parseMoney,
    toCurrency,
    todayLocal,
} from "../../utils/format";
import type { Member, Person } from "../../models/members";
import SpecialServiceStatusBadge from "./SpecialServiceStatusBadge";
import SpecialServiceStatusSteps from "./SpecialServiceStatusSteps";

type TitularType = "member" | "person" | "none";

/**
 * Un movimiento está vigente si no fue anulado. Los que impactan en caja además
 * necesitan su movimiento de caja (si se borró, ya no cuenta como registrado).
 */
function isActiveRecordMovement(movement: SpecialServiceRecordMovementItem): boolean {
    if (movement.movement_anulado) return false;
    return !movement.includes_movement || Boolean(movement.movement_id);
}

interface SpecialServiceRecordDetailModalProps {
    record: SpecialServiceRecordItem;
    onClose: () => void;
    onUpdated: (record: SpecialServiceRecordItem) => void;
    onCancelled: (record: SpecialServiceRecordItem) => void;
    onNavigateToMovement?: (movementId: string) => void;
    onNavigateToTitular?: (memberId: string | null, personId: string | null) => void;
}

type MovementDraft = {
    label: string;
    movementType: MovementDirection;
    includesMovement: boolean;
    movementTypeKey: string | null;
    amount: string;
    date: string;
    mode: MovementMode;
    statusToApply: string | null;
};

function getTitular(record: SpecialServiceRecordItem): string {
    if (record.member_nombre) {
        return `${record.member_nombre}${record.member_numero_de_socio ? ` (N\u00BA ${record.member_numero_de_socio})` : ""}`;
    }
    return record.person_nombre ?? "Sin titular";
}

function toDateInputValue(value: string | null): string {
    if (!value) return "";
    const iso = value.split("T")[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : "";
}

const SpecialServiceRecordDetailModal: React.FC<SpecialServiceRecordDetailModalProps> = ({
    record,
    onClose,
    onUpdated,
    onCancelled,
    onNavigateToMovement,
    onNavigateToTitular,
}) => {
    const [status, setStatus] = useState(record.status);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const statuses = useSpecialServiceStatusesStore((state) => state.statuses);
    const loadStatuses = useSpecialServiceStatusesStore((state) => state.load);
    const movementTypes = useSpecialServiceMovementTypesStore((state) => state.movementTypes);
    const loadMovementTypes = useSpecialServiceMovementTypesStore((state) => state.load);

    const [movements, setMovements] = useState<SpecialServiceRecordMovementItem[]>([]);
    const [movementsLoading, setMovementsLoading] = useState(true);
    const [movementError, setMovementError] = useState<string | null>(null);
    const [draft, setDraft] = useState<MovementDraft | null>(null);
    const [movementSaving, setMovementSaving] = useState(false);
    const [movementFilter, setMovementFilter] = useState<"all" | "listos" | "pendientes">("all");
    const [comprobanteData, setComprobanteData] = useState<ComprobanteData | null>(null);

    const [editing, setEditing] = useState(false);
    const [optionsLoading, setOptionsLoading] = useState(false);
    const [services, setServices] = useState<SpecialServiceItem[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [persons, setPersons] = useState<Person[]>([]);

    const [serviceId, setServiceId] = useState(record.special_service_id ?? "");
    const [titularType, setTitularType] = useState<TitularType>(
        record.member_id ? "member" : record.person_id ? "person" : "none"
    );
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [memberSearch, setMemberSearch] = useState(record.member_nombre ?? "");
    const [personSearch, setPersonSearch] = useState(record.person_nombre ?? "");
    const [showMemberDropdown, setShowMemberDropdown] = useState(false);
    const [showPersonDropdown, setShowPersonDropdown] = useState(false);
    const [amount, setAmount] = useState(formatNumberInput(record.amount));
    const [date, setDate] = useState(toDateInputValue(record.date) || todayLocal());
    const [serviceDate, setServiceDate] = useState(toDateInputValue(record.service_date));

    useEffect(() => {
        void loadStatuses();
        void loadMovementTypes();
    }, [loadStatuses, loadMovementTypes]);

    useEffect(() => {
        let mounted = true;
        fetchSpecialServiceRecordMovements(record.id)
            .then((data) => {
                if (mounted) setMovements(data);
            })
            .catch((err) => {
                if (mounted) {
                    setMovementError(
                        err instanceof Error ? err.message : "Error al cargar los movimientos"
                    );
                }
            })
            .finally(() => {
                if (mounted) setMovementsLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, [record.id]);

    // Configuración del servicio guardado en el registro (movimientos) y del servicio
    // que se está editando (estados). Ambas caen en la lista base si el servicio no tiene una propia.
    const { workflow: recordWorkflow } = useSpecialServiceWorkflow(record.special_service_id);
    const { workflow: editWorkflow } = useSpecialServiceWorkflow(
        editing ? serviceId || null : record.special_service_id
    );

    // Estados seleccionables: los del servicio, más el estado actual del registro si ya no
    // forma parte de esa lista (p. ej. "Cancelado" o un estado quitado después).
    const stepStatuses = useMemo(() => {
        const list = editWorkflow?.statuses ?? statuses;
        if (list.some((item) => item.key === record.status)) return list;
        const current = statuses.find((item) => item.key === record.status);
        return current ? [...list, { ...current, sort_order: list.length }] : list;
    }, [editWorkflow, statuses, record.status]);

    const availableMovementTypes = recordWorkflow?.movement_types ?? movementTypes;

    const effectiveStatus = stepStatuses.some((item) => item.key === status)
        ? status
        : stepStatuses[0]?.key ?? status;

    const pendingMovementKeys = useMemo(() => {
        const pending = new Set<string>();
        const selectedStatus = stepStatuses.find((item) => item.key === effectiveStatus) ?? null;
        if (!selectedStatus?.includes_movement) return pending;
        const registered = new Set(
            movements
                .map((movement) => movement.movement_type_key)
                .filter((key): key is string => Boolean(key))
        );
        for (const item of stepStatuses) {
            if (
                item.includes_movement &&
                item.movement_type_key &&
                item.sort_order < selectedStatus.sort_order &&
                !registered.has(item.movement_type_key)
            ) {
                pending.add(item.movement_type_key);
            }
        }
        return pending;
    }, [stepStatuses, effectiveStatus, movements]);

    // Tipos con un movimiento vigente (no anulado): no se pueden volver a registrar.
    const completedMovementKeys = useMemo(() => {
        return new Set(
            movements
                .filter(isActiveRecordMovement)
                .map((movement) => movement.movement_type_key)
                .filter((key): key is string => Boolean(key))
        );
    }, [movements]);

    // Tipos que se registraron pero cuyos movimientos están todos anulados: se pueden registrar de nuevo.
    const annulledMovementKeys = useMemo(() => {
        const keys = new Set<string>();
        for (const movement of movements) {
            if (
                movement.movement_type_key &&
                movement.movement_anulado &&
                !completedMovementKeys.has(movement.movement_type_key)
            ) {
                keys.add(movement.movement_type_key);
            }
        }
        return keys;
    }, [movements, completedMovementKeys]);

    const visibleMovementTypes = useMemo(() => {
        if (movementFilter === "all") return availableMovementTypes;
        return availableMovementTypes.filter((type) =>
            movementFilter === "listos"
                ? completedMovementKeys.has(type.key)
                : !completedMovementKeys.has(type.key)
        );
    }, [availableMovementTypes, movementFilter, completedMovementKeys]);

    const selectedService = useMemo(
        () => services.find((service) => service.id === serviceId) ?? null,
        [services, serviceId]
    );

    const memberResults = useMemo(() => {
        const q = memberSearch.trim().toLowerCase();
        return members
            .filter(
                (member) =>
                    !q ||
                    member.nombre.toLowerCase().includes(q) ||
                    member.documento.includes(q) ||
                    member.numeroDeSocio.includes(q)
            )
            .slice(0, 20);
    }, [members, memberSearch]);

    const personResults = useMemo(() => {
        const q = personSearch.trim().toLowerCase();
        return persons
            .filter(
                (person) =>
                    !q ||
                    person.nombre.toLowerCase().includes(q) ||
                    person.documento.includes(q)
            )
            .slice(0, 20);
    }, [persons, personSearch]);

    const getPrice = (service: SpecialServiceItem, type: TitularType): number =>
        type === "person" ? service.person_price : service.member_price;

    const editDirty = useMemo(() => {
        if (!editing) return false;
        const originalTitularType: TitularType = record.member_id
            ? "member"
            : record.person_id
              ? "person"
              : "none";
        const currentMemberId = titularType === "member" ? selectedMember?.id ?? null : null;
        const currentPersonId = titularType === "person" ? selectedPerson?.id ?? null : null;
        return (
            serviceId !== (record.special_service_id ?? "") ||
            titularType !== originalTitularType ||
            currentMemberId !== (record.member_id ?? null) ||
            currentPersonId !== (record.person_id ?? null) ||
            amount !== formatNumberInput(record.amount) ||
            date !== (toDateInputValue(record.date) || todayLocal()) ||
            serviceDate !== toDateInputValue(record.service_date) ||
            status !== record.status
        );
    }, [
        editing,
        record,
        serviceId,
        titularType,
        selectedMember,
        selectedPerson,
        amount,
        date,
        serviceDate,
        status,
    ]);

    const isDirty = editing ? editDirty : status !== record.status;

    const resetFormFromRecord = () => {
        setServiceId(record.special_service_id ?? "");
        setTitularType(
            record.member_id ? "member" : record.person_id ? "person" : "none"
        );
        setAmount(formatNumberInput(record.amount));
        setDate(toDateInputValue(record.date) || todayLocal());
        setServiceDate(toDateInputValue(record.service_date));
        setStatus(record.status);
        setMemberSearch(record.member_nombre ?? "");
        setPersonSearch(record.person_nombre ?? "");
    };

    const startEditing = async () => {
        setError(null);
        setDraft(null);
        setMovementError(null);
        resetFormFromRecord();
        setEditing(true);
        if (services.length > 0 && members.length > 0 && persons.length > 0) {
            setSelectedMember(record.member_id
                ? members.find((item) => item.id === record.member_id) ?? null
                : null);
            setSelectedPerson(record.person_id
                ? persons.find((item) => item.id === record.person_id) ?? null
                : null);
            return;
        }
        setOptionsLoading(true);
        try {
            const [allServices, allMembers, allPersons] = await Promise.all([
                fetchSpecialServices(),
                fetchMembers(),
                fetchAllPersons(),
            ]);
            setServices(allServices);
            setMembers([...allMembers].sort((a, b) => a.nombre.localeCompare(b.nombre)));
            setPersons([...allPersons].sort((a, b) => a.nombre.localeCompare(b.nombre)));
            setSelectedMember(record.member_id
                ? allMembers.find((item) => item.id === record.member_id) ?? null
                : null);
            setSelectedPerson(record.person_id
                ? allPersons.find((item) => item.id === record.person_id) ?? null
                : null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al cargar los datos");
        } finally {
            setOptionsLoading(false);
        }
    };

    const cancelEditing = () => {
        setEditing(false);
        setError(null);
        resetFormFromRecord();
    };

    const handleTitularTypeChange = (value: TitularType) => {
        setTitularType(value);
        const service = selectedService;
        if (service) {
            setAmount(formatNumberInput(getPrice(service, value)));
        }
        if (value !== "member") {
            setSelectedMember(null);
            setMemberSearch("");
            setShowMemberDropdown(false);
        }
        if (value !== "person") {
            setSelectedPerson(null);
            setPersonSearch("");
            setShowPersonDropdown(false);
        }
    };

    const handleServiceChange = (value: string) => {
        setServiceId(value);
        const service = services.find((item) => item.id === value);
        if (service) {
            setAmount(formatNumberInput(getPrice(service, titularType)));
        }
    };

    const handleSelectMember = (member: Member | Person) => {
        const selected = member as Member;
        setSelectedMember(selected);
        setMemberSearch(selected.nombre);
        setShowMemberDropdown(false);
    };

    const handleSelectPerson = (person: Member | Person) => {
        const selected = person as Person;
        setSelectedPerson(selected);
        setPersonSearch(selected.nombre);
        setShowPersonDropdown(false);
    };

    const openMovementForType = (type: SpecialServiceMovementTypeItem) => {
        if (completedMovementKeys.has(type.key)) {
            setMovementError(
                `Ya hay un "${type.label}" registrado. Anulalo para poder registrarlo de nuevo.`
            );
            return;
        }
        const suggested =
            type.movement_type === "egreso" || type.key === "sena"
                ? record.deposit_cost ?? record.amount
                : record.amount;
        setMovementError(null);
        setDraft({
            label: type.label,
            movementType: type.movement_type,
            includesMovement: type.includes_movement,
            movementTypeKey: type.key,
            amount: formatNumberInput(suggested),
            date: todayLocal(),
            mode: "efectivo",
            statusToApply: null,
        });
    };

    const saveStatus = async () => {
        if (saving || status === record.status) return;
        setSaving(true);
        setError(null);
        try {
            const updated = await updateSpecialServiceRecord(record.id, {
                status: effectiveStatus,
            });
            setStatus(updated.status);
            onUpdated(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al actualizar el estado");
        } finally {
            setSaving(false);
        }
    };

    const buildComprobanteData = (
        movement: SpecialServiceRecordMovementItem,
        comprobante: {
            receipt_number: number;
            copies_to_print: number;
            detail: string;
            payer_name: string | null;
        }
    ): ComprobanteData => ({
        receipt_number: comprobante.receipt_number,
        type: movement.movement_type,
        date: movement.date,
        detail: comprobante.detail,
        amount: movement.amount,
        origin: movement.mode === "efectivo" ? "Caja Chica" : "Banco",
        payerName:
            comprobante.payer_name ??
            record.member_nombre ??
            record.person_nombre ??
            undefined,
        conceptDetail: comprobante.detail,
        copies_to_print: comprobante.copies_to_print,
        paymentMethod: movement.mode === "efectivo" ? "Efectivo" : "Transferencia",
        anulado: movement.movement_anulado ?? undefined,
    });

    const openComprobanteForMovement = async (movement: SpecialServiceRecordMovementItem) => {
        if (!movement.movement_id) return;
        setMovementError(null);
        try {
            const comprobante = await fetchComprobanteByMovementId(movement.movement_id);
            if (!comprobante) {
                setMovementError("Este movimiento no tiene comprobante registrado.");
                return;
            }
            setComprobanteData(buildComprobanteData(movement, comprobante));
        } catch (err) {
            setMovementError(
                err instanceof Error ? err.message : "Error al cargar el comprobante"
            );
        }
    };

    const handleSubmitMovement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!draft) return;
        if (!draft.date) {
            setMovementError("Indicá la fecha del movimiento.");
            return;
        }
        setMovementSaving(true);
        setMovementError(null);
        try {
            const saved = await saveSpecialServiceRecordMovement({
                record_id: record.id,
                movement_type_key: draft.movementTypeKey,
                label: draft.label,
                movement_type: draft.movementType,
                includes_movement: draft.includesMovement,
                amount: parseMoney(draft.amount),
                date: draft.date,
                mode: draft.mode,
            });
            setMovements((prev) => [saved, ...prev]);
            if (saved.comprobante) {
                setComprobanteData(buildComprobanteData(saved, saved.comprobante));
            }
            if (draft.statusToApply) {
                const updated = await updateSpecialServiceRecord(record.id, {
                    status: draft.statusToApply,
                });
                setStatus(draft.statusToApply);
                onUpdated(updated);
            }
            setDraft(null);
        } catch (err) {
            setMovementError(
                err instanceof Error ? err.message : "Error al registrar el movimiento"
            );
        } finally {
            setMovementSaving(false);
        }
    };

    const saveEdits = async () => {
        setError(null);
        if (!serviceId) {
            setError("Seleccioná un servicio.");
            return;
        }
        if (!date) {
            setError("Indicá la fecha del registro.");
            return;
        }
        if (!serviceDate) {
            setError("Indicá la fecha del servicio.");
            return;
        }
        if (titularType === "member" && !selectedMember) {
            setError("Seleccioná un socio.");
            return;
        }
        if (titularType === "person" && !selectedPerson) {
            setError("Seleccioná una persona.");
            return;
        }

        setSaving(true);
        try {
            const updated = await updateSpecialServiceRecord(record.id, {
                special_service_id: serviceId,
                member_id: titularType === "member" ? selectedMember!.id : null,
                person_id: titularType === "person" ? selectedPerson!.id : null,
                amount: parseMoney(amount),
                date,
                service_date: serviceDate,
                status: effectiveStatus,
            });
            onUpdated(updated);
            setEditing(false);
            setStatus(updated.status);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al actualizar el servicio");
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitEdits = (e: React.FormEvent) => {
        e.preventDefault();
        void saveEdits();
    };

    const handleApplyChanges = () => {
        if (!isDirty || saving) return;
        if (editing) {
            void saveEdits();
            return;
        }
        void saveStatus();
    };

    const handleDelete = async () => {
        if (
            !window.confirm(
                "¿Cancelar este servicio? Se anularán todos los pagos relacionados y el registro quedará marcado como cancelado."
            )
        ) {
            return;
        }
        setDeleting(true);
        setError(null);
        try {
            const updated = await cancelSpecialServiceRecord(record.id);
            await loadStatuses(true);
            onCancelled(updated);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al cancelar el registro");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
        <Modal
            isOpen={!!record}
            onClose={onClose}
            title="Detalle del servicio"
            maxWidth={980}
            contentClassName="ss-detail-modal"
        >
            <div className="ss-detail-layout">
                <div className="ss-detail-main">
                    {editing ? (
                        <>
                        <form className="ss-form" onSubmit={handleSubmitEdits}>
                            <div className="ss-field">
                                <label>Servicio *</label>
                                <select
                                    className="ss-input"
                                    value={serviceId}
                                    onChange={(e) => handleServiceChange(e.target.value)}
                                    disabled={optionsLoading}
                                >
                                    <option value="">Seleccionar servicio...</option>
                                    {services.map((service) => (
                                        <option key={service.id} value={service.id}>
                                            {service.name}
                                        </option>
                                    ))}
                                </select>
                                {selectedService?.detail && (
                                    <span className="ss-hint">{selectedService.detail}</span>
                                )}
                            </div>

                            <div className="ss-field">
                                <label>Titular</label>
                                <select
                                    className="ss-input"
                                    value={titularType}
                                    onChange={(e) => handleTitularTypeChange(e.target.value as TitularType)}
                                >
                                    <option value="member">Socio</option>
                                    <option value="person">Persona</option>
                                    <option value="none">Sin titular</option>
                                </select>
                            </div>

                            {titularType === "member" && (
                                <div className="ss-field">
                                    <label>Socio *</label>
                                    <PersonSearch
                                        type="socio"
                                        searchValue={memberSearch}
                                        onSearchChange={(value) => {
                                            setMemberSearch(value);
                                            setShowMemberDropdown(true);
                                            if (selectedMember && value !== selectedMember.nombre) {
                                                setSelectedMember(null);
                                            }
                                        }}
                                        results={memberResults}
                                        selected={selectedMember}
                                        onSelect={handleSelectMember}
                                        onClear={() => {
                                            setSelectedMember(null);
                                            setMemberSearch("");
                                        }}
                                        showDropdown={showMemberDropdown}
                                        onShowDropdown={setShowMemberDropdown}
                                        loading={optionsLoading}
                                    />
                                </div>
                            )}

                            {titularType === "person" && (
                                <div className="ss-field">
                                    <label>Persona *</label>
                                    <PersonSearch
                                        type="persona"
                                        searchValue={personSearch}
                                        onSearchChange={(value) => {
                                            setPersonSearch(value);
                                            setShowPersonDropdown(true);
                                            if (selectedPerson && value !== selectedPerson.nombre) {
                                                setSelectedPerson(null);
                                            }
                                        }}
                                        results={personResults}
                                        selected={selectedPerson}
                                        onSelect={handleSelectPerson}
                                        onClear={() => {
                                            setSelectedPerson(null);
                                            setPersonSearch("");
                                        }}
                                        showDropdown={showPersonDropdown}
                                        onShowDropdown={setShowPersonDropdown}
                                        loading={optionsLoading}
                                    />
                                </div>
                            )}

                            <div className="ss-row">
                                <div className="ss-field">
                                    <label>Monto</label>
                                    <MoneyInput
                                        value={amount}
                                        onValueChange={setAmount}
                                    />
                                </div>
                            </div>

                            <div className="ss-row">
                                <DateInput
                                    id="ss-detail-record-date"
                                    label="Fecha del registro *"
                                    value={date}
                                    onChange={setDate}
                                />
                                <DateInput
                                    id="ss-detail-service-date"
                                    label="Fecha del servicio *"
                                    required
                                    value={serviceDate}
                                    onChange={setServiceDate}
                                />
                            </div>

                            <div className="ss-field">
                                <label>Estado</label>
                                <SpecialServiceStatusSteps
                                    statuses={stepStatuses}
                                    value={effectiveStatus}
                                    onSelect={setStatus}
                                    disabled={saving}
                                />
                            </div>

                            {error && <div className="ss-error">{error}</div>}
                        </form>
                        <div className="ss-detail-actions">
                            <button
                                type="button"
                                className="ss-btn ss-btn-secondary"
                                onClick={cancelEditing}
                                disabled={saving}
                            >
                                <X size={15} /> Cancelar
                            </button>
                            <button
                                type="button"
                                className="ss-btn ss-btn-primary"
                                onClick={handleApplyChanges}
                                disabled={!isDirty || saving || movementSaving || optionsLoading}
                            >
                                {saving ? (
                                    <>
                                        <Loader size={15} className="spin" /> Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Save size={15} /> Actualizar
                                    </>
                                )}
                            </button>
                        </div>
                        </>
                    ) : (
                        <>
                            <div className="ss-detail-highlight">
                                <span className="ss-detail-amount">{toCurrency(record.amount)}</span>
                                <SpecialServiceStatusBadge
                                    statusKey={effectiveStatus}
                                    statuses={statuses}
                                />
                            </div>

                            <div className="ss-detail-grid">
                                <div className="ss-detail-field">
                                    <span className="ss-detail-icon"><FileText size={14} /></span>
                                    <div>
                                        <span className="ss-detail-label">Servicio</span>
                                        <span className="ss-detail-value">
                                            {record.special_service_name ?? "—"}
                                        </span>
                                        {record.special_service_detail && (
                                            <span className="ss-detail-hint">{record.special_service_detail}</span>
                                        )}
                                    </div>
                                </div>

                                <div className="ss-detail-field">
                                    <span className="ss-detail-icon"><User size={14} /></span>
                                    <div>
                                        <span className="ss-detail-label">Titular</span>
                                        <span className="ss-detail-value ss-detail-value-row">
                                            {getTitular(record)}
                                            {(record.member_id || record.person_id) && onNavigateToTitular && (
                                                <button
                                                    type="button"
                                                    className="ss-link-btn"
                                                    onClick={() => {
                                                        onClose();
                                                        onNavigateToTitular(record.member_id, record.person_id);
                                                    }}
                                                >
                                                    Ver perfil <ExternalLink size={12} />
                                                </button>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {record.addons.length > 0 && (
                                    <div className="ss-detail-field">
                                        <span className="ss-detail-icon"><Package size={14} /></span>
                                        <div>
                                            <span className="ss-detail-label">Añadidos</span>
                                            <ul className="ss-detail-addons">
                                                {record.addons.map((addon) => (
                                                    <li key={addon.id}>
                                                        <span>{addon.name}</span>
                                                        <span>{toCurrency(addon.cost)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}

                                <div className="ss-detail-field">
                                    <span className="ss-detail-icon"><Calendar size={14} /></span>
                                    <div>
                                        <span className="ss-detail-label">Fecha del registro</span>
                                        <span className="ss-detail-value">{formatRecordDate(record.date)}</span>
                                    </div>
                                </div>

                                {record.service_date && (
                                    <div className="ss-detail-field">
                                        <span className="ss-detail-icon"><Calendar size={14} /></span>
                                        <div>
                                            <span className="ss-detail-label">Fecha del servicio</span>
                                            <span className="ss-detail-value">{formatRecordDate(record.service_date)}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="ss-detail-field">
                                    <span className="ss-detail-icon"><DollarSign size={14} /></span>
                                    <div>
                                        <span className="ss-detail-label">Costo de la seña</span>
                                        <span className="ss-detail-value">
                                            {record.deposit_cost != null ? toCurrency(record.deposit_cost) : "—"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="ss-status-editor">
                                <label>Estado del servicio</label>
                                <SpecialServiceStatusSteps
                                    statuses={stepStatuses}
                                    value={effectiveStatus}
                                    onSelect={setStatus}
                                    disabled={saving}
                                />
                                <span className="ss-hint">
                                    Elegí el estado y presioná Actualizar para guardarlo.
                                </span>
                            </div>

                            {error && <div className="ss-error">{error}</div>}

                            <div className="ss-detail-actions">
                                <button
                                    type="button"
                                    className="ss-btn ss-btn-secondary"
                                    onClick={startEditing}
                                >
                                    <Pencil size={15} /> Editar
                                </button>
                                <button
                                    type="button"
                                    className="ss-btn ss-btn-danger"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                >
                                    {deleting ? (
                                        <>
                                            <Loader size={15} className="spin" /> Eliminando...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 size={15} /> Eliminar
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className="ss-btn ss-btn-primary"
                                    onClick={handleApplyChanges}
                                    disabled={!isDirty || saving || movementSaving || optionsLoading}
                                >
                                    {saving ? (
                                        <>
                                            <Loader size={15} className="spin" /> Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={15} /> Actualizar
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <aside className="ss-detail-side">
                    <div className="ss-side-head">
                        <div>
                            <h4 className="ss-side-title">Movimientos</h4>
                            <span className="ss-side-sub">
                                {movements.length === 0
                                    ? "Sin movimientos registrados"
                                    : `${movements.length} movimiento${movements.length === 1 ? "" : "s"}`}
                            </span>
                        </div>
                    </div>

                    <div className="ss-movement-filter">
                        {(
                            [
                                { key: "all", label: "Todos" },
                                { key: "pendientes", label: "Pendientes" },
                                { key: "listos", label: "Listos" },
                            ] as const
                        ).map((option) => (
                            <button
                                key={option.key}
                                type="button"
                                className={`ss-filter-chip${
                                    movementFilter === option.key ? " is-active" : ""
                                }`}
                                onClick={() => setMovementFilter(option.key)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <div className="ss-movement-actions">
                        {visibleMovementTypes.map((type) => {
                            const isDone = completedMovementKeys.has(type.key);
                            const isAnnulled = !isDone && annulledMovementKeys.has(type.key);
                            const isPending =
                                !isDone && !isAnnulled && pendingMovementKeys.has(type.key);
                            return (
                                <button
                                    key={type.key}
                                    type="button"
                                    className={`ss-movement-action ${type.movement_type}${
                                        isPending ? " is-pending" : ""
                                    }${isDone ? " is-done" : ""}${isAnnulled ? " is-annulled" : ""}`}
                                    onClick={() => openMovementForType(type)}
                                    disabled={editing || movementSaving || isDone}
                                    title={
                                        isDone
                                            ? "Ya registrado. Anulalo para poder registrarlo de nuevo."
                                            : isAnnulled
                                              ? "El movimiento registrado fue anulado. Podés registrarlo de nuevo."
                                              : isPending
                                                ? "Pendiente"
                                                : undefined
                                    }
                                >
                                    {isDone ? <Check size={14} /> : <Plus size={14} />} {type.label}
                                    {isDone ? (
                                        <span className="ss-movement-done" title="Movimiento realizado">
                                            <Check size={14} />
                                        </span>
                                    ) : isAnnulled ? (
                                        <span
                                            className="ss-movement-annulled"
                                            title="Movimiento anulado"
                                        >
                                            <CircleHelp size={14} />
                                        </span>
                                    ) : isPending ? (
                                        <span className="ss-movement-pending" title="Pendiente">
                                            <X size={14} />
                                        </span>
                                    ) : null}
                                </button>
                            );
                        })}
                        {availableMovementTypes.length === 0 && (
                            <p className="ss-movement-empty">
                                Configurá los movimientos en Configuración → Variables.
                            </p>
                        )}
                        {availableMovementTypes.length > 0 && visibleMovementTypes.length === 0 && (
                            <p className="ss-movement-empty">
                                {movementFilter === "listos"
                                    ? "No hay movimientos realizados."
                                    : "No hay movimientos pendientes."}
                            </p>
                        )}
                    </div>

                    {draft && (
                        <form className="ss-movement-form" onSubmit={handleSubmitMovement}>
                            <div className="ss-movement-form-head">
                                <span>{draft.label}</span>
                                <button
                                    type="button"
                                    className="ss-editor-close"
                                    onClick={() => {
                                        setDraft(null);
                                        setMovementError(null);
                                    }}
                                    disabled={movementSaving}
                                >
                                    <X size={15} />
                                </button>
                            </div>
                            <div className="ss-field">
                                <label>Monto</label>
                                <MoneyInput
                                    value={draft.amount}
                                    onValueChange={(value) =>
                                        setDraft({ ...draft, amount: value })
                                    }
                                    disabled={movementSaving}
                                />
                            </div>
                            <div className="ss-row">
                                <DateInput
                                    id="ss-movement-date"
                                    label="Fecha"
                                    value={draft.date}
                                    onChange={(value) => setDraft({ ...draft, date: value })}
                                />
                                <div className="ss-field">
                                    <label>Medio</label>
                                    <select
                                        className="ss-input"
                                        value={draft.mode}
                                        onChange={(e) =>
                                            setDraft({
                                                ...draft,
                                                mode: e.target.value as MovementMode,
                                            })
                                        }
                                        disabled={movementSaving}
                                    >
                                        <option value="efectivo">Efectivo</option>
                                        <option value="transferencia">Transferencia</option>
                                    </select>
                                </div>
                            </div>
                            {draft.statusToApply && (
                                <span className="ss-hint">
                                    Al guardar también se actualizará el estado del servicio.
                                </span>
                            )}
                            {movementError && <div className="ss-error">{movementError}</div>}
                            <div className="ss-actions">
                                <button
                                    type="button"
                                    className="ss-btn ss-btn-secondary"
                                    onClick={() => {
                                        setDraft(null);
                                        setMovementError(null);
                                    }}
                                    disabled={movementSaving}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="ss-btn ss-btn-primary"
                                    disabled={movementSaving}
                                >
                                    {movementSaving ? (
                                        <>
                                            <Loader size={15} className="spin" /> Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={15} /> Registrar
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="ss-movement-list custom-scroll">
                        {movementsLoading ? (
                            <div className="ss-loading">
                                <Loader size={16} className="spin" /> Cargando...
                            </div>
                        ) : movements.length === 0 ? (
                            <p className="ss-movement-empty">Todavía no hay movimientos.</p>
                        ) : (
                            movements.map((movement) => (
                                <div
                                    key={movement.id}
                                    className={`ss-movement-item ${movement.movement_type}${
                                        movement.movement_anulado ? " is-annulled" : ""
                                    }`}
                                >
                                    <div className="ss-movement-item-top">
                                        <span className="ss-movement-item-label">
                                            {movement.label}
                                        </span>
                                        <span className="ss-movement-item-amount">
                                            {movement.movement_type === "egreso" ? "−" : "+"}
                                            {toCurrency(movement.amount)}
                                        </span>
                                    </div>
                                    <div className="ss-movement-item-meta">
                                        <span>{formatRecordDate(movement.date)}</span>
                                        <span>
                                            {movement.mode === "efectivo"
                                                ? "Efectivo"
                                                : "Transferencia"}
                                        </span>
                                        {!movement.includes_movement && (
                                            <span className="ss-movement-tag">Sin caja</span>
                                        )}
                                        {movement.movement_anulado && (
                                            <span
                                                className="ss-movement-tag annulled"
                                                title="Este movimiento fue anulado. Podés registrarlo de nuevo."
                                            >
                                                <CircleHelp size={10} /> Anulado
                                            </span>
                                        )}
                                    </div>
                                    {movement.movement_id && (
                                        <div className="ss-movement-item-actions">
                                            <button
                                                type="button"
                                                className="ss-link-btn"
                                                onClick={() => openComprobanteForMovement(movement)}
                                            >
                                                Ver comprobante <FileText size={12} />
                                            </button>
                                            {onNavigateToMovement && (
                                                <button
                                                    type="button"
                                                    className="ss-link-btn"
                                                    onClick={() => {
                                                        onClose();
                                                        onNavigateToMovement(movement.movement_id!);
                                                    }}
                                                >
                                                    Ver movimiento <ExternalLink size={12} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </aside>
            </div>

        </Modal>
        {comprobanteData && (
            <Comprobante
                data={comprobanteData}
                onClose={() => setComprobanteData(null)}
            />
        )}
        </>
    );
};

export default SpecialServiceRecordDetailModal;
