import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "../_handler.js";

// Una sola función para todas las rutas /api/backup/<action>
// (status, run, download, tables, table). El catch-all api/[[...slug]].ts
// no atiende rutas de dos segmentos en Vercel.
export default async function (req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? "");
  await handler(req, res, `/api/backup/${action}`);
}
