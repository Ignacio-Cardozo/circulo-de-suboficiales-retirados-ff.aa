import { randomUUID } from "node:crypto";
import { getSql } from "./connection.js";
import { runOnce } from "./runOnce.js";

export type DueRow = {
    id: string;
    type: "socio" | "cementerio";
    payment_date: string;
    period: string[] | null;
    member_id: string | null;
    person_id: string | null;
    movement_id: string | null;
    family_group: string | null;
    paid_members: string[] | null;
    created_at: string;
};

export type DueWithDetails = {
    id: string;
    type: "socio" | "cementerio";
    payment_date: string;
    period: string[] | null;
    member_id: string | null;
    member_nombre: string | null;
    member_numero_de_socio: string | null;
    person_id: string | null;
    person_nombre: string | null;
    movement_id: string | null;
    amount: number | null;
    family_group: string | null;
    paid_members: string[] | null;
    receipt_number: number | null;
    anulado: boolean;
    created_at: string;
};

function parseJsonArray(val: unknown): string[] | null {
    if (!val) return null;
    if (Array.isArray(val)) return val as string[];
    if (typeof val === "string") {
        try { return JSON.parse(val) as string[]; }
        catch { return null; }
    }
    return null;
}

function parsePaidMembers(val: unknown): string[] | null {
    return parseJsonArray(val);
}

