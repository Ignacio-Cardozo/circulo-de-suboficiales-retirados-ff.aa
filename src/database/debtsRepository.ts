import { randomUUID } from "node:crypto";
import { getSql } from "./connection.js";
import { runOnce } from "./runOnce.js";

export type DebtRow = {
    id: string;
    member_id: string | null;
    person_id: string | null;
    type: string;
    description: string | null;
    amount: number;
    movement_id: string | null;
    date: string;
    created_at: string;
};

export type DebtWithDetails = DebtRow & {
    member_nombre: string | null;
    member_numero_de_socio: string | null;
    person_nombre: string | null;
};

async function migrateDebtsSchemaTask(): Promise<void> {
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS debts (
            id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            member_id       UUID            REFERENCES members(id) ON DELETE SET NULL,
            person_id       UUID            REFERENCES persons(id) ON DELETE SET NULL,
            type            VARCHAR(50)     NOT NULL,
            description     TEXT,
            amount          NUMERIC(12,2)   NOT NULL,
            movement_id     UUID            REFERENCES petty_cash(id) ON DELETE SET NULL,
            date            DATE            NOT NULL,
            created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_debts_member_id  ON debts (member_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_debts_person_id  ON debts (person_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_debts_movement_id ON debts (movement_id)`;
}

export async function insertDebt(debt: {
    member_id?: string | null;
    person_id?: string | null;
    type: string;
    description?: string | null;
    amount: number;
    movement_id?: string | null;
    date: string;
}): Promise<string> {
    const sql = getSql();
    const id = randomUUID();
    await sql`
        INSERT INTO debts (id, member_id, person_id, type, description, amount, movement_id, date)
        VALUES (${id}, ${debt.member_id ?? null}, ${debt.person_id ?? null}, ${debt.type}, ${debt.description ?? null}, ${debt.amount}, ${debt.movement_id ?? null}, ${debt.date})
    `;
    return id;
}

export async function getDebtsByMember(memberId: string): Promise<DebtWithDetails[]> {
    const sql = getSql();
    const rows = await sql`
        SELECT
            d.id, d.member_id, d.person_id, d.type, d.description,
            d.amount::float, d.movement_id, d.date::text, d.created_at::text,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            p.nombre AS person_nombre
        FROM debts d
        LEFT JOIN members m ON d.member_id = m.id
        LEFT JOIN persons p ON d.person_id = p.id
        LEFT JOIN petty_cash pc ON d.movement_id = pc.id
        WHERE d.member_id = ${memberId}
          AND (pc.anulado = false OR d.movement_id IS NULL)
        ORDER BY d.date DESC, d.created_at DESC
    `;
    return rows as DebtWithDetails[];
}

export async function getDebtsByPerson(personId: string): Promise<DebtWithDetails[]> {
    const sql = getSql();
    const rows = await sql`
        SELECT
            d.id, d.member_id, d.person_id, d.type, d.description,
            d.amount::float, d.movement_id, d.date::text, d.created_at::text,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            p.nombre AS person_nombre
        FROM debts d
        LEFT JOIN members m ON d.member_id = m.id
        LEFT JOIN persons p ON d.person_id = p.id
        LEFT JOIN petty_cash pc ON d.movement_id = pc.id
        WHERE d.person_id = ${personId}
          AND (pc.anulado = false OR d.movement_id IS NULL)
        ORDER BY d.date DESC, d.created_at DESC
    `;
    return rows as DebtWithDetails[];
}

export async function getDebtsByMovementId(movementId: string): Promise<DebtWithDetails[]> {
    const sql = getSql();
    const rows = await sql`
        SELECT
            d.id, d.member_id, d.person_id, d.type, d.description,
            d.amount::float, d.movement_id, d.date::text, d.created_at::text,
            m.nombre AS member_nombre,
            m.numero_de_socio AS member_numero_de_socio,
            p.nombre AS person_nombre
        FROM debts d
        LEFT JOIN members m ON d.member_id = m.id
        LEFT JOIN persons p ON d.person_id = p.id
        WHERE d.movement_id = ${movementId}
        ORDER BY d.date DESC, d.created_at DESC
    `;
    return rows as DebtWithDetails[];
}

export async function getBalanceByMember(memberId: string): Promise<number> {
    const sql = getSql();
    const result = await sql`
        SELECT COALESCE(SUM(amount), 0)::float AS balance
        FROM debts
        WHERE member_id = ${memberId}
    `;
    const rows = result as { balance: number }[];
    return rows[0]?.balance ?? 0;
}

export async function getBalanceByPerson(personId: string): Promise<number> {
    const sql = getSql();
    const result = await sql`
        SELECT COALESCE(SUM(amount), 0)::float AS balance
        FROM debts
        WHERE person_id = ${personId}
    `;
    const rows = result as { balance: number }[];
    return rows[0]?.balance ?? 0;
}

export async function deleteDebtById(id: string): Promise<boolean> {
    const sql = getSql();
    const result = await sql`DELETE FROM debts WHERE id = ${id}`;
    return ((result as unknown as Record<string, unknown>)?.count as number) > 0;
}

export async function reverseDebtsByMovementId(movementId: string): Promise<number> {
    const sql = getSql();
    const debts = await sql`
        SELECT id, description, amount
        FROM debts
        WHERE movement_id = ${movementId}
    ` as { id: string; description: string | null; amount: number }[];

    if (debts.length === 0) return 0;

    let reversed = 0;
    for (const debt of debts) {
        const cancelDesc = `Cancelados ${debt.amount >= 0 ? "+" : ""}${Number(debt.amount).toFixed(2)} - ${debt.description ?? ""}`;
        await sql`
            UPDATE debts
            SET amount = 0, description = ${cancelDesc}
            WHERE id = ${debt.id}
        `;
        reversed++;
    }
    return reversed;
}

// Preparación del esquema: una sola vez por proceso del servidor (ver runOnce).
export const migrateDebtsSchema = runOnce(migrateDebtsSchemaTask);
