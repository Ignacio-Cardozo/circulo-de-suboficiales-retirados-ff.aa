import { randomUUID } from "node:crypto";
import { getSql } from "./connection.js";
import { ensureSpecialServicesTable } from "./specialServicesRepository.js";
import { runOnce } from "./runOnce.js";

export type SpecialServiceAddonRow = {
    id: string;
    special_service_id: string;
    name: string;
    cost: number;
    created_at: string;
    updated_at: string;
};

export type SpecialServiceAddonInput = {
    special_service_id: string;
    name: string;
    cost?: number;
};

async function ensureSpecialServiceAddonsTableTask(): Promise<void> {
    const sql = getSql();
    await ensureSpecialServicesTable();
    await sql`
        CREATE TABLE IF NOT EXISTS special_service_addons (
            id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            special_service_id  UUID            NOT NULL REFERENCES special_services(id) ON DELETE CASCADE,
            name                VARCHAR(255)    NOT NULL,
            cost                NUMERIC(12,2)   NOT NULL DEFAULT 0,
            created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_special_service_addons_service_id ON special_service_addons (special_service_id)`;
}

export async function getAllSpecialServiceAddons(): Promise<SpecialServiceAddonRow[]> {
    await ensureSpecialServiceAddonsTable();
    const sql = getSql();
    const rows = (await sql`
        SELECT
            id,
            special_service_id,
            name,
            cost::float AS cost,
            created_at::text AS created_at,
            updated_at::text AS updated_at
        FROM special_service_addons
        ORDER BY name ASC
    `) as SpecialServiceAddonRow[];
    return rows;
}

export async function getSpecialServiceAddonsByService(serviceId: string): Promise<SpecialServiceAddonRow[]> {
    await ensureSpecialServiceAddonsTable();
    const sql = getSql();
    const rows = (await sql`
        SELECT
            id,
            special_service_id,
            name,
            cost::float AS cost,
            created_at::text AS created_at,
            updated_at::text AS updated_at
        FROM special_service_addons
        WHERE special_service_id = ${serviceId}
        ORDER BY name ASC
    `) as SpecialServiceAddonRow[];
    return rows;
}

export async function getSpecialServiceAddonById(id: string): Promise<SpecialServiceAddonRow | null> {
    await ensureSpecialServiceAddonsTable();
    const sql = getSql();
    const rows = (await sql`
        SELECT
            id,
            special_service_id,
            name,
            cost::float AS cost,
            created_at::text AS created_at,
            updated_at::text AS updated_at
        FROM special_service_addons
        WHERE id = ${id}
        LIMIT 1
    `) as SpecialServiceAddonRow[];
    return rows[0] ?? null;
}

export async function insertSpecialServiceAddon(data: SpecialServiceAddonInput): Promise<SpecialServiceAddonRow> {
    await ensureSpecialServiceAddonsTable();
    const sql = getSql();
    const id = randomUUID();
    const rows = (await sql`
        INSERT INTO special_service_addons (id, special_service_id, name, cost)
        VALUES (
            ${id},
            ${data.special_service_id},
            ${data.name},
            ${data.cost ?? 0}
        )
        RETURNING
            id,
            special_service_id,
            name,
            cost::float AS cost,
            created_at::text AS created_at,
            updated_at::text AS updated_at
    `) as SpecialServiceAddonRow[];
    return rows[0];
}

export async function updateSpecialServiceAddon(
    id: string,
    data: { name: string; cost?: number }
): Promise<SpecialServiceAddonRow | null> {
    await ensureSpecialServiceAddonsTable();
    const sql = getSql();
    const rows = (await sql`
        UPDATE special_service_addons SET
            name = ${data.name},
            cost = ${data.cost ?? 0},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING
            id,
            special_service_id,
            name,
            cost::float AS cost,
            created_at::text AS created_at,
            updated_at::text AS updated_at
    `) as SpecialServiceAddonRow[];
    return rows[0] ?? null;
}

export async function deleteSpecialServiceAddon(id: string): Promise<void> {
    await ensureSpecialServiceAddonsTable();
    const sql = getSql();
    await sql`DELETE FROM special_service_addons WHERE id = ${id}`;
}

// Preparación del esquema: una sola vez por proceso del servidor (ver runOnce).
export const ensureSpecialServiceAddonsTable = runOnce(ensureSpecialServiceAddonsTableTask);
