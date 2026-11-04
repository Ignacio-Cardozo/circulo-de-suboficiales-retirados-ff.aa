import React from "react";
import type { SpecialServiceStatusItem } from "../../services/specialServiceStatusesApi";

type Props = {
    statuses: SpecialServiceStatusItem[];
    value: string;
    onSelect: (key: string) => void;
    disabled?: boolean;
};

const SpecialServiceStatusSteps: React.FC<Props> = ({
    statuses,
    value,
    onSelect,
    disabled,
}) => {
    if (statuses.length === 0) return null;

    const sorted = [...statuses].sort(
        (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)
    );
    const selected = sorted.find((status) => status.key === value) ?? null;
    const selectedOrder = selected ? selected.sort_order : -1;

    return (
        <div className="ss-status-steps">
            {sorted.map((status) => {
                const active = status.key === value;
                const passed = selectedOrder >= 0 && status.sort_order <= selectedOrder;
                return (
                    <button
                        key={status.key}
                        type="button"
                        className={`ss-status-step${active ? " is-active" : ""}${
                            passed ? " is-passed" : ""
                        }`}
                        onClick={() => onSelect(status.key)}
                        disabled={disabled || active}
                        title={status.label}
                    >
                        <span
                            className="ss-status-dot"
                            style={{
                                background: passed ? status.color : "#fff",
                                borderColor: status.color,
                            }}
                        />
                        <span className="ss-status-step-label">{status.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default SpecialServiceStatusSteps;
