import React, { useEffect, useMemo, useState } from "react";
import { Loader, Pencil, Plus, X } from "lucide-react";
import Modal from "../../components/ui/Modal";
import DateInput from "../../components/ui/DateInput";
import MoneyInput from "../../components/ui/MoneyInput";
import PersonSearch from "../../components/person/PersonSearch";
import SpecialServiceEditor, {
    type SpecialServiceEditorMode,
} from "./SpecialServiceEditor";
import SpecialServicePersonEditor, {
    type PersonEditorMode,
} from "./SpecialServicePersonEditor";
import { fetchMembers } from "../../services/membersApi";
import { fetchAllPersons } from "../../services/personsApi";
import {
    fetchSpecialServices,
    type SpecialServiceItem,
} from "../../services/specialServicesApi";
import {
    fetchSpecialServiceAddons,
    type SpecialServiceAddonItem,
} from "../../services/specialServiceAddonsApi";
import {
    saveSpecialServiceRecord,
    type SpecialServiceRecordItem,
} from "../../services/specialServiceRecordsApi";
import { useSpecialServiceStatusesStore } from "../../store/specialServiceStatusesStore";
import { useSpecialServiceWorkflow } from "../../store/specialServiceWorkflowStore";
import type { Member, Person } from "../../models/members";
import { formatNumberInput, parseMoney, toCurrency, todayLocal } from "../../utils/format";

type TitularType = "member" | "person" | "none";

interface NewSpecialServiceRecordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (record: SpecialServiceRecordItem) => void;
}

