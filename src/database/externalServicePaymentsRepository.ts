import { randomUUID } from "node:crypto";
import { getSql } from "./connection.js";
import { runOnce } from "./runOnce.js";

export type ExternalServicePaymentRow = {
    id: string;
    service_id: string;
    month: number;
    year: number;
    amount: number | null;
    movement_id: string | null;
    created_at: string;
};

async function ensureExternalServicePaymentsTableTask(): Promise<void> {
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS external_service_payments (
            id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            service_id  UUID            NOT NULL REFERENCES external_services(id) ON DELETE CASCADE,
            month       INT             NOT NULL CHECK (month BETWEEN 1 AND 12),
            year        INT             NOT NULL,
            amount      NUMERIC(12,2),
            movement_id UUID            REFERENCES petty_cash(id) ON DELETE SET NULL,
            created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
            UNIQUE(service_id, month, year)
        )
    `;
}

export async function getPaymentsByYear(year: number): Promise<ExternalServicePaymentRow[]> {
    await ensureExternalServicePaymentsTable();
    const sql = getSql();
    const rows = (await sql`
        SELECT esp.id, esp.service_id, esp.month, esp.year, esp.amount, esp.movement_id, esp.created_at
        FROM external_service_payments esp
        LEFT JOIN petty_cash pc ON esp.movement_id = pc.id
        WHERE esp.year = ${year}
          AND (pc.anulado = false OR esp.movement_id IS NULL)
        ORDER BY esp.service_id, esp.month
    `) as ExternalServicePaymentRow[];
    return rows;
}

export async function upsertPayment(serviceId: string, month: number, year: number, amount: number | null, movementId: string | null): Promise<ExternalServicePaymentRow> {
    await ensureExternalServicePaymentsTable();
    const sql = getSql();
    const rows = (await sql`
        INSERT INTO external_service_payments (id, service_id, month, year, amount, movement_id)
        VALUES (${randomUUID()}, ${serviceId}, ${month}, ${year}, ${amount}, ${movementId})
        ON CONFLICT (service_id, month, year)
        DO UPDATE SET amount = ${amount}, movement_id = ${movementId}
        RETURNING id, service_id, month, year, amount, movement_id, created_at
    `) as ExternalServicePaymentRow[];
    return rows[0];
}

export async function deletePayment(serviceId: string, month: number, year: number): Promise<void> {
    await ensureExternalServicePaymentsTable();
    const sql = getSql();
    await sql`
        DELETE FROM external_service_payments
        WHERE service_id = ${serviceId} AND month = ${month} AND year = ${year}
    `;
}

export async function deletePaymentById(id: string): Promise<void> {
    await ensureExternalServicePaymentsTable();
    const sql = getSql();
    await sql`DELETE FROM external_service_payments WHERE id = ${id}`;
}

export async function deletePaymentsByMovementId(movementId: string): Promise<void> {
    await ensureExternalServicePaymentsTable();
    const sql = getSql();
    await sql`DELETE FROM external_service_payments WHERE movement_id = ${movementId}`;
}

// Preparación del esquema: una sola vez por proceso del servidor (ver runOnce).
export const ensureExternalServicePaymentsTable = runOnce(ensureExternalServicePaymentsTableTask);
