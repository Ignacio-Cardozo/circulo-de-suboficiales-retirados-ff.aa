import React, { useEffect, useState } from "react";
import { Loader, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
    saveSpecialServiceMovementType,
    updateSpecialServiceMovementType,
    deleteSpecialServiceMovementType,
    type MovementDirection,
    type SpecialServiceMovementTypeItem,
} from "../../services/specialServiceMovementTypesApi";
import { useSpecialServiceMovementTypesStore } from "../../store/specialServiceMovementTypesStore";
import { useSpecialServiceWorkflowStore } from "../../store/specialServiceWorkflowStore";

function sortMovementTypes(
    movementTypes: SpecialServiceMovementTypeItem[]
): SpecialServiceMovementTypeItem[] {
    return [...movementTypes].sort(
        (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)
    );
}

const SpecialServiceMovementTypesConfig: React.FC = () => {
    const movementTypes = useSpecialServiceMovementTypesStore((state) => state.movementTypes);
    const loadMovementTypes = useSpecialServiceMovementTypesStore((state) => state.load);
    const setMovementTypes = useSpecialServiceMovementTypesStore(
        (state) => state.setMovementTypes
    );

    const [label, setLabel] = useState("");
    const [includesMovement, setIncludesMovement] = useState(true);
    const [movementType, setMovementType] = useState<MovementDirection>("ingreso");
    const [isDefault, setIsDefault] = useState(true);
    const clearWorkflows = useSpecialServiceWorkflowStore((state) => state.clear);
    const [editKey, setEditKey] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void loadMovementTypes(true);
    }, [loadMovementTypes]);

    const resetForm = () => {
        setLabel("");
        setIncludesMovement(true);
        setMovementType("ingreso");
        setIsDefault(true);
        setEditKey(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!label.trim()) return;
        setSaving(true);
        setError(null);
        try {
            if (editKey) {
                const updated = await updateSpecialServiceMovementType(editKey, {
                    label: label.trim(),
                    includes_movement: includesMovement,
                    movement_type: movementType,
                    is_default: isDefault,
                });
                setMovementTypes(
                    sortMovementTypes(
                        movementTypes.map((item) => (item.key === editKey ? updated : item))
                    )
                );
            } else {
                const created = await saveSpecialServiceMovementType({
                    label: label.trim(),
                    includes_movement: includesMovement,
                    movement_type: movementType,
                    is_default: isDefault,
                });
                setMovementTypes(sortMovementTypes([...movementTypes, created]));
            }
            clearWorkflows();
            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al guardar el movimiento");
        } finally {
            setSaving(false);
        }
    };

    const handleStartEdit = (movement: SpecialServiceMovementTypeItem) => {
        setLabel(movement.label);
        setIncludesMovement(movement.includes_movement);
        setMovementType(movement.movement_type);
        setIsDefault(movement.is_default !== false);
        setEditKey(movement.key);
        setError(null);
    };

    const handleDelete = async (movement: SpecialServiceMovementTypeItem) => {
        if (!window.confirm(`¿Eliminar el movimiento "${movement.label}"?`)) return;
        setError(null);
        try {
            await deleteSpecialServiceMovementType(movement.key);
            setMovementTypes(movementTypes.filter((item) => item.key !== movement.key));
            clearWorkflows();
            if (editKey === movement.key) resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al eliminar el movimiento");
        }
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="config-form special-movements-form">
                <div className="config-field">
                    <label>{editKey ? "Nombre del movimiento" : "Nuevo movimiento"}</label>
                    <input
                        autoComplete="off"
                        type="text"
                        className="config-input"
                        value={label}
                        maxLength={80}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Ej: Pago de seña"
                    />
                </div>
                <div className="config-field">
                    <label>Tipo de movimiento</label>
                    <select
                        className="config-input"
                        value={movementType}
                        onChange={(e) => setMovementType(e.target.value as MovementDirection)}
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
                        <span>Impacta en la caja</span>
                    </label>
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
                                <Save size={16} /> Actualizar Movimiento
                            </>
                        ) : (
                            <>
                                <Plus size={16} /> Agregar Movimiento
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
                <table className="special-statuses-table special-movements-table">
                    <thead>
                        <tr>
                            <th>Movimiento</th>
                            <th>Tipo</th>
                            <th>Incluye movimiento</th>
                            <th>Lista base</th>
                            <th className="actions">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {movementTypes.map((movement) => (
                            <tr key={movement.key}>
                                <td>
                                    <strong>{movement.label}</strong>
                                    <span className="special-status-key">{movement.key}</span>
                                </td>
                                <td>
                                    <span
                                        className={`special-movement-type ${movement.movement_type}`}
                                    >
                                        {movement.movement_type === "ingreso"
                                            ? "Ingreso"
                                            : "Egreso"}
                                    </span>
                                </td>
                                <td>{movement.includes_movement ? "Sí" : "No"}</td>
                                <td>
                                    <span
                                        className={`special-default-badge ${movement.is_default !== false ? "is-on" : "is-off"}`}
                                        title={
                                            movement.is_default !== false
                                                ? "Lo usan los servicios que siguen la lista base"
                                                : "Solo disponible para servicios con lista propia"
                                        }
                                    >
                                        {movement.is_default !== false ? "Sí" : "No"}
                                    </span>
                                </td>
                                <td className="actions">
                                    <button
                                        type="button"
                                        onClick={() => handleStartEdit(movement)}
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
                                        onClick={() => handleDelete(movement)}
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
                        {movementTypes.length === 0 && (
                            <tr>
                                <td colSpan={5} className="svc-list-empty">
                                    No hay movimientos configurados. Ejecutá npm run db:migrate para
                                    crear los movimientos por defecto.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default SpecialServiceMovementTypesConfig;
