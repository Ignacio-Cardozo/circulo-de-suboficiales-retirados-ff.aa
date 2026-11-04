import React, { useEffect, useMemo } from "react";
import { ArrowDown, ArrowUp, ArrowLeftRight, Plus, Tags, X } from "lucide-react";
import type { SpecialServiceWorkflowInput } from "../../services/specialServiceWorkflowApi";
import { useSpecialServiceStatusesStore } from "../../store/specialServiceStatusesStore";
import { useSpecialServiceMovementTypesStore } from "../../store/specialServiceMovementTypesStore";
import { statusBadgeStyle } from "../../utils/specialServiceStatus";
import "./SpecialServiceWorkflowFields.css";

const INGRESO_COLOR = "#15803d";
const EGRESO_COLOR = "#b91c1c";

type WorkflowItem = {
    key: string;
    label: string;
    color: string;
    hint?: string;
    isDefault: boolean;
    sortOrder: number;
};

interface WorkflowSectionProps {
    title: string;
    icon: React.ReactNode;
    noun: { singular: string; plural: string };
    items: WorkflowItem[];
    custom: boolean;
    selectedKeys: string[];
    disabled?: boolean;
    onChange: (custom: boolean, keys: string[]) => void;
}

const Chip: React.FC<{ item: WorkflowItem }> = ({ item }) => (
    <span className="ssw-chip" style={statusBadgeStyle(item.color)} title={item.hint}>
        {item.label}
    </span>
);

