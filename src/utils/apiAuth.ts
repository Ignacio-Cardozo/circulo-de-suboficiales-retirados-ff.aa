import { authClient } from "../auth";

/**
 * Agrega el JWT de Neon Auth (header Authorization) a todas las llamadas a
 * la API propia (/api/...). La API rechaza con 401 cualquier pedido sin un
 * token válido (ver api/_auth.ts).
 *
 * No hace falta cachear el token acá: el cliente de Neon Auth ya guarda la
 * sesión en memoria hasta que el JWT está por vencer.
 */

async function getApiToken(): Promise<string | null> {
    try {
        const result = await authClient.getSession();
        return result.data?.session?.token ?? null;
    } catch {
        return null;
    }
}

function isApiRequest(input: RequestInfo | URL): boolean {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
}

export function installApiAuth(): void {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        if (!isApiRequest(input)) return originalFetch(input, init);

        const token = await getApiToken();
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
        return originalFetch(input, { ...init, headers });
    };
}