const NewSpecialServiceRecordModal: React.FC<NewSpecialServiceRecordModalProps> = ({
    isOpen,
    onClose,
    onCreated,
}) => {
    const [services, setServices] = useState<SpecialServiceItem[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [persons, setPersons] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [serviceId, setServiceId] = useState("");
    const [titularType, setTitularType] = useState<TitularType>("member");
    const [memberSearch, setMemberSearch] = useState("");
    const [personSearch, setPersonSearch] = useState("");
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [showMemberDropdown, setShowMemberDropdown] = useState(false);
    const [showPersonDropdown, setShowPersonDropdown] = useState(false);
    const [amount, setAmount] = useState("");
    const [amountTouched, setAmountTouched] = useState(false);
    const [date, setDate] = useState(todayLocal());
    const [serviceDate, setServiceDate] = useState("");
    const [detail, setDetail] = useState("");
    const [status, setStatus] = useState("registrado");
    const statuses = useSpecialServiceStatusesStore((state) => state.statuses);
    const loadStatuses = useSpecialServiceStatusesStore((state) => state.load);

    const [serviceAddons, setServiceAddons] = useState<SpecialServiceAddonItem[]>([]);
    const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
    const [loadingAddons, setLoadingAddons] = useState(false);
    const [addonsReloadToken, setAddonsReloadToken] = useState(0);

    const [editorOpen, setEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState<SpecialServiceEditorMode>("create");
    const [editorService, setEditorService] = useState<SpecialServiceItem | null>(null);

    // Panel lateral de persona (alta o edición del tercero titular).
    const [personEditorOpen, setPersonEditorOpen] = useState(false);
    const [personEditorMode, setPersonEditorMode] = useState<PersonEditorMode>("create");
    const [personEditorPerson, setPersonEditorPerson] = useState<Person | null>(null);
    const anyPanelOpen = editorOpen || personEditorOpen;

    useEffect(() => {
        if (!isOpen) return;
        let mounted = true;
        Promise.all([fetchSpecialServices(), fetchMembers(), fetchAllPersons()])
            .then(([specialServices, allMembers, allPersons]) => {
                if (!mounted) return;
                setServices(specialServices);
                setMembers(
                    [...allMembers].sort((a, b) => a.nombre.localeCompare(b.nombre))
                );
                setPersons(
                    [...allPersons].sort((a, b) => a.nombre.localeCompare(b.nombre))
                );
            })
            .catch((err) => {
                if (!mounted) return;
                setError(err instanceof Error ? err.message : "Error al cargar los datos");
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        void loadStatuses();
    }, [isOpen, loadStatuses]);

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

    useEffect(() => {
        if (!serviceId) return;
        let cancelled = false;
        fetchSpecialServiceAddons(serviceId)
            .then((items) => {
                if (cancelled) return;
                setServiceAddons(items);
                setSelectedAddonIds((prev) =>
                    prev.filter((id) => items.some((addon) => addon.id === id))
                );
            })
            .catch(() => {
                if (!cancelled) setServiceAddons([]);
            })
            .finally(() => {
                if (!cancelled) setLoadingAddons(false);
            });
        return () => {
            cancelled = true;
        };
    }, [serviceId, addonsReloadToken]);

    const addonsTotal = serviceAddons
        .filter((addon) => selectedAddonIds.includes(addon.id))
        .reduce((sum, addon) => sum + addon.cost, 0);

    const amountValue = selectedService
        ? amountTouched
            ? amount
            : formatNumberInput(getPrice(selectedService, titularType) + addonsTotal)
        : "";

    // Estados habilitados para el servicio elegido (su lista propia o la lista base).
    const { workflow } = useSpecialServiceWorkflow(serviceId || null);
    const availableStatuses = useMemo(
        () => workflow?.statuses ?? statuses.filter((item) => item.is_default !== false),
        [workflow, statuses]
    );

    const effectiveStatus = availableStatuses.some((item) => item.key === status)
        ? status
        : availableStatuses[0]?.key ?? status;

    const handleServiceChange = (value: string) => {
        setServiceId(value);
        setServiceAddons([]);
        setSelectedAddonIds([]);
        setLoadingAddons(Boolean(value));
        setAmountTouched(false);
    };

    const handleTitularTypeChange = (value: TitularType) => {
        setTitularType(value);
        setAmountTouched(false);
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

    const handleToggleAddon = (addonId: string) => {
        setAmountTouched(false);
        setSelectedAddonIds((prev) =>
            prev.includes(addonId)
                ? prev.filter((id) => id !== addonId)
                : [...prev, addonId]
        );
    };

    const handleSelectMember = (member: Member | Person) => {
        const selected = member as Member;
        setSelectedMember(selected);
        setMemberSearch(selected.nombre);
        setShowMemberDropdown(false);
    };

    const handleClearMember = () => {
        setSelectedMember(null);
        setMemberSearch("");
    };

    const handleSelectPerson = (person: Member | Person) => {
        const selected = person as Person;
        setSelectedPerson(selected);
        setPersonSearch(selected.nombre);
        setShowPersonDropdown(false);
    };

    const handleClearPerson = () => {
        setSelectedPerson(null);
        setPersonSearch("");
    };

    const handleCloseModal = () => {
        setEditorOpen(false);
        setPersonEditorOpen(false);
        onClose();
    };

    const openCreateEditor = () => {
        setPersonEditorOpen(false);
        setEditorMode("create");
        setEditorService(null);
        setEditorOpen(true);
    };

    const openEditEditor = () => {
        if (!selectedService) return;
        setPersonEditorOpen(false);
        setEditorMode("edit");
        setEditorService(selectedService);
        setEditorOpen(true);
    };

    const openCreatePersonEditor = () => {
        setEditorOpen(false);
        setPersonEditorMode("create");
        setPersonEditorPerson(null);
        setPersonEditorOpen(true);
    };

    const openEditPersonEditor = () => {
        if (!selectedPerson) return;
        setEditorOpen(false);
        setPersonEditorMode("edit");
        setPersonEditorPerson(selectedPerson);
        setPersonEditorOpen(true);
    };

    // La persona guardada se agrega (o actualiza) en la lista y queda como titular.
    const handlePersonSaved = (savedPerson: Person) => {
        setPersons((prev) => {
            const exists = prev.some((item) => item.id === savedPerson.id);
            const next = exists
                ? prev.map((item) => (item.id === savedPerson.id ? savedPerson : item))
                : [...prev, savedPerson];
            return [...next].sort((a, b) => a.nombre.localeCompare(b.nombre));
        });
        if (titularType !== "person") setAmountTouched(false);
        setTitularType("person");
        setSelectedPerson(savedPerson);
        setPersonSearch(savedPerson.nombre);
        setShowPersonDropdown(false);
    };

    const handleEditorSaved = (savedService: SpecialServiceItem, isNew: boolean) => {
        setServices((prev) => {
            const exists = prev.some((item) => item.id === savedService.id);
            const next = exists
                ? prev.map((item) => (item.id === savedService.id ? savedService : item))
                : [...prev, savedService];
            return [...next].sort((a, b) => a.name.localeCompare(b.name));
        });
        const isSameService = !isNew && editorService?.id === savedService.id;
        if (!isSameService) {
            setServiceAddons([]);
            setSelectedAddonIds([]);
        }
        setServiceId(savedService.id);
        setAddonsReloadToken((token) => token + 1);
        setLoadingAddons(true);
        setAmountTouched(false);
        if (isNew) {
            setEditorService(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!serviceId) {
            setError("Seleccioná un servicio especial.");
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
            const selectedAddons = serviceAddons.filter((addon) =>
                selectedAddonIds.includes(addon.id)
            );
            const created = await saveSpecialServiceRecord({
                special_service_id: serviceId,
                member_id: titularType === "member" ? selectedMember!.id : null,
                person_id: titularType === "person" ? selectedPerson!.id : null,
                amount: parseMoney(amountValue),
                date,
                service_date: serviceDate,
                detail: detail.trim() || null,
                status: effectiveStatus,
                addons: selectedAddons.map((addon) => ({
                    addon_id: addon.id,
                    name: addon.name,
                    cost: addon.cost,
                })),
            });
            onCreated(created);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al agendar el servicio especial");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleCloseModal}
            title="Agendar un servicio"
            maxWidth={anyPanelOpen ? 1180 : 820}
            contentClassName="ss-modal"
            closeOnOverlayClick={false}
        >
            <div className="ss-modal-body custom-scroll">
                {loading ? (
                    <div className="ss-loading">
                        <Loader size={18} className="spin" /> Cargando datos...
                    </div>
                ) : (
                    <div className={`ss-columns${anyPanelOpen ? " has-editor" : ""}`}>
                        <form className="ss-form" onSubmit={handleSubmit}>
                        <div className="ss-field">
                            <label>Servicio especial *</label>
                            <div className="ss-service-select-row">
                                <select
                                    className="ss-input"
                                    value={serviceId}
                                    onChange={(e) => handleServiceChange(e.target.value)}
                                >
                                    <option value="">Seleccionar servicio...</option>
                                    {services.map((service) => (
                                        <option key={service.id} value={service.id}>
                                            {service.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="ss-icon-btn ss-edit-btn"
                                    onClick={openEditEditor}
                                    disabled={!selectedService}
                                    title="Editar servicio"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    type="button"
                                    className="ss-icon-btn ss-add-btn"
                                    onClick={openCreateEditor}
                                    title="Agregar servicio"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                            {selectedService?.detail && (
                                <span className="ss-hint">{selectedService.detail}</span>
                            )}
                        </div>

                        {selectedService && (
                            <div className="ss-field">
                                <label>Añadidos</label>
                                {loadingAddons ? (
                                    <span className="ss-hint">
                                        <Loader size={13} className="spin" /> Cargando añadidos...
                                    </span>
                                ) : serviceAddons.length === 0 ? (
                                    <span className="ss-hint">
                                        Este servicio no tiene añadidos cargados.
                                    </span>
                                ) : (
                                    <div className="ss-record-addons custom-scroll">
                                        {serviceAddons.map((addon) => (
                                            <label key={addon.id} className="ss-addon-option">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedAddonIds.includes(addon.id)}
                                                    onChange={() => handleToggleAddon(addon.id)}
                                                />
                                                <span className="ss-addon-option-name">
                                                    {addon.name}
                                                </span>
                                                <span className="ss-addon-option-cost">
                                                    {toCurrency(addon.cost)}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                                {selectedAddonIds.length > 0 && (
                                    <span className="ss-hint">
                                        {`Añadidos seleccionados: ${toCurrency(
                                            serviceAddons
                                                .filter((addon) =>
                                                    selectedAddonIds.includes(addon.id)
                                                )
                                                .reduce((sum, addon) => sum + addon.cost, 0)
                                        )}`}
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="ss-row">
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
                            <div className="ss-field">
                                <label>Estado</label>
                                <select
                                    className="ss-input"
                                    value={effectiveStatus}
                                    onChange={(e) => setStatus(e.target.value)}
                                >
                                    {availableStatuses.map((item) => (
                                        <option key={item.key} value={item.key}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                                {selectedService && workflow?.custom_statuses && (
                                    <span className="ss-hint">Estados propios de este servicio.</span>
                                )}
                            </div>
                        </div>

                        {titularType === "member" && (
                            <div className="ss-field">
                                <label>Socio *</label>
                                <PersonSearch
                                    type="socio"
                                    searchValue={memberSearch}
                                    onSearchChange={setMemberSearch}
                                    results={memberResults}
                                    selected={selectedMember}
                                    onSelect={handleSelectMember}
                                    onClear={handleClearMember}
                                    showDropdown={showMemberDropdown}
                                    onShowDropdown={setShowMemberDropdown}
                                    loading={loading}
                                />
                            </div>
                        )}

                        {titularType === "person" && (
                            <div className="ss-field">
                                <label>Persona *</label>
                                <div className="ss-service-select-row ss-person-select-row">
                                    <div className="ss-person-search">
                                        <PersonSearch
                                            type="persona"
                                            searchValue={personSearch}
                                            onSearchChange={setPersonSearch}
                                            results={personResults}
                                            selected={selectedPerson}
                                            onSelect={handleSelectPerson}
                                            onClear={handleClearPerson}
                                            showDropdown={showPersonDropdown}
                                            onShowDropdown={setShowPersonDropdown}
                                            loading={loading}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="ss-icon-btn ss-edit-btn"
                                        onClick={openEditPersonEditor}
                                        disabled={!selectedPerson}
                                        title="Editar persona"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        className="ss-icon-btn ss-add-btn"
                                        onClick={openCreatePersonEditor}
                                        title="Registrar nueva persona"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="ss-row">
                            <div className="ss-field">
                                <label>Monto</label>
                                <MoneyInput
                                    value={amountValue}
                                    onValueChange={(value) => {
                                        setAmount(value);
                                        setAmountTouched(true);
                                    }}
                                />
                                {selectedService && (
                                    <span className="ss-hint">
                                        {`Precio socio: $ ${formatNumberInput(selectedService.member_price)} · Precio persona: $ ${formatNumberInput(selectedService.person_price)} · Seña: $ ${formatNumberInput(selectedService.deposit_cost)} · Seguro: $ ${formatNumberInput(selectedService.insurance_cost ?? 0)}`}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="ss-row">
                            <DateInput
                                id="ss-record-date"
                                label="Fecha del registro *"
                                value={date}
                                onChange={setDate}
                            />
                            <DateInput
                                id="ss-service-date"
                                label="Fecha del servicio *"
                                required
                                value={serviceDate}
                                onChange={setServiceDate}
                            />
                        </div>

                        <div className="ss-field">
                            <label htmlFor="ss-record-detail">Detalles</label>
                            <textarea
                                id="ss-record-detail"
                                className="ss-input ss-textarea"
                                value={detail}
                                onChange={(e) => setDetail(e.target.value)}
                                maxLength={1000}
                                rows={3}
                                placeholder="Opcional: un mensaje adicional para este servicio"
                            />
                        </div>

                        {error && <div className="ss-error">{error}</div>}

                        <div className="ss-actions">
                            <button type="button" className="ss-btn ss-btn-secondary" onClick={handleCloseModal}>
                                <X size={16} /> Cancelar
                            </button>
                            <button type="submit" className="ss-btn ss-btn-primary" disabled={saving || loading}>
                                {saving ? (
                                    <>
                                        <Loader size={16} className="spin" /> Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Plus size={16} /> Agendar servicio
                                    </>
                                )}
                            </button>
                        </div>
                        </form>
                        {editorOpen && (
                            <SpecialServiceEditor
                                key={`${editorMode}-${editorService?.id ?? "new"}`}
                                mode={editorMode}
                                service={editorService}
                                onClose={() => setEditorOpen(false)}
                                onSaved={handleEditorSaved}
                            />
                        )}
                        {personEditorOpen && (
                            <SpecialServicePersonEditor
                                key={`${personEditorMode}-${personEditorPerson?.id ?? "new"}`}
                                mode={personEditorMode}
                                person={personEditorPerson}
                                persons={persons}
                                onClose={() => setPersonEditorOpen(false)}
                                onSaved={handlePersonSaved}
                            />
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default NewSpecialServiceRecordModal;
