import React, { useEffect, useState } from "react";
import { AlertCircle, Check, Loader, Plus, Trash2, X } from "lucide-react";
import MoneyInput from "../../components/ui/MoneyInput";
import {
    saveSpecialService,
    updateSpecialService,
    type SpecialServiceItem,
} from "../../services/specialServicesApi";
import {
    deleteSpecialServiceAddon,
    fetchSpecialServiceAddons,
    saveSpecialServiceAddon,
    type SpecialServiceAddonItem,
} from "../../services/specialServiceAddonsApi";
import {
    saveSpecialServiceWorkflow,
    type SpecialServiceWorkflowInput,
} from "../../services/specialServiceWorkflowApi";
import { useSpecialServiceWorkflowStore } from "../../store/specialServiceWorkflowStore";
import SpecialServiceWorkflowFields from "../../components/service/SpecialServiceWorkflowFields";
import {
    emptyWorkflowDraft,
    getWorkflowDraftError,
    workflowToDraft,
} from "../../utils/specialServiceWorkflow";
import { formatNumberInput, parseMoney, toCurrency } from "../../utils/format";

export type SpecialServiceEditorMode = "create" | "edit";

interface SpecialServiceEditorProps {
    mode: SpecialServiceEditorMode;
    service: SpecialServiceItem | null;
    onClose: () => void;
    onSaved: (service: SpecialServiceItem, isNew: boolean) => void;
}

type DraftAddon = {
    tempId: string;
    name: string;
    cost: string;
};

