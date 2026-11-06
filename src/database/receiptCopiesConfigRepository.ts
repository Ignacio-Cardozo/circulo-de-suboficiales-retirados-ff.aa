import { getSql } from "./connection.js";
import { runOnce } from "./runOnce.js";

export type ReceiptConceptRow = {
    id: string;
    type: "ingreso" | "egreso";
    name: string;
    target: "socios" | "personas" | "ambos";
    sort_order: number;
    active: boolean;
    copies_to_print: number;
};

export type ReceiptCopiesDefaults = Record<string, number>;

const SEED_CONCEPTS: { type: "ingreso" | "egreso"; name: string; target: "socios" | "personas" | "ambos"; sort_order: number; copies: number }[] = [
    { type: "ingreso", name: "Cuota Socio", target: "socios", sort_order: 1, copies: 3 },
    { type: "ingreso", name: "Servicios", target: "ambos", sort_order: 2, copies: 2 },
    { type: "ingreso", name: "Cementerio", target: "ambos", sort_order: 3, copies: 3 },
    { type: "egreso", name: "Servicios Varios", target: "ambos", sort_order: 10, copies: 1 },
    { type: "egreso", name: "Pago de servicio externo", target: "ambos", sort_order: 11, copies: 1 },
    { type: "egreso", name: "Adelanto de haberes", target: "ambos", sort_order: 12, copies: 1 },
    { type: "egreso", name: "Pago de haberes", target: "ambos", sort_order: 13, copies: 1 },
    { type: "egreso", name: "Otros", target: "ambos", sort_order: 14, copies: 1 },
];

