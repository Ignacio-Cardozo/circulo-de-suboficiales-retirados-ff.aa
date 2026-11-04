export type MovementDirection = "ingreso" | "egreso";

export type SpecialServiceMovementTypeItem = {
    key: string;
    label: string;
    includes_movement: boolean;
    movement_type: MovementDirection;
    sort_order: number;
    /** Forma parte de la lista base para servicios sin configuración propia. */
    is_default: boolean;
    created_at: string;
    updated_at: string;
};

export type SpecialServiceMovementTypeInput = {
    label: string;
    includes_movement: boolean;
    movement_type: MovementDirection;
    is_default?: boolean;
};

async function parseError(response: Response, fallback: string): Promise<Error> {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return new Error(body?.error ?? fallback);
}

export async function fetchSpecialServiceMovementTypes(): Promise<
    SpecialServiceMovementTypeItem[]
> {
    const response = await fetch("/api/special-service-movement-types");
    if (!response.ok) {
        throw await parseError(response, "Error al cargar los movimientos de servicios especiales");
    }
    return response.json() as Promise<SpecialServiceMovementTypeItem[]>;
}

export async function saveSpecialServiceMovementType(
    data: SpecialServiceMovementTypeInput
): Promise<SpecialServiceMovementTypeItem> {
    const response = await fetch("/api/special-service-movement-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw await parseError(response, "Error al crear el movimiento");
    return response.json() as Promise<SpecialServiceMovementTypeItem>;
}

export async function updateSpecialServiceMovementType(
    key: string,
    data: SpecialServiceMovementTypeInput
): Promise<SpecialServiceMovementTypeItem> {
    const response = await fetch("/api/special-service-movement-types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, ...data }),
    });
    if (!response.ok) throw await parseError(response, "Error al actualizar el movimiento");
    return response.json() as Promise<SpecialServiceMovementTypeItem>;
}

export async function deleteSpecialServiceMovementType(key: string): Promise<void> {
    const response = await fetch(
        `/api/special-service-movement-types?key=${encodeURIComponent(key)}`,
        { method: "DELETE" }
    );
    if (!response.ok) throw await parseError(response, "Error al eliminar el movimiento");
}
