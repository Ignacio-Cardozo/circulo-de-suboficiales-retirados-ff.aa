import type { CSSProperties } from "react";
import type { SpecialServiceStatusItem } from "../services/specialServiceStatusesApi";

export const FALLBACK_STATUS_COLOR = "#475569";

export function getSpecialServiceStatus(
    statuses: SpecialServiceStatusItem[],
    key: string
): SpecialServiceStatusItem | null {
    return statuses.find((status) => status.key === key) ?? null;
}

export function resolveStatusLabel(statuses: SpecialServiceStatusItem[], key: string): string {
    return getSpecialServiceStatus(statuses, key)?.label ?? key;
}

function normalizeHex(color: string): string {
    return /^#[0-9a-f]{6}$/i.test(color.trim()) ? color.trim() : FALLBACK_STATUS_COLOR;
}

function colorWithAlpha(color: string, alpha: number): string {
    const hex = normalizeHex(color);
    const value = parseInt(hex.slice(1), 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function statusBadgeStyle(color: string): CSSProperties {
    const hex = normalizeHex(color);
    return {
        backgroundColor: colorWithAlpha(hex, 0.14),
        borderColor: colorWithAlpha(hex, 0.35),
        color: hex,
    };
}
