import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse, pathname: string) {
  const method = req.method ?? "GET";

  try {
    if (method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (pathname === "/api/members" && method === "GET") {
      const { getAllMembers } = await import("../src/database/membersRepository.js");
      const members = await getAllMembers();
      res.status(200).json(members);
      return;
    }

    if (pathname === "/api/members/search" && method === "GET") {
      const q = (req.query.q as string) || "";
      if (q) {
        const { searchActiveMembers } = await import("../src/database/membersRepository.js");
        const members = await searchActiveMembers(q);
        res.status(200).json(members);
      } else {
        res.status(400).json({ error: "Falta el parámetro q" });
      }
      return;
    }

    if (pathname === "/api/members/family" && method === "GET") {
      const memberId = req.query.memberId as string | undefined;
      if (!memberId) {
        res.status(400).json({ error: "Falta el parámetro memberId" });
        return;
      }
      const { getFamilyMembers } = await import("../src/database/membersRepository.js");
      const members = await getFamilyMembers(memberId);
      res.status(200).json(members);
      return;
    }

    if (pathname === "/api/members/debt-status" && method === "GET") {
      const { getMembersDebtStatus } = await import("../src/database/duesRepository.js");
      const { getDuesConfig } = await import("../src/database/duesConfigRepository.js");
      const [members, config] = await Promise.all([
        getMembersDebtStatus(),
        getDuesConfig(),
      ]);
      res.status(200).json({
        members,
        consideration_years: config?.consideration_years ?? 0,
      });
      return;
    }

    if (pathname === "/api/members/vitalicios" && method === "PATCH") {
      const { updateVitalicios } = await import("../src/database/membersRepository.js");
      const count = await updateVitalicios();
      res.status(200).json({ updated: count });
      return;
    }

    if (pathname === "/api/persons" && method === "GET") {
      const q = (req.query.q as string) || "";
      if (q) {
        const { searchPersons } = await import("../src/database/membersRepository.js");
        const persons = await searchPersons(q);
        res.status(200).json(persons);
      } else {
        const { getAllPersons } = await import("../src/database/personsRepository.js");
        const persons = await getAllPersons();
        res.status(200).json(persons);
      }
      return;
    }

    if (pathname === "/api/movements" && method === "GET") {
      const { getAllMovements } = await import("../src/database/pettyCashRepository.js");
      const { getComprobantesByMovementIds } = await import("../src/database/comprobantesRepository.js");
      const movements = await getAllMovements();
      const movementIds = movements.map((m) => m.id);
      const comprobantes = await getComprobantesByMovementIds(movementIds);
      const comprobanteByMovement = new Map(comprobantes.map((c) => [c.movement_id, c]));
      const movementsWithComprobante = movements.map((m) => ({
        ...m,
        comprobante: comprobanteByMovement.get(m.id) ?? null,
      }));
      res.status(200).json(movementsWithComprobante);
      return;
    }

    if (pathname === "/api/movement") {
      const { getMovementById, updateMovement, setMovementAnulado } = await import("../src/database/pettyCashRepository.js");
      const { getDueByMovementId, updateDueByMovementId } = await import("../src/database/duesRepository.js");
      const { getServiceRecordsByMovement } = await import("../src/database/serviceRecordsRepository.js");
      const { getCementerioMovimientosByMovement } = await import("../src/database/cementerioMovimientosRepository.js");
      const { getComprobanteByMovementId } = await import("../src/database/comprobantesRepository.js");
      const { getSpecialServiceRecordsByMovement } = await import("../src/database/specialServiceRecordsRepository.js");
      const { migrateSpecialServiceMovementTypesSchema } = await import("../src/database/specialServiceMovementTypesRepository.js");
      const id = req.query.id as string | undefined;

      if (!id) {
        res.status(400).json({ error: "Falta el parámetro id" });
        return;
      }

      if (method === "GET") {
        const movement = await getMovementById(id);
        if (!movement) {
          res.status(404).json({ error: "Movimiento no encontrado" });
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
        res.status(200).json({ ...movement, linked_due: due, linked_service_records: serviceRecords, linked_cementerio_movimientos: cementerioMovimientos, linked_special_service_records: specialServiceRecords, comprobante });
        return;
      }

      if (method === "PUT") {
        const data = req.body;
        if (!data) {
          res.status(400).json({ error: "Faltan datos" });
          return;
        }
        const { due: dueData, ...movementData } = data;
        await updateMovement(id, movementData);
        if (dueData) {
          await updateDueByMovementId(id, dueData);
        }
        res.status(200).json({ success: true });
        return;
      }

      if (method === "PATCH") {
        await setMovementAnulado(id, req.body?.anulado !== false);
        res.status(200).json({ success: true });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/member") {
      if (method === "GET") {
        const id = req.query.id as string | undefined;
        if (!id) {
          res.status(400).json({ error: "Falta el parámetro id" });
          return;
        }
        const { getMemberById } = await import("../src/database/membersRepository.js");
        const member = await getMemberById(id);
        if (!member) {
          res.status(404).json({ error: "Socio no encontrado" });
          return;
        }
        res.status(200).json(member);
        return;
      }

      if (method === "POST") {
        const member = req.body;
        if (!member?.numeroDeSocio) {
          res.status(400).json({ error: "Falta el número de socio" });
          return;
        }
        const { upsertMember } = await import("../src/database/membersRepository.js");
        await upsertMember(member);
        res.status(200).json({ success: true });
        return;
      }

      if (method === "DELETE") {
        const id = req.query.id as string | undefined;
        if (!id) {
          res.status(400).json({ error: "Falta el parámetro id" });
          return;
        }
        const { deleteMemberById } = await import("../src/database/membersRepository.js");
        await deleteMemberById(id);
        res.status(200).json({ success: true });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/person") {
      if (method === "GET") {
        const id = req.query.id as string | undefined;
        if (!id) {
          res.status(400).json({ error: "Falta el parámetro id" });
          return;
        }
        const { getPersonById } = await import("../src/database/personsRepository.js");
        const person = await getPersonById(id);
        if (!person) {
          res.status(404).json({ error: "Persona no encontrada" });
          return;
        }
        res.status(200).json(person);
        return;
      }

      if (method === "POST") {
        const person = req.body;
        if (!person?.nombre?.trim()) {
          res.status(400).json({ error: "Falta el nombre de la persona" });
          return;
        }
        const { upsertPerson } = await import("../src/database/personsRepository.js");
        await upsertPerson(person);
        res.status(200).json({ success: true });
        return;
      }

      if (method === "DELETE") {
        const id = req.query.id as string | undefined;
        if (!id) {
          res.status(400).json({ error: "Falta el parámetro id" });
          return;
        }
        const { deletePersonById } = await import("../src/database/personsRepository.js");
        await deletePersonById(id);
        res.status(200).json({ success: true });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/person-members" && method === "GET") {
      const personId = req.query.personId as string | undefined;
      if (!personId) {
        res.status(400).json({ error: "Falta el parámetro personId" });
        return;
      }
      const { getMembersByPersonId } = await import("../src/database/personsRepository.js");
      const members = await getMembersByPersonId(personId);
      res.status(200).json(members);
      return;
    }

    if (pathname === "/api/service-providers" && method === "GET") {
      const { getServiceProviders } = await import("../src/database/personsRepository.js");
      const providers = await getServiceProviders();
      res.status(200).json(providers);
      return;
    }

    if (pathname === "/api/initial-balances") {
      if (method === "GET") {
        const { getInitialBalances } = await import("../src/database/initialBalancesRepository.js");
        const balances = await getInitialBalances();
        res.status(200).json(balances);
        return;
      }

      if (method === "POST") {
        const { caja_chica, banco, comprobante_ingreso, comprobante_egreso } = req.body as {
          caja_chica?: number;
          banco?: number;
          comprobante_ingreso?: number;
          comprobante_egreso?: number;
        };
        if (caja_chica === undefined || banco === undefined) {
          res.status(400).json({ error: "Faltan parámetros caja_chica y/o banco" });
          return;
        }
        const { upsertInitialBalances } = await import("../src/database/initialBalancesRepository.js");
        const result = await upsertInitialBalances(caja_chica, banco, comprobante_ingreso, comprobante_egreso);
        res.status(200).json(result);
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/payment" && method === "POST") {
      const payment = req.body;
      if (!payment?.date || payment?.amount == null) {
        res.status(400).json({ error: "Faltan datos requeridos" });
        return;
      }
      const { insertMovement } = await import("../src/database/pettyCashRepository.js");
      const movementId = await insertMovement({
        date: payment.date,
        detail: payment.detail,
        amount: payment.amount,
        type: payment.type || "ingreso",
        mode: payment.mode,
        concept: payment.concept ?? null,
      });
      res.status(200).json({ success: true, id: movementId });
      return;
    }

    if (pathname === "/api/receipt/next" && method === "POST") {
      const { type } = req.body as { type?: string };
      if (type !== "ingreso" && type !== "egreso") {
        res.status(400).json({ error: "Tipo inválido (ingreso o egreso)" });
        return;
      }
      const { getNextAndIncrementReceipt } = await import("../src/database/initialBalancesRepository.js");
      const receiptNumber = await getNextAndIncrementReceipt(type);
      res.status(200).json({ receipt_number: receiptNumber });
      return;
    }

    if (pathname === "/api/comprobante" && method === "GET") {
      const movementId = req.query.movementId as string;
      if (!movementId) {
        res.status(400).json({ error: "Falta movementId" });
        return;
      }
      const { getComprobanteByMovementId } = await import("../src/database/comprobantesRepository.js");
      const comprobante = await getComprobanteByMovementId(movementId);
      res.status(200).json(comprobante);
      return;
    }

    if (pathname === "/api/comprobante" && method === "POST") {
      const data = req.body;
      if (!data?.movement_id || data?.receipt_number == null || !data?.detail) {
        res.status(400).json({ error: "Faltan datos requeridos" });
        return;
      }
      const { insertComprobante } = await import("../src/database/comprobantesRepository.js");
      const id = await insertComprobante({
        movement_id: data.movement_id,
        receipt_number: data.receipt_number,
        copies_to_print: data.copies_to_print ?? 1,
        detail: data.detail,
        concept: data.concept ?? null,
        payer_name: data.payer_name ?? null,
      });
      res.status(200).json({ success: true, id });
      return;
    }

    if (pathname === "/api/cementerios") {
      const {
        getAllCementeriosGrid,
        getCementeriosByNicho,
        getCementeriosByOwnerId,
        getCementerioOwnerIds,
        updateCementerio,
      } = await import("../src/database/cementeriosRepository.js");

      if (method === "GET") {
        const nicho = req.query.nicho as string | undefined;
        const ownerId = req.query.ownerId as string | undefined;
        const isSocio = req.query.isSocio === "true";
        const ownersOnly = req.query.owners === "true";

        if (ownersOnly) {
          const ids = await getCementerioOwnerIds();
          res.status(200).json(ids);
          return;
        }
        if (ownerId) {
          const items = await getCementeriosByOwnerId(ownerId, isSocio);
          res.status(200).json(items);
          return;
        }
        if (nicho) {
          const items = await getCementeriosByNicho(nicho);
          res.status(200).json(items);
        } else {
          const items = await getAllCementeriosGrid();
          res.status(200).json(items);
        }
        return;
      }

      if (method === "PATCH") {
        const id = req.query.id as string | undefined;
        if (!id) {
          res.status(400).json({ error: "Falta el parámetro id" });
          return;
        }
        const data = req.body;
        await updateCementerio(id, data);
        res.status(200).json({ success: true });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/cementerio-movimientos") {
      const {
        getCementerioMovimientosByMovement,
        getCementerioMovimientosByNicho,
        getCementerioMovimientosByNichoAndArrendatario,
        insertCementerioMovimiento,
        hasCementerioMovimientosByNicho,
        getCementerioPagosMap,
      } = await import("../src/database/cementerioMovimientosRepository.js");

      if (method === "GET") {
        const movementId = req.query.movementId as string | undefined;
        const nicho = req.query.nicho as string | undefined;
        const hasNicho = req.query.hasNicho as string | undefined;
        const pagosMap = req.query.pagosMap === "true";
        const memberId = req.query.memberId as string | null | undefined;
        const personId = req.query.personId as string | null | undefined;

        if (pagosMap) {
          const map = await getCementerioPagosMap();
          res.status(200).json(map);
          return;
        }
        if (hasNicho) {
          const exists = await hasCementerioMovimientosByNicho(hasNicho);
          res.status(200).json({ exists });
          return;
        }
        if (movementId) {
          const records = await getCementerioMovimientosByMovement(movementId);
          res.status(200).json(records);
          return;
        }
        if (nicho) {
          const records = (memberId || personId)
            ? await getCementerioMovimientosByNichoAndArrendatario(nicho, memberId ?? null, personId ?? null)
            : await getCementerioMovimientosByNicho(nicho);
          res.status(200).json(records);
          return;
        }
        res.status(400).json({ error: "Falta el parámetro movementId o nicho" });
        return;
      }

      if (method === "POST") {
        const body = req.body;
        if (!body?.movement_id || !body?.nicho || !body?.fecha_pago) {
          res.status(400).json({ error: "Faltan datos requeridos (movement_id, nicho, fecha_pago)" });
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
        res.status(200).json({ success: true, id });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/dues") {
      const {
        getAllDues,
        getDuesByMember,
        getDuesByPerson,
        insertDue,
        getDuesByMemberWithCemeteryCheck,
      } = await import("../src/database/duesRepository.js");

      if (method === "GET") {
        const memberId = req.query.memberId as string | undefined;
        const personId = req.query.personId as string | undefined;
        const check = req.query.check as string | undefined;

        if (memberId && check === "cementerio") {
          const result = await getDuesByMemberWithCemeteryCheck(memberId);
          res.status(200).json(result);
          return;
        }

        if (memberId) {
          const dues = await getDuesByMember(memberId);
          res.status(200).json(dues);
          return;
        }

        if (personId) {
          const dues = await getDuesByPerson(personId);
          res.status(200).json(dues);
          return;
        }

        const all = await getAllDues();
        res.status(200).json(all);
        return;
      }

      if (method === "POST") {
        const body = req.body;
        if (!body?.type || !body?.payment_date) {
          res.status(400).json({ error: "Faltan datos requeridos (type, payment_date)" });
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
        res.status(200).json({ success: true, id });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/dues-config") {
      if (method === "GET") {
        const { getDuesConfig } = await import("../src/database/duesConfigRepository.js");
        const config = await getDuesConfig();
        res.status(200).json(config);
        return;
      }

      if (method === "POST") {
        const {
          member_fee, consideration_years,
          nicho_member_fee, nicho_non_member_fee,
          urna_member_fee, urna_non_member_fee,
          bolsa_member_fee, bolsa_non_member_fee,
          asistencial_fee, plan_salud_fee,
          fee_act, fee_act_a, fee_adh, fee_part, fee_vit,
        } = req.body;
        if (member_fee === undefined) {
          res.status(400).json({ error: "Falta parámetro member_fee" });
          return;
        }
        const { upsertDuesConfig } = await import("../src/database/duesConfigRepository.js");
        const result = await upsertDuesConfig(
          member_fee, consideration_years ?? 0,
          nicho_member_fee ?? 0, nicho_non_member_fee ?? 0,
          urna_member_fee ?? 0, urna_non_member_fee ?? 0,
          bolsa_member_fee ?? 0, bolsa_non_member_fee ?? 0,
          asistencial_fee ?? 0, plan_salud_fee ?? 0,
          fee_act ?? 0, fee_act_a ?? 0, fee_adh ?? 0, fee_part ?? 0, fee_vit ?? 0,
        );
        res.status(200).json(result);
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/dues-config/history") {
      if (method === "GET") {
        const { getPricingHistory } = await import("../src/database/duesConfigRepository.js");
        const history = await getPricingHistory();
        res.status(200).json(history);
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/receipt-copies-config") {
      if (method === "GET") {
        const { getAllReceiptConcepts } = await import("../src/database/receiptCopiesConfigRepository.js");
        const concepts = await getAllReceiptConcepts();
        res.status(200).json({ concepts });
        return;
      }

      if (method === "POST") {
        const { concepts } = req.body;
        if (!Array.isArray(concepts)) {
          res.status(400).json({ error: "Falta parámetro concepts" });
          return;
        }
        const { saveAllReceiptConcepts } = await import("../src/database/receiptCopiesConfigRepository.js");
        const result = await saveAllReceiptConcepts(concepts);
        res.status(200).json({ concepts: result });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/frontend-errors") {
      if (method === "POST") {
        console.error("[frontend]", req.body?.type, req.body?.message, req.body?.url ?? "");
        if (req.body?.stack) console.error("[frontend] stack:", req.body.stack);
        res.status(200).json({ success: true });
        return;
      }
      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/services") {
      const { getAllServices, insertService, updateService, deleteService } = await import("../src/database/servicesRepository.js");

      if (method === "GET") {
        const services = await getAllServices();
        res.status(200).json(services);
        return;
      }

      if (method === "POST") {
        const { name, amount } = req.body;
        if (!name?.trim()) {
          res.status(400).json({ error: "Falta el name del servicio" });
          return;
        }
        const result = await insertService(name.trim(), amount ?? 0);
        res.status(200).json(result);
        return;
      }

      if (method === "PUT") {
        const { id, name, amount } = req.body;
        if (!id || !name?.trim()) {
          res.status(400).json({ error: "Faltan parámetros id y/o name" });
          return;
        }
        const result = await updateService(id, name.trim(), amount ?? 0);
        if (!result) {
          res.status(404).json({ error: "Servicio no encontrado" });
          return;
        }
        res.status(200).json(result);
        return;
      }

      if (method === "DELETE") {
        const id = req.query.id as string;
        if (!id) {
          res.status(400).json({ error: "Falta el parámetro id" });
          return;
        }
        await deleteService(id);
        res.status(200).json({ success: true });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/special-services") {
      const {
        getAllSpecialServices,
        insertSpecialService,
        updateSpecialService,
        deleteSpecialService,
      } = await import("../src/database/specialServicesRepository.js");

      if (method === "GET") {
        const services = await getAllSpecialServices();
        res.status(200).json(services);
        return;
      }

      if (method === "POST") {
        const { name, detail, member_price, person_price, deposit_cost } = req.body;
        if (!name?.trim()) {
          res.status(400).json({ error: "Falta el nombre del servicio especial" });
          return;
        }
        const result = await insertSpecialService({
          name: name.trim(),
          detail: detail?.trim() || null,
          member_price: member_price ?? 0,
          person_price: person_price ?? 0,
          deposit_cost: deposit_cost ?? 0,
        });
        res.status(201).json(result);
        return;
      }

      if (method === "PUT") {
        const { id, name, detail, member_price, person_price, deposit_cost } = req.body;
        if (!id || !name?.trim()) {
          res.status(400).json({ error: "Faltan parámetros id y/o name" });
          return;
        }
        const result = await updateSpecialService(id, {
          name: name.trim(),
          detail: detail?.trim() || null,
          member_price: member_price ?? 0,
          person_price: person_price ?? 0,
          deposit_cost: deposit_cost ?? 0,
        });
        if (!result) {
          res.status(404).json({ error: "Servicio especial no encontrado" });
          return;
        }
        res.status(200).json(result);
        return;
      }

      if (method === "DELETE") {
        const id = req.query.id as string | undefined;
        if (!id) {
          res.status(400).json({ error: "Falta el parámetro id" });
          return;
        }
        await deleteSpecialService(id);
        res.status(200).json({ success: true });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/service-records") {
      const {
        getAllServiceRecords,
        getServiceRecordById,
        getServiceRecordsByMember,
        getServiceRecordsByPerson,
        getServiceRecordsByMovement,
        insertServiceRecord,
        updateServiceRecord,
        deleteServiceRecord,
      } = await import("../src/database/serviceRecordsRepository.js");

      if (method === "GET") {
        const id = req.query.id as string | undefined;
        const memberId = req.query.memberId as string | undefined;
        const personId = req.query.personId as string | undefined;
        const movementId = req.query.movementId as string | undefined;

        if (id) {
          const record = await getServiceRecordById(id);
          if (!record) {
            res.status(404).json({ error: "Registro no encontrado" });
            return;
          }
          res.status(200).json(record);
          return;
        }
        if (memberId) {
          const records = await getServiceRecordsByMember(memberId);
          res.status(200).json(records);
          return;
        }
        if (personId) {
          const records = await getServiceRecordsByPerson(personId);
          res.status(200).json(records);
          return;
        }
        if (movementId) {
          const records = await getServiceRecordsByMovement(movementId);
          res.status(200).json(records);
          return;
        }

        const records = await getAllServiceRecords();
        res.status(200).json(records);
        return;
      }

      if (method === "POST") {
        const { service_id, member_id, person_id, movement_id, amount, date, service_date, detail } = req.body;
        if (!date) {
          res.status(400).json({ error: "Falta el parámetro date" });
          return;
        }
        if (!member_id && !person_id) {
          res.status(400).json({ error: "Se requiere member_id o person_id" });
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
        res.status(200).json(result);
        return;
      }

      if (method === "PUT") {
        const { id, service_id, member_id, person_id, movement_id, amount, date, service_date, detail } = req.body;
        if (!id) {
          res.status(400).json({ error: "Falta el parámetro id" });
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
          res.status(404).json({ error: "Registro no encontrado" });
          return;
        }
        res.status(200).json(result);
        return;
      }

      if (method === "DELETE") {
        const id = req.query.id as string;
        if (!id) {
          res.status(400).json({ error: "Falta el parámetro id" });
          return;
        }
        await deleteServiceRecord(id);
        res.status(200).json({ success: true });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/special-service-addons") {
      const {
        getAllSpecialServiceAddons,
        getSpecialServiceAddonsByService,
        insertSpecialServiceAddon,
        updateSpecialServiceAddon,
        deleteSpecialServiceAddon,
      } = await import("../src/database/specialServiceAddonsRepository.js");

      if (method === "GET") {
        const serviceId = req.query.serviceId as string | undefined;
        const addons = serviceId
          ? await getSpecialServiceAddonsByService(serviceId)
          : await getAllSpecialServiceAddons();
        res.status(200).json(addons);
        return;
      }

      if (method === "POST") {
        const { special_service_id, name, cost } = req.body;
        if (!special_service_id || !name?.trim()) {
          res.status(400).json({ error: "Faltan el servicio especial y/o el nombre del añadido" });
          return;
        }
        const result = await insertSpecialServiceAddon({
          special_service_id,
          name: name.trim(),
          cost: cost ?? 0,
        });
        res.status(201).json(result);
        return;
      }

      if (method === "PUT") {
        const { id, name, cost } = req.body;
        if (!id || !name?.trim()) {
          res.status(400).json({ error: "Faltan parámetros id y/o name" });
          return;
        }
        const result = await updateSpecialServiceAddon(id, {
          name: name.trim(),
          cost: cost ?? 0,
        });
        if (!result) {
          res.status(404).json({ error: "Añadido no encontrado" });
          return;
        }
        res.status(200).json(result);
        return;
      }

      if (method === "DELETE") {
        const id = req.query.id as string | undefined;
        if (!id) {
          res.status(400).json({ error: "Falta el parámetro id" });
          return;
        }
        await deleteSpecialServiceAddon(id);
        res.status(200).json({ success: true });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/special-service-statuses") {
      const {
        getAllSpecialServiceStatuses,
        insertSpecialServiceStatus,
        updateSpecialServiceStatus,
        deleteSpecialServiceStatus,
        reorderSpecialServiceStatus,
      } = await import("../src/database/specialServiceStatusesRepository.js");

      if (method === "GET") {
        const statuses = await getAllSpecialServiceStatuses();
        res.status(200).json(statuses);
        return;
      }

      if (method === "POST") {
        const { label, color } = req.body;
        if (!label?.trim()) {
          res.status(400).json({ error: "Falta el nombre del estado" });
          return;
        }
        const nextColor = typeof color === "string" && color.trim() ? color.trim() : "#475569";
        if (!/^#[0-9a-f]{6}$/i.test(nextColor)) {
          res.status(400).json({ error: "Color de estado inválido" });
          return;
        }
        const result = await insertSpecialServiceStatus({
          label: label.trim(),
          color: nextColor,
          includes_movement: req.body.includes_movement !== false,
          movement_type: req.body.movement_type === "egreso" ? "egreso" : "ingreso",
          is_default: typeof req.body.is_default === "boolean" ? req.body.is_default : undefined,
          movement_type_key:
            typeof req.body.movement_type_key === "string" && req.body.movement_type_key
              ? req.body.movement_type_key
              : null,
        });
        res.status(201).json(result);
        return;
      }

      if (method === "PUT") {
        const { key, label, color } = req.body;
        if (!key || !label?.trim()) {
          res.status(400).json({ error: "Faltan parámetros key y/o label" });
          return;
        }
        const nextColor = typeof color === "string" ? color.trim() : "";
        if (!/^#[0-9a-f]{6}$/i.test(nextColor)) {
          res.status(400).json({ error: "Color de estado inválido" });
          return;
        }
        const result = await updateSpecialServiceStatus(key, {
          label: label.trim(),
          color: nextColor,
          includes_movement: req.body.includes_movement !== false,
          movement_type: req.body.movement_type === "egreso" ? "egreso" : "ingreso",
          is_default: typeof req.body.is_default === "boolean" ? req.body.is_default : undefined,
          movement_type_key:
            typeof req.body.movement_type_key === "string" && req.body.movement_type_key
              ? req.body.movement_type_key
              : null,
        });
        if (!result) {
          res.status(404).json({ error: "Estado no encontrado" });
          return;
        }
        res.status(200).json(result);
        return;
      }

      if (method === "PATCH") {
        const { key, position } = req.body;
        if (!key || typeof position !== "number") {
          res.status(400).json({ error: "Faltan parámetros key y/o position" });
          return;
        }
        const statuses = await reorderSpecialServiceStatus(key, position);
        res.status(200).json(statuses);
        return;
      }

      if (method === "DELETE") {
        const key = req.query.key as string | undefined;
        if (!key) {
          res.status(400).json({ error: "Falta el parámetro key" });
          return;
        }
        try {
          await deleteSpecialServiceStatus(key);
        } catch (error) {
          res.status(409).json({
            error: error instanceof Error ? error.message : "No se pudo eliminar el estado",
          });
          return;
        }
        res.status(200).json({ success: true });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/special-service-movement-types") {
      const {
        getAllSpecialServiceMovementTypes,
        insertSpecialServiceMovementType,
        updateSpecialServiceMovementType,
        deleteSpecialServiceMovementType,
      } = await import("../src/database/specialServiceMovementTypesRepository.js");

      if (method === "GET") {
        const movementTypes = await getAllSpecialServiceMovementTypes();
        res.status(200).json(movementTypes);
        return;
      }

      if (method === "POST") {
        const { label } = req.body;
        if (!label?.trim()) {
          res.status(400).json({ error: "Falta el nombre del movimiento" });
          return;
        }
        const result = await insertSpecialServiceMovementType({
          label: label.trim(),
          includes_movement: req.body.includes_movement !== false,
          movement_type: req.body.movement_type === "egreso" ? "egreso" : "ingreso",
          is_default: typeof req.body.is_default === "boolean" ? req.body.is_default : undefined,
        });
        res.status(201).json(result);
        return;
      }

      if (method === "PUT") {
        const { key, label } = req.body;
        if (!key || !label?.trim()) {
          res.status(400).json({ error: "Faltan parámetros key y/o label" });
          return;
        }
        const result = await updateSpecialServiceMovementType(key, {
          label: label.trim(),
          includes_movement: req.body.includes_movement !== false,
          movement_type: req.body.movement_type === "egreso" ? "egreso" : "ingreso",
          is_default: typeof req.body.is_default === "boolean" ? req.body.is_default : undefined,
        });
        if (!result) {
          res.status(404).json({ error: "Movimiento no encontrado" });
          return;
        }
        res.status(200).json(result);
        return;
      }

      if (method === "DELETE") {
        const key = req.query.key as string | undefined;
        if (!key) {
          res.status(400).json({ error: "Falta el parámetro key" });
          return;
        }
        try {
          await deleteSpecialServiceMovementType(key);
        } catch (error) {
          res.status(409).json({
            error: error instanceof Error ? error.message : "No se pudo eliminar el movimiento",
          });
          return;
        }
        res.status(200).json({ success: true });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/special-service-workflow") {
      const {
        getBaseSpecialServiceWorkflow,
        getSpecialServiceWorkflow,
        parseSpecialServiceWorkflowInput,
        saveSpecialServiceWorkflow,
      } = await import("../src/database/specialServiceWorkflowRepository.js");

      if (method === "GET") {
        const serviceId = req.query.serviceId as string | undefined;
        const workflow = serviceId
          ? await getSpecialServiceWorkflow(serviceId)
          : await getBaseSpecialServiceWorkflow();
        if (!workflow) {
          res.status(404).json({ error: "Servicio especial no encontrado" });
          return;
        }
        res.status(200).json(workflow);
        return;
      }

      if (method === "PUT") {
        const { special_service_id } = req.body ?? {};
        if (!special_service_id) {
          res.status(400).json({ error: "Falta el servicio especial" });
          return;
        }
        try {
          const result = await saveSpecialServiceWorkflow(
            special_service_id,
            parseSpecialServiceWorkflowInput(req.body)
          );
          if (!result) {
            res.status(404).json({ error: "Servicio especial no encontrado" });
            return;
          }
          res.status(200).json(result);
        } catch (error) {
          res.status(400).json({
            error:
              error instanceof Error
                ? error.message
                : "No se pudo guardar la configuración del servicio",
          });
        }
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/special-service-record-movements") {
      const {
        getSpecialServiceRecordMovements,
        insertSpecialServiceRecordMovement,
        deleteSpecialServiceRecordMovement,
      } = await import("../src/database/specialServiceMovementTypesRepository.js");

      if (method === "GET") {
        const recordId = req.query.recordId as string | undefined;
        if (!recordId) {
          res.status(400).json({ error: "Falta el parámetro recordId" });
          return;
        }
        const movements = await getSpecialServiceRecordMovements(recordId);
        res.status(200).json(movements);
        return;
      }

      if (method === "POST") {
        const { record_id, date } = req.body;
        if (!record_id) {
          res.status(400).json({ error: "Falta el registro de servicio especial" });
          return;
        }
        if (!date) {
          res.status(400).json({ error: "Falta la fecha del movimiento" });
          return;
        }
        try {
          const { checkSpecialServiceRecordMovementType } = await import("../src/database/specialServiceWorkflowRepository.js");

          const movementError = await checkSpecialServiceRecordMovementType(

            record_id,

            req.body.movement_type_key ?? null

          );

          if (movementError) {

            res.status(400).json({ error: movementError });

            return;

          }

          const result = await insertSpecialServiceRecordMovement({
            record_id,
            movement_type_key: req.body.movement_type_key ?? null,
            label: typeof req.body.label === "string" ? req.body.label : undefined,
            movement_type:
              req.body.movement_type === "egreso"
                ? "egreso"
                : req.body.movement_type === "ingreso"
                  ? "ingreso"
                  : undefined,
            includes_movement:
              typeof req.body.includes_movement === "boolean"
                ? req.body.includes_movement
                : undefined,
            amount: Number(req.body.amount) || 0,
            date,
            mode: req.body.mode === "transferencia" ? "transferencia" : "efectivo",
          });
          res.status(201).json(result);
        } catch (error) {
          res.status(400).json({
            error: error instanceof Error ? error.message : "No se pudo registrar el movimiento",
          });
        }
        return;
      }

      if (method === "DELETE") {
        const id = req.query.id as string | undefined;
        if (!id) {
          res.status(400).json({ error: "Falta el parámetro id" });
          return;
        }
        await deleteSpecialServiceRecordMovement(id);
        res.status(200).json({ success: true });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/special-service-records") {
      const {
        getAllSpecialServiceRecords,
        getSpecialServiceRecordById,
        getSpecialServiceRecordsByMember,
        getSpecialServiceRecordsByPerson,
        getSpecialServiceRecordsByMovement,
        insertSpecialServiceRecord,
        updateSpecialServiceRecord,
        cancelSpecialServiceRecord,
      } = await import("../src/database/specialServiceRecordsRepository.js");
      const { specialServiceStatusExists } = await import(
        "../src/database/specialServiceStatusesRepository.js"
      );
      const { migrateSpecialServiceMovementTypesSchema } = await import(
        "../src/database/specialServiceMovementTypesRepository.js"
      );

      if (method === "GET") {
        const id = req.query.id as string | undefined;
        const memberId = req.query.memberId as string | undefined;
        const personId = req.query.personId as string | undefined;
        const movementId = req.query.movementId as string | undefined;

        if (movementId) {
          await migrateSpecialServiceMovementTypesSchema();
        }
        if (id) {
          const record = await getSpecialServiceRecordById(id);
          if (!record) {
            res.status(404).json({ error: "Registro de servicio especial no encontrado" });
            return;
          }
          res.status(200).json(record);
          return;
        }
        if (memberId) {
          const records = await getSpecialServiceRecordsByMember(memberId);
          res.status(200).json(records);
          return;
        }
        if (personId) {
          const records = await getSpecialServiceRecordsByPerson(personId);
          res.status(200).json(records);
          return;
        }
        if (movementId) {
          const records = await getSpecialServiceRecordsByMovement(movementId);
          res.status(200).json(records);
          return;
        }

        const records = await getAllSpecialServiceRecords();
        res.status(200).json(records);
        return;
      }

      if (method === "POST") {
        const {
          special_service_id,
          member_id,
          person_id,
          amount,
          date,
          service_date,
          status,
        } = req.body;
        if (!special_service_id) {
          res.status(400).json({ error: "Falta el servicio especial" });
          return;
        }
        if (!date) {
          res.status(400).json({ error: "Falta la fecha" });
          return;
        }
        if (status !== undefined && !(await specialServiceStatusExists(status))) {
          res.status(400).json({ error: "Estado de servicio especial inválido" });
          return;
        }
        const { checkSpecialServiceRecordStatus } = await import("../src/database/specialServiceWorkflowRepository.js");

        const statusError = await checkSpecialServiceRecordStatus({

          serviceId: special_service_id,

          status,

        });

        if (statusError) {

          res.status(400).json({ error: statusError });

          return;

        }

        const result = await insertSpecialServiceRecord({
          special_service_id,
          member_id: member_id ?? null,
          person_id: person_id ?? null,
          amount: amount ?? 0,
          date,
          service_date: service_date ?? null,
          status,
          addons: Array.isArray(req.body.addons) ? req.body.addons : [],
        });
        res.status(201).json(result);
        return;
      }

      if (method === "PUT") {
        const {
          id,
          special_service_id,
          member_id,
          person_id,
          amount,
          date,
          service_date,
          status,
        } = req.body;
        if (!id) {
          res.status(400).json({ error: "Falta el parámetro id" });
          return;
        }
        if (status !== undefined && !(await specialServiceStatusExists(status))) {
          res.status(400).json({ error: "Estado de servicio especial inválido" });
          return;
        }
        const { checkSpecialServiceRecordStatus } = await import("../src/database/specialServiceWorkflowRepository.js");

        const statusError = await checkSpecialServiceRecordStatus({

          recordId: id,

          serviceId: special_service_id,

          status,

        });

        if (statusError) {

          res.status(400).json({ error: statusError });

          return;

        }

        const result = await updateSpecialServiceRecord(id, {
          special_service_id,
          member_id,
          person_id,
          amount,
          date,
          service_date,
          status,
        });
        if (!result) {
          res.status(404).json({ error: "Registro de servicio especial no encontrado" });
          return;
        }
        res.status(200).json(result);
        return;
      }

      if (method === "DELETE") {
        const id = req.query.id as string | undefined;
        if (!id) {
          res.status(400).json({ error: "Falta el parámetro id" });
          return;
        }
        const result = await cancelSpecialServiceRecord(id);
        if (!result) {
          res.status(404).json({ error: "Registro de servicio especial no encontrado" });
          return;
        }
        res.status(200).json(result);
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/users" && method === "GET") {
      const { getAllAppUsers } = await import("../src/database/usersRepository.js");
      const users = await getAllAppUsers();
      res.status(200).json(users);
      return;
    }

    if (pathname === "/api/users" && method === "POST") {
      const { auth_user_id, email, name, role } = req.body;
      if (!auth_user_id || !email) {
        res.status(400).json({ error: "Faltan auth_user_id y/o email" });
        return;
      }
      const { upsertAppUser } = await import("../src/database/usersRepository.js");
      const user = await upsertAppUser(auth_user_id, email, name ?? null, role ?? "secretario");
      res.status(200).json(user);
      return;
    }

    if (pathname === "/api/users" && method === "PATCH") {
      const { auth_user_id, role } = req.body;
      if (!auth_user_id || !role) {
        res.status(400).json({ error: "Faltan auth_user_id y/o role" });
        return;
      }
      const { updateAppUserRole } = await import("../src/database/usersRepository.js");
      const user = await updateAppUserRole(auth_user_id, role);
      if (!user) {
        res.status(404).json({ error: "Usuario no encontrado" });
        return;
      }
      res.status(200).json(user);
      return;
    }

    if (pathname === "/api/users" && method === "DELETE") {
      const authUserId = req.query.auth_user_id as string | undefined;
      if (!authUserId) {
        res.status(400).json({ error: "Falta el parámetro auth_user_id" });
        return;
      }
      const { deleteAppUser } = await import("../src/database/usersRepository.js");
      await deleteAppUser(authUserId);
      res.status(200).json({ success: true });
      return;
    }

    if (pathname === "/api/debts") {
      const {
        getDebtsByMember,
        getDebtsByPerson,
        getDebtsByMovementId,
        insertDebt,
      } = await import("../src/database/debtsRepository.js");

      if (method === "GET") {
        const memberId = req.query.memberId as string | undefined;
        const personId = req.query.personId as string | undefined;
        const movementId = req.query.movementId as string | undefined;

        if (movementId) {
          const debts = await getDebtsByMovementId(movementId);
          res.status(200).json(debts);
          return;
        }
        if (memberId) {
          const debts = await getDebtsByMember(memberId);
          res.status(200).json(debts);
          return;
        }
        if (personId) {
          const debts = await getDebtsByPerson(personId);
          res.status(200).json(debts);
          return;
        }
        res.status(400).json({ error: "Falta el parámetro memberId, personId o movementId" });
        return;
      }

      if (method === "POST") {
        const body = req.body;
        if (!body?.type || body.amount === undefined || !body?.date) {
          res.status(400).json({ error: "Faltan datos requeridos (type, amount, date)" });
          return;
        }
        if (!body.member_id && !body.person_id) {
          res.status(400).json({ error: "Se requiere member_id o person_id" });
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
        res.status(200).json({ success: true, id });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/debts/balance") {
      const {
        getBalanceByMember,
        getBalanceByPerson,
      } = await import("../src/database/debtsRepository.js");

      if (method === "GET") {
        const memberId = req.query.memberId as string | undefined;
        const personId = req.query.personId as string | undefined;

        if (memberId) {
          const balance = await getBalanceByMember(memberId);
          res.status(200).json({ balance });
          return;
        }
        if (personId) {
          const balance = await getBalanceByPerson(personId);
          res.status(200).json({ balance });
          return;
        }
        res.status(400).json({ error: "Falta el parámetro memberId o personId" });
        return;
      }

      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/external-services") {
      const {
        getAllExternalServices,
        insertExternalService,
        updateExternalService,
        deleteExternalService,
      } = await import("../src/database/externalServicesRepository.js");

      if (method === "GET") {
        const rows = await getAllExternalServices();
        res.status(200).json(rows);
        return;
      }
      if (method === "POST") {
        const { name, phone, description, frequency, start_month } = req.body as { name: string; phone?: string | null; description?: string | null; frequency?: string; start_month?: number | null };
        if (!name?.trim()) { res.status(400).json({ error: "Falta el nombre" }); return; }
        const row = await insertExternalService(name.trim(), phone ?? null, description ?? null, frequency ?? "mensual", start_month ?? null);
        res.status(201).json(row);
        return;
      }
      if (method === "PUT") {
        const { id, name, phone, description, frequency, start_month, active } = req.body as { id: string; name: string; phone?: string | null; description?: string | null; frequency?: string; start_month?: number | null; active: boolean };
        if (!id || !name?.trim()) { res.status(400).json({ error: "Faltan campos" }); return; }
        const row = await updateExternalService(id, name.trim(), phone ?? null, description ?? null, frequency ?? "mensual", start_month ?? null, active);
        if (!row) { res.status(404).json({ error: "No encontrado" }); return; }
        res.status(200).json(row);
        return;
      }
      if (method === "DELETE") {
        const id = req.query.id as string | undefined;
        if (!id) { res.status(400).json({ error: "Falta el id" }); return; }
        await deleteExternalService(id);
        res.status(200).json({ success: true });
        return;
      }
      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    if (pathname === "/api/external-service-payments") {
      const {
        getPaymentsByYear,
        upsertPayment,
        deletePayment,
      } = await import("../src/database/externalServicePaymentsRepository.js");

      if (method === "GET") {
        const year = parseInt(req.query.year as string, 10);
        if (isNaN(year)) { res.status(400).json({ error: "Falta el año" }); return; }
        const rows = await getPaymentsByYear(year);
        res.status(200).json(rows);
        return;
      }
      if (method === "POST") {
        const { service_id, month, year, amount, movement_id } = req.body as {
          service_id: string; month: number; year: number; amount: number | null; movement_id: string | null;
        };
        if (!service_id || !month || !year) { res.status(400).json({ error: "Faltan campos" }); return; }
        const row = await upsertPayment(service_id, month, year, amount ?? null, movement_id ?? null);
        res.status(200).json(row);
        return;
      }
      if (method === "DELETE") {
        const { service_id, month, year } = req.body as { service_id: string; month: number; year: number };
        if (!service_id || !month || !year) { res.status(400).json({ error: "Faltan campos" }); return; }
        await deletePayment(service_id, month, year);
        res.status(200).json({ success: true });
        return;
      }
      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    res.status(404).json({ error: "Ruta no encontrada" });
  } catch (error) {
    console.error(`Error en ${pathname}:`, error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
