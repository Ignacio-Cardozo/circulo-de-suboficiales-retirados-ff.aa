import { randomUUID } from "node:crypto";
import { getSql } from "./connection.js";
import { runOnce } from "./runOnce.js";

export type ExternalServiceRow = {
    id: string;
    name: string;
    phone: string | null;
    description: string | null;
    frequency: string;
    start_month: number | null;
    active: boolean;
    created_at: string;
    updated_at: string;
};

async function ensureExternalServicesTableTask(): Promise<void> {
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS external_services (
            id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            name          VARCHAR(255)    NOT NULL,
            phone         VARCHAR(100),
            description   TEXT,
            frequency     VARCHAR(20)     NOT NULL DEFAULT 'mensual',
            start_month   INTEGER,
            active        BOOLEAN         NOT NULL DEFAULT TRUE,
            created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
}

export async function getAllExternalServices(): Promise<ExternalServiceRow[]> {
    await ensureExternalServicesTable();
    const sql = getSql();
    const rows = (await sql`
        SELECT id, name, phone, description, frequency, start_month, active, created_at, updated_at
        FROM external_services
        ORDER BY name ASC
    `) as ExternalServiceRow[];
    return rows;
}

export async function insertExternalService(name: string, phone: string | null, description: string | null, frequency: string, startMonth: number | null): Promise<ExternalServiceRow> {
    await ensureExternalServicesTable();
    const sql = getSql();
    const id = randomUUID();
    const rows = (await sql`
        INSERT INTO external_services (id, name, phone, description, frequency, start_month)
        VALUES (${id}, ${name}, ${phone}, ${description}, ${frequency}, ${startMonth})
        RETURNING id, name, phone, description, frequency, start_month, active, created_at, updated_at
    `) as ExternalServiceRow[];
    return rows[0];
}

export async function updateExternalService(id: string, name: string, phone: string | null, description: string | null, frequency: string, startMonth: number | null, active: boolean): Promise<ExternalServiceRow | null> {
    const sql = getSql();
    const rows = (await sql`
        UPDATE external_services SET name = ${name}, phone = ${phone}, description = ${description}, frequency = ${frequency}, start_month = ${startMonth}, active = ${active}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, name, phone, description, frequency, start_month, active, created_at, updated_at
    `) as ExternalServiceRow[];
    return rows[0] ?? null;
}

export async function deleteExternalService(id: string): Promise<void> {
    const sql = getSql();
    await sql`DELETE FROM external_services WHERE id = ${id}`;
}

// Preparación del esquema: una sola vez por proceso del servidor (ver runOnce).
export const ensureExternalServicesTable = runOnce(ensureExternalServicesTableTask);
