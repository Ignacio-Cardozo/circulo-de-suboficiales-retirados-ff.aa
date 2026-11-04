import React from "react";
import type { SpecialServiceStatusItem } from "../../services/specialServiceStatusesApi";
import {
    FALLBACK_STATUS_COLOR,
    getSpecialServiceStatus,
    statusBadgeStyle,
} from "../../utils/specialServiceStatus";

type Props = {
    statusKey: string;
    statuses: SpecialServiceStatusItem[];
    className?: string;
};

const SpecialServiceStatusBadge: React.FC<Props> = ({ statusKey, statuses, className }) => {
    const status = getSpecialServiceStatus(statuses, statusKey);
    const classes = ["ss-status-badge", className].filter(Boolean).join(" ");
    return (
        <span className={classes} style={statusBadgeStyle(status?.color ?? FALLBACK_STATUS_COLOR)}>
            {status?.label ?? statusKey}
        </span>
    );
};

export default SpecialServiceStatusBadge;
