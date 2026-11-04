import type { SpecialServiceStatusItem } from "./specialServiceStatusesApi";
import type { SpecialServiceMovementTypeItem } from "./specialServiceMovementTypesApi";

/** Estados y movimientos efectivos de un servicio especial (o la lista base si no tiene id). */
export type SpecialServiceWorkflow = {
    special_service_id: string | null;
    custom_statuses: boolean;
    custom_movement_types: boolean;
    statuses: SpecialServiceStatusItem[];
    movement_types: SpecialServiceMovementTypeItem[];
};

export type SpecialServiceWorkflowInput = {
    custom_statuses: boolean;
    status_keys: string[];
    custom_movement_types: boolean;
    movement_type_keys: string[];
};

async function parseError(response: Response, fallback: string): Promise<Error> {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return new Error(body?.error ?? fallback);
}

export async function fetchSpecialServiceWorkflow(
    serviceId: string | null
): Promise<SpecialServiceWorkflow> {
    const query = serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : "";
    const response = await fetch(`/api/special-service-workflow${query}`);
    if (!response.ok) {
        throw await parseError(response, "Error al cargar la configuración del servicio");
    }
    return response.json() as Promise<SpecialServiceWorkflow>;
}

export async function saveSpecialServiceWorkflow(
    serviceId: string,
    input: SpecialServiceWorkflowInput
): Promise<SpecialServiceWorkflow> {
    const response = await fetch("/api/special-service-workflow", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ special_service_id: serviceId, ...input }),
    });
    if (!response.ok) {
        throw await parseError(response, "Error al guardar la configuración del servicio");
    }
    return response.json() as Promise<SpecialServiceWorkflow>;
}