function makeTempId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const SpecialServiceEditor: React.FC<SpecialServiceEditorProps> = ({
    mode,
    service,
    onClose,
    onSaved,
}) => {
    const [name, setName] = useState(mode === "edit" && service ? service.name : "");
    const [detail, setDetail] = useState(
        mode === "edit" && service ? service.detail ?? "" : ""
    );
    const [memberPrice, setMemberPrice] = useState(
        mode === "edit" && service ? formatNumberInput(service.member_price) : ""
    );
    const [personPrice, setPersonPrice] = useState(
        mode === "edit" && service ? formatNumberInput(service.person_price) : ""
    );
    const [depositCost, setDepositCost] = useState(
        mode === "edit" && service ? formatNumberInput(service.deposit_cost) : ""
    );

    const [existingAddons, setExistingAddons] = useState<SpecialServiceAddonItem[]>([]);
    const [removedAddonIds, setRemovedAddonIds] = useState<string[]>([]);
    const [draftAddons, setDraftAddons] = useState<DraftAddon[]>([]);
    const [addonName, setAddonName] = useState("");
    const [addonCost, setAddonCost] = useState("");
    const [addonError, setAddonError] = useState<string | null>(null);

    const [loadingAddons, setLoadingAddons] = useState(mode === "edit" && !!service);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [createdServiceId, setCreatedServiceId] = useState<string | null>(null);

    const [workflowDraft, setWorkflowDraft] = useState<SpecialServiceWorkflowInput>(emptyWorkflowDraft);
    const [loadingWorkflow, setLoadingWorkflow] = useState(mode === "edit" && !!service);
    const [workflowLoadFailed, setWorkflowLoadFailed] = useState(false);
    const loadWorkflow = useSpecialServiceWorkflowStore((state) => state.load);
    const setStoredWorkflow = useSpecialServiceWorkflowStore((state) => state.setWorkflow);

    useEffect(() => {
        if (mode !== "edit" || !service) return;
        let cancelled = false;
        void loadWorkflow(service.id, true).then((workflow) => {
            if (cancelled) return;
            if (workflow) setWorkflowDraft(workflowToDraft(workflow));
            else {
                setWorkflowLoadFailed(true);
                setError("No se pudo cargar la configuración de estados y movimientos. Cerrá el panel y volvé a abrirlo.");
            }
            setLoadingWorkflow(false);
        });
        return () => {
            cancelled = true;
        };
    }, [mode, service, loadWorkflow]);

    useEffect(() => {
        if (mode !== "edit" || !service) return;
        let cancelled = false;
        fetchSpecialServiceAddons(service.id)
            .then((items) => {
                if (!cancelled) setExistingAddons(items);
            })
            .catch((err) => {
                if (!cancelled) {
                    setAddonError(
                        err instanceof Error ? err.message : "Error al cargar los añadidos"
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingAddons(false);
            });
        return () => {
            cancelled = true;
        };
    }, [mode, service]);

    const handleAddAddon = () => {
        if (!addonName.trim()) {
            setAddonError("Ingresá un nombre para el añadido.");
            return;
        }
        setAddonError(null);
        setDraftAddons((prev) => [
            ...prev,
            { tempId: makeTempId(), name: addonName.trim(), cost: addonCost },
        ]);
        setAddonName("");
        setAddonCost("");
    };

    const handleRemoveExistingAddon = (id: string) => {
        setRemovedAddonIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    };

    const handleRemoveDraftAddon = (tempId: string) => {
        setDraftAddons((prev) => prev.filter((item) => item.tempId !== tempId));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setAddonError(null);

        if (!name.trim()) {
            setError("Ingresá el nombre del servicio.");
            return;
        }
        const workflowError = getWorkflowDraftError(workflowDraft);
        if (workflowError) {
            setError(workflowError);
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: name.trim(),
                detail: detail.trim() || null,
                member_price: parseMoney(memberPrice),
                person_price: parseMoney(personPrice),
                deposit_cost: parseMoney(depositCost),
            };

            let savedService: SpecialServiceItem;
            let isNew = false;
            if (mode === "edit" && service) {
                savedService = await updateSpecialService(service.id, payload);
            } else if (createdServiceId) {
                savedService = await updateSpecialService(createdServiceId, payload);
            } else {
                savedService = await saveSpecialService(payload);
                setCreatedServiceId(savedService.id);
                isNew = true;
            }

            for (const id of [...removedAddonIds]) {
                await deleteSpecialServiceAddon(id);
                setRemovedAddonIds((prev) => prev.filter((item) => item !== id));
                setExistingAddons((prev) => prev.filter((item) => item.id !== id));
            }

            for (const draft of [...draftAddons]) {
                await saveSpecialServiceAddon({
                    special_service_id: savedService.id,
                    name: draft.name,
                    cost: parseMoney(draft.cost),
                });
                setDraftAddons((prev) => prev.filter((item) => item.tempId !== draft.tempId));
            }

            const workflow = await saveSpecialServiceWorkflow(savedService.id, workflowDraft);
            setStoredWorkflow(workflow);
            savedService = {
                ...savedService,
                custom_statuses: workflow.custom_statuses,
                custom_movement_types: workflow.custom_movement_types,
            };

            setSaved(true);
            onSaved(savedService, isNew);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al guardar el servicio");
        } finally {
            setSaving(false);
        }
    };

    const visibleExistingAddons = existingAddons.filter(
        (addon) => !removedAddonIds.includes(addon.id)
    );
    const totalAddons = visibleExistingAddons.length + draftAddons.length;

    if (saved) {
        return (
            <aside className="ss-editor">
                <div className="ss-editor-status">
                    <div className="ss-editor-status-icon ok">
                        <Check size={26} />
                    </div>
                    <h4>Servicio guardado</h4>
                    <p>El servicio quedó seleccionado para agendar el registro.</p>
                    <button type="button" className="ss-btn ss-btn-primary" onClick={onClose}>
                        <Check size={16} /> OK
                    </button>
                </div>
            </aside>
        );
    }

    return (
        <aside className="ss-editor">
            <div className="ss-editor-head">
                <div>
                    <h4 className="ss-editor-title">
                        {mode === "edit" ? "Editar servicio" : "Nuevo servicio"}
                    </h4>
                    <p className="ss-editor-sub">
                        Completá los datos y añadidos del servicio especial.
                    </p>
                </div>
                <button
                    type="button"
                    className="ss-editor-close"
                    onClick={onClose}
                    title="Cerrar panel"
                >
                    <X size={16} />
                </button>
            </div>

            <form className="ss-editor-form" onSubmit={handleSubmit}>
                <div className="ss-field">
                    <label>Nombre *</label>
                    <input
                        autoComplete="off"
                        type="text"
                        className="ss-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nombre del servicio"
                    />
                </div>

                <div className="ss-field">
                    <label>Detalle</label>
                    <input
                        autoComplete="off"
                        type="text"
                        className="ss-input"
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
                        placeholder="Descripción del servicio"
                    />
                </div>

                <div className="ss-row">
                    <div className="ss-field">
                        <label>Precio socio</label>
                        <MoneyInput
                            value={memberPrice}
                            onValueChange={setMemberPrice}
                        />
                    </div>
                    <div className="ss-field">
                        <label>Precio persona</label>
                        <MoneyInput
                            value={personPrice}
                            onValueChange={setPersonPrice}
                        />
                    </div>
                </div>

                <div className="ss-field">
                    <label>Costo de la seña</label>
                    <MoneyInput
                        value={depositCost}
                        onValueChange={setDepositCost}
                    />
                </div>

                <div className="ss-editor-section">
                    <span className="ss-editor-section-title">
                        Añadidos ({totalAddons})
                    </span>

                    <div className="ss-editor-addons-form">
                        <input
                            autoComplete="off"
                            type="text"
                            className="ss-input"
                            value={addonName}
                            onChange={(e) => setAddonName(e.target.value)}
                            placeholder="Nombre del añadido"
                        />
                        <MoneyInput
                            value={addonCost}
                            onValueChange={setAddonCost}
                            placeholder="Costo"
                        />
                        <button
                            type="button"
                            className="ss-icon-btn ss-add-btn"
                            onClick={handleAddAddon}
                            title="Agregar añadido"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    {addonError && <div className="ss-error">{addonError}</div>}

                    {loadingAddons ? (
                        <span className="ss-addon-empty">
                            <Loader size={13} className="spin" /> Cargando añadidos...
                        </span>
                    ) : totalAddons === 0 ? (
                        <span className="ss-addon-empty">Sin añadidos cargados.</span>
                    ) : (
                        <ul className="ss-addon-list custom-scroll">
                            {visibleExistingAddons.map((addon) => (
                                <li key={addon.id} className="ss-addon-item">
                                    <span className="ss-addon-name">{addon.name}</span>
                                    <span className="ss-addon-cost">
                                        {toCurrency(addon.cost)}
                                    </span>
                                    <button
                                        type="button"
                                        className="ss-addon-remove"
                                        onClick={() => handleRemoveExistingAddon(addon.id)}
                                        title="Quitar añadido"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </li>
                            ))}
                            {draftAddons.map((addon) => (
                                <li key={addon.tempId} className="ss-addon-item">
                                    <span className="ss-addon-name">{addon.name}</span>
                                    <span className="ss-addon-cost">
                                        {toCurrency(parseMoney(addon.cost))}
                                    </span>
                                    <button
                                        type="button"
                                        className="ss-addon-remove"
                                        onClick={() => handleRemoveDraftAddon(addon.tempId)}
                                        title="Quitar añadido"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="ss-editor-section">
                    <span className="ss-editor-section-title">Estados y movimientos</span>
                    <SpecialServiceWorkflowFields
                        value={workflowDraft}
                        onChange={setWorkflowDraft}
                        disabled={saving}
                        loading={loadingWorkflow}
                    />
                </div>

                {error && (
                    <div className="ss-editor-error">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                <div className="ss-editor-actions">
                    <button
                        type="button"
                        className="ss-btn ss-btn-secondary"
                        onClick={onClose}
                        disabled={saving}
                    >
                        <X size={16} /> Cancelar
                    </button>
                    <button
                        type="submit"
                        className="ss-btn ss-btn-primary"
                        disabled={saving || loadingWorkflow || workflowLoadFailed}
                    >
                        {saving ? (
                            <>
                                <Loader size={16} className="spin" /> Guardando...
                            </>
                        ) : (
                            <>
                                <Check size={16} /> Confirmar
                            </>
                        )}
                    </button>
                </div>
            </form>
        </aside>
    );
};

export default SpecialServiceEditor;
