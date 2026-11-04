import { randomUUID } from "node:crypto";
import { getSql } from "./connection.js";
import { getNextAndIncrementReceipt } from "./initialBalancesRepository.js";
import { getComprobanteByMovementId, insertComprobante, type ComprobanteRow } from "./comprobantesRepository.js";
import { insertMovement } from "./pettyCashRepository.js";
import { migrateSpecialServiceRecordsSchema } from "./specialServiceRecordsRepository.js";

export type MovementDirection = "ingreso" | "egreso";
export type MovementMode = "efectivo" | "transferencia";

export type SpecialServiceMovementTypeRow = {
    key: string;
    label: string;
    includes_movement: boolean;
    movement_type: MovementDirection;
    sort_order: number;
    /** Forma parte de la lista base que usan los servicios sin configuración propia. */
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

export const DEFAULT_SPECIAL_SERVICE_MOVEMENT_TYPES: Array<
    SpecialServiceMovementTypeInput & { key: string; sort_order: number }
> = [
    {
        key: "sena",
        label: "Pago de seña",
        includes_movement: true,
        movement_type: "ingreso",
        sort_order: 0,
        is_default: true,
    },
    {
        key: "pago",
        label: "Pago del servicio",
        includes_movement: true,
        movement_type: "ingreso",
        sort_order: 1,
        is_default: true,
    },
    {
        key: "devolucion_seguro",
        label: "Devolución del seguro",
        includes_movement: true,
        movement_type: "egreso",
        sort_order: 2,
        is_default: true,
    },
    {
        key: "pago_de_seguro",
        label: "Pago de Seguro",
        includes_movement: true,
        movement_type: "ingreso",
        sort_order: 3,
        is_default: true,
    },
];

export async function ensureSpecialServiceMovementTypesTable(): Promise<void> {
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS special_service_movement_types (
            key                 VARCHAR(80)     PRIMARY KEY,
            label               VARCHAR(255)    NOT NULL,
            includes_movement   BOOLEAN         NOT NULL DEFAULT TRUE,
            movement_type       VARCHAR(20)     NOT NULL DEFAULT 'ingreso',
            sort_order          INT             NOT NULL DEFAULT 0,
            created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
    await sql`
        ALTER TABLE special_service_movement_types
        ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT TRUE
    `;
}

export async function ensureSpecialServiceRecordMovementsTable(): Promise<void> {
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS special_service_record_movements (
            id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            record_id           UUID            NOT NULL REFERENCES special_service_records(id) ON DELETE CASCADE,
            movement_type_key   VARCHAR(80)     REFERENCES special_service_movement_types(key) ON DELETE SET NULL,
            label               VARCHAR(255)    NOT NULL,
            movement_type       VARCHAR(20)     NOT NULL DEFAULT 'ingreso',
            includes_movement   BOOLEAN         NOT NULL DEFAULT TRUE,
            amount              NUMERIC(12,2)   NOT NULL DEFAULT 0,
            date                DATE            NOT NULL,
            mode                VARCHAR(20)     NOT NULL DEFAULT 'efectivo',
            movement_id         UUID            REFERENCES petty_cash(id) ON DELETE SET NULL,
            created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_special_service_record_movements_record_id ON special_service_record_movements (record_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_special_service_record_movements_movement_id ON special_service_record_movements (movement_id)`;
}

export async function migrateSpecialServiceMovementTypesSchema(): Promise<void> {
    await migrateSpecialServiceRecordsSchema();
    await ensureSpecialServiceMovementTypesTable();
    await ensureSpecialServiceRecordMovementsTable();
    const sql = getSql();
    const countRows = (await sql`
        SELECT COUNT(*)::int AS count
        FROM special_service_movement_types
    `) as { count: number }[];

    if ((countRows[0]?.count ?? 0) === 0) {
        for (const movementType of DEFAULT_SPECIAL_SERVICE_MOVEMENT_TYPES) {
            await sql`
                INSERT INTO special_service_movement_types (
                    key, label, includes_movement, movement_type, sort_order, is_default
                )
                VALUES (
                    ${movementType.key},
                    ${movementType.label},
                    ${movementType.includes_movement},
                    ${movementType.movement_type},
                    ${movementType.sort_order},
                    ${movementType.is_default ?? true}
                )
                ON CONFLICT (key) DO NOTHING
            `;
        }
    }

    const legacyColumns = (await sql`
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'special_service_records'
          AND column_name = 'movement_sena_id'
        LIMIT 1
    `) as { "?column?": number }[];

    if (legacyColumns.length > 0) {
        await sql`
            INSERT INTO special_service_record_movements (
                id, record_id, movement_type_key, label, movement_type, includes_movement, amount, date, mode, movement_id
            )
            SELECT
                gen_random_uuid(),
                sr.id,
                (SELECT key FROM special_service_movement_types WHERE key = 'sena'),
                COALESCE(mt.label, 'Pago de seña'),
                COALESCE(mt.movement_type, 'ingreso'),
                COALESCE(mt.includes_movement, true),
                pc.amount,
                pc.date,
                COALESCE(pc.mode, 'efectivo'),
                pc.id
            FROM special_service_records sr
            INNER JOIN petty_cash pc ON pc.id = sr.movement_sena_id
            LEFT JOIN special_service_movement_types mt ON mt.key = 'sena'
            WHERE sr.movement_sena_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM special_service_record_movements srm
                  WHERE srm.record_id = sr.id AND srm.movement_id = sr.movement_sena_id
              )
        `;
        await sql`ALTER TABLE special_service_records DROP COLUMN movement_sena_id`;
    }
}

export async function getAllSpecialServiceMovementTypes(): Promise<SpecialServiceMovementTypeRow[]> {
    await migrateSpecialServiceMovementTypesSchema();
    const sql = getSql();
    const rows = (await sql`
        SELECT
            key,
            label,
            includes_movement,
            movement_type,
            sort_order,
            is_default,
            created_at::text AS created_at,
            updated_at::text AS updated_at
        FROM special_service_movement_types
        ORDER BY sort_order ASC, label ASC
    `) as SpecialServiceMovementTypeRow[];
    return rows;
}

export async function getSpecialServiceMovementTypeByKey(
    key: string
): Promise<SpecialServiceMovementTypeRow | null> {
    await ensureSpecialServiceMovementTypesTable();
    const sql = getSql();
    const rows = (await sql`
        SELECT
            key,
            label,
            includes_movement,
            movement_type,
            sort_order,
            is_default,
            created_at::text AS created_at,
            updated_at::text AS updated_at
        FROM special_service_movement_types
        WHERE key = ${key}
        LIMIT 1
    `) as SpecialServiceMovementTypeRow[];
    return rows[0] ?? null;
}

export async function specialServiceMovementTypeExists(key: string): Promise<boolean> {
    const type = await getSpecialServiceMovementTypeByKey(key);
    return type !== null;
}

function slugifyMovementType(value: string): string {
    const slug = value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60);
    return slug || "movimiento";
}

async function buildUniqueMovementTypeKey(label: string): Promise<string> {
    const sql = getSql();
    const base = slugifyMovementType(label);
    const rows = (await sql`
        SELECT key
        FROM special_service_movement_types
        WHERE key = ${base} OR key LIKE ${`${base}_%`}
    `) as { key: string }[];
    const existing = new Set(rows.map((row) => row.key));
    if (!existing.has(base)) return base;
    let suffix = 2;
    while (existing.has(`${base}_${suffix}`)) suffix += 1;
    return `${base}_${suffix}`;
}

export async function insertSpecialServiceMovementType(
    data: SpecialServiceMovementTypeInput
): Promise<SpecialServiceMovementTypeRow> {
    await ensureSpecialServiceMovementTypesTable();
    const sql = getSql();
    const key = await buildUniqueMovementTypeKey(data.label);
    const orderRows = (await sql`
        SELECT COALESCE(MAX(sort_order) + 1, 0)::int AS next_order
        FROM special_service_movement_types
    `) as { next_order: number }[];
    const sortOrder = orderRows[0]?.next_order ?? 0;
    const rows = (await sql`
        INSERT INTO special_service_movement_types (
            key, label, includes_movement, movement_type, sort_order, is_default
        )
        VALUES (
            ${key},
            ${data.label.trim()},
            ${data.includes_movement},
            ${data.movement_type},
            ${sortOrder},
            ${data.is_default ?? true}
        )
        RETURNING
            key,
            label,
            includes_movement,
            movement_type,
            sort_order,
            is_default,
            created_at::text AS created_at,
            updated_at::text AS updated_at
    `) as SpecialServiceMovementTypeRow[];
    return rows[0];
}

export async function updateSpecialServiceMovementType(
    key: string,
    data: SpecialServiceMovementTypeInput
): Promise<SpecialServiceMovementTypeRow | null> {
    await ensureSpecialServiceMovementTypesTable();
    const sql = getSql();
    const rows = (await sql`
        UPDATE special_service_movement_types SET
            label = ${data.label.trim()},
            includes_movement = ${data.includes_movement},
            movement_type = ${data.movement_type},
            is_default = COALESCE(${data.is_default ?? null}::boolean, is_default),
            updated_at = NOW()
        WHERE key = ${key}
        RETURNING
            key,
            label,
            includes_movement,
            movement_type,
            sort_order,
            is_default,
            created_at::text AS created_at,
            updated_at::text AS updated_at
    `) as SpecialServiceMovementTypeRow[];
    return rows[0] ?? null;
}

async function countMovementTypeUsage(key: string): Promise<number> {
    const sql = getSql();
    const rows = (await sql`
        SELECT COUNT(*)::int AS count
        FROM special_service_record_movements
        WHERE movement_type_key = ${key}
    `) as { count: number }[];
    return rows[0]?.count ?? 0;
}

export async function deleteSpecialServiceMovementType(key: string): Promise<void> {
    await migrateSpecialServiceMovementTypesSchema();
    const inUse = await countMovementTypeUsage(key);
    if (inUse > 0) {
        throw new Error(
            `No se puede eliminar el movimiento porque hay ${inUse} registro${inUse === 1 ? "" : "s"} que lo utilizan.`
        );
    }
    const sql = getSql();
    await sql`DELETE FROM special_service_movement_types WHERE key = ${key}`;
}

export type SpecialServiceRecordMovementRow = {
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
    comprobante?: ComprobanteRow | null;
};

export async function getSpecialServiceRecordMovements(
    recordId: string
): Promise<SpecialServiceRecordMovementRow[]> {
    await migrateSpecialServiceMovementTypesSchema();
    const sql = getSql();
    const rows = (await sql`
        SELECT
            m.id,
            m.record_id,
            m.movement_type_key,
            m.label,
            m.movement_type,
            m.includes_movement,
            m.amount::float AS amount,
            m.date::text AS date,
            m.mode,
            m.movement_id,
            pc.anulado AS movement_anulado,
            m.created_at::text AS created_at,
            m.updated_at::text AS updated_at
        FROM special_service_record_movements m
        LEFT JOIN petty_cash pc ON m.movement_id = pc.id
        WHERE m.record_id = ${recordId}
        ORDER BY m.date DESC, m.created_at DESC
    `) as SpecialServiceRecordMovementRow[];
    return rows;
}

async function getSpecialServiceRecordMovementById(
    id: string
): Promise<SpecialServiceRecordMovementRow | null> {
    const sql = getSql();
    const rows = (await sql`
        SELECT
            m.id,
            m.record_id,
            m.movement_type_key,
            m.label,
            m.movement_type,
            m.includes_movement,
            m.amount::float AS amount,
            m.date::text AS date,
            m.mode,
            m.movement_id,
            pc.anulado AS movement_anulado,
            m.created_at::text AS created_at,
            m.updated_at::text AS updated_at
        FROM special_service_record_movements m
        LEFT JOIN petty_cash pc ON m.movement_id = pc.id
        WHERE m.id = ${id}
        LIMIT 1
    `) as SpecialServiceRecordMovementRow[];
    return rows[0] ?? null;
}

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

export async function insertSpecialServiceRecordMovement(
    data: SpecialServiceRecordMovementInput
): Promise<SpecialServiceRecordMovementRow> {
    await migrateSpecialServiceMovementTypesSchema();
    const sql = getSql();

    const recordRows = (await sql`
        SELECT
            sr.id,
            ss.name AS service_name,
            m.nombre AS member_nombre,
            p.nombre AS person_nombre
        FROM special_service_records sr
        LEFT JOIN special_services ss ON sr.special_service_id = ss.id
        LEFT JOIN members m ON sr.member_id = m.id
        LEFT JOIN persons p ON sr.person_id = p.id
        WHERE sr.id = ${data.record_id}
        LIMIT 1
    `) as {
        id: string;
        service_name: string | null;
        member_nombre: string | null;
        person_nombre: string | null;
    }[];
    const record = recordRows[0];
    if (!record) {
        throw new Error("Registro de servicio especial no encontrado");
    }

    const movementType = data.movement_type_key
        ? await getSpecialServiceMovementTypeByKey(data.movement_type_key)
        : null;
    if (data.movement_type_key && !movementType) {
        throw new Error("Tipo de movimiento inválido");
    }

    // Un tipo de movimiento sólo puede estar registrado una vez por servicio, salvo que
    // el anterior se haya anulado (o se haya borrado su movimiento de caja).
    if (data.movement_type_key) {
        const activeRows = (await sql`
            SELECT m.label
            FROM special_service_record_movements m
            LEFT JOIN petty_cash pc ON pc.id = m.movement_id
            WHERE m.record_id = ${data.record_id}
              AND m.movement_type_key = ${data.movement_type_key}
              AND COALESCE(pc.anulado, FALSE) = FALSE
              AND (m.includes_movement = FALSE OR m.movement_id IS NOT NULL)
            LIMIT 1
        `) as { label: string }[];
        if (activeRows.length > 0) {
            throw new Error(
                `Ya hay un "${activeRows[0].label}" registrado para este servicio. Anulalo para poder registrarlo de nuevo.`
            );
        }
    }

    const label = (data.label ?? movementType?.label ?? "Movimiento").trim();
    if (!label) {
        throw new Error("Falta el nombre del movimiento");
    }
    const movementTypeValue: MovementDirection =
        data.movement_type ?? movementType?.movement_type ?? "ingreso";
    const includesMovement =
        data.includes_movement ?? movementType?.includes_movement ?? true;
    const amount = Number.isFinite(data.amount) ? data.amount : 0;
    const mode: MovementMode = data.mode === "transferencia" ? "transferencia" : "efectivo";

    const detail = record.service_name ? `${label} - ${record.service_name}` : label;
    let movementId: string | null = null;
    if (includesMovement) {
        movementId = await insertMovement({
            date: data.date,
            detail,
            amount,
            type: movementTypeValue,
            mode,
            concept: null,
        });
    }

    const id = randomUUID();
    await sql`
        INSERT INTO special_service_record_movements (
            id,
            record_id,
            movement_type_key,
            label,
            movement_type,
            includes_movement,
            amount,
            date,
            mode,
            movement_id
        )
        VALUES (
            ${id},
            ${data.record_id},
            ${data.movement_type_key ?? null},
            ${label},
            ${movementTypeValue},
            ${includesMovement},
            ${amount},
            ${data.date},
            ${mode},
            ${movementId}
        )
    `;

    let comprobante: ComprobanteRow | null = null;
    if (movementId) {
        const receiptNumber = await getNextAndIncrementReceipt(movementTypeValue);
        await insertComprobante({
            movement_id: movementId,
            receipt_number: receiptNumber,
            copies_to_print: 1,
            detail,
            concept: label,
            payer_name: record.member_nombre ?? record.person_nombre ?? null,
        });
        comprobante = await getComprobanteByMovementId(movementId);
    }

    const created = await getSpecialServiceRecordMovementById(id);
    return { ...created!, comprobante };
}

export async function deleteSpecialServiceRecordMovement(id: string): Promise<void> {
    await migrateSpecialServiceMovementTypesSchema();
    const sql = getSql();
    await sql`DELETE FROM special_service_record_movements WHERE id = ${id}`;
}
