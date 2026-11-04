import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage } from "http";

function collectBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function apiDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: "api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const pathname = url.pathname;
        const isMembers = pathname === "/api/members";
        const isMembersSearch = pathname === "/api/members/search";
        const isMembersFamily = pathname === "/api/members/family";
        const isMembersDebt = pathname === "/api/members/debt-status";
        const isPersons = pathname === "/api/persons";
        const isServiceProviders = pathname === "/api/service-providers";
        const isMovements = pathname === "/api/movements";
        const isMovement = pathname === "/api/movement";
        const isMember = pathname === "/api/member";
        const isPerson = pathname === "/api/person";
        const isPersonMembers = pathname === "/api/person-members";
        const isInitialBalances = pathname === "/api/initial-balances";
        const isPayment = pathname === "/api/payment";
        const isCementerios = pathname === "/api/cementerios";
        const isDues = pathname === "/api/dues";
        const isDuesConfig = pathname === "/api/dues-config";
        const isDuesConfigHistory = pathname === "/api/dues-config/history";
        const isServices = pathname === "/api/services";
        const isServiceRecords = pathname === "/api/service-records";
        const isSpecialServices = pathname === "/api/special-services";
        const isSpecialServiceAddons = pathname === "/api/special-service-addons";
        const isSpecialServiceStatuses = pathname === "/api/special-service-statuses";
        const isSpecialServiceMovementTypes = pathname === "/api/special-service-movement-types";
        const isSpecialServiceWorkflow = pathname === "/api/special-service-workflow";
        const isSpecialServiceRecordMovements = pathname === "/api/special-service-record-movements";
        const isSpecialServiceRecords = pathname === "/api/special-service-records";
        const isCementerioMovimientos = pathname === "/api/cementerio-movimientos";
        const isUsers = pathname === "/api/users";
        const isVitalicios = pathname === "/api/members/vitalicios";
        const isDebts = pathname === "/api/debts";
        const isDebtsBalance = pathname === "/api/debts/balance";
        const isExternalServices = pathname === "/api/external-services";
        const isExternalServicePayments = pathname === "/api/external-service-payments";

        const isReceiptNext = pathname === "/api/receipt/next";
        const isComprobante = pathname === "/api/comprobante";
        const isReceiptCopiesConfig = pathname === "/api/receipt-copies-config";
        const isFrontendErrors = pathname === "/api/frontend-errors";

        if (!isMembers && !isMembersSearch && !isMembersFamily && !isMembersDebt && !isPersons && !isServiceProviders && !isMovements && !isMovement && !isMember && !isPerson && !isPersonMembers && !isInitialBalances && !isPayment && !isCementerios && !isDues && !isDuesConfig && !isDuesConfigHistory && !isServices && !isServiceRecords && !isSpecialServices && !isSpecialServiceAddons && !isSpecialServiceStatuses && !isSpecialServiceMovementTypes && !isSpecialServiceWorkflow && !isSpecialServiceRecordMovements && !isSpecialServiceRecords && !isCementerioMovimientos && !isUsers && !isVitalicios && !isDebts && !isDebtsBalance && !isExternalServices && !isExternalServicePayments && !isReceiptNext && !isComprobante && !isReceiptCopiesConfig && !isFrontendErrors) {
          next();
          return;
        }

        try {
          if (!process.env.DATABASE_URL && env.DATABASE_URL) {
            process.env.DATABASE_URL = env.DATABASE_URL;
          }

          res.setHeader("Content-Type", "application/json");

          if (isMembers && req.method === "GET") {
            const { getAllMembers } = await import("./src/database/membersRepository");
            const members = await getAllMembers();
            res.statusCode = 200;
            res.end(JSON.stringify(members));
            return;
          }

          if (isMembersSearch && req.method === "GET") {
            const q = url.searchParams.get("q") || "";
            if (!q) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Falta el parámetro q" }));
              return;
            }
            const { searchActiveMembers } = await import("./src/database/membersRepository");
            const members = await searchActiveMembers(q);
            res.statusCode = 200;
            res.end(JSON.stringify(members));
            return;
          }

          if (isMembersFamily && req.method === "GET") {
            const memberId = url.searchParams.get("memberId");
            if (!memberId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Falta el parámetro memberId" }));
              return;
            }
            const { getFamilyMembers } = await import("./src/database/membersRepository");
            const members = await getFamilyMembers(memberId);
            res.statusCode = 200;
            res.end(JSON.stringify(members));
            return;
          }

          if (isMembersDebt && req.method === "GET") {
            const { getMembersDebtStatus } = await import("./src/database/duesRepository");
            const { getDuesConfig } = await import("./src/database/duesConfigRepository");
            const [members, config] = await Promise.all([
              getMembersDebtStatus(),
              getDuesConfig(),
            ]);
            res.statusCode = 200;
            res.end(JSON.stringify({
              members,
              consideration_years: config?.consideration_years ?? 0,
            }));
            return;
          }

          if (isPersons && req.method === "GET") {
            const q = url.searchParams.get("q") || "";
            if (q) {
              const { searchPersons } = await import("./src/database/membersRepository");
              const persons = await searchPersons(q);
              res.statusCode = 200;
              res.end(JSON.stringify(persons));
            } else {
              const { getAllPersons } = await import("./src/database/personsRepository");
              const persons = await getAllPersons();
              res.statusCode = 200;
              res.end(JSON.stringify(persons));
            }
            return;
          }

          if (isServiceProviders && req.method === "GET") {
            const { getServiceProviders } = await import("./src/database/personsRepository");
            const providers = await getServiceProviders();
            res.statusCode = 200;
            res.end(JSON.stringify(providers));
            return;
          }

          if (isMovement) {
            const { getMovementById, updateMovement, setMovementAnulado } = await import("./src/database/pettyCashRepository");
            const { getDueByMovementId, updateDueByMovementId } = await import("./src/database/duesRepository");
            const { getServiceRecordsByMovement } = await import("./src/database/serviceRecordsRepository");
            const { getCementerioMovimientosByMovement } = await import("./src/database/cementerioMovimientosRepository");
            const { getComprobanteByMovementId } = await import("./src/database/comprobantesRepository");
            const { getSpecialServiceRecordsByMovement } = await import("./src/database/specialServiceRecordsRepository");
            const { migrateSpecialServiceMovementTypesSchema } = await import("./src/database/specialServiceMovementTypesRepository");
            const id = url.searchParams.get("id") ?? undefined;

            if (req.method === "GET") {
              if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro id" }));
                return;
              }
              const movement = await getMovementById(id);
              if (!movement) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Movimiento no encontrado" }));
                return;
              }
              await migrateSpecialServiceMovementTypesSchema();
              const [due, serviceRecords, cementerioMovimientos, comprobante, specialServiceRecords] = await Promise.all([
                getDueByMovementId(id),
                getServiceRecordsByMovement(id),
                getCementerioMovimientosByMovement(id),
                getComprobanteByMovementId(id),
                getSpecialServiceRecordsByMovement(id),
              ]);
              res.statusCode = 200;
              res.end(JSON.stringify({ ...movement, linked_due: due, linked_service_records: serviceRecords, linked_cementerio_movimientos: cementerioMovimientos, linked_special_service_records: specialServiceRecords, comprobante }));
              return;
            }

            if (req.method === "PUT") {
              if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro id" }));
                return;
              }
              const body = JSON.parse(await collectBody(req));
              const { due: dueData, ...movementData } = body;
              await updateMovement(id, movementData);
              if (dueData) {
                await updateDueByMovementId(id, dueData);
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
              return;
            }

            if (req.method === "PATCH") {
              if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro id" }));
                return;
              }
              const body = JSON.parse(await collectBody(req));
              await setMovementAnulado(id, body.anulado !== false);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
              return;
            }

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isMovements && req.method === "GET") {
            const { getAllMovements } = await import("./src/database/pettyCashRepository");
            const { getComprobantesByMovementIds } = await import("./src/database/comprobantesRepository");
            const movements = await getAllMovements();
            const movementIds = movements.map((m) => m.id);
            const comprobantes = await getComprobantesByMovementIds(movementIds);
            const comprobanteByMovement = new Map(comprobantes.map((c) => [c.movement_id, c]));
            const movementsWithComprobante = movements.map((m) => ({
              ...m,
              comprobante: comprobanteByMovement.get(m.id) ?? null,
            }));
            res.statusCode = 200;
            res.end(JSON.stringify(movementsWithComprobante));
            return;
          }

          if (isInitialBalances) {
            if (req.method === "GET") {
              const { getInitialBalances } = await import("./src/database/initialBalancesRepository");
              const balances = await getInitialBalances();
              res.statusCode = 200;
              res.end(JSON.stringify(balances));
              return;
            }
            if (req.method === "POST") {
              const body = await collectBody(req);
              const { caja_chica, banco, comprobante_ingreso, comprobante_egreso } = JSON.parse(body);
              const { upsertInitialBalances } = await import("./src/database/initialBalancesRepository");
              const result = await upsertInitialBalances(caja_chica, banco, comprobante_ingreso, comprobante_egreso);
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }
            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }
          }

          if (isMember && req.method === "GET") {
            const id = url.searchParams.get("id");
            if (!id) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Falta el parámetro id" }));
              return;
            }
            const { getMemberById } = await import("./src/database/membersRepository");
            const member = await getMemberById(id);
            if (!member) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "Socio no encontrado" }));
              return;
            }
            res.statusCode = 200;
            res.end(JSON.stringify(member));
            return;
          }

          if (isPayment && req.method === "POST") {
            const body = await collectBody(req);
            const payment = JSON.parse(body);
            if (!payment?.date || payment?.amount == null) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Faltan datos requeridos" }));
              return;
            }
            const { insertMovement } = await import("./src/database/pettyCashRepository");
            const movementId = await insertMovement({
              date: payment.date,
              detail: payment.detail,
              amount: payment.amount,
              type: payment.type || "ingreso",
              mode: payment.mode,
              concept: payment.concept ?? null,
            });
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, id: movementId }));
            return;
          }

          if (isReceiptNext && req.method === "POST") {
            const body = JSON.parse(await collectBody(req));
            const { type } = body;
            if (type !== "ingreso" && type !== "egreso") {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Tipo inválido (ingreso o egreso)" }));
              return;
            }
            const { getNextAndIncrementReceipt } = await import("./src/database/initialBalancesRepository");
            const receiptNumber = await getNextAndIncrementReceipt(type);
            res.statusCode = 200;
            res.end(JSON.stringify({ receipt_number: receiptNumber }));
            return;
          }

          if (isPayment && req.method === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
          }

          if (isComprobante && req.method === "GET") {
            const movementId = url.searchParams.get("movementId");
            if (!movementId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Falta movementId" }));
              return;
            }
            const { getComprobanteByMovementId } = await import("./src/database/comprobantesRepository");
            const comprobante = await getComprobanteByMovementId(movementId);
            res.statusCode = 200;
            res.end(JSON.stringify(comprobante));
            return;
          }

          if (isComprobante && req.method === "POST") {
            const body = await collectBody(req);
            const data = JSON.parse(body);
            if (!data?.movement_id || data?.receipt_number == null || !data?.detail) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Faltan datos requeridos" }));
              return;
            }
            const { insertComprobante } = await import("./src/database/comprobantesRepository");
            const id = await insertComprobante({
              movement_id: data.movement_id,
              receipt_number: data.receipt_number,
              copies_to_print: data.copies_to_print ?? 1,
              detail: data.detail,
              concept: data.concept ?? null,
              payer_name: data.payer_name ?? null,
            });
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, id }));
            return;
          }

          if (isComprobante && req.method === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
          }

          if (isMember && req.method === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
          }

          if (isPerson && req.method === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
          }

          if (isMember && req.method === "POST") {
            const body = await collectBody(req);
            const member = JSON.parse(body);
            if (!member?.numeroDeSocio) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Falta el número de socio" }));
              return;
            }
            const { upsertMember } = await import("./src/database/membersRepository");
            await upsertMember(member);
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
            return;
          }

          if (isMember && req.method === "DELETE") {
            const id = url.searchParams.get("id");
            if (!id) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Falta el parámetro id" }));
              return;
            }
            const { deleteMemberById } = await import("./src/database/membersRepository");
            await deleteMemberById(id);
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
            return;
          }

          if (isPerson && req.method === "GET") {
            const id = url.searchParams.get("id");
            if (!id) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Falta el parámetro id" }));
              return;
            }
            const { getPersonById } = await import("./src/database/personsRepository");
            const person = await getPersonById(id);
            if (!person) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "Persona no encontrada" }));
              return;
            }
            res.statusCode = 200;
            res.end(JSON.stringify(person));
            return;
          }

          if (isPerson && req.method === "POST") {
            const body = await collectBody(req);
            const person = JSON.parse(body);
            if (!person?.nombre?.trim()) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Falta el nombre de la persona" }));
              return;
            }
            const { upsertPerson } = await import("./src/database/personsRepository");
            await upsertPerson(person);
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
            return;
          }

          if (isPerson && req.method === "DELETE") {
            const id = url.searchParams.get("id");
            if (!id) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Falta el parámetro id" }));
              return;
            }
            const { deletePersonById } = await import("./src/database/personsRepository");
            await deletePersonById(id);
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
            return;
          }

          if (isCementerios) {
            const { getAllCementeriosGrid, getCementeriosByNicho, getCementeriosByOwnerId, getCementerioOwnerIds, updateCementerio } = await import("./src/database/cementeriosRepository");

            if (req.method === "GET") {
              const ownerId = url.searchParams.get("ownerId");
              const isSocio = url.searchParams.get("isSocio") === "true";
              const nicho = url.searchParams.get("nicho");
              const ownersOnly = url.searchParams.get("owners") === "true";

              if (ownersOnly) {
                const ids = await getCementerioOwnerIds();
                res.statusCode = 200;
                res.end(JSON.stringify(ids));
                return;
              }
              if (ownerId) {
                const items = await getCementeriosByOwnerId(ownerId, isSocio);
                res.statusCode = 200;
                res.end(JSON.stringify(items));
                return;
              }
              if (nicho) {
                const items = await getCementeriosByNicho(nicho);
                res.statusCode = 200;
                res.end(JSON.stringify(items));
              } else {
                const items = await getAllCementeriosGrid();
                res.statusCode = 200;
                res.end(JSON.stringify(items));
              }
              return;
            }

            if (req.method === "PATCH") {
              const id = url.searchParams.get("id");
              if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro id" }));
                return;
              }
              const body = await collectBody(req);
              const data = JSON.parse(body);
              await updateCementerio(id, data);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
              return;
            }

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }
          }

          if (isPersonMembers && req.method === "GET") {
            const personId = url.searchParams.get("personId");
            if (!personId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Falta el parámetro personId" }));
              return;
            }
            const { getMembersByPersonId } = await import("./src/database/personsRepository");
            const members = await getMembersByPersonId(personId);
            res.statusCode = 200;
            res.end(JSON.stringify(members));
            return;
          }

          if (isDues) {
            const {
              getAllDues,
              getDuesByMember,
              getDuesByPerson,
              insertDue,
              getDuesByMemberWithCemeteryCheck,
            } = await import("./src/database/duesRepository");

            if (req.method === "GET") {
              const memberId = url.searchParams.get("memberId");
              const personId = url.searchParams.get("personId");
              const check = url.searchParams.get("check");

              if (memberId && check === "cementerio") {
                const result = await getDuesByMemberWithCemeteryCheck(memberId);
                res.statusCode = 200;
                res.end(JSON.stringify(result));
                return;
              }

              if (memberId) {
                const dues = await getDuesByMember(memberId);
                res.statusCode = 200;
                res.end(JSON.stringify(dues));
                return;
              }

              if (personId) {
                const dues = await getDuesByPerson(personId);
                res.statusCode = 200;
                res.end(JSON.stringify(dues));
                return;
              }

              const all = await getAllDues();
              res.statusCode = 200;
              res.end(JSON.stringify(all));
              return;
            }

            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.type || !body?.payment_date) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Faltan datos requeridos (type, payment_date)" }));
                return;
              }
              const id = await insertDue({
                type: body.type,
                payment_date: body.payment_date,
                period: body.period ?? null,
                member_id: body.member_id ?? null,
                person_id: body.person_id ?? null,
                movement_id: body.movement_id ?? null,
                family_group: body.family_group ?? null,
                paid_members: body.paid_members ?? null,
              });
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, id }));
              return;
            }

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isDuesConfig) {
            if (req.method === "GET") {
              const { getDuesConfig } = await import("./src/database/duesConfigRepository");
              const config = await getDuesConfig();
              res.statusCode = 200;
              res.end(JSON.stringify(config));
              return;
            }
            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req));
              const {
                member_fee, consideration_years,
                nicho_member_fee, nicho_non_member_fee,
                urna_member_fee, urna_non_member_fee,
                bolsa_member_fee, bolsa_non_member_fee,
                asistencial_fee, plan_salud_fee,
                fee_act, fee_act_a, fee_adh, fee_part, fee_vit,
              } = body;
              if (member_fee === undefined) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta parámetro member_fee" }));
                return;
              }
              const { upsertDuesConfig } = await import("./src/database/duesConfigRepository");
              const result = await upsertDuesConfig(
                member_fee, consideration_years ?? 0,
                nicho_member_fee ?? 0, nicho_non_member_fee ?? 0,
                urna_member_fee ?? 0, urna_non_member_fee ?? 0,
                bolsa_member_fee ?? 0, bolsa_non_member_fee ?? 0,
                asistencial_fee ?? 0, plan_salud_fee ?? 0,
                fee_act ?? 0, fee_act_a ?? 0, fee_adh ?? 0, fee_part ?? 0, fee_vit ?? 0,
              );
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }
            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }
            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isDuesConfigHistory) {
            if (req.method === "GET") {
              const { getPricingHistory } = await import("./src/database/duesConfigRepository");
              const history = await getPricingHistory();
              res.statusCode = 200;
              res.end(JSON.stringify(history));
              return;
            }
            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }
            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isReceiptCopiesConfig) {
            if (req.method === "GET") {
              const { getAllReceiptConcepts } = await import("./src/database/receiptCopiesConfigRepository");
              const concepts = await getAllReceiptConcepts();
              res.statusCode = 200;
              res.end(JSON.stringify({ concepts }));
              return;
            }
            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req));
              const { concepts } = body;
              if (!Array.isArray(concepts)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta parámetro concepts" }));
                return;
              }
              const { saveAllReceiptConcepts } = await import("./src/database/receiptCopiesConfigRepository");
              const result = await saveAllReceiptConcepts(concepts);
              res.statusCode = 200;
              res.end(JSON.stringify({ concepts: result }));
              return;
            }
            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isFrontendErrors) {
            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req));
              console.error("[frontend]", body.type, body.message, body.url ?? "");
              if (body.stack) console.error("[frontend] stack:", body.stack);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
              return;
            }
            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isServices) {
            const { getAllServices, insertService, updateService, deleteService } = await import("./src/database/servicesRepository");
            if (req.method === "GET") {
              const services = await getAllServices();
              res.statusCode = 200;
              res.end(JSON.stringify(services));
              return;
            }
            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.name?.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el name del servicio" }));
                return;
              }
              const result = await insertService(body.name.trim(), body.amount ?? 0);
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }
            if (req.method === "PUT") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.id || !body?.name?.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Faltan parámetros id y/o name" }));
                return;
              }
              const result = await updateService(body.id, body.name.trim(), body.amount ?? 0);
              if (!result) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Servicio no encontrado" }));
                return;
              }
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }
            if (req.method === "DELETE") {
              const id = url.searchParams.get("id");
              if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro id" }));
                return;
              }
              await deleteService(id);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
              return;
            }
            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }
            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isServiceRecords) {
            const {
              getAllServiceRecords,
              getServiceRecordById,
              getServiceRecordsByMember,
              getServiceRecordsByPerson,
              getServiceRecordsByMovement,
              insertServiceRecord,
              updateServiceRecord,
              deleteServiceRecord,
            } = await import("./src/database/serviceRecordsRepository");

            if (req.method === "GET") {
              const id = url.searchParams.get("id");
              const memberId = url.searchParams.get("memberId");
              const personId = url.searchParams.get("personId");
              const movementId = url.searchParams.get("movementId");

              if (id) {
                const record = await getServiceRecordById(id);
                if (!record) {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: "Registro no encontrado" }));
                  return;
                }
                res.statusCode = 200;
                res.end(JSON.stringify(record));
                return;
              }
              if (memberId) {
                const records = await getServiceRecordsByMember(memberId);
                res.statusCode = 200;
                res.end(JSON.stringify(records));
                return;
              }
              if (personId) {
                const records = await getServiceRecordsByPerson(personId);
                res.statusCode = 200;
                res.end(JSON.stringify(records));
                return;
              }
              if (movementId) {
                const records = await getServiceRecordsByMovement(movementId);
                res.statusCode = 200;
                res.end(JSON.stringify(records));
                return;
              }

              const records = await getAllServiceRecords();
              res.statusCode = 200;
              res.end(JSON.stringify(records));
              return;
            }

            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req));
              const { service_id, member_id, person_id, movement_id, amount, date, service_date, detail } = body;
              if (!date) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro date" }));
                return;
              }
              if (!member_id && !person_id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Se requiere member_id o person_id" }));
                return;
              }
              const result = await insertServiceRecord({
                service_id,
                member_id: member_id ?? null,
                person_id: person_id ?? null,
                movement_id: movement_id ?? null,
                amount: amount ?? 0,
                date,
                service_date: service_date ?? null,
                detail: detail ?? null,
              });
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (req.method === "PUT") {
              const body = JSON.parse(await collectBody(req));
              const { id, service_id, member_id, person_id, movement_id, amount, date, service_date, detail } = body;
              if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro id" }));
                return;
              }
              const result = await updateServiceRecord(id, {
                service_id,
                member_id: member_id ?? null,
                person_id: person_id ?? null,
                movement_id: movement_id ?? null,
                amount,
                date,
                service_date: service_date ?? null,
                detail: detail ?? null,
              });
              if (!result) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Registro no encontrado" }));
                return;
              }
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (req.method === "DELETE") {
              const id = url.searchParams.get("id");
              if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro id" }));
                return;
              }
              await deleteServiceRecord(id);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
              return;
            }

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isSpecialServices) {
            const {
              getAllSpecialServices,
              insertSpecialService,
              updateSpecialService,
              deleteSpecialService,
            } = await import("./src/database/specialServicesRepository");

            if (req.method === "GET") {
              const services = await getAllSpecialServices();
              res.statusCode = 200;
              res.end(JSON.stringify(services));
              return;
            }

            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.name?.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el nombre del servicio especial" }));
                return;
              }
              const result = await insertSpecialService({
                name: body.name.trim(),
                detail: body.detail?.trim() || null,
                member_price: body.member_price ?? 0,
                person_price: body.person_price ?? 0,
                deposit_cost: body.deposit_cost ?? 0,
              });
              res.statusCode = 201;
              res.end(JSON.stringify(result));
              return;
            }

            if (req.method === "PUT") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.id || !body?.name?.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Faltan parámetros id y/o name" }));
                return;
              }
              const result = await updateSpecialService(body.id, {
                name: body.name.trim(),
                detail: body.detail?.trim() || null,
                member_price: body.member_price ?? 0,
                person_price: body.person_price ?? 0,
                deposit_cost: body.deposit_cost ?? 0,
              });
              if (!result) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Servicio especial no encontrado" }));
                return;
              }
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (req.method === "DELETE") {
              const id = url.searchParams.get("id");
              if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro id" }));
                return;
              }
              await deleteSpecialService(id);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
              return;
            }

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isSpecialServiceAddons) {
            const {
              getAllSpecialServiceAddons,
              getSpecialServiceAddonsByService,
              insertSpecialServiceAddon,
              updateSpecialServiceAddon,
              deleteSpecialServiceAddon,
            } = await import("./src/database/specialServiceAddonsRepository");

            if (req.method === "GET") {
              const serviceId = url.searchParams.get("serviceId");
              const addons = serviceId
                ? await getSpecialServiceAddonsByService(serviceId)
                : await getAllSpecialServiceAddons();
              res.statusCode = 200;
              res.end(JSON.stringify(addons));
              return;
            }

            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.special_service_id || !body?.name?.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Faltan el servicio especial y/o el nombre del añadido" }));
                return;
              }
              const result = await insertSpecialServiceAddon({
                special_service_id: body.special_service_id,
                name: body.name.trim(),
                cost: body.cost ?? 0,
              });
              res.statusCode = 201;
              res.end(JSON.stringify(result));
              return;
            }

            if (req.method === "PUT") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.id || !body?.name?.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Faltan parámetros id y/o name" }));
                return;
              }
              const result = await updateSpecialServiceAddon(body.id, {
                name: body.name.trim(),
                cost: body.cost ?? 0,
              });
              if (!result) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Añadido no encontrado" }));
                return;
              }
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (req.method === "DELETE") {
              const id = url.searchParams.get("id");
              if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro id" }));
                return;
              }
              await deleteSpecialServiceAddon(id);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
              return;
            }

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isSpecialServiceStatuses) {
            const {
              getAllSpecialServiceStatuses,
              insertSpecialServiceStatus,
              updateSpecialServiceStatus,
              deleteSpecialServiceStatus,
              reorderSpecialServiceStatus,
            } = await import("./src/database/specialServiceStatusesRepository");

            if (req.method === "GET") {
              const statuses = await getAllSpecialServiceStatuses();
              res.statusCode = 200;
              res.end(JSON.stringify(statuses));
              return;
            }

            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.label?.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el nombre del estado" }));
                return;
              }
              const color = typeof body.color === "string" && body.color.trim() ? body.color.trim() : "#475569";
              if (!/^#[0-9a-f]{6}$/i.test(color)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Color de estado inválido" }));
                return;
              }
              const result = await insertSpecialServiceStatus({
                label: body.label.trim(),
                color,
                includes_movement: body.includes_movement !== false,
                movement_type: body.movement_type === "egreso" ? "egreso" : "ingreso",
                is_default: typeof body.is_default === "boolean" ? body.is_default : undefined,
                movement_type_key:
                  typeof body.movement_type_key === "string" && body.movement_type_key
                    ? body.movement_type_key
                    : null,
              });
              res.statusCode = 201;
              res.end(JSON.stringify(result));
              return;
            }

            if (req.method === "PUT") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.key || !body?.label?.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Faltan parámetros key y/o label" }));
                return;
              }
              const color = typeof body.color === "string" ? body.color.trim() : "";
              if (!/^#[0-9a-f]{6}$/i.test(color)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Color de estado inválido" }));
                return;
              }
              const result = await updateSpecialServiceStatus(body.key, {
                label: body.label.trim(),
                color,
                includes_movement: body.includes_movement !== false,
                movement_type: body.movement_type === "egreso" ? "egreso" : "ingreso",
                is_default: typeof body.is_default === "boolean" ? body.is_default : undefined,
                movement_type_key:
                  typeof body.movement_type_key === "string" && body.movement_type_key
                    ? body.movement_type_key
                    : null,
              });
              if (!result) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Estado no encontrado" }));
                return;
              }
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (req.method === "PATCH") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.key || typeof body.position !== "number") {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Faltan parámetros key y/o position" }));
                return;
              }
              const statuses = await reorderSpecialServiceStatus(body.key, body.position);
              res.statusCode = 200;
              res.end(JSON.stringify(statuses));
              return;
            }

            if (req.method === "DELETE") {
              const key = url.searchParams.get("key");
              if (!key) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro key" }));
                return;
              }
              try {
                await deleteSpecialServiceStatus(key);
              } catch (error) {
                res.statusCode = 409;
                res.end(
                  JSON.stringify({
                    error: error instanceof Error ? error.message : "No se pudo eliminar el estado",
                  })
                );
                return;
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
              return;
            }

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isSpecialServiceMovementTypes) {
            const {
              getAllSpecialServiceMovementTypes,
              insertSpecialServiceMovementType,
              updateSpecialServiceMovementType,
              deleteSpecialServiceMovementType,
            } = await import("./src/database/specialServiceMovementTypesRepository");

            if (req.method === "GET") {
              const movementTypes = await getAllSpecialServiceMovementTypes();
              res.statusCode = 200;
              res.end(JSON.stringify(movementTypes));
              return;
            }

            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.label?.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el nombre del movimiento" }));
                return;
              }
              const result = await insertSpecialServiceMovementType({
                label: body.label.trim(),
                includes_movement: body.includes_movement !== false,
                movement_type: body.movement_type === "egreso" ? "egreso" : "ingreso",
                is_default: typeof body.is_default === "boolean" ? body.is_default : undefined,
              });
              res.statusCode = 201;
              res.end(JSON.stringify(result));
              return;
            }

            if (req.method === "PUT") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.key || !body?.label?.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Faltan parámetros key y/o label" }));
                return;
              }
              const result = await updateSpecialServiceMovementType(body.key, {
                label: body.label.trim(),
                includes_movement: body.includes_movement !== false,
                movement_type: body.movement_type === "egreso" ? "egreso" : "ingreso",
                is_default: typeof body.is_default === "boolean" ? body.is_default : undefined,
              });
              if (!result) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Movimiento no encontrado" }));
                return;
              }
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (req.method === "DELETE") {
              const key = url.searchParams.get("key");
              if (!key) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro key" }));
                return;
              }
              try {
                await deleteSpecialServiceMovementType(key);
              } catch (error) {
                res.statusCode = 409;
                res.end(
                  JSON.stringify({
                    error:
                      error instanceof Error
                        ? error.message
                        : "No se pudo eliminar el movimiento",
                  })
                );
                return;
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
              return;
            }

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isSpecialServiceWorkflow) {
            const {
              getBaseSpecialServiceWorkflow,
              getSpecialServiceWorkflow,
              parseSpecialServiceWorkflowInput,
              saveSpecialServiceWorkflow,
            } = await import("./src/database/specialServiceWorkflowRepository");

            if (req.method === "GET") {
              const serviceId = url.searchParams.get("serviceId");
              const workflow = serviceId
                ? await getSpecialServiceWorkflow(serviceId)
                : await getBaseSpecialServiceWorkflow();
              if (!workflow) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Servicio especial no encontrado" }));
                return;
              }
              res.statusCode = 200;
              res.end(JSON.stringify(workflow));
              return;
            }

            if (req.method === "PUT") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.special_service_id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el servicio especial" }));
                return;
              }
              try {
                const result = await saveSpecialServiceWorkflow(
                  body.special_service_id,
                  parseSpecialServiceWorkflowInput(body)
                );
                if (!result) {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: "Servicio especial no encontrado" }));
                  return;
                }
                res.statusCode = 200;
                res.end(JSON.stringify(result));
              } catch (error) {
                res.statusCode = 400;
                res.end(
                  JSON.stringify({
                    error:
                      error instanceof Error
                        ? error.message
                        : "No se pudo guardar la configuración del servicio",
                  })
                );
              }
              return;
            }

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isSpecialServiceRecordMovements) {
            const {
              getSpecialServiceRecordMovements,
              insertSpecialServiceRecordMovement,
              deleteSpecialServiceRecordMovement,
            } = await import("./src/database/specialServiceMovementTypesRepository");

            if (req.method === "GET") {
              const recordId = url.searchParams.get("recordId");
              if (!recordId) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro recordId" }));
                return;
              }
              const movements = await getSpecialServiceRecordMovements(recordId);
              res.statusCode = 200;
              res.end(JSON.stringify(movements));
              return;
            }

            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.record_id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el registro de servicio especial" }));
                return;
              }
              if (!body?.date) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta la fecha del movimiento" }));
                return;
              }
              try {
                const { checkSpecialServiceRecordMovementType } = await import("./src/database/specialServiceWorkflowRepository");

                const movementError = await checkSpecialServiceRecordMovementType(

                  body.record_id,

                  body.movement_type_key ?? null

                );

                if (movementError) {

                  res.statusCode = 400;

                  res.end(JSON.stringify({ error: movementError }));

                  return;

                }

                const result = await insertSpecialServiceRecordMovement({
                  record_id: body.record_id,
                  movement_type_key: body.movement_type_key ?? null,
                  label: typeof body.label === "string" ? body.label : undefined,
                  movement_type:
                    body.movement_type === "egreso"
                      ? "egreso"
                      : body.movement_type === "ingreso"
                        ? "ingreso"
                        : undefined,
                  includes_movement:
                    typeof body.includes_movement === "boolean"
                      ? body.includes_movement
                      : undefined,
                  amount: Number(body.amount) || 0,
                  date: body.date,
                  mode: body.mode === "transferencia" ? "transferencia" : "efectivo",
                });
                res.statusCode = 201;
                res.end(JSON.stringify(result));
              } catch (error) {
                res.statusCode = 400;
                res.end(
                  JSON.stringify({
                    error:
                      error instanceof Error
                        ? error.message
                        : "No se pudo registrar el movimiento",
                  })
                );
              }
              return;
            }

            if (req.method === "DELETE") {
              const id = url.searchParams.get("id");
              if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro id" }));
                return;
              }
              await deleteSpecialServiceRecordMovement(id);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
              return;
            }

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isSpecialServiceRecords) {
            const {
              getAllSpecialServiceRecords,
              getSpecialServiceRecordById,
              getSpecialServiceRecordsByMember,
              getSpecialServiceRecordsByPerson,
              getSpecialServiceRecordsByMovement,
              insertSpecialServiceRecord,
              updateSpecialServiceRecord,
              cancelSpecialServiceRecord,
            } = await import("./src/database/specialServiceRecordsRepository");
            const { specialServiceStatusExists } = await import(
              "./src/database/specialServiceStatusesRepository"
            );
            const { migrateSpecialServiceMovementTypesSchema } = await import(
              "./src/database/specialServiceMovementTypesRepository"
            );

            if (req.method === "GET") {
              const id = url.searchParams.get("id");
              const memberId = url.searchParams.get("memberId");
              const personId = url.searchParams.get("personId");
              const movementId = url.searchParams.get("movementId");

              if (movementId) {
                await migrateSpecialServiceMovementTypesSchema();
              }
              if (id) {
                const record = await getSpecialServiceRecordById(id);
                if (!record) {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: "Registro de servicio especial no encontrado" }));
                  return;
                }
                res.statusCode = 200;
                res.end(JSON.stringify(record));
                return;
              }
              if (memberId) {
                const records = await getSpecialServiceRecordsByMember(memberId);
                res.statusCode = 200;
                res.end(JSON.stringify(records));
                return;
              }
              if (personId) {
                const records = await getSpecialServiceRecordsByPerson(personId);
                res.statusCode = 200;
                res.end(JSON.stringify(records));
                return;
              }
              if (movementId) {
                const records = await getSpecialServiceRecordsByMovement(movementId);
                res.statusCode = 200;
                res.end(JSON.stringify(records));
                return;
              }

              const records = await getAllSpecialServiceRecords();
              res.statusCode = 200;
              res.end(JSON.stringify(records));
              return;
            }

            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.special_service_id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el servicio especial" }));
                return;
              }
              if (!body?.date) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta la fecha" }));
                return;
              }
              if (body.status !== undefined && !(await specialServiceStatusExists(body.status))) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Estado de servicio especial inválido" }));
                return;
              }
              const { checkSpecialServiceRecordStatus } = await import("./src/database/specialServiceWorkflowRepository");

              const statusError = await checkSpecialServiceRecordStatus({

                serviceId: body.special_service_id,

                status: body.status,

              });

              if (statusError) {

                res.statusCode = 400;

                res.end(JSON.stringify({ error: statusError }));

                return;

              }

              const result = await insertSpecialServiceRecord({
                special_service_id: body.special_service_id,
                member_id: body.member_id ?? null,
                person_id: body.person_id ?? null,
                amount: body.amount ?? 0,
                date: body.date,
                service_date: body.service_date ?? null,
                status: body.status,
                addons: Array.isArray(body.addons) ? body.addons : [],
              });
              res.statusCode = 201;
              res.end(JSON.stringify(result));
              return;
            }

            if (req.method === "PUT") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro id" }));
                return;
              }
              if (body.status !== undefined && !(await specialServiceStatusExists(body.status))) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Estado de servicio especial inválido" }));
                return;
              }
              const { checkSpecialServiceRecordStatus } = await import("./src/database/specialServiceWorkflowRepository");

              const statusError = await checkSpecialServiceRecordStatus({

                recordId: body.id,

                serviceId: body.special_service_id,

                status: body.status,

              });

              if (statusError) {

                res.statusCode = 400;

                res.end(JSON.stringify({ error: statusError }));

                return;

              }

              const result = await updateSpecialServiceRecord(body.id, {
                special_service_id: body.special_service_id,
                member_id: body.member_id,
                person_id: body.person_id,
                amount: body.amount,
                date: body.date,
                service_date: body.service_date,
                status: body.status,
              });
              if (!result) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Registro de servicio especial no encontrado" }));
                return;
              }
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (req.method === "DELETE") {
              const id = url.searchParams.get("id");
              if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro id" }));
                return;
              }
              const result = await cancelSpecialServiceRecord(id);
              if (!result) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Registro de servicio especial no encontrado" }));
                return;
              }
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isUsers) {
            if (req.method === "GET") {
              const { getAllAppUsers } = await import("./src/database/usersRepository");
              const users = await getAllAppUsers();
              res.statusCode = 200;
              res.end(JSON.stringify(users));
              return;
            }
            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req));
              const { auth_user_id, email, name, role } = body;
              if (!auth_user_id || !email) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Faltan auth_user_id y/o email" }));
                return;
              }
              const { upsertAppUser } = await import("./src/database/usersRepository");
              const user = await upsertAppUser(auth_user_id, email, name ?? null, role ?? "secretario");
              res.statusCode = 200;
              res.end(JSON.stringify(user));
              return;
            }
            if (req.method === "PATCH") {
              const body = JSON.parse(await collectBody(req));
              const { auth_user_id, role } = body;
              if (!auth_user_id || !role) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Faltan auth_user_id y/o role" }));
                return;
              }
              const { updateAppUserRole } = await import("./src/database/usersRepository");
              const user = await updateAppUserRole(auth_user_id, role);
              if (!user) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Usuario no encontrado" }));
                return;
              }
              res.statusCode = 200;
              res.end(JSON.stringify(user));
              return;
            }
            if (req.method === "DELETE") {
              const authUserId = url.searchParams.get("auth_user_id");
              if (!authUserId) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el parámetro auth_user_id" }));
                return;
              }
              const { deleteAppUser } = await import("./src/database/usersRepository");
              await deleteAppUser(authUserId);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
              return;
            }
            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }
          }

          if (isVitalicios && req.method === "PATCH") {
            const { updateVitalicios } = await import("./src/database/membersRepository");
            const count = await updateVitalicios();
            res.statusCode = 200;
            res.end(JSON.stringify({ updated: count }));
            return;
          }

          if (isCementerioMovimientos) {
            const {
              getCementerioMovimientosByMovement,
              getCementerioMovimientosByNicho,
              getCementerioMovimientosByNichoAndArrendatario,
              insertCementerioMovimiento,
              hasCementerioMovimientosByNicho,
              getCementerioPagosMap,
            } = await import("./src/database/cementerioMovimientosRepository");

            if (req.method === "GET") {
              const movementId = url.searchParams.get("movementId");
              const nicho = url.searchParams.get("nicho");
              const hasNicho = url.searchParams.get("hasNicho");
              const pagosMap = url.searchParams.get("pagosMap") === "true";
              const memberId = url.searchParams.get("memberId");
              const personId = url.searchParams.get("personId");

              if (pagosMap) {
                const map = await getCementerioPagosMap();
                res.statusCode = 200;
                res.end(JSON.stringify(map));
                return;
              }
              if (hasNicho) {
                const exists = await hasCementerioMovimientosByNicho(hasNicho);
                res.statusCode = 200;
                res.end(JSON.stringify({ exists }));
                return;
              }
              if (movementId) {
                const records = await getCementerioMovimientosByMovement(movementId);
                res.statusCode = 200;
                res.end(JSON.stringify(records));
                return;
              }
              if (nicho) {
                const records = (memberId || personId)
                  ? await getCementerioMovimientosByNichoAndArrendatario(nicho, memberId, personId)
                  : await getCementerioMovimientosByNicho(nicho);
                res.statusCode = 200;
                res.end(JSON.stringify(records));
                return;
              }
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Falta el parámetro movementId o nicho" }));
              return;
            }

            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.movement_id || !body?.nicho || !body?.fecha_pago) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Faltan datos requeridos (movement_id, nicho, fecha_pago)" }));
                return;
              }
              const id = await insertCementerioMovimiento({
                movement_id: body.movement_id,
                cementerio_id: body.cementerio_id ?? null,
                nicho: body.nicho,
                tipo: body.tipo ?? null,
                ocupante: body.ocupante ?? null,
                anios_pagados: body.anios_pagados ?? [],
                importe: body.importe ?? 0,
                fecha_pago: body.fecha_pago,
                member_id: body.member_id ?? null,
                person_id: body.person_id ?? null,
              });
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, id }));
              return;
            }

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isDebts) {
            const {
              getDebtsByMember,
              getDebtsByPerson,
              getDebtsByMovementId,
              insertDebt,
            } = await import("./src/database/debtsRepository");

            if (req.method === "GET") {
              const memberId = url.searchParams.get("memberId");
              const personId = url.searchParams.get("personId");
              const movementId = url.searchParams.get("movementId");

              if (movementId) {
                const debts = await getDebtsByMovementId(movementId);
                res.statusCode = 200;
                res.end(JSON.stringify(debts));
                return;
              }
              if (memberId) {
                const debts = await getDebtsByMember(memberId);
                res.statusCode = 200;
                res.end(JSON.stringify(debts));
                return;
              }
              if (personId) {
                const debts = await getDebtsByPerson(personId);
                res.statusCode = 200;
                res.end(JSON.stringify(debts));
                return;
              }
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Falta el parámetro memberId, personId o movementId" }));
              return;
            }

            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req));
              if (!body?.type || body.amount === undefined || !body?.date) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Faltan datos requeridos (type, amount, date)" }));
                return;
              }
              if (!body.member_id && !body.person_id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Se requiere member_id o person_id" }));
                return;
              }
              const id = await insertDebt({
                member_id: body.member_id ?? null,
                person_id: body.person_id ?? null,
                type: body.type,
                description: body.description ?? null,
                amount: body.amount,
                movement_id: body.movement_id ?? null,
                date: body.date,
              });
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, id }));
              return;
            }

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isDebtsBalance) {
            const {
              getBalanceByMember,
              getBalanceByPerson,
            } = await import("./src/database/debtsRepository");

            if (req.method === "GET") {
              const memberId = url.searchParams.get("memberId");
              const personId = url.searchParams.get("personId");

              if (memberId) {
                const balance = await getBalanceByMember(memberId);
                res.statusCode = 200;
                res.end(JSON.stringify({ balance }));
                return;
              }
              if (personId) {
                const balance = await getBalanceByPerson(personId);
                res.statusCode = 200;
                res.end(JSON.stringify({ balance }));
                return;
              }
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Falta el parámetro memberId o personId" }));
              return;
            }

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isExternalServices) {
            const {
              getAllExternalServices,
              insertExternalService,
              updateExternalService,
              deleteExternalService,
            } = await import("./src/database/externalServicesRepository");

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }
            if (req.method === "GET") {
              const rows = await getAllExternalServices();
              res.statusCode = 200;
              res.end(JSON.stringify(rows));
              return;
            }
            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req)) as { name: string; phone?: string | null; description?: string | null; frequency?: string; start_month?: number | null };
              if (!body.name?.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el nombre" }));
                return;
              }
              const row = await insertExternalService(body.name.trim(), body.phone ?? null, body.description ?? null, body.frequency ?? "mensual", body.start_month ?? null);
              res.statusCode = 201;
              res.end(JSON.stringify(row));
              return;
            }
            if (req.method === "PUT") {
              const body = JSON.parse(await collectBody(req)) as { id: string; name: string; phone?: string | null; description?: string | null; frequency?: string; start_month?: number | null; active: boolean };
              if (!body.id || !body.name?.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Faltan campos" }));
                return;
              }
              const row = await updateExternalService(body.id, body.name.trim(), body.phone ?? null, body.description ?? null, body.frequency ?? "mensual", body.start_month ?? null, body.active);
              if (!row) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "No encontrado" }));
                return;
              }
              res.statusCode = 200;
              res.end(JSON.stringify(row));
              return;
            }
            if (req.method === "DELETE") {
              const id = url.searchParams.get("id");
              if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el id" }));
                return;
              }
              await deleteExternalService(id);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
              return;
            }
            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          if (isExternalServicePayments) {
            const {
              getPaymentsByYear,
              upsertPayment,
              deletePayment,
            } = await import("./src/database/externalServicePaymentsRepository");

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }
            if (req.method === "GET") {
              const year = parseInt(url.searchParams.get("year") ?? "", 10);
              if (isNaN(year)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Falta el año" }));
                return;
              }
              const rows = await getPaymentsByYear(year);
              res.statusCode = 200;
              res.end(JSON.stringify(rows));
              return;
            }
            if (req.method === "POST") {
              const body = JSON.parse(await collectBody(req)) as {
                service_id: string; month: number; year: number; amount: number | null; movement_id: string | null;
              };
              if (!body.service_id || !body.month || !body.year) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Faltan campos" }));
                return;
              }
              const row = await upsertPayment(body.service_id, body.month, body.year, body.amount ?? null, body.movement_id ?? null);
              res.statusCode = 200;
              res.end(JSON.stringify(row));
              return;
            }
            if (req.method === "DELETE") {
              const body = JSON.parse(await collectBody(req)) as { service_id: string; month: number; year: number };
              if (!body.service_id || !body.month || !body.year) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Faltan campos" }));
                return;
              }
              await deletePayment(body.service_id, body.month, body.year);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
              return;
            }
            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Método no permitido" }));
            return;
          }

          next();
        } catch (error) {
          console.error(`API ${req.url}:`, error);
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: "No se pudieron cargar los datos desde la base de datos",
            })
          );
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
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
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
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
