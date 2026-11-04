import type { ComprobanteRecord } from "./comprobantesApi";

export type MovementDirection = "ingreso" | "egreso";
export type MovementMode = "efectivo" | "transferencia";

export type SpecialServiceRecordMovementItem = {
    id: string;
    record_id: string;
    movement_type_key: string | null;
    label: string;
    movement_type: MovementDirection;
    includes_movement: boolean;
    amount: number;
    date: string;
    mode: MovementMode;
    movement_id: string | null;
    movement_anulado: boolean | null;
    created_at: string;
    updated_at: string;
    comprobante?: ComprobanteRecord | null;
};

export type SpecialServiceRecordMovementInput = {
    record_id: string;
    movement_type_key?: string | null;
    label?: string;
    movement_type?: MovementDirection;
    includes_movement?: boolean;
    amount: number;
    date: string;
    mode: MovementMode;
};

async function parseError(response: Response, fallback: string): Promise<Error> {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return new Error(body?.error ?? fallback);
}

export async function fetchSpecialServiceRecordMovements(
    recordId: string
): Promise<SpecialServiceRecordMovementItem[]> {
    const response = await fetch(
        `/api/special-service-record-movements?recordId=${encodeURIComponent(recordId)}`
    );
    if (!response.ok) {
        throw await parseError(response, "Error al cargar los movimientos del servicio");
    }
    return response.json() as Promise<SpecialServiceRecordMovementItem[]>;
}

export async function saveSpecialServiceRecordMovement(
    data: SpecialServiceRecordMovementInput
): Promise<SpecialServiceRecordMovementItem> {
    const response = await fetch("/api/special-service-record-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw await parseError(response, "Error al registrar el movimiento");
    return response.json() as Promise<SpecialServiceRecordMovementItem>;
}

export async function deleteSpecialServiceRecordMovement(id: string): Promise<void> {
    const response = await fetch(
        `/api/special-service-record-movements?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
    );
    if (!response.ok) throw await parseError(response, "Error al eliminar el movimiento");
}
