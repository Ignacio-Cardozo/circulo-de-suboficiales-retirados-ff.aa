export type SpecialServiceRecordAddon = {
    id: string;
    record_id: string;
    addon_id: string | null;
    name: string;
    cost: number;
    created_at: string;
    updated_at: string;
};

export type SpecialServiceRecordAddonInput = {
    addon_id?: string | null;
    name: string;
    cost?: number;
};

export type SpecialServiceRecordItem = {
    id: string;
    special_service_id: string | null;
    special_service_name: string | null;
    special_service_detail: string | null;
    member_price: number | null;
    person_price: number | null;
    deposit_cost: number | null;
    member_id: string | null;
    member_nombre: string | null;
    member_numero_de_socio: string | null;
    person_id: string | null;
    person_nombre: string | null;
    amount: number;
    date: string;
    service_date: string | null;
    status: string;
    addons: SpecialServiceRecordAddon[];
    created_at: string;
    updated_at: string;
};

export type SpecialServiceRecordInput = {
    special_service_id?: string | null;
    member_id?: string | null;
    person_id?: string | null;
    amount?: number;
    date: string;
    service_date?: string | null;
    status?: string;
    addons?: SpecialServiceRecordAddonInput[];
};

async function parseError(response: Response, fallback: string): Promise<Error> {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return new Error(body?.error ?? fallback);
}

export async function fetchSpecialServiceRecords(): Promise<SpecialServiceRecordItem[]> {
    const response = await fetch("/api/special-service-records");
    if (!response.ok) throw await parseError(response, "Error al cargar registros de servicios especiales");
    return response.json() as Promise<SpecialServiceRecordItem[]>;
}

export async function fetchSpecialServiceRecordById(id: string): Promise<SpecialServiceRecordItem> {
    const response = await fetch(`/api/special-service-records?id=${encodeURIComponent(id)}`);
    if (!response.ok) throw await parseError(response, "Error al cargar registro de servicio especial");
    return response.json() as Promise<SpecialServiceRecordItem>;
}

export async function fetchSpecialServiceRecordsByMember(memberId: string): Promise<SpecialServiceRecordItem[]> {
    const response = await fetch(`/api/special-service-records?memberId=${encodeURIComponent(memberId)}`);
    if (!response.ok) throw await parseError(response, "Error al cargar servicios especiales del socio");
    return response.json() as Promise<SpecialServiceRecordItem[]>;
}

export async function fetchSpecialServiceRecordsByPerson(personId: string): Promise<SpecialServiceRecordItem[]> {
    const response = await fetch(`/api/special-service-records?personId=${encodeURIComponent(personId)}`);
    if (!response.ok) throw await parseError(response, "Error al cargar servicios especiales de la persona");
    return response.json() as Promise<SpecialServiceRecordItem[]>;
}

export async function fetchSpecialServiceRecordsByMovement(movementId: string): Promise<SpecialServiceRecordItem[]> {
    const response = await fetch(`/api/special-service-records?movementId=${encodeURIComponent(movementId)}`);
    if (!response.ok) throw await parseError(response, "Error al cargar servicios especiales del movimiento");
    return response.json() as Promise<SpecialServiceRecordItem[]>;
}

export async function saveSpecialServiceRecord(data: SpecialServiceRecordInput): Promise<SpecialServiceRecordItem> {
    const response = await fetch("/api/special-service-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw await parseError(response, "Error al guardar registro de servicio especial");
    return response.json() as Promise<SpecialServiceRecordItem>;
}

export async function updateSpecialServiceRecord(
    id: string,
    data: Partial<SpecialServiceRecordInput>
): Promise<SpecialServiceRecordItem> {
    const response = await fetch("/api/special-service-records", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
    });
    if (!response.ok) throw await parseError(response, "Error al actualizar registro de servicio especial");
    return response.json() as Promise<SpecialServiceRecordItem>;
}

export async function cancelSpecialServiceRecord(id: string): Promise<SpecialServiceRecordItem> {
    const response = await fetch(`/api/special-service-records?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
    if (!response.ok) throw await parseError(response, "Error al cancelar registro de servicio especial");
    return response.json() as Promise<SpecialServiceRecordItem>;
}
