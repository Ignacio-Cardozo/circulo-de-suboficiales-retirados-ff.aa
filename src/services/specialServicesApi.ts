import { getOrFetch, invalidate, CACHE_KEY } from "./apiCache";

export type SpecialServiceItem = {
    id: string;
    name: string;
    detail: string | null;
    member_price: number;
    person_price: number;
    deposit_cost: number;
    created_at: string;
    updated_at: string;
};

export type SpecialServiceInput = {
    name: string;
    detail?: string | null;
    member_price?: number;
    person_price?: number;
    deposit_cost?: number;
};

export async function fetchSpecialServices(): Promise<SpecialServiceItem[]> {
    return getOrFetch(CACHE_KEY.specialServices, async () => {
        const response = await fetch("/api/special-services");
        if (!response.ok) {
            const body = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(body?.error ?? "Error al cargar servicios especiales");
        }
        return response.json() as Promise<SpecialServiceItem[]>;
    });
}

export async function saveSpecialService(data: SpecialServiceInput): Promise<SpecialServiceItem> {
    const response = await fetch("/api/special-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Error al guardar servicio especial");
    }
    const created = (await response.json()) as SpecialServiceItem;
    invalidate(CACHE_KEY.specialServices);
    return created;
}

export async function updateSpecialService(id: string, data: SpecialServiceInput): Promise<SpecialServiceItem> {
    const response = await fetch("/api/special-services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
    });
    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Error al actualizar servicio especial");
    }
    const updated = (await response.json()) as SpecialServiceItem;
    invalidate(CACHE_KEY.specialServices);
    return updated;
}

export async function deleteSpecialService(id: string): Promise<void> {
    const response = await fetch(`/api/special-services?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Error al eliminar servicio especial");
    }
    invalidate(CACHE_KEY.specialServices);
}
