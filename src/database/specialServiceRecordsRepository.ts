import { randomUUID } from "node:crypto";
import { getSql } from "./connection.js";
import { ensureSpecialServicesTable } from "./specialServicesRepository.js";
import { ensureSpecialServiceAddonsTable } from "./specialServiceAddonsRepository.js";
import {
    CANCELED_SPECIAL_SERVICE_STATUS_KEY,
    ensureCanceledSpecialServiceStatus,
    ensureSpecialServiceStatusesTable,
} from "./specialServiceStatusesRepository.js";
import { runOnce } from "./runOnce.js";

export type SpecialServiceRecordAddonRow = {
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

export type SpecialServiceRecordWithDetails = {
    id: string;
    special_service_id: string | null;
    special_service_name: string | null;
    special_service_detail: string | null;
    member_price: number | null;
    person_price: number | null;
    deposit_cost: number | null;
    insurance_cost: number | null;
    member_id: string | null;
    member_nombre: string | null;
    member_numero_de_socio: string | null;
    person_id: string | null;
    person_nombre: string | null;
    amount: number;
    date: string;
    service_date: string | null;
    /** Mensaje adicional opcional del servicio agendado. */
    detail: string | null;
    status: string;
    addons: SpecialServiceRecordAddonRow[];
    created_at: string;
    updated_at: string;
};

type SpecialServiceRecordBaseRow = Omit<SpecialServiceRecordWithDetails, "addons">;

export type SpecialServiceRecordInput = {
    special_service_id?: string | null;
    member_id?: string | null;
    person_id?: string | null;
    amount?: number;
    date: string;
    service_date?: string | null;
    detail?: string | null;
    status?: string;
    addons?: SpecialServiceRecordAddonInput[];
};

/** Normaliza el detalle opcional: sin espacios de más, vacío como null, hasta 1000 caracteres. */
export function parseSpecialServiceRecordDetail(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "string") return null;
    const trimmed = value.trim().slice(0, 1000);
    return trimmed || null;
}

async function migrateSpecialServiceRecordsSchemaTask(): Promise<void> {
    const sql = getSql();
    await ensureSpecialServicesTable();
    await ensureSpecialServiceAddonsTable();
    await ensureSpecialServiceStatusesTable();
    await sql`
        CREATE TABLE IF NOT EXISTS special_service_records (
            id                  UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
            special_service_id  UUID                        REFERENCES special_services(id) ON DELETE SET NULL,
            member_id           UUID                        REFERENCES members(id) ON DELETE SET NULL,
            person_id           UUID                        REFERENCES persons(id) ON DELETE SET NULL,
            amount              NUMERIC(12,2)               NOT NULL DEFAULT 0,
            date                DATE                        NOT NULL,
            service_date        DATE,
            status              TEXT                        NOT NULL DEFAULT 'registrado',
            created_at          TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
        )
    `;
    const statusColumns = (await sql`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'special_service_records'
          AND column_name = 'status'
        LIMIT 1
    `) as { data_type: string }[];
    if (statusColumns[0] && statusColumns[0].data_type !== "text") {
        await sql`ALTER TABLE special_service_records ALTER COLUMN status DROP DEFAULT`;
        await sql`ALTER TABLE special_service_records ALTER COLUMN status TYPE TEXT USING status::text`;
        await sql`ALTER TABLE special_service_records ALTER COLUMN status SET DEFAULT 'registrado'`;
    }
    await sql`ALTER TABLE special_service_records ADD COLUMN IF NOT EXISTS detail TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS idx_special_service_records_service_id ON special_service_records (special_service_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_special_service_records_member_id ON special_service_records (member_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_special_service_records_person_id ON special_service_records (person_id)`;
    await sql`
        CREATE TABLE IF NOT EXISTS special_service_record_addons (
            id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            record_id           UUID            NOT NULL REFERENCES special_service_records(id) ON DELETE CASCADE,
            addon_id            UUID            REFERENCES special_service_addons(id) ON DELETE SET NULL,
            name                VARCHAR(255)    NOT NULL,
            cost                NUMERIC(12,2)   NOT NULL DEFAULT 0,
            created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_special_service_record_addons_record_id ON special_service_record_addons (record_id)`;
}

