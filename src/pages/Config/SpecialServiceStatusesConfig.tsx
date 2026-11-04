import React, { useEffect, useMemo, useState } from "react";
import { GripVertical, Loader, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
    reorderSpecialServiceStatus,
    saveSpecialServiceStatus,
    updateSpecialServiceStatus,
    deleteSpecialServiceStatus,
    type MovementDirection,
    type SpecialServiceStatusItem,
} from "../../services/specialServiceStatusesApi";
import { useSpecialServiceMovementTypesStore } from "../../store/specialServiceMovementTypesStore";
import { useSpecialServiceStatusesStore } from "../../store/specialServiceStatusesStore";
import { useSpecialServiceWorkflowStore } from "../../store/specialServiceWorkflowStore";
import { statusBadgeStyle } from "../../utils/specialServiceStatus";

const DEFAULT_COLOR = "#475569";

function sortStatuses(statuses: SpecialServiceStatusItem[]): SpecialServiceStatusItem[] {
    return [...statuses].sort(
        (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)
    );
}

const SpecialServiceStatusesConfig: React.FC = () => {
    const statuses = useSpecialServiceStatusesStore((state) => state.statuses);
    const loadStatuses = useSpecialServiceStatusesStore((state) => state.load);
    const setStatuses = useSpecialServiceStatusesStore((state) => state.setStatuses);
    const movementTypes = useSpecialServiceMovementTypesStore((state) => state.movementTypes);
    const loadMovementTypes = useSpecialServiceMovementTypesStore((state) => state.load);

    const [label, setLabel] = useState("");
    const [color, setColor] = useState(DEFAULT_COLOR);
    const [includesMovement, setIncludesMovement] = useState(false);
    const [movementType, setMovementType] = useState<MovementDirection>("ingreso");
    const [movementTypeKey, setMovementTypeKey] = useState("");
    const [isDefault, setIsDefault] = useState(true);
    const clearWorkflows = useSpecialServiceWorkflowStore((state) => state.clear);
    const [editKey, setEditKey] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [reorderingKey, setReorderingKey] = useState<string | null>(null);
    const [orderDrafts, setOrderDrafts] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void loadStatuses(true);
        void loadMovementTypes(true);
    }, [loadStatuses, loadMovementTypes]);

    const movementLabelByKey = useMemo(() => {
        const map = new Map<string, string>();
        for (const movement of movementTypes) map.set(movement.key, movement.label);
        return map;
    }, [movementTypes]);

    const resetForm = () => {
        setLabel("");
        setColor(DEFAULT_COLOR);
        setIncludesMovement(false);
        setMovementType("ingreso");
        setMovementTypeKey("");
        setIsDefault(true);
        setEditKey(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!label.trim()) return;
        setSaving(true);
        setError(null);
        try {
            const payload = {
                label: label.trim(),
                color,
                includes_movement: includesMovement,
                movement_type: movementType,
                movement_type_key: includesMovement ? movementTypeKey || null : null,
                is_default: isDefault,
            };
            if (editKey) {
                const updated = await updateSpecialServiceStatus(editKey, payload);
                setStatuses(sortStatuses(statuses.map((item) => (item.key === editKey ? updated : item))));
            } else {
                const created = await saveSpecialServiceStatus(payload);
                setStatuses(sortStatuses([...statuses, created]));
            }
            clearWorkflows();
            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al guardar el estado");
        } finally {
            setSaving(false);
        }
    };

    const handleStartEdit = (status: SpecialServiceStatusItem) => {
        setLabel(status.label);
        setColor(status.color);
        setIncludesMovement(status.includes_movement);
        setMovementType(status.movement_type);
        setMovementTypeKey(status.movement_type_key ?? "");
        setIsDefault(status.is_default !== false);
        setEditKey(status.key);
        setError(null);
    };

    const handleDelete = async (status: SpecialServiceStatusItem) => {
        if (!window.confirm(`¿Eliminar el estado "${status.label}"?`)) return;
        setError(null);
        try {
            await deleteSpecialServiceStatus(status.key);
            const next = sortStatuses(
                statuses
                    .filter((item) => item.key !== status.key)
                    .map((item, index) => ({ ...item, sort_order: index }))
            );
            setStatuses(next);
            setOrderDrafts({});
            clearWorkflows();
            if (editKey === status.key) resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al eliminar el estado");
        }
    };

    const handleMovementTypeKeyChange = (key: string) => {
        setMovementTypeKey(key);
        const linked = movementTypes.find((item) => item.key === key);
        if (linked) setMovementType(linked.movement_type);
    };

    const commitOrder = async (status: SpecialServiceStatusItem, rawValue: string) => {
        const parsed = Number.parseInt(rawValue, 10);
        setOrderDrafts((current) => {
            const next = { ...current };
            delete next[status.key];
            return next;
        });
        if (!Number.isFinite(parsed)) return;
        const position = Math.max(1, Math.min(parsed, statuses.length));
        if (position === status.sort_order + 1) return;
        setReorderingKey(status.key);
        setError(null);
        try {
            const next = await reorderSpecialServiceStatus(status.key, position);
            setStatuses(next);
            clearWorkflows();
            setOrderDrafts({});
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al reordenar los estados");
        } finally {
            setReorderingKey(null);
        }
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="config-form special-statuses-form">
                <div className="config-field">
                    <label>{editKey ? "Nombre del estado" : "Nuevo estado"}</label>
                    <input
                        autoComplete="off"
                        type="text"
                        className="config-input"
                        value={label}
                        maxLength={80}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Nombre del estado"
                    />
                </div>
                <div className="config-field">
                    <label>Color</label>
                    <div className="special-status-color-row">
                        <input
                            type="color"
                            className="special-status-color-input"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            aria-label="Color del estado"
                        />
                        <span className="special-status-color-value">{color.toUpperCase()}</span>
                    </div>
                </div>
                <div className="config-field">
                    <label>Tipo de movimiento</label>
                    <select
                        className="config-input"
                        value={movementType}
                        onChange={(e) => setMovementType(e.target.value as MovementDirection)}
                        disabled={!includesMovement}
                    >
                        <option value="ingreso">Ingreso</option>
                        <option value="egreso">Egreso</option>
                    </select>
                </div>
                <div className="config-field">
                    <label>Incluye movimiento</label>
                    <label className="special-movement-check">
                        <input
                            type="checkbox"
                            checked={includesMovement}
                            onChange={(e) => setIncludesMovement(e.target.checked)}
                        />
                        <span>Al pasar a este estado se registra un movimiento</span>
                    </label>
                </div>
                <div className="config-field">
                    <label>Movimiento asociado</label>
                    <select
                        className="config-input"
                        value={movementTypeKey}
                        onChange={(e) => handleMovementTypeKeyChange(e.target.value)}
                        disabled={!includesMovement}
                    >
                        <option value="">Sin vínculo</option>
                        {movementTypes.map((movement) => (
                            <option key={movement.key} value={movement.key}>
                                {movement.label} ({movement.movement_type})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="config-field">
                    <label>Lista base</label>
                    <label className="special-movement-check">
                        <input
                            type="checkbox"
                            checked={isDefault}
                            onChange={(e) => setIsDefault(e.target.checked)}
                        />
                        <span>Incluir en la lista base de los servicios</span>
                    </label>
                </div>
                {error && <div className="config-error">{error}</div>}
                <div className="config-form-actions">
                    <button type="submit" className="config-save-btn" disabled={saving || !label.trim()}>
                        {saving ? (
                            <>
                                <Loader size={16} className="spin" /> Guardando...
                            </>
                        ) : editKey ? (
                            <>
                                <Save size={16} /> Actualizar Estado
                            </>
                        ) : (
                            <>
                                <Plus size={16} /> Agregar Estado
                            </>
                        )}
                    </button>
                    {editKey && (
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

            <div className="special-statuses-wrapper">
                <table className="special-statuses-table">
                    <thead>
                        <tr>
                            <th className="order">Orden</th>
                            <th>Estado</th>
                            <th>Color</th>
                            <th>Movimiento</th>
                            <th>Lista base</th>
                            <th className="actions">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {statuses.map((status) => (
                            <tr key={status.key}>
                                <td className="order">
                                    <div className="special-status-order">
                                        <GripVertical size={14} />
                                        <input
                                            type="number"
                                            className="special-status-order-input"
                                            min={1}
                                            max={statuses.length}
                                            value={orderDrafts[status.key] ?? String(status.sort_order + 1)}
                                            disabled={reorderingKey === status.key}
                                            onChange={(e) =>
                                                setOrderDrafts((current) => ({
                                                    ...current,
                                                    [status.key]: e.target.value,
                                                }))
                                            }
                                            onBlur={(e) => void commitOrder(status, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    e.currentTarget.blur();
                                                }
                                            }}
                                            aria-label={`Orden de ${status.label}`}
                                        />
                                    </div>
                                </td>
                                <td>
                                    <span
                                        className="special-status-badge"
                                        style={statusBadgeStyle(status.color)}
                                    >
                                        {status.label}
                                    </span>
                                    <span className="special-status-key">{status.key}</span>
                                </td>
                                <td>
                                    <span className="special-status-swatch-row">
                                        <span
                                            className="special-status-swatch"
                                            style={{ background: status.color }}
                                        />
                                        <span>{status.color.toUpperCase()}</span>
                                    </span>
                                </td>
                                <td>
                                    {status.includes_movement ? (
                                        <div className="special-status-movement-cell">
                                            <span
                                                className={`special-movement-type ${status.movement_type}`}
                                            >
                                                {status.movement_type === "ingreso"
                                                    ? "Ingreso"
                                                    : "Egreso"}
                                            </span>
                                            <span className="special-status-movement-label">
                                                {status.movement_type_key
                                                    ? movementLabelByKey.get(status.movement_type_key) ??
                                                      status.movement_type_key
                                                    : "Sin vínculo"}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="special-status-key" style={{ marginTop: 0 }}>
                                            Sin movimiento
                                        </span>
                                    )}
                                </td>
                                <td>
                                    <span
                                        className={`special-default-badge ${status.is_default !== false ? "is-on" : "is-off"}`}
                                        title={
                                            status.is_default !== false
                                                ? "Lo usan los servicios que siguen la lista base"
                                                : "Solo disponible para servicios con lista propia"
                                        }
                                    >
                                        {status.is_default !== false ? "Sí" : "No"}
                                    </span>
                                </td>
                                <td className="actions">
                                    <button
                                        type="button"
                                        onClick={() => handleStartEdit(status)}
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
                                        onClick={() => handleDelete(status)}
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
                        {statuses.length === 0 && (
                            <tr>
                                <td colSpan={6} className="svc-list-empty">
                                    No hay estados configurados. Ejecutá npm run db:migrate para
                                    crear los estados por defecto.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {statuses.length > 1 && (
                    <p className="special-status-order-hint">
                        El orden se renumera automáticamente al mover un estado.
                    </p>
                )}
            </div>
        </>
    );
};

export default SpecialServiceStatusesConfig;