async function migrateDuesSchemaTask(): Promise<void> {
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS dues (
            id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            type            VARCHAR(20)     NOT NULL,
            payment_date    DATE            NOT NULL,
            member_id       UUID            REFERENCES members(id) ON DELETE SET NULL,
            person_id       UUID            REFERENCES persons(id) ON DELETE SET NULL,
            movement_id     UUID            REFERENCES petty_cash(id) ON DELETE SET NULL,
            created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
    await sql`
        CREATE INDEX IF NOT EXISTS idx_dues_member_id ON dues (member_id)
    `;
    await sql`
        CREATE INDEX IF NOT EXISTS idx_dues_person_id ON dues (person_id)
    `;
    await sql`
        CREATE INDEX IF NOT EXISTS idx_dues_type ON dues (type)
    `;
    await sql`
        ALTER TABLE dues ADD COLUMN IF NOT EXISTS family_group VARCHAR(50)
    `;
    await sql`
        ALTER TABLE dues ADD COLUMN IF NOT EXISTS paid_members JSONB DEFAULT '[]'::jsonb
    `;
    await sql`
        ALTER TABLE dues ADD COLUMN IF NOT EXISTS period JSONB DEFAULT '[]'::jsonb
    `;
}

export async function insertDue(due: {
    type: "socio" | "cementerio";
    payment_date: string;
    period?: string | null;
    member_id?: string | null;
    person_id?: string | null;
    movement_id?: string | null;
    family_group?: string | null;
    paid_members?: string[] | null;
}): Promise<string> {
    const sql = getSql();
    const id = randomUUID();
    const paidMembers = due.paid_members && due.paid_members.length > 0
        ? JSON.stringify(due.paid_members)
        : null;
    const periodJson = due.period && due.period.length > 0 ? JSON.stringify(due.period) : null;
    await sql`
        INSERT INTO dues (id, type, payment_date, period, member_id, person_id, movement_id, family_group, paid_members)
        VALUES (${id}, ${due.type}, ${due.payment_date}, ${periodJson}, ${due.member_id ?? null}, ${due.person_id ?? null}, ${due.movement_id ?? null}, ${due.family_group ?? null}, ${paidMembers})
    `;
    return id;
}

async function mapDues(rows: unknown[]): Promise<DueWithDetails[]> {
    return (rows as Record<string, unknown>[]).map((r) => ({
        ...r,
        period: parseJsonArray(r.period),
        paid_members: parsePaidMembers(r.paid_members),
    })) as DueWithDetails[];
}

export async function getDuesByMember(memberId: string): Promise<DueWithDetails[]> {
    const sql = getSql();
    const rows = await sql`
        SELECT
            d.id,
            d.type,
            d.payment_date::text as payment_date,
            d.period,
            d.member_id,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            d.person_id,
            p.nombre AS person_nombre,
            d.movement_id,
            pc.amount::float AS amount,
            d.family_group,
            d.paid_members,
            c.receipt_number,
            pc.anulado,
            d.created_at::text as created_at
        FROM dues d
        LEFT JOIN members m ON d.member_id = m.id
        LEFT JOIN persons p ON d.person_id = p.id
        LEFT JOIN petty_cash pc ON d.movement_id = pc.id
        LEFT JOIN comprobantes c ON d.movement_id = c.movement_id
        WHERE d.member_id = ${memberId}
           OR d.paid_members::jsonb ? ${memberId}
        ORDER BY d.payment_date DESC, d.created_at DESC
    `;
    return mapDues(rows as unknown as Record<string, unknown>[]);
}

export async function getDuesByPerson(personId: string): Promise<DueWithDetails[]> {
    const sql = getSql();
    const rows = await sql`
        SELECT
            d.id,
            d.type,
            d.payment_date::text as payment_date,
            d.period,
            d.member_id,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            d.person_id,
            p.nombre AS person_nombre,
            d.movement_id,
            pc.amount::float AS amount,
            d.family_group,
            d.paid_members,
            c.receipt_number,
            pc.anulado,
            d.created_at::text as created_at
        FROM dues d
        LEFT JOIN members m ON d.member_id = m.id
        LEFT JOIN persons p ON d.person_id = p.id
        LEFT JOIN petty_cash pc ON d.movement_id = pc.id
        LEFT JOIN comprobantes c ON d.movement_id = c.movement_id
        WHERE d.person_id = ${personId}
        ORDER BY d.payment_date DESC, d.created_at DESC
    `;
    return mapDues(rows as unknown as Record<string, unknown>[]);
}

export async function getAllDues(): Promise<DueWithDetails[]> {
    const sql = getSql();
    const rows = await sql`
        SELECT
            d.id,
            d.type,
            d.payment_date::text as payment_date,
            d.period,
            d.member_id,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            d.person_id,
            p.nombre AS person_nombre,
            d.movement_id,
            pc.amount::float AS amount,
            d.family_group,
            d.paid_members,
            c.receipt_number,
            pc.anulado,
            d.created_at::text as created_at
        FROM dues d
        LEFT JOIN members m ON d.member_id = m.id
        LEFT JOIN persons p ON d.person_id = p.id
        LEFT JOIN petty_cash pc ON d.movement_id = pc.id
        LEFT JOIN comprobantes c ON d.movement_id = c.movement_id
        ORDER BY d.payment_date DESC, d.created_at DESC
    `;
    return mapDues(rows as unknown as Record<string, unknown>[]);
}

export async function getDueByMovementId(movementId: string): Promise<DueWithDetails | null> {
    const sql = getSql();
    const rows = await sql`
        SELECT
            d.id,
            d.type,
            d.payment_date::text as payment_date,
            d.period,
            d.member_id,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            d.person_id,
            p.nombre AS person_nombre,
            d.movement_id,
            pc.amount::float AS amount,
            d.family_group,
            d.paid_members,
            c.receipt_number,
            pc.anulado,
            d.created_at::text as created_at
        FROM dues d
        LEFT JOIN members m ON d.member_id = m.id
        LEFT JOIN persons p ON d.person_id = p.id
        LEFT JOIN petty_cash pc ON d.movement_id = pc.id
        LEFT JOIN comprobantes c ON d.movement_id = c.movement_id
        WHERE d.movement_id = ${movementId}
        LIMIT 1
    `;
    const mapped = await mapDues(rows as unknown as Record<string, unknown>[]);
    return mapped.length > 0 ? mapped[0] : null;
}

export async function deleteDueByMovementId(movementId: string): Promise<boolean> {
    const sql = getSql();
    const result = await sql`
        DELETE FROM dues WHERE movement_id = ${movementId}
    `;
    return ((result as unknown as Record<string, unknown>)?.count as number) > 0;
}

export async function updateDueByMovementId(
    movementId: string,
    data: { period?: string[] | null; paid_members?: string[] | null }
): Promise<void> {
    const sql = getSql();
    const periodJson = data.period && data.period.length > 0 ? JSON.stringify(data.period) : null;
    const paidMembers = data.paid_members && data.paid_members.length > 0
        ? JSON.stringify(data.paid_members)
        : null;
    await sql`
        UPDATE dues SET
            period = COALESCE(${periodJson}::jsonb, period),
            paid_members = COALESCE(${paidMembers}::jsonb, paid_members)
        WHERE movement_id = ${movementId}
    `;
}

export async function getDuesByMemberWithCemeteryCheck(memberId: string): Promise<{
    hasCementerio: boolean;
    dues: DueWithDetails[];
}> {
    const sql = getSql();
    const [cementerioResult, dues] = await Promise.all([
        sql`SELECT COUNT(*)::int AS count FROM cementerios WHERE socio_id = ${memberId}` as unknown as { count: number }[],
        getDuesByMember(memberId),
    ]);
    return {
        hasCementerio: cementerioResult[0]?.count > 0,
        dues,
    };
}

export async function getMembersDebtStatus(): Promise<Record<string, string | null>> {
    const sql = getSql();
    const rows = (await sql`
        SELECT d.member_id, d.paid_members, d.period
        FROM dues d
        LEFT JOIN petty_cash pc ON d.movement_id = pc.id
        WHERE d.type = 'socio'
          AND (pc.anulado = false OR d.movement_id IS NULL)
    `) as { member_id: string | null; paid_members: unknown; period: unknown }[];
    const map: Record<string, string | null> = {};
    for (const row of rows) {
        const periods = parseJsonArray(row.period);
        if (!periods || periods.length === 0) continue;
        const latest = periods.reduce((a, b) => a > b ? a : b);
        const members: string[] = [];
        if (row.member_id) members.push(row.member_id);
        const paid = parsePaidMembers(row.paid_members);
        if (paid) members.push(...paid);
        for (const mid of members) {
            if (!map[mid] || latest > map[mid]) {
                map[mid] = latest;
            }
        }
    }
    return map;
}

// Preparación del esquema: una sola vez por proceso del servidor (ver runOnce).
export const migrateDuesSchema = runOnce(migrateDuesSchemaTask);
