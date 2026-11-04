import { getSql } from "./connection.js";

export type SpecialServiceStatusRow = {
    key: string;
    label: string;
    color: string;
    includes_movement: boolean;
    movement_type: "ingreso" | "egreso";
    movement_type_key: string | null;
    sort_order: number;
    /** Forma parte de la lista base que usan los servicios sin configuración propia. */
    is_default: boolean;
    created_at: string;
    updated_at: string;
};

export type SpecialServiceStatusInput = {
    label: string;
    color: string;
    includes_movement: boolean;
    movement_type: "ingreso" | "egreso";
    movement_type_key?: string | null;
    is_default?: boolean;
};

export const CANCELED_SPECIAL_SERVICE_STATUS_KEY = "cancelado";

export const CANCELED_SPECIAL_SERVICE_STATUS: SpecialServiceStatusInput & {
    key: string;
} = {
    key: CANCELED_SPECIAL_SERVICE_STATUS_KEY,
    label: "Cancelado",
    color: "#6b7280",
    includes_movement: false,
    movement_type: "ingreso",
    movement_type_key: null,
};

export const DEFAULT_SPECIAL_SERVICE_STATUSES: Array<
    SpecialServiceStatusInput & { key: string; sort_order: number }
> = [
    {
        key: "registrado",
        label: "Registrado",
        color: "#475569",
        includes_movement: false,
        movement_type: "ingreso",
        movement_type_key: null,
        sort_order: 0,
        is_default: true,
    },
    {
        key: "senado",
        label: "Señado",
        color: "#b45309",
        includes_movement: true,
        movement_type: "ingreso",
        movement_type_key: "sena",
        sort_order: 1,
        is_default: true,
    },
    {
        key: "pago_del_seguro",
        label: "Pago del Seguro",
        color: "#d18923",
        includes_movement: true,
        movement_type: "ingreso",
        movement_type_key: "pago_de_seguro",
        sort_order: 2,
        is_default: true,
    },
    {
        key: "pago",
        label: "Pago",
        color: "#1d4ed8",
        includes_movement: true,
        movement_type: "ingreso",
        movement_type_key: "pago",
        sort_order: 3,
        is_default: true,
    },
    {
        key: "completado",
        label: "Completado",
        color: "#15803d",
        includes_movement: false,
        movement_type: "ingreso",
        movement_type_key: null,
        sort_order: 4,
        is_default: true,
    },
    {
        key: "pendiente_devolucion_seguro",
        label: "Pendiente devolución del seguro",
        color: "#b91c1c",
        includes_movement: true,
        movement_type: "egreso",
        movement_type_key: "devolucion_seguro",
        sort_order: 5,
        is_default: true,
    },
];

