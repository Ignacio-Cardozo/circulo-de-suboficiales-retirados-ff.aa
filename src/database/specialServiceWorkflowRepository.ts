/**
 * Configuración de estados y movimientos por servicio especial.
 *
 * - Configuración global (lista base): los estados y movimientos del catálogo con
 *   `is_default = TRUE`, en el orden global (`sort_order`).
 * - Configuración por servicio: si el servicio tiene `custom_statuses` /
 *   `custom_movement_types` en TRUE, usa su propia selección y orden, guardada en
 *   las tablas intermedias `special_service_status_assignments` y
 *   `special_service_movement_type_assignments`.
 */
import { getSql } from "./connection.js";
import { ensureSpecialServicesTable } from "./specialServicesRepository.js";
import {
    ensureSpecialServiceStatusesTable,
    type SpecialServiceStatusRow,
} from "./specialServiceStatusesRepository.js";
import {
    ensureSpecialServiceMovementTypesTable,
    type SpecialServiceMovementTypeRow,
} from "./specialServiceMovementTypesRepository.js";

export type SpecialServiceWorkflow = {
    special_service_id: string | null;
    custom_statuses: boolean;
    custom_movement_types: boolean;
    /** Estados efectivos del servicio, con `sort_order` renumerado según el orden del servicio. */
    statuses: SpecialServiceStatusRow[];
    /** Movimientos efectivos del servicio, con `sort_order` renumerado según el orden del servicio. */
    movement_types: SpecialServiceMovementTypeRow[];
};

export type SpecialServiceWorkflowInput = {
    custom_statuses: boolean;
    status_keys: string[];
    custom_movement_types: boolean;
    movement_type_keys: string[];
};

let schemaReady: Promise<void> | null = null;

