import { zipSync, strToU8 } from "fflate";

export interface BackupItem {
    id: number;
    name: string;
    kind: "diaria" | "mensual";
    size: number;
    created_at: string;
    expires_at: string;
}

export interface BackupRun {
    id: number;
    status: string;
    conclusion: string | null;
    trigger: "automática" | "manual";
    created_at: string;
    updated_at: string;
    url: string;
}

export interface BackupStatus {
    configured: { github: boolean; passphrase: boolean };
    /** false si el workflow todavía no está subido a GitHub. */
    workflow: boolean;
    backups: BackupItem[];
    runs: BackupRun[];
}

// El token de sesión lo agrega src/utils/apiAuth.ts a todas las llamadas /api/.
async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(path, init);
    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Error ${response.status}`);
    }
    return response;
}

function saveFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function fetchBackupStatus(): Promise<BackupStatus> {
    const res = await request("/api/backup/status");
    return res.json() as Promise<BackupStatus>;
}

export async function startBackup(): Promise<void> {
    await request("/api/backup/run", { method: "POST" });
}

export async function downloadBackup(item: BackupItem): Promise<void> {
    const res = await request(`/api/backup/download?id=${item.id}`);
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${item.name}.dump`;
    saveFile(await res.blob(), filename);
}

// ---------------------------------------------------------------------------
// Exportación a CSV (un archivo por tabla, empaquetados en un ZIP)
// ---------------------------------------------------------------------------

type TablePage = {
    columns: string[];
    rows: Record<string, unknown>[];
    next_offset: number | null;
};

function csvCell(value: unknown): string {
    if (value === null || value === undefined) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const README = `Exportación de datos del sistema del Círculo de Suboficiales Retirados FF.AA.

Cada archivo .csv es una tabla de la base de datos.
- Separador: punto y coma (;)   Codificación: UTF-8
- Se abren directamente con Excel o LibreOffice.

Esta exportación sirve para consultar o revisar los datos.
Para migrar la base completa a otro servidor, usá una copia .dump
(Configuración → Respaldos) y restaurala con pg_restore.
`;

export async function exportTablesToCsv(onProgress?: (done: number, total: number, table: string) => void): Promise<void> {
    const tablesRes = await request("/api/backup/tables");
    const tables = (await tablesRes.json()) as { name: string; rows: number }[];

    const files: Record<string, Uint8Array> = { "LEEME.txt": strToU8(README) };

    for (let i = 0; i < tables.length; i++) {
        const { name } = tables[i];
        onProgress?.(i, tables.length, name);

        let columns: string[] = [];
        const lines: string[] = [];
        let offset: number | null = 0;
        while (offset !== null) {
            const res = await request(`/api/backup/table?name=${encodeURIComponent(name)}&offset=${offset}`);
            const page = (await res.json()) as TablePage;
            columns = page.columns;
            for (const row of page.rows) lines.push(columns.map((c) => csvCell(row[c])).join(";"));
            offset = page.next_offset;
        }

        // BOM para que Excel detecte UTF-8 (acentos y ñ).
        files[`${name}.csv`] = strToU8("﻿" + [columns.map(csvCell).join(";"), ...lines].join("\r\n") + "\r\n");
    }
    onProgress?.(tables.length, tables.length, "");

    const zipped = zipSync(files, { level: 6 });
    const date = new Date().toISOString().slice(0, 10);
    saveFile(new Blob([zipped as BlobPart], { type: "application/zip" }), `exportacion-datos-${date}.zip`);
}
