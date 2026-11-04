import React, { useEffect, useMemo, useRef, useState } from "react";
import { Save, Loader, Plus, Trash2, Pencil, X, Search, ArrowUpDown } from "lucide-react";
import {
    saveSpecialService,
    updateSpecialService,
    deleteSpecialService,
    type SpecialServiceItem,
} from "../../services/specialServicesApi";
import {
    fetchSpecialServiceAddons,
    fetchAllSpecialServiceAddons,
    saveSpecialServiceAddon,
    deleteSpecialServiceAddon,
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
import { formatNumberInput, parseMoney } from "../../utils/format";

interface SpecialServicesConfigProps {
    initialServices: SpecialServiceItem[];
}

const SpecialServicesConfig: React.FC<SpecialServicesConfigProps> = ({ initialServices }) => {
    const [services, setServices] = useState<SpecialServiceItem[]>(initialServices);
    const [name, setName] = useState("");
    const [detail, setDetail] = useState("");
    const [memberPrice, setMemberPrice] = useState("");
    const [personPrice, setPersonPrice] = useState("");
    const [depositCost, setDepositCost] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editId, setEditId] = useState<string | null>(null);
    const [searchText, setSearchText] = useState("");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [addons, setAddons] = useState<SpecialServiceAddonItem[]>([]);
    const [addonCounts, setAddonCounts] = useState<Record<string, number>>({});
    const [loadingAddons, setLoadingAddons] = useState(false);
    const [addonError, setAddonError] = useState<string | null>(null);
    const [addonName, setAddonName] = useState("");
    const [addonCost, setAddonCost] = useState("");
    const [savingAddon, setSavingAddon] = useState(false);
    const [workflowDraft, setWorkflowDraft] = useState<SpecialServiceWorkflowInput>(emptyWorkflowDraft);
    const [loadingWorkflow, setLoadingWorkflow] = useState(false);
    const [workflowLoadFailed, setWorkflowLoadFailed] = useState(false);
    const workflowRequestRef = useRef<string | null>(null);
    const loadWorkflow = useSpecialServiceWorkflowStore((state) => state.load);
    const setStoredWorkflow = useSpecialServiceWorkflowStore((state) => state.setWorkflow);

    useEffect(() => {
        let cancelled = false;
        fetchAllSpecialServiceAddons()
            .then((items) => {
                if (cancelled) return;
                const counts: Record<string, number> = {};
                for (const addon of items) {
                    counts[addon.special_service_id] = (counts[addon.special_service_id] ?? 0) + 1;
                }
                setAddonCounts(counts);
            })
            .catch(() => {
                if (!cancelled) setAddonCounts({});
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const resetForm = () => {
        setName("");
        setDetail("");
        setMemberPrice("");
        setPersonPrice("");
        setDepositCost("");
        setEditId(null);
        setAddons([]);
        setAddonError(null);
        setAddonName("");
        setAddonCost("");
        setWorkflowDraft(emptyWorkflowDraft());
        setLoadingWorkflow(false);
        setWorkflowLoadFailed(false);
        workflowRequestRef.current = null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        const workflowError = getWorkflowDraftError(workflowDraft);
        if (workflowError) {
            setError(workflowError);
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const payload = {
                name: name.trim(),
                detail: detail.trim() || null,
                member_price: parseMoney(memberPrice),
                person_price: parseMoney(personPrice),
                deposit_cost: parseMoney(depositCost),
            };
            let saved: SpecialServiceItem;
            if (editId) {
                saved = await updateSpecialService(editId, payload);
                setServices((prev) => prev.map((s) => (s.id === editId ? saved : s)));
            } else {
                saved = await saveSpecialService(payload);
                setServices((prev) => [...prev, saved]);
                // Si falla la configuración, el reintento actualiza este servicio en vez de duplicarlo.
                setEditId(saved.id);
            }
            const workflow = await saveSpecialServiceWorkflow(saved.id, workflowDraft);
            setStoredWorkflow(workflow);
            setServices((prev) =>
                prev.map((s) =>
                    s.id === saved.id
                        ? {
                              ...s,
                              custom_statuses: workflow.custom_statuses,
                              custom_movement_types: workflow.custom_movement_types,
                          }
                        : s
                )
            );
            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al guardar servicio especial");
        } finally {
            setSaving(false);
        }
    };

    const handleStartEdit = async (svc: SpecialServiceItem) => {
        setName(svc.name);
        setDetail(svc.detail ?? "");
        setMemberPrice(formatNumberInput(svc.member_price));
        setPersonPrice(formatNumberInput(svc.person_price));
        setDepositCost(formatNumberInput(svc.deposit_cost));
        setEditId(svc.id);
        setAddons([]);
        setAddonError(null);
        setAddonName("");
        setAddonCost("");
        setWorkflowDraft(emptyWorkflowDraft());
        setLoadingWorkflow(true);
        setWorkflowLoadFailed(false);
        workflowRequestRef.current = svc.id;
        void loadWorkflow(svc.id, true).then((workflow) => {
            // Ignora la respuesta si mientras tanto se empezó a editar otro servicio.
            if (workflowRequestRef.current !== svc.id) return;
            if (workflow) setWorkflowDraft(workflowToDraft(workflow));
            else {
                setWorkflowLoadFailed(true);
                setError("No se pudo cargar la configuración de estados y movimientos del servicio. Volvé a intentar editarlo.");
            }
            setLoadingWorkflow(false);
        });
        setLoadingAddons(true);
        try {
            const data = await fetchSpecialServiceAddons(svc.id);
            setAddons(data);
            setAddonCounts((prev) => ({ ...prev, [svc.id]: data.length }));
        } catch (err) {
            setAddonError(err instanceof Error ? err.message : "Error al cargar los añadidos");
        } finally {
            setLoadingAddons(false);
        }
    };

    const handleAddAddon = async () => {
        if (!editId || !addonName.trim()) return;
        setSavingAddon(true);
        setAddonError(null);
        try {
            const created = await saveSpecialServiceAddon({
                special_service_id: editId,
                name: addonName.trim(),
                cost: parseMoney(addonCost),
            });
            setAddons((prev) =>
                [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
            );
            setAddonCounts((prev) => ({
                ...prev,
                [created.special_service_id]: (prev[created.special_service_id] ?? 0) + 1,
            }));
            setAddonName("");
            setAddonCost("");
        } catch (err) {
            setAddonError(err instanceof Error ? err.message : "Error al guardar el añadido");
        } finally {
            setSavingAddon(false);
        }
    };

    const handleDeleteAddon = async (id: string) => {
        if (!window.confirm("¿Eliminar este añadido?")) return;
        const addon = addons.find((item) => item.id === id);
        setAddonError(null);
        try {
            await deleteSpecialServiceAddon(id);
            setAddons((prev) => prev.filter((item) => item.id !== id));
            if (addon) {
                setAddonCounts((prev) => ({
                    ...prev,
                    [addon.special_service_id]: Math.max(0, (prev[addon.special_service_id] ?? 0) - 1),
                }));
            }
        } catch (err) {
            setAddonError(err instanceof Error ? err.message : "Error al eliminar el añadido");
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Eliminar este servicio especial?")) return;
        if (editId === id) resetForm();
        setError(null);
        try {
            await deleteSpecialService(id);
            setServices((prev) => prev.filter((s) => s.id !== id));
            setAddonCounts((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al eliminar servicio especial");
        }
    };

    const filteredServices = useMemo(() => {
        const q = searchText.toLowerCase().trim();
        let list = services;
        if (q) {
            list = list.filter(
                (s) => s.name.toLowerCase().includes(q) || (s.detail ?? "").toLowerCase().includes(q)
            );
        }
        return [...list].sort((a, b) => a.name.localeCompare(b.name) * (sortDir === "asc" ? 1 : -1));
    }, [services, searchText, sortDir]);

    return (
        <>
            <form onSubmit={handleSubmit} className="config-form special-services-form">
                <div className="config-field">
                    <label>{editId ? "Nombre del servicio especial" : "Nuevo servicio especial"}</label>
                    <input
                        autoComplete="off"
                        type="text"
                        className="config-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nombre del servicio"
                    />
                </div>
                <div className="config-field special-services-detail-field">
                    <label>Detalle</label>
                    <input
                        autoComplete="off"
                        type="text"
                        className="config-input"
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
                        placeholder="Descripción del servicio"
                    />
                </div>
                <div className="config-field">
                    <label>Precio socio</label>
                    <input
                        autoComplete="off"
                        type="text"
                        className="config-input"
                        value={memberPrice}
                        onChange={(e) => setMemberPrice(e.target.value)}
                        placeholder="0.00"
                    />
                </div>
                <div className="config-field">
                    <label>Precio persona</label>
                    <input
                        autoComplete="off"
                        type="text"
                        className="config-input"
                        value={personPrice}
                        onChange={(e) => setPersonPrice(e.target.value)}
                        placeholder="0.00"
                    />
                </div>
                <div className="config-field">
                    <label>Costo de la seña</label>
                    <input
                        autoComplete="off"
                        type="text"
                        className="config-input"
                        value={depositCost}
                        onChange={(e) => setDepositCost(e.target.value)}
                        placeholder="0.00"
                    />
                </div>
                <div className="config-field">
                    <label>Estados y movimientos del servicio</label>
                    <SpecialServiceWorkflowFields
                        value={workflowDraft}
                        onChange={setWorkflowDraft}
                        disabled={saving}
                        loading={loadingWorkflow}
                    />
                </div>
                {error && <div className="config-error">{error}</div>}
                <div className="config-form-actions">
                    <button
                        type="submit"
                        className="config-save-btn"
                        disabled={saving || loadingWorkflow || workflowLoadFailed || !name.trim()}
                    >
                        {saving ? (
                            <>
                                <Loader size={16} className="spin" /> Guardando...
                            </>
                        ) : editId ? (
                            <>
                                <Save size={16} /> Actualizar Servicio
                            </>
                        ) : (
                            <>
                                <Plus size={16} /> Agregar Servicio
                            </>
                        )}
                    </button>
                    {editId && (
                        <button
                            type="button"
                            className="config-save-btn"
                            onClick={resetForm}
                            style={{ background: "#6c757d" }}
                        >
                            <X size={16} /> Cancelar
                        </button>
                    )}
                </div>
            </form>

            {editId && (
                <div className="special-addons-section">
                    <div className="special-addons-head">
                        <div>
                            <h4>Añadidos del servicio</h4>
                            <span className="special-addons-hint">
                                Costos adicionales que se pueden sumar a este servicio especial.
                            </span>
                        </div>
                    </div>

                    <div className="special-addons-form">
                        <input
                            autoComplete="off"
                            type="text"
                            className="config-input"
                            value={addonName}
                            onChange={(e) => setAddonName(e.target.value)}
                            placeholder="Nombre del añadido"
                        />
                        <input
                            autoComplete="off"
                            type="text"
                            className="config-input"
                            value={addonCost}
                            onChange={(e) => setAddonCost(e.target.value)}
                            placeholder="Costo"
                        />
                        <button
                            type="button"
                            className="config-save-btn"
                            onClick={handleAddAddon}
                            disabled={savingAddon || !addonName.trim()}
                        >
                            {savingAddon ? (
                                <>
                                    <Loader size={16} className="spin" /> Guardando...
                                </>
                            ) : (
                                <>
                                    <Plus size={16} /> Agregar
                                </>
                            )}
                        </button>
                    </div>

                    {addonError && <div className="config-error">{addonError}</div>}

                    {loadingAddons ? (
                        <div className="special-addons-empty">
                            <Loader size={15} className="spin" /> Cargando añadidos...
                        </div>
                    ) : addons.length === 0 ? (
                        <div className="special-addons-empty">Sin añadidos registrados.</div>
                    ) : (
                        <ul className="special-addons-list">
                            {addons.map((addon) => (
                                <li key={addon.id} className="special-addon-item">
                                    <span className="special-addon-name">{addon.name}</span>
                                    <span className="special-addon-cost">
                                        $ {addon.cost.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteAddon(addon.id)}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            color: "#dc3545",
                                            padding: 4,
                                        }}
                                        title="Eliminar añadido"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {services.length > 0 && (
                <div className="svc-list-wrapper">
                    <div className="svc-list-toolbar">
                        <div className="svc-list-search">
                            <Search size={14} />
                            <input
                                autoComplete="off"
                                type="text"
                                placeholder="Buscar..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                            />
                        </div>
                        <div className="svc-list-sort">
                            <ArrowUpDown size={14} />
                            <select
                                autoComplete="off"
                                value={sortDir}
                                onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                            >
                                <option value="asc">Nombre A-Z</option>
                                <option value="desc">Nombre Z-A</option>
                            </select>
                        </div>
                    </div>
                    <div className="special-services-table-wrapper custom-scroll">
                        <table className="special-services-table">
                            <thead>
                                <tr>
                                    <th>Servicio</th>
                                    <th>Detalle</th>
                                    <th className="num">Precio socio</th>
                                    <th className="num">Precio persona</th>
                                    <th className="num">Costo seña</th>
                                    <th className="center">Añadidos</th>
                                    <th className="center">Estados</th>
                                    <th className="center">Movimientos</th>
                                    <th className="actions">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredServices.map((svc) => (
                                    <tr key={svc.id}>
                                        <td className="name">{svc.name}</td>
                                        <td className="detail">{svc.detail || "—"}</td>
                                        <td className="num">
                                            $ {svc.member_price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="num">
                                            $ {svc.person_price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="num">
                                            $ {svc.deposit_cost.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="center">
                                            <button
                                                type="button"
                                                className={`special-addons-count${(addonCounts[svc.id] ?? 0) === 0 ? " is-empty" : ""}`}
                                                onClick={() => handleStartEdit(svc)}
                                                title="Ver añadidos"
                                            >
                                                {addonCounts[svc.id] ?? 0}
                                            </button>
                                        </td>
                                        <td className="center">
                                            <span
                                                className={`special-workflow-tag${svc.custom_statuses ? " is-custom" : ""}`}
                                                title={svc.custom_statuses ? "Estados personalizados del servicio" : "Usa la lista base de estados"}
                                            >
                                                {svc.custom_statuses ? "Pers." : "Base"}
                                            </span>
                                        </td>
                                        <td className="center">
                                            <span
                                                className={`special-workflow-tag${svc.custom_movement_types ? " is-custom" : ""}`}
                                                title={svc.custom_movement_types ? "Movimientos personalizados del servicio" : "Usa la lista base de movimientos"}
                                            >
                                                {svc.custom_movement_types ? "Pers." : "Base"}
                                            </span>
                                        </td>
                                        <td className="actions">
                                            <button
                                                type="button"
                                                onClick={() => handleStartEdit(svc)}
                                                style={{
                                                    background: "none",
                                                    border: "none",
                                                    cursor: "pointer",
                                                    color: "var(--azul-institucional)",
                                                    padding: 4,
                                                }}
                                                title="Editar"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(svc.id)}
                                                style={{
                                                    background: "none",
                                                    border: "none",
                                                    cursor: "pointer",
                                                    color: "#dc3545",
                                                    padding: 4,
                                                }}
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredServices.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="svc-list-empty">
                                            No se encontraron servicios
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
};

export default SpecialServicesConfig;
