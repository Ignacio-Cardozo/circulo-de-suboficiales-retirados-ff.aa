import { randomUUID } from "node:crypto";
import { getSql } from "./connection.js";
import { runOnce } from "./runOnce.js";

export type ServiceRow = {
    id: string;
    name: string;
    amount: number;
    created_at: string;
    updated_at: string;
};

async function ensureServicesTableTask(): Promise<void> {
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS services (
            id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            name        VARCHAR(255)    NOT NULL,
            amount      NUMERIC(12,2)   NOT NULL DEFAULT 0,
            created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
}

export async function getAllServices(): Promise<ServiceRow[]> {
    await ensureServicesTable();
    const sql = getSql();
    const rows = (await sql`
        SELECT id, name, amount::float as amount, created_at, updated_at
        FROM services
        ORDER BY name ASC
    `) as ServiceRow[];
    return rows;
}

export async function insertService(name: string, amount: number): Promise<ServiceRow> {
    await ensureServicesTable();
    const sql = getSql();
    const id = randomUUID();
    const rows = (await sql`
        INSERT INTO services (id, name, amount)
        VALUES (${id}, ${name}, ${amount})
        RETURNING id, name, amount::float as amount, created_at, updated_at
    `) as ServiceRow[];
    return rows[0];
}

export async function updateService(id: string, name: string, amount: number): Promise<ServiceRow | null> {
    const sql = getSql();
    const rows = (await sql`
        UPDATE services SET name = ${name}, amount = ${amount}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, name, amount::float as amount, created_at, updated_at
    `) as ServiceRow[];
    return rows[0] ?? null;
}

export async function deleteService(id: string): Promise<void> {
    const sql = getSql();
    await sql`DELETE FROM services WHERE id = ${id}`;
}

// Preparación del esquema: una sola vez por proceso del servidor (ver runOnce).
export const ensureServicesTable = runOnce(ensureServicesTableTask);
