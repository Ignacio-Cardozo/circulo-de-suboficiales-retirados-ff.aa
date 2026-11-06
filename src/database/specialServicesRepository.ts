import { randomUUID } from "node:crypto";
import { getSql } from "./connection.js";
import { runOnce } from "./runOnce.js";

export type SpecialServiceRow = {
    id: string;
    name: string;
    detail: string | null;
    member_price: number;
    person_price: number;
    deposit_cost: number;
    /** Costo del seguro (monto sugerido para el pago y la devolución del seguro). */
    insurance_cost: number;
    /** true: usa su propia lista de estados (special_service_status_assignments). false: usa la lista base. */
    custom_statuses: boolean;
    /** true: usa su propia lista de movimientos (special_service_movement_type_assignments). false: usa la lista base. */
    custom_movement_types: boolean;
    created_at: string;
    updated_at: string;
};

export type SpecialServiceInput = {
    name: string;
    detail?: string | null;
    member_price?: number;
    person_price?: number;
    deposit_cost?: number;
    insurance_cost?: number;
};

async function ensureSpecialServicesTableTask(): Promise<void> {
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
    await sql`ALTER TABLE special_services ADD COLUMN IF NOT EXISTS insurance_cost NUMERIC(12,2) NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE special_services ADD COLUMN IF NOT EXISTS custom_statuses BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE special_services ADD COLUMN IF NOT EXISTS custom_movement_types BOOLEAN NOT NULL DEFAULT FALSE`;
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
            insurance_cost::float AS insurance_cost,
            custom_statuses,
            custom_movement_types,
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
            insurance_cost::float AS insurance_cost,
            custom_statuses,
            custom_movement_types,
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
        INSERT INTO special_services (id, name, detail, member_price, person_price, deposit_cost, insurance_cost)
        VALUES (
            ${id},
            ${data.name},
            ${data.detail ?? null},
            ${data.member_price ?? 0},
            ${data.person_price ?? 0},
            ${data.deposit_cost ?? 0},
            ${data.insurance_cost ?? 0}
        )
        RETURNING
            id,
            name,
            detail,
            member_price::float AS member_price,
            person_price::float AS person_price,
            deposit_cost::float AS deposit_cost,
            insurance_cost::float AS insurance_cost,
            custom_statuses,
            custom_movement_types,
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
            insurance_cost = ${data.insurance_cost ?? 0},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING
            id,
            name,
            detail,
            member_price::float AS member_price,
            person_price::float AS person_price,
            deposit_cost::float AS deposit_cost,
            insurance_cost::float AS insurance_cost,
            custom_statuses,
            custom_movement_types,
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

// Preparación del esquema: una sola vez por proceso del servidor (ver runOnce).
export const ensureSpecialServicesTable = runOnce(ensureSpecialServicesTableTask);
