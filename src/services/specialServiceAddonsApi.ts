export type SpecialServiceAddonItem = {
    id: string;
    special_service_id: string;
    name: string;
    cost: number;
    created_at: string;
    updated_at: string;
};

export type SpecialServiceAddonInput = {
    special_service_id: string;
    name: string;
    cost?: number;
};

async function parseError(response: Response, fallback: string): Promise<Error> {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return new Error(body?.error ?? fallback);
}

export async function fetchSpecialServiceAddons(serviceId: string): Promise<SpecialServiceAddonItem[]> {
    const response = await fetch(`/api/special-service-addons?serviceId=${encodeURIComponent(serviceId)}`);
    if (!response.ok) throw await parseError(response, "Error al cargar los añadidos");
    return response.json() as Promise<SpecialServiceAddonItem[]>;
}

export async function fetchAllSpecialServiceAddons(): Promise<SpecialServiceAddonItem[]> {
    const response = await fetch("/api/special-service-addons");
    if (!response.ok) throw await parseError(response, "Error al cargar los añadidos");
    return response.json() as Promise<SpecialServiceAddonItem[]>;
}

export async function saveSpecialServiceAddon(data: SpecialServiceAddonInput): Promise<SpecialServiceAddonItem> {
    const response = await fetch("/api/special-service-addons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw await parseError(response, "Error al guardar el añadido");
    return response.json() as Promise<SpecialServiceAddonItem>;
}

export async function updateSpecialServiceAddon(
    id: string,
    data: { name: string; cost?: number }
): Promise<SpecialServiceAddonItem> {
    const response = await fetch("/api/special-service-addons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
    });
    if (!response.ok) throw await parseError(response, "Error al actualizar el añadido");
    return response.json() as Promise<SpecialServiceAddonItem>;
}

export async function deleteSpecialServiceAddon(id: string): Promise<void> {
    const response = await fetch(`/api/special-service-addons?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
    if (!response.ok) throw await parseError(response, "Error al eliminar el añadido");
}
