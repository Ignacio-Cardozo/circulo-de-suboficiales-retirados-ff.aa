import { randomUUID } from "node:crypto";
import { getSql } from "./connection.js";

export type SpecialServiceRow = {
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

export async function ensureSpecialServicesTable(): Promise<void> {
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS special_services (
            id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            name            VARCHAR(255)    NOT NULL,
            detail          TEXT,
            member_price    NUMERIC(12,2)   NOT NULL DEFAULT 0,
            person_price    NUMERIC(12,2)   NOT NULL DEFAULT 0,
            deposit_cost    NUMERIC(12,2)   NOT NULL DEFAULT 0,
            created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
}

export async function getAllSpecialServices(): Promise<SpecialServiceRow[]> {
    await ensureSpecialServicesTable();
    const sql = getSql();
    const rows = (await sql`
        SELECT
            id,
            name,
            detail,
            member_price::float AS member_price,
            person_price::float AS person_price,
            deposit_cost::float AS deposit_cost,
            created_at::text AS created_at,
            updated_at::text AS updated_at
        FROM special_services
        ORDER BY name ASC
    `) as SpecialServiceRow[];
    return rows;
}

export async function getSpecialServiceById(id: string): Promise<SpecialServiceRow | null> {
    await ensureSpecialServicesTable();
    const sql = getSql();
    const rows = (await sql`
        SELECT
            id,
            name,
            detail,
            member_price::float AS member_price,
            person_price::float AS person_price,
            deposit_cost::float AS deposit_cost,
            created_at::text AS created_at,
            updated_at::text AS updated_at
        FROM special_services
        WHERE id = ${id}
        LIMIT 1
    `) as SpecialServiceRow[];
    return rows[0] ?? null;
}

export async function insertSpecialService(data: SpecialServiceInput): Promise<SpecialServiceRow> {
    await ensureSpecialServicesTable();
    const sql = getSql();
    const id = randomUUID();
    const rows = (await sql`
        INSERT INTO special_services (id, name, detail, member_price, person_price, deposit_cost)
        VALUES (
            ${id},
            ${data.name},
            ${data.detail ?? null},
            ${data.member_price ?? 0},
            ${data.person_price ?? 0},
            ${data.deposit_cost ?? 0}
        )
        RETURNING
            id,
            name,
            detail,
            member_price::float AS member_price,
            person_price::float AS person_price,
            deposit_cost::float AS deposit_cost,
            created_at::text AS created_at,
            updated_at::text AS updated_at
    `) as SpecialServiceRow[];
    return rows[0];
}

export async function updateSpecialService(id: string, data: SpecialServiceInput): Promise<SpecialServiceRow | null> {
    await ensureSpecialServicesTable();
    const sql = getSql();
    const rows = (await sql`
        UPDATE special_services SET
            name = ${data.name},
            detail = ${data.detail ?? null},
            member_price = ${data.member_price ?? 0},
            person_price = ${data.person_price ?? 0},
            deposit_cost = ${data.deposit_cost ?? 0},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING
            id,
            name,
            detail,
            member_price::float AS member_price,
            person_price::float AS person_price,
            deposit_cost::float AS deposit_cost,
            created_at::text AS created_at,
            updated_at::text AS updated_at
    `) as SpecialServiceRow[];
    return rows[0] ?? null;
}

export async function deleteSpecialService(id: string): Promise<void> {
    await ensureSpecialServicesTable();
    const sql = getSql();
    await sql`DELETE FROM special_services WHERE id = ${id}`;
}
