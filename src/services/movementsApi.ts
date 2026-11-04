import type { ComprobanteRecord } from "./comprobantesApi";
import type { SpecialServiceRecordItem } from "./specialServiceRecordsApi";

export interface DueLink {
    id: string;
    type: "socio" | "cementerio";
    payment_date: string;
    period: string[] | null;
    member_id: string | null;
    member_nombre: string | null;
    person_id: string | null;
    person_nombre: string | null;
    family_group: string | null;
    paid_members: string[] | null;
}

export interface ServiceRecordLink {
    id: string;
    service_id: string | null;
    service_name: string | null;
    service_amount: number | null;
    member_id: string | null;
    member_nombre: string | null;
    member_numero_de_socio: string | null;
    person_id: string | null;
    person_nombre: string | null;
    amount: number;
    date: string;
    service_date: string | null;
    detail: string | null;
}

export interface CementerioMovimientoLink {
    id: string;
    movement_id: string | null;
    cementerio_id: string | null;
    nicho: string;
    tipo: string | null;
    ocupante: string | null;
    anios_pagados: string[];
    importe: number;
    fecha_pago: string;
    member_id: string | null;
    person_id: string | null;
}

export interface Movement {
    id: string;
    date: string;
    detail: string;
    amount: number;
    type: "ingreso" | "egreso" | "transferencia";
    mode: "efectivo" | "transferencia";
    concept?: string | null;
    anulado?: boolean;
    created_at?: string;
    comprobante?: ComprobanteRecord | null;
    linked_due?: DueLink | null;
    linked_service_records?: ServiceRecordLink[];
    linked_cementerio_movimientos?: CementerioMovimientoLink[];
    linked_special_service_records?: SpecialServiceRecordItem[];
}

export async function fetchMovements(): Promise<Movement[]> {
    const response = await fetch("/api/movements");

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new Error(body?.error ?? "No se pudieron cargar los movimientos de caja");
    }

    return response.json() as Promise<Movement[]>;
}

export async function fetchMovementById(id: string): Promise<Movement> {
    const response = await fetch(`/api/movement?id=${encodeURIComponent(id)}`);

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new Error(body?.error ?? "No se pudo cargar el movimiento");
    }

    return response.json() as Promise<Movement>;
}

export async function updateMovement(
    id: string,
    data: Partial<Pick<Movement, "date" | "detail" | "amount" | "type" | "mode" | "concept">> & { due?: Record<string, unknown> }
): Promise<void> {
    const response = await fetch(`/api/movement?id=${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new Error(body?.error ?? "No se pudo actualizar el movimiento");
    }
}

export async function setMovementAnulado(id: string, anulado: boolean): Promise<void> {
    const response = await fetch(`/api/movement?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anulado }),
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new Error(body?.error ?? "No se pudo anular el movimiento");
    }
}
