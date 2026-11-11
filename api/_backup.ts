/**
 * Endpoints de respaldo (Configuración → Respaldos).
 *
 *   GET  /api/backup/status          estado de la configuración, copias disponibles y últimas ejecuciones
 *   POST /api/backup/run             dispara el workflow de GitHub Actions (copia manual)
 *   GET  /api/backup/download?id=N   descarga una copia, descifrada, como .dump
 *   GET  /api/backup/tables          tablas del esquema public (para exportar a CSV)
 *   GET  /api/backup/table?name=&offset=   filas de una tabla, paginadas
 *
 * La sesión se verifica en api/_handler.ts (ver api/_auth.ts); acá se exige
 * además rol owner o admin.
 *
 * Variables de entorno (Vercel):
 *   BACKUP_GITHUB_TOKEN   token de GitHub con permiso "Actions: read and write" sobre el repo
 *   BACKUP_PASSPHRASE     la misma clave configurada como secret en GitHub
 *   BACKUP_GITHUB_REPO    opcional, "owner/repo" (por defecto se usa el repo que despliega Vercel)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createDecipheriv, pbkdf2Sync } from "node:crypto";
import { unzipSync } from "fflate";
import { ADMIN_ROLES, HttpError, requireRole, type AuthContext } from "./_auth.js";

const WORKFLOW_FILE = "db-backup.yml";
const ARTIFACT_PREFIX = "db-backup-";
const PAGE_SIZE = 2000;

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

function githubConfig() {
    const token = process.env.BACKUP_GITHUB_TOKEN?.trim() ?? "";
    const fromVercel =
        process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
            ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
            : "";
    const repo = (process.env.BACKUP_GITHUB_REPO ?? fromVercel).trim();
    const ref = (process.env.BACKUP_GITHUB_REF ?? process.env.VERCEL_GIT_COMMIT_REF ?? "main").trim();
    return { token, repo, ref };
}

function requireGithub() {
    const cfg = githubConfig();
    if (!cfg.token || !cfg.repo) {
        throw new HttpError(503, "Los respaldos automáticos no están configurados (faltan BACKUP_GITHUB_TOKEN / BACKUP_GITHUB_REPO).");
    }
    return cfg;
}

async function github(path: string, init: RequestInit = {}): Promise<Response> {
    const { token, repo } = requireGithub();
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
        ...init,
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "backup-client",
            ...(init.headers ?? {}),
        },
    });
    if (res.status === 401 || res.status === 403) {
        throw new HttpError(502, "GitHub rechazó el token de respaldos. Revisá BACKUP_GITHUB_TOKEN y sus permisos.");
    }
    if (res.status === 404) {
        throw new HttpError(502, "GitHub no encontró el repositorio o el workflow de respaldos. Revisá BACKUP_GITHUB_REPO.");
    }
    return res;
}

type GithubArtifact = {
    id: number;
    name: string;
    size_in_bytes: number;
    created_at: string;
    expires_at: string;
    expired: boolean;
};

type GithubRun = {
    id: number;
    status: string;
    conclusion: string | null;
    event: string;
    created_at: string;
    updated_at: string;
    html_url: string;
};

async function listBackups() {
    const res = await github(`/actions/artifacts?per_page=100`);
    if (!res.ok) throw new HttpError(502, `GitHub respondió ${res.status} al listar las copias`);
    const body = (await res.json()) as { artifacts: GithubArtifact[] };
    return body.artifacts
        .filter((a) => a.name.startsWith(ARTIFACT_PREFIX) && !a.expired)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((a) => ({
            id: a.id,
            name: a.name,
            kind: a.name.startsWith(`${ARTIFACT_PREFIX}monthly-`) ? "mensual" : "diaria",
            size: a.size_in_bytes,
            created_at: a.created_at,
            expires_at: a.expires_at,
        }));
}

async function listRuns() {
    const res = await github(`/actions/workflows/${WORKFLOW_FILE}/runs?per_page=5`);
    if (!res.ok) throw new HttpError(502, `GitHub respondió ${res.status} al consultar las ejecuciones`);
    const body = (await res.json()) as { workflow_runs: GithubRun[] };
    return body.workflow_runs.map((r) => ({
        id: r.id,
        status: r.status,
        conclusion: r.conclusion,
        trigger: r.event === "schedule" ? "automática" : "manual",
        created_at: r.created_at,
        updated_at: r.updated_at,
        url: r.html_url,
    }));
}

// ---------------------------------------------------------------------------
// Descifrado (formato de `openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -md sha256`)
// ---------------------------------------------------------------------------

function decryptOpenssl(data: Uint8Array, passphrase: string): Buffer {
    const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    if (buf.subarray(0, 8).toString("latin1") !== "Salted__") {
        throw new HttpError(500, "El archivo de respaldo no tiene el formato esperado.");
    }
    const salt = buf.subarray(8, 16);
    const derived = pbkdf2Sync(passphrase, salt, 200_000, 48, "sha256");
    const decipher = createDecipheriv("aes-256-cbc", derived.subarray(0, 32), derived.subarray(32, 48));
    try {
        return Buffer.concat([decipher.update(buf.subarray(16)), decipher.final()]);
    } catch {
        throw new HttpError(500, "No se pudo descifrar la copia. BACKUP_PASSPHRASE no coincide con la usada en GitHub.");
    }
}

async function downloadBackup(id: number): Promise<{ filename: string; data: Buffer }> {
    const passphrase = process.env.BACKUP_PASSPHRASE ?? "";
    if (!passphrase) throw new HttpError(503, "Falta configurar BACKUP_PASSPHRASE en el servidor.");

    const meta = await github(`/actions/artifacts/${id}`);
    if (!meta.ok) throw new HttpError(404, "Copia no encontrada.");
    const artifact = (await meta.json()) as GithubArtifact;
    if (!artifact.name.startsWith(ARTIFACT_PREFIX)) throw new HttpError(404, "Copia no encontrada.");
    if (artifact.expired) throw new HttpError(410, "Esta copia ya venció y fue eliminada por GitHub.");

    // GitHub responde con una redirección a una URL temporal; fetch la sigue
    // y no reenvía el header Authorization a otro dominio.
    const zipRes = await github(`/actions/artifacts/${id}/zip`);
    if (!zipRes.ok) throw new HttpError(502, `GitHub respondió ${zipRes.status} al descargar la copia`);
    const files = unzipSync(new Uint8Array(await zipRes.arrayBuffer()));
    const entry = Object.entries(files).find(([name]) => name.endsWith(".dump.enc"));
    if (!entry) throw new HttpError(500, "La copia no contiene un archivo de respaldo.");

    const [encName, encData] = entry;
    return {
        filename: encName.replace(/^.*\//, "").replace(/\.enc$/, ""),
        data: decryptOpenssl(encData, passphrase),
    };
}

// ---------------------------------------------------------------------------
// Exportación de tablas (CSV, armado en el navegador)
// ---------------------------------------------------------------------------

async function publicTableNames(): Promise<string[]> {
    const { getSql } = await import("../src/database/connection.js");
    const sql = getSql();
    const tables = (await sql`
        SELECT table_name AS name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `) as { name: string }[];
    return tables.map((t) => t.name);
}

async function listTables(): Promise<{ name: string; rows: number }[]> {
    const { getSql } = await import("../src/database/connection.js");
    const sql = getSql();
    const names = await publicTableNames();
    return Promise.all(
        names.map(async (name) => {
            const r = (await sql.query(`SELECT COUNT(*)::int AS n FROM public."${name.replace(/"/g, '""')}"`)) as { n: number }[];
            return { name, rows: r[0]?.n ?? 0 };
        }),
    );
}

async function tableRows(name: string, offset: number) {
    // El nombre se valida contra el catálogo antes de interpolarlo en el SQL.
    if (!(await publicTableNames()).includes(name)) throw new HttpError(404, "Tabla no encontrada.");
    const { getSql } = await import("../src/database/connection.js");
    const sql = getSql();
    const quoted = `public."${name.replace(/"/g, '""')}"`;
    const rows = (await sql.query(`SELECT * FROM ${quoted} ORDER BY ctid LIMIT $1 OFFSET $2`, [PAGE_SIZE, offset])) as Record<string, unknown>[];
    const columns = (await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${name}
        ORDER BY ordinal_position
    `) as { column_name: string }[];
    return {
        columns: columns.map((c) => c.column_name),
        rows,
        next_offset: rows.length === PAGE_SIZE ? offset + PAGE_SIZE : null,
    };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export async function handleBackup(req: VercelRequest, res: VercelResponse, pathname: string, auth: AuthContext): Promise<void> {
    const method = req.method ?? "GET";
    try {
        requireRole(auth, ADMIN_ROLES, "Solo los administradores pueden acceder a los respaldos.");

        if (pathname === "/api/backup/status" && method === "GET") {
            const cfg = githubConfig();
            const configured = {
                github: Boolean(cfg.token && cfg.repo),
                passphrase: Boolean(process.env.BACKUP_PASSPHRASE),
            };
            if (!configured.github) {
                res.status(200).json({ configured, backups: [], runs: [] });
                return;
            }
            const [backups, runs] = await Promise.all([listBackups(), listRuns()]);
            res.status(200).json({ configured, backups, runs });
            return;
        }

        if (pathname === "/api/backup/run" && method === "POST") {
            const { ref } = requireGithub();
            const r = await github(`/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ref }),
            });
            if (r.status !== 204) throw new HttpError(502, `GitHub respondió ${r.status} al iniciar la copia`);
            res.status(202).json({ started: true });
            return;
        }

        if (pathname === "/api/backup/download" && method === "GET") {
            const id = Number(req.query.id);
            if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Falta el parámetro id");
            const { filename, data } = await downloadBackup(id);
            res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.setHeader("Cache-Control", "no-store");
            res.status(200).send(data);
            return;
        }

        if (pathname === "/api/backup/tables" && method === "GET") {
            res.setHeader("Cache-Control", "no-store");
            res.status(200).json(await listTables());
            return;
        }

        if (pathname === "/api/backup/table" && method === "GET") {
            const name = String(req.query.name ?? "");
            const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
            if (!name) throw new HttpError(400, "Falta el parámetro name");
            res.setHeader("Cache-Control", "no-store");
            res.status(200).json(await tableRows(name, offset));
            return;
        }

        res.status(404).json({ error: "Ruta no encontrada" });
    } catch (error) {
        if (error instanceof HttpError) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        console.error(`Error en ${pathname}:`, error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
}