async function attachRecordAddons(
    records: SpecialServiceRecordBaseRow[]
): Promise<SpecialServiceRecordWithDetails[]> {
    if (records.length === 0) return [];
    const sql = getSql();
    const recordIds = records.map((record) => record.id);
    const rows = (await sql`
        SELECT
            id,
            record_id,
            addon_id,
            name,
            cost::float AS cost,
            created_at::text AS created_at,
            updated_at::text AS updated_at
        FROM special_service_record_addons
        WHERE record_id = ANY(${recordIds})
        ORDER BY name ASC
    `) as SpecialServiceRecordAddonRow[];
    const addonsByRecord = new Map<string, SpecialServiceRecordAddonRow[]>();
    for (const row of rows) {
        const list = addonsByRecord.get(row.record_id) ?? [];
        list.push(row);
        addonsByRecord.set(row.record_id, list);
    }
    return records.map((record) => ({
        ...record,
        addons: addonsByRecord.get(record.id) ?? [],
    }));
}

export async function getAllSpecialServiceRecords(): Promise<SpecialServiceRecordWithDetails[]> {
    await migrateSpecialServiceRecordsSchema();
    const sql = getSql();
    const rows = (await sql`
        SELECT
            sr.id,
            sr.special_service_id,
            ss.name AS special_service_name,
            ss.detail AS special_service_detail,
            ss.member_price::float AS member_price,
            ss.person_price::float AS person_price,
            ss.deposit_cost::float AS deposit_cost,
            ss.insurance_cost::float AS insurance_cost,
            sr.member_id,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            sr.person_id,
            p.nombre AS person_nombre,
            sr.amount::float AS amount,
            sr.date::text AS date,
            sr.service_date::text AS service_date,
            sr.detail,
            sr.status,
            sr.created_at::text AS created_at,
            sr.updated_at::text AS updated_at
        FROM special_service_records sr
        LEFT JOIN special_services ss ON sr.special_service_id = ss.id
        LEFT JOIN members m ON sr.member_id = m.id
        LEFT JOIN persons p ON sr.person_id = p.id
        ORDER BY sr.date DESC, sr.created_at DESC
    `) as SpecialServiceRecordBaseRow[];
    return attachRecordAddons(rows);
}

export async function getSpecialServiceRecordById(id: string): Promise<SpecialServiceRecordWithDetails | null> {
    await migrateSpecialServiceRecordsSchema();
    const sql = getSql();
    const rows = (await sql`
        SELECT
            sr.id,
            sr.special_service_id,
            ss.name AS special_service_name,
            ss.detail AS special_service_detail,
            ss.member_price::float AS member_price,
            ss.person_price::float AS person_price,
            ss.deposit_cost::float AS deposit_cost,
            ss.insurance_cost::float AS insurance_cost,
            sr.member_id,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            sr.person_id,
            p.nombre AS person_nombre,
            sr.amount::float AS amount,
            sr.date::text AS date,
            sr.service_date::text AS service_date,
            sr.detail,
            sr.status,
            sr.created_at::text AS created_at,
            sr.updated_at::text AS updated_at
        FROM special_service_records sr
        LEFT JOIN special_services ss ON sr.special_service_id = ss.id
        LEFT JOIN members m ON sr.member_id = m.id
        LEFT JOIN persons p ON sr.person_id = p.id
        WHERE sr.id = ${id}
        LIMIT 1
    `) as SpecialServiceRecordBaseRow[];
    const record = rows[0] ?? null;
    if (!record) return null;
    const [withAddons] = await attachRecordAddons([record]);
    return withAddons;
}

