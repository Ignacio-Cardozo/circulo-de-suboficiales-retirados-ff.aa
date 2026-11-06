import { getSql } from "./connection.js";
import { runOnce } from "./runOnce.js";

const SINGLETON_ID = "00000000-0000-0000-0000-000000000001";

export type InitialBalances = {
    id: string;
    caja_chica: number;
    banco: number;
    comprobante_ingreso: number;
    comprobante_egreso: number;
};

async function ensureInitialBalancesTableTask(): Promise<void> {
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS initial_balances (
            id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            caja_chica              NUMERIC(12,2)   NOT NULL DEFAULT 0,
            banco                   NUMERIC(12,2)   NOT NULL DEFAULT 0,
            comprobante_ingreso     INT             NOT NULL DEFAULT 1,
            comprobante_egreso      INT             NOT NULL DEFAULT 1,
            updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
    await sql`ALTER TABLE initial_balances ADD COLUMN IF NOT EXISTS comprobante_ingreso INT NOT NULL DEFAULT 1`;
    await sql`ALTER TABLE initial_balances ADD COLUMN IF NOT EXISTS comprobante_egreso INT NOT NULL DEFAULT 1`;
}

export async function getInitialBalances(): Promise<InitialBalances | null> {
    await ensureInitialBalancesTable();
    const sql = getSql();
    const rows = (await sql`
        SELECT id, caja_chica::float as caja_chica, banco::float as banco,
               comprobante_ingreso, comprobante_egreso
        FROM initial_balances
        LIMIT 1
    `) as InitialBalances[];
    const row = rows[0];
    return row ?? null;
}

export async function upsertInitialBalances(
    caja_chica: number,
    banco: number,
    comprobante_ingreso?: number,
    comprobante_egreso?: number,
): Promise<InitialBalances> {
    await ensureInitialBalancesTable();
    const sql = getSql();
    const rows = (await sql`
        INSERT INTO initial_balances (id, caja_chica, banco, comprobante_ingreso, comprobante_egreso)
        VALUES (${SINGLETON_ID}, ${caja_chica}, ${banco}, ${comprobante_ingreso ?? 1}, ${comprobante_egreso ?? 1})
        ON CONFLICT (id) DO UPDATE SET
            caja_chica = EXCLUDED.caja_chica,
            banco = EXCLUDED.banco,
            comprobante_ingreso = COALESCE(${comprobante_ingreso ?? null}, initial_balances.comprobante_ingreso),
            comprobante_egreso = COALESCE(${comprobante_egreso ?? null}, initial_balances.comprobante_egreso),
            updated_at = NOW()
        RETURNING id, caja_chica::float as caja_chica, banco::float as banco,
                  comprobante_ingreso, comprobante_egreso
    `) as InitialBalances[];
    return rows[0];
}

export async function getNextAndIncrementReceipt(
    type: "ingreso" | "egreso"
): Promise<number> {
    await ensureInitialBalancesTable();
    const sql = getSql();
    const column = type === "ingreso" ? "comprobante_ingreso" : "comprobante_egreso";
    const rows = await sql.query(
        `UPDATE initial_balances
         SET ${column} = ${column} + 1, updated_at = NOW()
         WHERE id = $1
         RETURNING ${column} - 1 AS receipt_number`,
        [SINGLETON_ID]
    );
    const result = rows as { receipt_number: number }[];
    if (result.length > 0) return result[0].receipt_number;
    await upsertInitialBalances(0, 0);
    return getNextAndIncrementReceipt(type);
}

// Preparación del esquema: una sola vez por proceso del servidor (ver runOnce).
export const ensureInitialBalancesTable = runOnce(ensureInitialBalancesTableTask);
