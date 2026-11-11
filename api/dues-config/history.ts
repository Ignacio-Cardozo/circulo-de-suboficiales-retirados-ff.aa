import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "../_handler.js";

export default async function (req: VercelRequest, res: VercelResponse) {
  await handler(req, res, "/api/dues-config/history");
}