export async function getSpecialServiceRecordsByMember(memberId: string): Promise<SpecialServiceRecordWithDetails[]> {
    await migrateSpecialServiceRecordsSchema();
    const sql = getSql();
    const rows = (await sql`
        SELECT
            sr.id,
            sr.special_service_id,
            ss.name AS special_service_name,
            ss.detail AS special_service_detail,
            ss.member_price::float AS member_price,
            ss.person_price::float AS person_price,
            ss.deposit_cost::float AS deposit_cost,
            ss.insurance_cost::float AS insurance_cost,
            sr.member_id,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            sr.person_id,
            p.nombre AS person_nombre,
            sr.amount::float AS amount,
            sr.date::text AS date,
            sr.service_date::text AS service_date,
            sr.detail,
            sr.status,
            sr.created_at::text AS created_at,
            sr.updated_at::text AS updated_at
        FROM special_service_records sr
        LEFT JOIN special_services ss ON sr.special_service_id = ss.id
        LEFT JOIN members m ON sr.member_id = m.id
        LEFT JOIN persons p ON sr.person_id = p.id
        WHERE sr.member_id = ${memberId}
        ORDER BY sr.date DESC, sr.created_at DESC
    `) as SpecialServiceRecordBaseRow[];
    return attachRecordAddons(rows);
}

export async function getSpecialServiceRecordsByPerson(personId: string): Promise<SpecialServiceRecordWithDetails[]> {
    await migrateSpecialServiceRecordsSchema();
    const sql = getSql();
    const rows = (await sql`
        SELECT
            sr.id,
            sr.special_service_id,
            ss.name AS special_service_name,
            ss.detail AS special_service_detail,
            ss.member_price::float AS member_price,
            ss.person_price::float AS person_price,
            ss.deposit_cost::float AS deposit_cost,
            ss.insurance_cost::float AS insurance_cost,
            sr.member_id,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            sr.person_id,
            p.nombre AS person_nombre,
            sr.amount::float AS amount,
            sr.date::text AS date,
            sr.service_date::text AS service_date,
            sr.detail,
            sr.status,
            sr.created_at::text AS created_at,
            sr.updated_at::text AS updated_at
        FROM special_service_records sr
        LEFT JOIN special_services ss ON sr.special_service_id = ss.id
        LEFT JOIN members m ON sr.member_id = m.id
        LEFT JOIN persons p ON sr.person_id = p.id
        WHERE sr.person_id = ${personId}
        ORDER BY sr.date DESC, sr.created_at DESC
    `) as SpecialServiceRecordBaseRow[];
    return attachRecordAddons(rows);
}

export async function getSpecialServiceRecordsByMovement(movementId: string): Promise<SpecialServiceRecordWithDetails[]> {
    await migrateSpecialServiceRecordsSchema();
    const sql = getSql();
    const rows = (await sql`
        SELECT
            sr.id,
            sr.special_service_id,
            ss.name AS special_service_name,
            ss.detail AS special_service_detail,
            ss.member_price::float AS member_price,
            ss.person_price::float AS person_price,
            ss.deposit_cost::float AS deposit_cost,
            ss.insurance_cost::float AS insurance_cost,
            sr.member_id,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            sr.person_id,
            p.nombre AS person_nombre,
            sr.amount::float AS amount,
            sr.date::text AS date,
            sr.service_date::text AS service_date,
            sr.detail,
            sr.status,
            sr.created_at::text AS created_at,
            sr.updated_at::text AS updated_at
        FROM special_service_records sr
        LEFT JOIN special_services ss ON sr.special_service_id = ss.id
        LEFT JOIN members m ON sr.member_id = m.id
        LEFT JOIN persons p ON sr.person_id = p.id
        WHERE EXISTS (
            SELECT 1
            FROM special_service_record_movements srm
            WHERE srm.record_id = sr.id AND srm.movement_id = ${movementId}
        )
        ORDER BY sr.date DESC, sr.created_at DESC
    `) as SpecialServiceRecordBaseRow[];
    return attachRecordAddons(rows);
}

