import { randomUUID } from "node:crypto";
import { getSql } from "./connection.js";
import type { ServiceRecordWithDetails } from "./types.js";
import { runOnce } from "./runOnce.js";

async function migrateServiceRecordsSchemaTask(): Promise<void> {
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS service_records (
            id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            service_id      UUID            REFERENCES services(id) ON DELETE SET NULL,
            member_id       UUID            REFERENCES members(id) ON DELETE SET NULL,
            person_id       UUID            REFERENCES persons(id) ON DELETE SET NULL,
            movement_id     UUID            REFERENCES petty_cash(id) ON DELETE SET NULL,
            amount          NUMERIC(12,2)   NOT NULL DEFAULT 0,
            date            DATE            NOT NULL,
            service_date    DATE,
            detail          TEXT,
            created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_service_records_service_id ON service_records (service_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_service_records_member_id ON service_records (member_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_service_records_person_id ON service_records (person_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_service_records_movement_id ON service_records (movement_id)`;
    await sql`ALTER TABLE service_records ADD COLUMN IF NOT EXISTS service_date DATE`;
}

export async function getAllServiceRecords(): Promise<ServiceRecordWithDetails[]> {
    const sql = getSql();
    const rows = await sql`
        SELECT
            sr.id,
            sr.service_id,
            s.name AS service_name,
            s.amount::float AS service_amount,
            sr.member_id,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            sr.person_id,
            p.nombre AS person_nombre,
            sr.movement_id,
            pc.amount::float AS movement_amount,
            sr.amount::float AS amount,
            sr.date::text AS date,
            sr.service_date::text AS service_date,
            sr.detail,
            sr.created_at::text AS created_at,
            sr.updated_at::text AS updated_at
        FROM service_records sr
        LEFT JOIN services s ON sr.service_id = s.id
        LEFT JOIN members m ON sr.member_id = m.id
        LEFT JOIN persons p ON sr.person_id = p.id
        LEFT JOIN petty_cash pc ON sr.movement_id = pc.id
        WHERE (pc.anulado = false OR sr.movement_id IS NULL)
        ORDER BY sr.date DESC, sr.created_at DESC
    `;
    return rows as ServiceRecordWithDetails[];
}

export async function getServiceRecordById(id: string): Promise<ServiceRecordWithDetails | null> {
    const sql = getSql();
    const rows = await sql`
        SELECT
            sr.id,
            sr.service_id,
            s.name AS service_name,
            s.amount::float AS service_amount,
            sr.member_id,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            sr.person_id,
            p.nombre AS person_nombre,
            sr.movement_id,
            pc.amount::float AS movement_amount,
            sr.amount::float AS amount,
            sr.date::text AS date,
            sr.service_date::text AS service_date,
            sr.detail,
            sr.created_at::text AS created_at,
            sr.updated_at::text AS updated_at
        FROM service_records sr
        LEFT JOIN services s ON sr.service_id = s.id
        LEFT JOIN members m ON sr.member_id = m.id
        LEFT JOIN persons p ON sr.person_id = p.id
        LEFT JOIN petty_cash pc ON sr.movement_id = pc.id
        WHERE sr.id = ${id}
        LIMIT 1
    `;
    const result = rows as ServiceRecordWithDetails[];
    return result.length > 0 ? result[0] : null;
}

export async function getServiceRecordsByMember(memberId: string): Promise<ServiceRecordWithDetails[]> {
    const sql = getSql();
    const rows = await sql`
        SELECT
            sr.id,
            sr.service_id,
            s.name AS service_name,
            s.amount::float AS service_amount,
            sr.member_id,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            sr.person_id,
            p.nombre AS person_nombre,
            sr.movement_id,
            pc.amount::float AS movement_amount,
            sr.amount::float AS amount,
            sr.date::text AS date,
            sr.service_date::text AS service_date,
            sr.detail,
            sr.created_at::text AS created_at,
            sr.updated_at::text AS updated_at
        FROM service_records sr
        LEFT JOIN services s ON sr.service_id = s.id
        LEFT JOIN members m ON sr.member_id = m.id
        LEFT JOIN persons p ON sr.person_id = p.id
        LEFT JOIN petty_cash pc ON sr.movement_id = pc.id
        WHERE sr.member_id = ${memberId}
          AND (pc.anulado = false OR sr.movement_id IS NULL)
        ORDER BY sr.date DESC, sr.created_at DESC
    `;
    return rows as ServiceRecordWithDetails[];
}

export async function getServiceRecordsByPerson(personId: string): Promise<ServiceRecordWithDetails[]> {
    const sql = getSql();
    const rows = await sql`
        SELECT
            sr.id,
            sr.service_id,
            s.name AS service_name,
            s.amount::float AS service_amount,
            sr.member_id,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            sr.person_id,
            p.nombre AS person_nombre,
            sr.movement_id,
            pc.amount::float AS movement_amount,
            sr.amount::float AS amount,
            sr.date::text AS date,
            sr.service_date::text AS service_date,
            sr.detail,
            sr.created_at::text AS created_at,
            sr.updated_at::text AS updated_at
        FROM service_records sr
        LEFT JOIN services s ON sr.service_id = s.id
        LEFT JOIN members m ON sr.member_id = m.id
        LEFT JOIN persons p ON sr.person_id = p.id
        LEFT JOIN petty_cash pc ON sr.movement_id = pc.id
        WHERE sr.person_id = ${personId}
          AND (pc.anulado = false OR sr.movement_id IS NULL)
        ORDER BY sr.date DESC, sr.created_at DESC
    `;
    return rows as ServiceRecordWithDetails[];
}

export async function getServiceRecordsByMovement(movementId: string): Promise<ServiceRecordWithDetails[]> {
    const sql = getSql();
    const rows = await sql`
        SELECT
            sr.id,
            sr.service_id,
            s.name AS service_name,
            s.amount::float AS service_amount,
            sr.member_id,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            sr.person_id,
            p.nombre AS person_nombre,
            sr.movement_id,
            pc.amount::float AS movement_amount,
            sr.amount::float AS amount,
            sr.date::text AS date,
            sr.service_date::text AS service_date,
            sr.detail,
            sr.created_at::text AS created_at,
            sr.updated_at::text AS updated_at
        FROM service_records sr
        LEFT JOIN services s ON sr.service_id = s.id
        LEFT JOIN members m ON sr.member_id = m.id
        LEFT JOIN persons p ON sr.person_id = p.id
        LEFT JOIN petty_cash pc ON sr.movement_id = pc.id
        WHERE sr.movement_id = ${movementId}
        ORDER BY sr.date DESC, sr.created_at DESC
    `;
    return rows as ServiceRecordWithDetails[];
}

export async function insertServiceRecord(data: {
    service_id?: string | null;
    member_id?: string | null;
    person_id?: string | null;
    movement_id?: string | null;
    amount: number;
    date: string;
    service_date?: string | null;
    detail?: string | null;
}): Promise<ServiceRecordWithDetails> {
    const sql = getSql();
    const id = randomUUID();
    await sql`
        INSERT INTO service_records (id, service_id, member_id, person_id, movement_id, amount, date, service_date, detail)
        VALUES (${id}, ${data.service_id ?? null}, ${data.member_id ?? null}, ${data.person_id ?? null}, ${data.movement_id ?? null}, ${data.amount}, ${data.date}, ${data.service_date ?? null}, ${data.detail ?? null})
    `;
    const record = await getServiceRecordById(id);
    return record!;
}

export async function updateServiceRecord(
    id: string,
    data: {
        service_id?: string;
        member_id?: string | null;
        person_id?: string | null;
        movement_id?: string | null;
        amount?: number;
        date?: string;
        service_date?: string | null;
        detail?: string | null;
    }
): Promise<ServiceRecordWithDetails | null> {
    const sql = getSql();
    await sql`
        UPDATE service_records SET
            service_id = COALESCE(${data.service_id ?? null}, service_id),
            member_id = COALESCE(${data.member_id ?? null}, member_id),
            person_id = COALESCE(${data.person_id ?? null}, person_id),
            movement_id = COALESCE(${data.movement_id ?? null}, movement_id),
            amount = COALESCE(${data.amount ?? null}, amount),
            date = COALESCE(${data.date ?? null}, date),
            service_date = ${data.service_date ?? null},
            detail = COALESCE(${data.detail ?? null}, detail),
            updated_at = NOW()
        WHERE id = ${id}
    `;
    return getServiceRecordById(id);
}

export async function deleteServiceRecord(id: string): Promise<void> {
    const sql = getSql();
    await sql`DELETE FROM service_records WHERE id = ${id}`;
}

export async function deleteServiceRecordsByMovement(movementId: string): Promise<boolean> {
    const sql = getSql();
    const result = await sql`DELETE FROM service_records WHERE movement_id = ${movementId}`;
    return (result as unknown as { count: number })?.count > 0;
}

// Preparación del esquema: una sola vez por proceso del servidor (ver runOnce).
export const migrateServiceRecordsSchema = runOnce(migrateServiceRecordsSchemaTask);
