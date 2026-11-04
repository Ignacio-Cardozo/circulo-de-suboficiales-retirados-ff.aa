export type MovementDirection = "ingreso" | "egreso";

export type SpecialServiceStatusItem = {
    key: string;
    label: string;
    color: string;
    includes_movement: boolean;
    movement_type: MovementDirection;
    movement_type_key: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
};

export type SpecialServiceStatusInput = {
    label: string;
    color: string;
    includes_movement: boolean;
    movement_type: MovementDirection;
    movement_type_key?: string | null;
};

async function parseError(response: Response, fallback: string): Promise<Error> {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return new Error(body?.error ?? fallback);
}

export async function fetchSpecialServiceStatuses(): Promise<SpecialServiceStatusItem[]> {
    const response = await fetch("/api/special-service-statuses");
    if (!response.ok) throw await parseError(response, "Error al cargar los estados de servicios especiales");
    return response.json() as Promise<SpecialServiceStatusItem[]>;
}

export async function saveSpecialServiceStatus(
    data: SpecialServiceStatusInput
): Promise<SpecialServiceStatusItem> {
    const response = await fetch("/api/special-service-statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw await parseError(response, "Error al crear el estado");
    return response.json() as Promise<SpecialServiceStatusItem>;
}

export async function updateSpecialServiceStatus(
    key: string,
    data: SpecialServiceStatusInput
): Promise<SpecialServiceStatusItem> {
    const response = await fetch("/api/special-service-statuses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, ...data }),
    });
    if (!response.ok) throw await parseError(response, "Error al actualizar el estado");
    return response.json() as Promise<SpecialServiceStatusItem>;
}

export async function deleteSpecialServiceStatus(key: string): Promise<void> {
    const response = await fetch(`/api/special-service-statuses?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
    });
    if (!response.ok) throw await parseError(response, "Error al eliminar el estado");
}

export async function reorderSpecialServiceStatus(
    key: string,
    position: number
): Promise<SpecialServiceStatusItem[]> {
    const response = await fetch("/api/special-service-statuses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", key, position }),
    });
    if (!response.ok) throw await parseError(response, "Error al reordenar los estados");
    return response.json() as Promise<SpecialServiceStatusItem[]>;
}
