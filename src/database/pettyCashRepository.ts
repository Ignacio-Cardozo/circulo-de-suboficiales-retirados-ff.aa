import { randomUUID } from "node:crypto";
import { getSql } from "./connection.js";
import { runOnce } from "./runOnce.js";

export type PettyCashRow = {
    id: string;
    date: string;
    detail: string;
    amount: number;
    type: "ingreso" | "egreso" | "transferencia";
    mode: "efectivo" | "transferencia";
    concept: string | null;
    anulado: boolean;
    created_at: string;
};

async function migratePettyCashSchemaTask(): Promise<void> {
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS petty_cash (
            id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            date                DATE            NOT NULL,
            detail              TEXT,
            amount              NUMERIC(12,2)   NOT NULL DEFAULT 0,
            type                VARCHAR(20)     NOT NULL,
            mode                VARCHAR(20)     NOT NULL DEFAULT 'efectivo',
            anulado             BOOLEAN         NOT NULL DEFAULT FALSE,
            created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
    await sql`
        ALTER TABLE petty_cash ADD COLUMN IF NOT EXISTS mode VARCHAR(20) NOT NULL DEFAULT 'efectivo'
    `;
    await sql`
        ALTER TABLE petty_cash ADD COLUMN IF NOT EXISTS concept VARCHAR(100)
    `;
    await sql`
        ALTER TABLE petty_cash ADD COLUMN IF NOT EXISTS receipt_number INT
    `;
    await sql`
        ALTER TABLE petty_cash ADD COLUMN IF NOT EXISTS anulado BOOLEAN NOT NULL DEFAULT FALSE
    `;
}

export async function getAllMovements(): Promise<PettyCashRow[]> {
    const sql = getSql();
    const rows = await sql`
        SELECT id, date::text as date, detail, amount::float as amount, type, mode, concept,
               anulado, created_at::text as created_at
        FROM petty_cash
        ORDER BY date DESC, created_at DESC
    `;
    return rows as PettyCashRow[];
}

export async function getMovementById(id: string): Promise<PettyCashRow | null> {
    const sql = getSql();
    const rows = await sql`
        SELECT id, date::text as date, detail, amount::float as amount, type, mode, concept, anulado
        FROM petty_cash
        WHERE id = ${id}
    `;
    const result = rows as PettyCashRow[];
    return result.length > 0 ? result[0] : null;
}

export async function updateMovement(
    id: string,
    data: { date?: string; detail?: string; amount?: number; type?: string; mode?: string; concept?: string | null }
): Promise<void> {
    const sql = getSql();
    await sql`
        UPDATE petty_cash
        SET
            date = COALESCE(${data.date ?? null}, date),
            detail = COALESCE(${data.detail ?? null}, detail),
            amount = COALESCE(${data.amount ?? null}, amount),
            type = COALESCE(${data.type ?? null}, type),
            mode = COALESCE(${data.mode ?? null}, mode),
            concept = COALESCE(${data.concept ?? null}, concept)
        WHERE id = ${id}
    `;
}

export async function deleteMovement(id: string): Promise<void> {
    const sql = getSql();
    await sql`DELETE FROM petty_cash WHERE id = ${id}`;
}

export async function setMovementAnulado(id: string, anulado: boolean): Promise<void> {
    const sql = getSql();
    await sql`
        UPDATE petty_cash SET anulado = ${anulado} WHERE id = ${id}
    `;
}

export async function clearAllMovements(): Promise<void> {
    const sql = getSql();
    await sql`TRUNCATE TABLE petty_cash`;
}

export async function insertMovement(movement: {
    date: string;
    detail: string;
    amount: number;
    type: "ingreso" | "egreso" | "transferencia";
    mode: "efectivo" | "transferencia";
    concept?: string | null;
}): Promise<string> {
    const sql = getSql();
    const id = randomUUID();
    await sql`
        INSERT INTO petty_cash (id, date, detail, amount, type, mode, concept)
        VALUES (${id}, ${movement.date}, ${movement.detail}, ${movement.amount}, ${movement.type}, ${movement.mode}, ${movement.concept ?? null})
    `;
    return id;
}

export async function insertMovementsBatch(
    movements: {
        date: string;
        detail: string;
        amount: number;
        type: "ingreso" | "egreso" | "transferencia";
        mode: "efectivo" | "transferencia";
    }[]
): Promise<number> {
    if (movements.length === 0) return 0;

    const sql = getSql();
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < movements.length; i += batchSize) {
        const batch = movements.slice(i, i + batchSize);

        const valueStrings: string[] = [];
        const values: (string | number | null)[] = [];

        batch.forEach((m, idx) => {
            const baseIndex = idx * 6;
            valueStrings.push(
                `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`
            );
            values.push(randomUUID());
            values.push(m.date ? m.date : null);
            values.push(m.detail);
            values.push(m.amount);
            values.push(m.type);
            values.push(m.mode);
        });

        const queryText = `
            INSERT INTO petty_cash (id, date, detail, amount, type, mode)
            VALUES ${valueStrings.join(", ")}
        `;

        await sql.query(queryText, values);
        insertedCount += batch.length;
    }

    return insertedCount;
}

// Preparación del esquema: una sola vez por proceso del servidor (ver runOnce).
export const migratePettyCashSchema = runOnce(migratePettyCashSchemaTask);
