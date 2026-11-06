import { randomUUID } from "node:crypto";
import { getSql } from "./connection.js";
import { runOnce } from "./runOnce.js";

export type AppUserRow = {
    id: string;
    auth_user_id: string;
    email: string;
    name: string | null;
    role: "owner" | "admin" | "secretario";
    created_at: string;
    updated_at: string;
};

async function ensureAppUsersTableTask(): Promise<void> {
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS app_users (
            id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            auth_user_id    TEXT            NOT NULL UNIQUE,
            email           VARCHAR(255)    NOT NULL,
            name            VARCHAR(255),
            role            VARCHAR(20)     NOT NULL DEFAULT 'secretario' CHECK (role IN ('owner', 'admin', 'secretario')),
            created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
}

export async function getAllAppUsers(): Promise<AppUserRow[]> {
    await ensureAppUsersTable();
    const sql = getSql();
    return (await sql`
        SELECT id, auth_user_id, email, name, role, created_at, updated_at
        FROM app_users
        ORDER BY created_at ASC
    `) as AppUserRow[];
}

export async function getAppUserByAuthId(authUserId: string): Promise<AppUserRow | null> {
    await ensureAppUsersTable();
    const sql = getSql();
    const rows = (await sql`
        SELECT id, auth_user_id, email, name, role, created_at, updated_at
        FROM app_users
        WHERE auth_user_id = ${authUserId}
        LIMIT 1
    `) as AppUserRow[];
    return rows[0] ?? null;
}

export async function upsertAppUser(
    authUserId: string,
    email: string,
    name: string | null,
    role: string = "secretario"
): Promise<AppUserRow> {
    await ensureAppUsersTable();
    const sql = getSql();
    const rows = (await sql`
        INSERT INTO app_users (id, auth_user_id, email, name, role)
        VALUES (${randomUUID()}, ${authUserId}, ${email}, ${name}, ${role})
        ON CONFLICT (auth_user_id) DO UPDATE SET
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            updated_at = NOW()
        RETURNING id, auth_user_id, email, name, role, created_at, updated_at
    `) as AppUserRow[];
    return rows[0];
}

export async function updateAppUserRole(
    authUserId: string,
    role: string
): Promise<AppUserRow | null> {
    await ensureAppUsersTable();
    const sql = getSql();
    const rows = (await sql`
        UPDATE app_users SET role = ${role}, updated_at = NOW()
        WHERE auth_user_id = ${authUserId}
        RETURNING id, auth_user_id, email, name, role, created_at, updated_at
    `) as AppUserRow[];
    return rows[0] ?? null;
}

export async function deleteAppUser(authUserId: string): Promise<void> {
    await ensureAppUsersTable();
    const sql = getSql();
    await sql`DELETE FROM app_users WHERE auth_user_id = ${authUserId}`;
}

// Preparación del esquema: una sola vez por proceso del servidor (ver runOnce).
export const ensureAppUsersTable = runOnce(ensureAppUsersTableTask);