export async function ensureSpecialServiceStatusesTable(): Promise<void> {
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS special_service_statuses (
            key                 VARCHAR(80)     PRIMARY KEY,
            label               VARCHAR(255)    NOT NULL,
            color               VARCHAR(20)     NOT NULL DEFAULT '#475569',
            includes_movement   BOOLEAN         NOT NULL DEFAULT FALSE,
            movement_type       VARCHAR(20)     NOT NULL DEFAULT 'ingreso',
            movement_type_key   VARCHAR(80)     NULL,
            sort_order          INT             NOT NULL DEFAULT 0,
            created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
    await sql`
        ALTER TABLE special_service_statuses
        ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT TRUE
    `;
    const columns = (await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'special_service_statuses'
          AND column_name IN ('includes_movement', 'movement_type', 'movement_type_key')
    `) as { column_name: string }[];
    const existing = new Set(columns.map((column) => column.column_name));
    const addedIncludesMovement = !existing.has("includes_movement");
    const addedMovementType = !existing.has("movement_type");
    const addedMovementTypeKey = !existing.has("movement_type_key");
    if (addedMovementType) {
        await sql`
            ALTER TABLE special_service_statuses
            ADD COLUMN IF NOT EXISTS movement_type VARCHAR(20) NOT NULL DEFAULT 'ingreso'
        `;
    }
    if (addedIncludesMovement) {
        await sql`
            ALTER TABLE special_service_statuses
            ADD COLUMN IF NOT EXISTS includes_movement BOOLEAN NOT NULL DEFAULT FALSE
        `;
    }
    if (addedMovementTypeKey) {
        await sql`
            ALTER TABLE special_service_statuses
            ADD COLUMN IF NOT EXISTS movement_type_key VARCHAR(80) NULL
        `;
    }
    if (addedIncludesMovement || addedMovementType || addedMovementTypeKey) {
        for (const status of DEFAULT_SPECIAL_SERVICE_STATUSES) {
            await sql`
                UPDATE special_service_statuses
                SET includes_movement = ${status.includes_movement},
                    movement_type = ${status.movement_type},
                    movement_type_key = ${status.movement_type_key}
                WHERE key = ${status.key}
            `;
        }
    }
    await normalizeSpecialServiceStatusOrder();
}

export async function ensureCanceledSpecialServiceStatus(): Promise<void> {
    await ensureSpecialServiceStatusesTable();
    const sql = getSql();
    const existing = (await sql`
        SELECT 1
        FROM special_service_statuses
        WHERE key = ${CANCELED_SPECIAL_SERVICE_STATUS.key}
        LIMIT 1
    `) as { "?column?": number }[];
    if (existing.length > 0) return;
    const orderRows = (await sql`
        SELECT COALESCE(MAX(sort_order) + 1, 0)::int AS next_order
        FROM special_service_statuses
    `) as { next_order: number }[];
    const sortOrder = orderRows[0]?.next_order ?? 0;
    await sql`
        INSERT INTO special_service_statuses (
            key, label, color, includes_movement, movement_type, movement_type_key, sort_order
        )
        VALUES (
            ${CANCELED_SPECIAL_SERVICE_STATUS.key},
            ${CANCELED_SPECIAL_SERVICE_STATUS.label},
            ${CANCELED_SPECIAL_SERVICE_STATUS.color},
            ${CANCELED_SPECIAL_SERVICE_STATUS.includes_movement},
            ${CANCELED_SPECIAL_SERVICE_STATUS.movement_type},
            ${CANCELED_SPECIAL_SERVICE_STATUS.movement_type_key},
            ${sortOrder}
        )
        ON CONFLICT (key) DO NOTHING
    `;
}

export async function migrateSpecialServiceStatusesSchema(): Promise<void> {
    await ensureSpecialServiceStatusesTable();
    const sql = getSql();
    const rows = (await sql`
        SELECT COUNT(*)::int AS count
        FROM special_service_statuses
    `) as { count: number }[];
    if ((rows[0]?.count ?? 0) === 0) {
        for (const status of DEFAULT_SPECIAL_SERVICE_STATUSES) {
            await sql`
                INSERT INTO special_service_statuses (
                    key, label, color, includes_movement, movement_type, movement_type_key, sort_order, is_default
                )
                VALUES (
                    ${status.key},
                    ${status.label},
                    ${status.color},
                    ${status.includes_movement},
                    ${status.movement_type},
                    ${status.movement_type_key},
                    ${status.sort_order},
                    ${status.is_default ?? true}
                )
                ON CONFLICT (key) DO NOTHING
            `;
        }
    }
    await ensureCanceledSpecialServiceStatus();
}

export async function getAllSpecialServiceStatuses(): Promise<SpecialServiceStatusRow[]> {
    await ensureSpecialServiceStatusesTable();
    const sql = getSql();
    const rows = (await sql`
        SELECT
            key,
            label,
            color,
            includes_movement,
            movement_type,
            movement_type_key,
            sort_order,
            is_default,
            created_at::text AS created_at,
            updated_at::text AS updated_at
        FROM special_service_statuses
        ORDER BY sort_order ASC, label ASC
    `) as SpecialServiceStatusRow[];
    return rows;
}

export async function specialServiceStatusExists(key: string): Promise<boolean> {
    await ensureSpecialServiceStatusesTable();
    const sql = getSql();
    const rows = (await sql`
        SELECT 1
        FROM special_service_statuses
        WHERE key = ${key}
        LIMIT 1
    `) as { "?column?": number }[];
    return rows.length > 0;
}

function slugifyStatus(value: string): string {
    const slug = value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60);
    return slug || "estado";
}

async function buildUniqueStatusKey(label: string): Promise<string> {
    const sql = getSql();
    const base = slugifyStatus(label);
    const rows = (await sql`
        SELECT key
        FROM special_service_statuses
        WHERE key = ${base} OR key LIKE ${`${base}_%`}
    `) as { key: string }[];
    const existing = new Set(rows.map((row) => row.key));
    if (!existing.has(base)) return base;
    let suffix = 2;
    while (existing.has(`${base}_${suffix}`)) suffix += 1;
    return `${base}_${suffix}`;
}

export async function insertSpecialServiceStatus(
    data: SpecialServiceStatusInput
): Promise<SpecialServiceStatusRow> {
    await ensureSpecialServiceStatusesTable();
    const sql = getSql();
    const key = await buildUniqueStatusKey(data.label);
    const orderRows = (await sql`
        SELECT COALESCE(MAX(sort_order) + 1, 0)::int AS next_order
        FROM special_service_statuses
    `) as { next_order: number }[];
    const sortOrder = orderRows[0]?.next_order ?? 0;
    const rows = (await sql`
        INSERT INTO special_service_statuses (
            key, label, color, includes_movement, movement_type, movement_type_key, sort_order, is_default
        )
        VALUES (
            ${key},
            ${data.label.trim()},
            ${data.color.trim()},
            ${data.includes_movement},
            ${data.movement_type},
            ${data.movement_type_key ?? null},
            ${sortOrder},
            ${data.is_default ?? true}
        )
        RETURNING
            key,
            label,
            color,
            includes_movement,
            movement_type,
            movement_type_key,
            sort_order,
            is_default,
            created_at::text AS created_at,
            updated_at::text AS updated_at
    `) as SpecialServiceStatusRow[];
    return rows[0];
}

export async function updateSpecialServiceStatus(
    key: string,
    data: SpecialServiceStatusInput
): Promise<SpecialServiceStatusRow | null> {
    await ensureSpecialServiceStatusesTable();
    const sql = getSql();
    const rows = (await sql`
        UPDATE special_service_statuses SET
            label = ${data.label.trim()},
            color = ${data.color.trim()},
            includes_movement = ${data.includes_movement},
            movement_type = ${data.movement_type},
            movement_type_key = ${data.movement_type_key ?? null},
            is_default = COALESCE(${data.is_default ?? null}::boolean, is_default),
            updated_at = NOW()
        WHERE key = ${key}
        RETURNING
            key,
            label,
            color,
            includes_movement,
            movement_type,
            movement_type_key,
            sort_order,
            is_default,
            created_at::text AS created_at,
            updated_at::text AS updated_at
    `) as SpecialServiceStatusRow[];
    return rows[0] ?? null;
}

async function countRecordsWithStatus(key: string): Promise<number> {
    const sql = getSql();
    const tableCheck = (await sql`
        SELECT to_regclass('public.special_service_records')::text AS table_name
    `) as { table_name: string | null }[];
    if (!tableCheck[0]?.table_name) return 0;
    const rows = (await sql`
        SELECT COUNT(*)::int AS count
        FROM special_service_records
        WHERE status = ${key}
    `) as { count: number }[];
    return rows[0]?.count ?? 0;
}

export async function deleteSpecialServiceStatus(key: string): Promise<void> {
    await ensureSpecialServiceStatusesTable();
    const inUse = await countRecordsWithStatus(key);
    if (inUse > 0) {
        throw new Error(
            `No se puede eliminar el estado porque hay ${inUse} registro${inUse === 1 ? "" : "s"} que lo utilizan.`
        );
    }
    const sql = getSql();
    await sql`DELETE FROM special_service_statuses WHERE key = ${key}`;
    await normalizeSpecialServiceStatusOrder();
}

async function normalizeSpecialServiceStatusOrder(): Promise<void> {
    const sql = getSql();
    const rows = (await sql`
        SELECT key
        FROM special_service_statuses
        ORDER BY sort_order ASC, label ASC
    `) as { key: string }[];
    for (let index = 0; index < rows.length; index += 1) {
        await sql`
            UPDATE special_service_statuses
            SET sort_order = ${index}, updated_at = NOW()
            WHERE key = ${rows[index].key}
              AND sort_order <> ${index}
        `;
    }
}

export async function reorderSpecialServiceStatus(
    key: string,
    position: number
): Promise<SpecialServiceStatusRow[]> {
    await ensureSpecialServiceStatusesTable();
    const statuses = await getAllSpecialServiceStatuses();
    const currentIndex = statuses.findIndex((status) => status.key === key);
    if (currentIndex === -1) throw new Error("Estado no encontrado");
    const desiredIndex = Math.max(1, Math.min(Math.trunc(position) || 1, statuses.length)) - 1;
    if (currentIndex !== desiredIndex) {
        const [moved] = statuses.splice(currentIndex, 1);
        statuses.splice(desiredIndex, 0, moved);
        const sql = getSql();
        for (let index = 0; index < statuses.length; index += 1) {
            await sql`
                UPDATE special_service_statuses
                SET sort_order = ${index}, updated_at = NOW()
                WHERE key = ${statuses[index].key}
            `;
        }
    }
    return getAllSpecialServiceStatuses();
}
