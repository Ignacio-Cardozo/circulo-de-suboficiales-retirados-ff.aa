import { getSql } from "./connection.js";
import { runOnce } from "./runOnce.js";

export interface ComprobanteRow {
    id: string;
    movement_id: string;
    receipt_number: number;
    copies_to_print: number;
    detail: string;
    concept: string | null;
    payer_name: string | null;
    created_at: string;
}

async function ensureTableTask(): Promise<void> {
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS comprobantes (
            id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            movement_id         UUID            NOT NULL REFERENCES petty_cash(id) ON DELETE CASCADE,
            receipt_number      INT             NOT NULL,
            copies_to_print     INT             NOT NULL DEFAULT 1,
            detail              TEXT            NOT NULL,
            concept             TEXT,
            payer_name          TEXT,
            created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_comprobantes_movement ON comprobantes (movement_id)`;
}

export async function insertComprobante(data: {
    movement_id: string;
    receipt_number: number;
    copies_to_print: number;
    detail: string;
    concept?: string | null;
    payer_name?: string | null;
}): Promise<string> {
    await ensureTable();
    const sql = getSql();
    const rows = await sql`
        INSERT INTO comprobantes (movement_id, receipt_number, copies_to_print, detail, concept, payer_name)
        VALUES (${data.movement_id}, ${data.receipt_number}, ${data.copies_to_print}, ${data.detail}, ${data.concept ?? null}, ${data.payer_name ?? null})
        RETURNING id
    `;
    return (rows as { id: string }[])[0].id;
}

export async function getComprobanteByMovementId(movementId: string): Promise<ComprobanteRow | null> {
    await ensureTable();
    const sql = getSql();
    const rows = await sql`
        SELECT id, movement_id::text as movement_id, receipt_number, copies_to_print, detail, concept, payer_name,
               created_at::text as created_at
        FROM comprobantes
        WHERE movement_id = ${movementId}
        ORDER BY created_at DESC
        LIMIT 1
    `;
    return (rows as ComprobanteRow[])[0] ?? null;
}

export async function getComprobantesByMovementIds(movementIds: string[]): Promise<ComprobanteRow[]> {
    if (movementIds.length === 0) return [];
    await ensureTable();
    const sql = getSql();
    const rows = await sql`
        SELECT id, movement_id::text as movement_id, receipt_number, copies_to_print, detail, concept, payer_name,
               created_at::text as created_at
        FROM comprobantes
        WHERE movement_id = ANY(${movementIds})
    `;
    return rows as ComprobanteRow[];
}

// Preparación del esquema: una sola vez por proceso del servidor (ver runOnce).
export const ensureTable = runOnce(ensureTableTask);
