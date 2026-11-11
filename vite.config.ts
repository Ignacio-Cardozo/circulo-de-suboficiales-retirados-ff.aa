import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "http";

function collectBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Variables del .env que el plugin copió a process.env (sobrevive a los reinicios de Vite). */
function copiedEnvKeys(): Set<string> {
  const g = globalThis as { __apiDevEnvKeys?: Set<string> };
  return (g.__apiDevEnvKeys ??= new Set());
}

/**
 * En desarrollo, las rutas /api/* las atiende el MISMO handler que usa Vercel
 * (api/_handler.ts), así local y producción se comportan igual: misma
 * autenticación, mismos permisos, mismas rutas.
 *
 * Este adaptador le da a req/res de Node la forma de VercelRequest /
 * VercelResponse (req.query, req.body, res.status().json(), res.send()).
 */
function apiDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: "api-dev",
    configureServer(server) {
      // Las variables del .env (DATABASE_URL, VITE_NEON_AUTH_URL, BACKUP_*)
      // quedan disponibles para la API como en Vercel. Vite se reinicia en el
      // mismo proceso cuando cambia el .env, así que las que copiamos nosotros
      // se vuelven a pisar; las que ya venían del sistema se respetan.
      const ours = copiedEnvKeys();
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
          ours.add(key);
        }
      }

      server.middlewares.use(async (req, res: ServerResponse, next) => {
        const url = new URL(req.url ?? "", "http://localhost");
        if (!url.pathname.startsWith("/api/")) {
          next();
          return;
        }

        const vreq = req as IncomingMessage & { query: Record<string, string | string[]>; body: unknown };
        const vres = res as ServerResponse & {
          status: (code: number) => typeof vres;
          json: (data: unknown) => typeof vres;
          send: (data: unknown) => typeof vres;
        };

        try {
          const query: Record<string, string | string[]> = {};
          for (const key of new Set(url.searchParams.keys())) {
            const all = url.searchParams.getAll(key);
            query[key] = all.length > 1 ? all : all[0];
          }
          vreq.query = query;

          const raw = await collectBody(req);
          const text = raw.toString();
          const isJson = (req.headers["content-type"] ?? "").includes("application/json");
          vreq.body = text && isJson ? JSON.parse(text) : text || undefined;

          vres.status = (code) => {
            vres.statusCode = code;
            return vres;
          };
          vres.json = (data) => {
            vres.setHeader("Content-Type", "application/json");
            vres.end(JSON.stringify(data));
            return vres;
          };
          vres.send = (data) => {
            if (Buffer.isBuffer(data) || typeof data === "string") vres.end(data);
            else vres.json(data);
            return vres;
          };

          // ssrLoadModule recarga el handler cuando cambia el código de la API.
          const mod = (await server.ssrLoadModule("/api/_handler.ts")) as {
            default: (req: unknown, res: unknown, pathname: string) => Promise<void>;
          };
          await mod.default(vreq, vres, url.pathname);
        } catch (error) {
          console.error(`API ${req.url}:`, error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Error interno del servidor" }));
          }
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv da prioridad a process.env: si no borramos lo que copió el plugin
  // en un arranque anterior, un cambio en el .env no se vería hasta reiniciar.
  const copied = copiedEnvKeys();
  for (const key of copied) delete process.env[key];
  copied.clear();
  const env = loadEnv(mode, process.cwd(), "");
  const host = process.env.TAURI_DEV_HOST;

  return {
    clearScreen: false,
    base: "/",
    plugins: [react(), apiDevPlugin(env)],
    server: {
      port: 5173,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
    },
    envPrefix: ["VITE_", "TAURI_ENV_*"],
    build: {
      target:
        process.env.TAURI_ENV_PLATFORM === "windows"
          ? "chrome105"
          : "safari13",
      minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
      sourcemap: !!process.env.TAURI_ENV_DEBUG,
    },
  };
});