async function createWorkflowSchema(): Promise<void> {
    await ensureSpecialServicesTable();
    await ensureSpecialServiceStatusesTable();
    await ensureSpecialServiceMovementTypesTable();
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS special_service_status_assignments (
            special_service_id  UUID            NOT NULL REFERENCES special_services(id) ON DELETE CASCADE,
            status_key          VARCHAR(80)     NOT NULL REFERENCES special_service_statuses(key) ON DELETE CASCADE,
            sort_order          INT             NOT NULL DEFAULT 0,
            created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
            PRIMARY KEY (special_service_id, status_key)
        )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_special_service_status_assignments_status ON special_service_status_assignments (status_key)`;
    await sql`
        CREATE TABLE IF NOT EXISTS special_service_movement_type_assignments (
            special_service_id  UUID            NOT NULL REFERENCES special_services(id) ON DELETE CASCADE,
            movement_type_key   VARCHAR(80)     NOT NULL REFERENCES special_service_movement_types(key) ON DELETE CASCADE,
            sort_order          INT             NOT NULL DEFAULT 0,
            created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
            PRIMARY KEY (special_service_id, movement_type_key)
        )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_special_service_movement_type_assignments_type ON special_service_movement_type_assignments (movement_type_key)`;
}

export function ensureSpecialServiceWorkflowSchema(): Promise<void> {
    if (!schemaReady) {
        schemaReady = createWorkflowSchema().catch((error) => {
            schemaReady = null;
            throw error;
        });
    }
    return schemaReady;
}

function renumber<T extends { sort_order: number }>(rows: T[]): T[] {
    return rows.map((row, index) => ({ ...row, sort_order: index }));
}

async function getBaseStatuses(): Promise<SpecialServiceStatusRow[]> {
    const sql = getSql();
    return (await sql`
        SELECT
            key, label, color, includes_movement, movement_type, movement_type_key,
            sort_order, is_default,
            created_at::text AS created_at,
            updated_at::text AS updated_at
        FROM special_service_statuses
        WHERE is_default = TRUE
        ORDER BY sort_order ASC, label ASC
    `) as SpecialServiceStatusRow[];
}

async function getAssignedStatuses(serviceId: string): Promise<SpecialServiceStatusRow[]> {
    const sql = getSql();
    return (await sql`
        SELECT
            s.key, s.label, s.color, s.includes_movement, s.movement_type, s.movement_type_key,
            s.sort_order, s.is_default,
            s.created_at::text AS created_at,
            s.updated_at::text AS updated_at
        FROM special_service_status_assignments a
        INNER JOIN special_service_statuses s ON s.key = a.status_key
        WHERE a.special_service_id = ${serviceId}
        ORDER BY a.sort_order ASC, s.label ASC
    `) as SpecialServiceStatusRow[];
}

async function getBaseMovementTypes(): Promise<SpecialServiceMovementTypeRow[]> {
    const sql = getSql();
    return (await sql`
        SELECT
            key, label, includes_movement, movement_type, sort_order, is_default,
            created_at::text AS created_at,
            updated_at::text AS updated_at
        FROM special_service_movement_types
        WHERE is_default = TRUE
        ORDER BY sort_order ASC, label ASC
    `) as SpecialServiceMovementTypeRow[];
}

async function getAssignedMovementTypes(serviceId: string): Promise<SpecialServiceMovementTypeRow[]> {
    const sql = getSql();
    return (await sql`
        SELECT
            t.key, t.label, t.includes_movement, t.movement_type, t.sort_order, t.is_default,
            t.created_at::text AS created_at,
            t.updated_at::text AS updated_at
        FROM special_service_movement_type_assignments a
        INNER JOIN special_service_movement_types t ON t.key = a.movement_type_key
        WHERE a.special_service_id = ${serviceId}
        ORDER BY a.sort_order ASC, t.label ASC
    `) as SpecialServiceMovementTypeRow[];
}

/** Lista base (configuración global), la que usa todo servicio sin configuración propia. */
export async function getBaseSpecialServiceWorkflow(): Promise<SpecialServiceWorkflow> {
    await ensureSpecialServiceWorkflowSchema();
    const [statuses, movementTypes] = await Promise.all([getBaseStatuses(), getBaseMovementTypes()]);
    return {
        special_service_id: null,
        custom_statuses: false,
        custom_movement_types: false,
        statuses: renumber(statuses),
        movement_types: renumber(movementTypes),
    };
}

/**
 * Configuración efectiva de un servicio. Si el servicio está marcado como personalizado
 * pero su lista quedó vacía (p. ej. se borraron del catálogo todos sus estados), vuelve
 * a la lista base para que el servicio siga siendo utilizable.
 */
export async function getSpecialServiceWorkflow(
    serviceId: string
): Promise<SpecialServiceWorkflow | null> {
    await ensureSpecialServiceWorkflowSchema();
    const sql = getSql();
    const serviceRows = (await sql`
        SELECT custom_statuses, custom_movement_types
        FROM special_services
        WHERE id = ${serviceId}
        LIMIT 1
    `) as { custom_statuses: boolean; custom_movement_types: boolean }[];
    const service = serviceRows[0];
    if (!service) return null;

    let statuses = service.custom_statuses ? await getAssignedStatuses(serviceId) : [];
    const customStatuses = service.custom_statuses && statuses.length > 0;
    if (!customStatuses) statuses = await getBaseStatuses();

    let movementTypes = service.custom_movement_types
        ? await getAssignedMovementTypes(serviceId)
        : [];
    const customMovementTypes = service.custom_movement_types && movementTypes.length > 0;
    if (!customMovementTypes) movementTypes = await getBaseMovementTypes();

    return {
        special_service_id: serviceId,
        custom_statuses: customStatuses,
        custom_movement_types: customMovementTypes,
        statuses: renumber(statuses),
        movement_types: renumber(movementTypes),
    };
}

function uniqueKeys(keys: unknown): string[] {
    if (!Array.isArray(keys)) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const key of keys) {
        if (typeof key !== "string" || !key || seen.has(key)) continue;
        seen.add(key);
        result.push(key);
    }
    return result;
}

export function parseSpecialServiceWorkflowInput(body: unknown): SpecialServiceWorkflowInput {
    const data = (body ?? {}) as Record<string, unknown>;
    return {
        custom_statuses: data.custom_statuses === true,
        status_keys: uniqueKeys(data.status_keys),
        custom_movement_types: data.custom_movement_types === true,
        movement_type_keys: uniqueKeys(data.movement_type_keys),
    };
}

/**
 * Guarda la configuración de un servicio. Devuelve null si el servicio no existe.
 * Lanza Error con un mensaje para el usuario si la configuración es inválida.
 */
export async function saveSpecialServiceWorkflow(
    serviceId: string,
    input: SpecialServiceWorkflowInput
): Promise<SpecialServiceWorkflow | null> {
    await ensureSpecialServiceWorkflowSchema();
    const sql = getSql();

    const exists = (await sql`
        SELECT 1 FROM special_services WHERE id = ${serviceId} LIMIT 1
    `) as unknown[];
    if (exists.length === 0) return null;

    const statusKeys = input.custom_statuses ? uniqueKeys(input.status_keys) : [];
    const movementTypeKeys = input.custom_movement_types ? uniqueKeys(input.movement_type_keys) : [];

    if (input.custom_statuses && statusKeys.length === 0) {
        throw new Error("Seleccioná al menos un estado para el servicio o usá la lista base.");
    }
    if (input.custom_movement_types && movementTypeKeys.length === 0) {
        throw new Error("Seleccioná al menos un movimiento para el servicio o usá la lista base.");
    }

    if (statusKeys.length > 0) {
        const found = (await sql`
            SELECT key FROM special_service_statuses WHERE key = ANY(${statusKeys})
        `) as { key: string }[];
        if (found.length !== statusKeys.length) {
            throw new Error("Alguno de los estados seleccionados ya no existe. Recargá la página.");
        }
    }
    if (movementTypeKeys.length > 0) {
        const found = (await sql`
            SELECT key FROM special_service_movement_types WHERE key = ANY(${movementTypeKeys})
        `) as { key: string }[];
        if (found.length !== movementTypeKeys.length) {
            throw new Error("Alguno de los movimientos seleccionados ya no existe. Recargá la página.");
        }
    }

    await sql.transaction([
        sql`
            UPDATE special_services
            SET custom_statuses = ${input.custom_statuses},
                custom_movement_types = ${input.custom_movement_types},
                updated_at = NOW()
            WHERE id = ${serviceId}
        `,
        sql`DELETE FROM special_service_status_assignments WHERE special_service_id = ${serviceId}`,
        sql`
            INSERT INTO special_service_status_assignments (special_service_id, status_key, sort_order)
            SELECT ${serviceId}::uuid, k.key, (k.ord - 1)::int
            FROM unnest(${statusKeys}::text[]) WITH ORDINALITY AS k(key, ord)
        `,
        sql`DELETE FROM special_service_movement_type_assignments WHERE special_service_id = ${serviceId}`,
        sql`
            INSERT INTO special_service_movement_type_assignments (special_service_id, movement_type_key, sort_order)
            SELECT ${serviceId}::uuid, k.key, (k.ord - 1)::int
            FROM unnest(${movementTypeKeys}::text[]) WITH ORDINALITY AS k(key, ord)
        `,
    ]);

    return getSpecialServiceWorkflow(serviceId);
}

/**
 * Valida que un estado se pueda asignar a un registro según la configuración de su servicio.
 * Siempre permite conservar el estado actual del registro (aunque luego se haya quitado
 * de la configuración) y no restringe registros sin servicio.
 * Devuelve un mensaje de error o null si es válido.
 */
export async function checkSpecialServiceRecordStatus(input: {
    recordId?: string | null;
    serviceId?: string | null;
    status?: string;
}): Promise<string | null> {
    if (input.status === undefined) return null;
    let serviceId = input.serviceId;
    let currentStatus: string | null = null;

    if (input.recordId) {
        const sql = getSql();
        const rows = (await sql`
            SELECT special_service_id, status
            FROM special_service_records
            WHERE id = ${input.recordId}
            LIMIT 1
        `) as { special_service_id: string | null; status: string }[];
        const record = rows[0];
        if (!record) return null;
        currentStatus = record.status;
        if (serviceId === undefined) serviceId = record.special_service_id;
    }

    if (input.status === currentStatus || !serviceId) return null;
    const workflow = await getSpecialServiceWorkflow(serviceId);
    if (!workflow) return null;
    if (workflow.statuses.some((status) => status.key === input.status)) return null;
    return "El estado seleccionado no está habilitado para este servicio especial.";
}

/**
 * Valida que un tipo de movimiento se pueda registrar sobre un registro según la
 * configuración de su servicio. También se aceptan los movimientos vinculados a alguno
 * de los estados habilitados del servicio. Devuelve un mensaje de error o null.
 */
export async function checkSpecialServiceRecordMovementType(
    recordId: string,
    movementTypeKey: string | null | undefined
): Promise<string | null> {
    if (!movementTypeKey) return null;
    const sql = getSql();
    const rows = (await sql`
        SELECT special_service_id
        FROM special_service_records
        WHERE id = ${recordId}
        LIMIT 1
    `) as { special_service_id: string | null }[];
    const serviceId = rows[0]?.special_service_id;
    if (!serviceId) return null;
    const workflow = await getSpecialServiceWorkflow(serviceId);
    if (!workflow) return null;
    const allowed =
        workflow.movement_types.some((type) => type.key === movementTypeKey) ||
        workflow.statuses.some((status) => status.movement_type_key === movementTypeKey);
    return allowed
        ? null
        : "El movimiento seleccionado no está habilitado para este servicio especial.";
}