const WorkflowSection: React.FC<WorkflowSectionProps> = ({
    title,
    icon,
    noun,
    items,
    custom,
    selectedKeys,
    disabled,
    onChange,
}) => {
    const byKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items]);
    const baseItems = useMemo(
        () => items.filter((item) => item.isDefault).sort((a, b) => a.sortOrder - b.sortOrder),
        [items]
    );
    // Ignora claves que ya no existen en el catálogo global.
    const selected = selectedKeys
        .map((key) => byKey.get(key))
        .filter((item): item is WorkflowItem => Boolean(item));
    const available = items.filter((item) => !selectedKeys.includes(item.key));

    const setKeys = (keys: string[]) => onChange(true, keys.filter((key) => byKey.has(key)));

    const switchMode = (nextCustom: boolean) => {
        if (nextCustom === custom) return;
        if (nextCustom) {
            // Arranca desde la lista base para que sólo haya que ajustar lo distinto.
            onChange(true, selected.length > 0 ? selected.map((item) => item.key) : baseItems.map((item) => item.key));
        } else {
            onChange(false, []);
        }
    };

    const move = (index: number, delta: number) => {
        const keys = selected.map((item) => item.key);
        const target = index + delta;
        if (target < 0 || target >= keys.length) return;
        [keys[index], keys[target]] = [keys[target], keys[index]];
        setKeys(keys);
    };

    return (
        <section className="ssw-section">
            <div className="ssw-section-head">
                <span className="ssw-section-title">
                    <span className="ssw-section-icon">{icon}</span>
                    {title}
                </span>
                <div className="ssw-toggle" role="radiogroup" aria-label={`${title}: origen de la lista`}>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={!custom}
                        className={!custom ? "is-active" : ""}
                        onClick={() => switchMode(false)}
                        disabled={disabled}
                    >
                        Lista base
                    </button>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={custom}
                        className={custom ? "is-active" : ""}
                        onClick={() => switchMode(true)}
                        disabled={disabled}
                    >
                        Personalizada
                    </button>
                </div>
            </div>

            {!custom ? (
                <div className="ssw-base">
                    {baseItems.length === 0 ? (
                        <span className="ssw-hint">
                            La lista base no tiene {noun.plural}. Configurala en Variables → Servicios Especiales.
                        </span>
                    ) : (
                        <div className="ssw-flow">
                            {baseItems.map((item) => (
                                <Chip key={item.key} item={item} />
                            ))}
                        </div>
                    )}
                    <span className="ssw-hint">
                        Usa la configuración global: si cambia la lista base, este servicio la sigue.
                    </span>
                </div>
            ) : (
                <div className="ssw-custom">
                    {selected.length === 0 ? (
                        <div className="ssw-warning">
                            Elegí al menos un {noun.singular} de la lista de abajo.
                        </div>
                    ) : (
                        <ol className="ssw-selected">
                            {selected.map((item, index) => (
                                <li key={item.key} className="ssw-selected-item">
                                    <span className="ssw-index">{index + 1}</span>
                                    <Chip item={item} />
                                    {item.hint && <span className="ssw-item-hint">{item.hint}</span>}
                                    <span className="ssw-item-actions">
                                        <button
                                            type="button"
                                            onClick={() => move(index, -1)}
                                            disabled={disabled || index === 0}
                                            title="Subir"
                                            aria-label={`Subir ${item.label}`}
                                        >
                                            <ArrowUp size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => move(index, 1)}
                                            disabled={disabled || index === selected.length - 1}
                                            title="Bajar"
                                            aria-label={`Bajar ${item.label}`}
                                        >
                                            <ArrowDown size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            className="is-remove"
                                            onClick={() =>
                                                setKeys(selected.filter((other) => other.key !== item.key).map((other) => other.key))
                                            }
                                            disabled={disabled}
                                            title="Quitar"
                                            aria-label={`Quitar ${item.label}`}
                                        >
                                            <X size={14} />
                                        </button>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}

                    {available.length > 0 && (
                        <div className="ssw-available">
                            <span className="ssw-available-title">Agregar {noun.plural}</span>
                            <div className="ssw-flow">
                                {available.map((item) => (
                                    <button
                                        key={item.key}
                                        type="button"
                                        className="ssw-add"
                                        onClick={() => setKeys([...selected.map((other) => other.key), item.key])}
                                        disabled={disabled}
                                        title={item.hint}
                                    >
                                        <Plus size={12} /> {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <span className="ssw-hint">
                        El orden define el recorrido de {noun.plural} del servicio.
                    </span>
                </div>
            )}
        </section>
    );
};

interface SpecialServiceWorkflowFieldsProps {
    value: SpecialServiceWorkflowInput;
    onChange: (value: SpecialServiceWorkflowInput) => void;
    disabled?: boolean;
    loading?: boolean;
}

/**
 * Permite elegir, para un servicio especial, si usa la lista base de estados y movimientos
 * o una lista propia (selección y orden).
 */
const SpecialServiceWorkflowFields: React.FC<SpecialServiceWorkflowFieldsProps> = ({
    value,
    onChange,
    disabled,
    loading,
}) => {
    const statuses = useSpecialServiceStatusesStore((state) => state.statuses);
    const loadStatuses = useSpecialServiceStatusesStore((state) => state.load);
    const movementTypes = useSpecialServiceMovementTypesStore((state) => state.movementTypes);
    const loadMovementTypes = useSpecialServiceMovementTypesStore((state) => state.load);

    useEffect(() => {
        void loadStatuses();
        void loadMovementTypes();
    }, [loadStatuses, loadMovementTypes]);

    const statusItems = useMemo<WorkflowItem[]>(
        () =>
            statuses.map((status) => ({
                key: status.key,
                label: status.label,
                color: status.color,
                isDefault: status.is_default !== false,
                sortOrder: status.sort_order,
            })),
        [statuses]
    );

    const movementItems = useMemo<WorkflowItem[]>(
        () =>
            movementTypes.map((movement) => ({
                key: movement.key,
                label: movement.label,
                color: movement.movement_type === "egreso" ? EGRESO_COLOR : INGRESO_COLOR,
                hint: movement.movement_type === "egreso" ? "Egreso" : "Ingreso",
                isDefault: movement.is_default !== false,
                sortOrder: movement.sort_order,
            })),
        [movementTypes]
    );

    if (loading) {
        return <div className="ssw ssw-loading">Cargando configuración del servicio…</div>;
    }

    return (
        <div className="ssw">
            <WorkflowSection
                title="Estados"
                icon={<Tags size={14} />}
                noun={{ singular: "estado", plural: "estados" }}
                items={statusItems}
                custom={value.custom_statuses}
                selectedKeys={value.status_keys}
                disabled={disabled}
                onChange={(custom, keys) =>
                    onChange({ ...value, custom_statuses: custom, status_keys: keys })
                }
            />
            <WorkflowSection
                title="Movimientos"
                icon={<ArrowLeftRight size={14} />}
                noun={{ singular: "movimiento", plural: "movimientos" }}
                items={movementItems}
                custom={value.custom_movement_types}
                selectedKeys={value.movement_type_keys}
                disabled={disabled}
                onChange={(custom, keys) =>
                    onChange({ ...value, custom_movement_types: custom, movement_type_keys: keys })
                }
            />
        </div>
    );
};

export default SpecialServiceWorkflowFields;