export async function insertSpecialServiceRecord(data: SpecialServiceRecordInput): Promise<SpecialServiceRecordWithDetails> {
    await migrateSpecialServiceRecordsSchema();
    const sql = getSql();
    const id = randomUUID();
    await sql`
        INSERT INTO special_service_records (
            id, special_service_id, member_id, person_id, amount, date, service_date, detail, status
        )
        VALUES (
            ${id},
            ${data.special_service_id ?? null},
            ${data.member_id ?? null},
            ${data.person_id ?? null},
            ${data.amount ?? 0},
            ${data.date},
            ${data.service_date ?? null},
            ${data.detail ?? null},
            ${data.status ?? "registrado"}
        )
    `;
    for (const addon of data.addons ?? []) {
        const name = addon.name.trim();
        if (!name) continue;
        await sql`
            INSERT INTO special_service_record_addons (id, record_id, addon_id, name, cost)
            VALUES (
                ${randomUUID()},
                ${id},
                ${addon.addon_id ?? null},
                ${name},
                ${addon.cost ?? 0}
            )
        `;
    }
    const record = await getSpecialServiceRecordById(id);
    return record!;
}

export async function updateSpecialServiceRecord(
    id: string,
    data: Partial<SpecialServiceRecordInput>
): Promise<SpecialServiceRecordWithDetails | null> {
    await migrateSpecialServiceRecordsSchema();
    const sql = getSql();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    let idx = 1;

    if (data.special_service_id !== undefined) { fields.push(`special_service_id = $${idx++}`); values.push(data.special_service_id); }
    if (data.member_id !== undefined) { fields.push(`member_id = $${idx++}`); values.push(data.member_id); }
    if (data.person_id !== undefined) { fields.push(`person_id = $${idx++}`); values.push(data.person_id); }
    if (data.amount !== undefined) { fields.push(`amount = $${idx++}`); values.push(data.amount); }
    if (data.date !== undefined) { fields.push(`date = $${idx++}`); values.push(data.date); }
    if (data.service_date !== undefined) { fields.push(`service_date = $${idx++}`); values.push(data.service_date); }
    if (data.detail !== undefined) { fields.push(`detail = $${idx++}`); values.push(data.detail); }
    if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status); }

    if (fields.length > 0) {
        fields.push("updated_at = NOW()");
        values.push(id);
        await sql.query(
            `UPDATE special_service_records SET ${fields.join(", ")} WHERE id = $${idx}`,
            values
        );
    }
    return getSpecialServiceRecordById(id);
}

export async function cancelSpecialServiceRecord(
    id: string
): Promise<SpecialServiceRecordWithDetails | null> {
    await migrateSpecialServiceRecordsSchema();
    await ensureCanceledSpecialServiceStatus();
    const sql = getSql();
    const movementTable = (await sql`
        SELECT to_regclass('public.special_service_record_movements')::text AS table_name
    `) as { table_name: string | null }[];
    if (movementTable[0]?.table_name) {
        await sql`
            UPDATE petty_cash
            SET anulado = TRUE
            WHERE id IN (
                SELECT movement_id
                FROM special_service_record_movements
                WHERE record_id = ${id}
                  AND movement_id IS NOT NULL
            )
        `;
    }
    await sql`
        UPDATE special_service_records
        SET status = ${CANCELED_SPECIAL_SERVICE_STATUS_KEY}, updated_at = NOW()
        WHERE id = ${id}
    `;
    return getSpecialServiceRecordById(id);
}

// Preparación del esquema: una sola vez por proceso del servidor (ver runOnce).
export const migrateSpecialServiceRecordsSchema = runOnce(migrateSpecialServiceRecordsSchemaTask);