async function ensureReceiptConceptsTablesTask(): Promise<void> {
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS receipt_concepts (
            id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            type        VARCHAR(20)     NOT NULL CHECK (type IN ('ingreso', 'egreso')),
            name        VARCHAR(100)    NOT NULL,
            target      VARCHAR(20)     NOT NULL DEFAULT 'ambos' CHECK (target IN ('socios', 'personas', 'ambos')),
            sort_order  INT             NOT NULL DEFAULT 0,
            active      BOOLEAN         NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `;
    await sql`
        CREATE TABLE IF NOT EXISTS receipt_copies_config (
            id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            concept_id      UUID            NOT NULL REFERENCES receipt_concepts(id) ON DELETE CASCADE,
            copies_to_print INT             NOT NULL DEFAULT 1,
            created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
            UNIQUE(concept_id)
        )
    `;
    // Ensure 'target' column exists on older tables
    await sql`ALTER TABLE receipt_concepts ADD COLUMN IF NOT EXISTS target VARCHAR(20) NOT NULL DEFAULT 'ambos'`;
}

async function seedBaseConcepts(): Promise<void> {
    const sql = getSql();
    const existing = (await sql`SELECT type, name FROM receipt_concepts`) as { type: string; name: string }[];
    const existingKeys = new Set(existing.map((r) => `${r.type}|${r.name.toLowerCase()}`));

    for (const c of SEED_CONCEPTS) {
        if (existingKeys.has(`${c.type}|${c.name.toLowerCase()}`)) {
            await sql`
                UPDATE receipt_concepts
                SET sort_order = ${c.sort_order}
                WHERE type = ${c.type} AND name ILIKE ${c.name}
            `;
            continue;
        }
        const rows = (await sql`
            INSERT INTO receipt_concepts (type, name, target, sort_order)
            VALUES (${c.type}, ${c.name}, ${c.target}, ${c.sort_order})
            RETURNING id
        `) as { id: string }[];
        await sql`
            INSERT INTO receipt_copies_config (concept_id, copies_to_print)
            VALUES (${rows[0].id}, ${c.copies})
            ON CONFLICT (concept_id) DO NOTHING
        `;
    }
}

export async function getAllReceiptConcepts(): Promise<ReceiptConceptRow[]> {
    await ensureReceiptConceptsTables();
    await seedBaseConcepts();
    const sql = getSql();
    const rows = (await sql`
        SELECT rc.id, rc.type, rc.name, rc.target, rc.sort_order, rc.active,
               COALESCE(rcc.copies_to_print, 1) as copies_to_print
        FROM receipt_concepts rc
        LEFT JOIN receipt_copies_config rcc ON rcc.concept_id = rc.id
        ORDER BY rc.type, rc.sort_order
    `) as ReceiptConceptRow[];
    return rows;
}

export async function getReceiptConceptsAsDefaults(): Promise<ReceiptCopiesDefaults> {
    const rows = await getAllReceiptConcepts();
    const defaults: ReceiptCopiesDefaults = {};
    for (const r of rows) {
        if (r.active) defaults[r.name] = r.copies_to_print;
    }
    return defaults;
}

export async function saveAllReceiptConcepts(
    concepts: { id?: string; type: "ingreso" | "egreso"; name: string; target: "socios" | "personas" | "ambos"; sort_order: number; active: boolean; copies_to_print: number }[],
): Promise<ReceiptConceptRow[]> {
    await ensureReceiptConceptsTables();
    const sql = getSql();

    const BASE_INGRESO = ["Cuota Socio", "Servicios", "Cementerio"].map((n) => n.toLowerCase());
    const BASE_EGRESO = ["Servicios Varios", "Pago de servicio externo", "Otros", "Adelanto de haberes", "Pago de haberes"].map((n) => n.toLowerCase());
    const isBase = (name: string, type: string) => {
        const key = name.toLowerCase();
        return type === "ingreso" ? BASE_INGRESO.includes(key) : BASE_EGRESO.includes(key);
    };

    const existingIds = (await sql`SELECT id, name, type FROM receipt_concepts`) as { id: string; name: string; type: string }[];
    const existingSet = new Set(existingIds.map((r) => r.id));
    const existingNameById = new Map(existingIds.map((r) => [r.id, r] as const));
    const incomingIds = new Set(concepts.filter((c) => c.id).map((c) => c.id!));

    for (const id of existingSet) {
        if (!incomingIds.has(id)) {
            const existing = existingNameById.get(id);
            if (existing && isBase(existing.name, existing.type)) continue;
            await sql`DELETE FROM receipt_copies_config WHERE concept_id = ${id}`;
            await sql`DELETE FROM receipt_concepts WHERE id = ${id}`;
        }
    }

    for (const c of concepts) {
        if (c.id && existingSet.has(c.id)) {
            const existing = existingNameById.get(c.id);
            const base = existing && isBase(existing.name, existing.type);
            if (base) {
                await sql`
                    INSERT INTO receipt_copies_config (concept_id, copies_to_print)
                    VALUES (${c.id}, ${c.copies_to_print})
                    ON CONFLICT (concept_id) DO UPDATE SET copies_to_print = EXCLUDED.copies_to_print
                `;
            } else {
                await sql`
                    UPDATE receipt_concepts
                    SET name = ${c.name}, type = ${c.type}, target = ${c.target}, sort_order = ${c.sort_order}, active = ${c.active}
                    WHERE id = ${c.id}
                `;
                await sql`
                    INSERT INTO receipt_copies_config (concept_id, copies_to_print)
                    VALUES (${c.id}, ${c.copies_to_print})
                    ON CONFLICT (concept_id) DO UPDATE SET copies_to_print = EXCLUDED.copies_to_print
                `;
            }
        } else {
            const rows = (await sql`
                INSERT INTO receipt_concepts (type, name, target, sort_order, active)
                VALUES (${c.type}, ${c.name}, ${c.target}, ${c.sort_order}, ${c.active})
                RETURNING id
            `) as { id: string }[];
            await sql`
                INSERT INTO receipt_copies_config (concept_id, copies_to_print)
                VALUES (${rows[0].id}, ${c.copies_to_print})
            `;
        }
    }

    return getAllReceiptConcepts();
}

// Preparación del esquema: una sola vez por proceso del servidor (ver runOnce).
export const ensureReceiptConceptsTables = runOnce(ensureReceiptConceptsTablesTask);
