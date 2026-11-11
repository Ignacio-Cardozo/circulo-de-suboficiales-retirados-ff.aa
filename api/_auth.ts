/**
 * Autenticación de la API.
 *
 * El frontend envía el JWT de Neon Auth en `Authorization: Bearer <token>`
 * (ver src/utils/apiAuth.ts). Acá se verifica la firma contra el JWKS de
 * Neon Auth y se obtiene el rol del usuario desde la tabla app_users.
 */
import type { VercelRequest } from "@vercel/node";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type AppRole = "owner" | "admin" | "secretario";

export type AuthContext = {
    userId: string;
    email: string | null;
    role: AppRole;
    /** false si el usuario todavía no tiene fila en app_users (recién registrado). */
    registered: boolean;
};

export class HttpError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
    if (!jwks) {
        const base = (process.env.NEON_AUTH_URL ?? process.env.VITE_NEON_AUTH_URL ?? "").trim().replace(/\/+$/, "");
        if (!base) throw new HttpError(500, "Falta configurar NEON_AUTH_URL en el servidor");
        jwks = createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`));
    }
    return jwks;
}

export async function authenticate(req: VercelRequest): Promise<AuthContext> {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) throw new HttpError(401, "Sesión no válida. Volvé a iniciar sesión.");

    let userId: string | undefined;
    let email: string | null;
    try {
        const { payload } = await jwtVerify(token, getJwks());
        userId = payload.sub;
        email = typeof payload.email === "string" ? payload.email : null;
    } catch {
        throw new HttpError(401, "Sesión vencida o no válida. Volvé a iniciar sesión.");
    }
    if (!userId) throw new HttpError(401, "Sesión no válida.");

    const { getAppUserByAuthId } = await import("../src/database/usersRepository.js");
    const user = await getAppUserByAuthId(userId);
    return {
        userId,
        email: user?.email ?? email,
        // Igual que el frontend: sin fila en app_users el usuario es "secretario".
        role: user?.role ?? "secretario",
        registered: Boolean(user),
    };
}

export function requireRole(auth: AuthContext, roles: AppRole[], message = "No tenés permisos para esta acción."): void {
    if (!roles.includes(auth.role)) throw new HttpError(403, message);
}

export const ADMIN_ROLES: AppRole[] = ["owner", "admin"];
