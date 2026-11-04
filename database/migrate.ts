import { config } from "dotenv";
import { migratePettyCashSchema } from "../src/database/pettyCashRepository";
import { migrateDuesSchema } from "../src/database/duesRepository";
import { ensurePricingTable } from "../src/database/duesConfigRepository";
import { ensureServicesTable } from "../src/database/servicesRepository";
import { migrateServiceRecordsSchema } from "../src/database/serviceRecordsRepository";
import { ensureSpecialServicesTable } from "../src/database/specialServicesRepository";
import { migrateSpecialServiceRecordsSchema } from "../src/database/specialServiceRecordsRepository";
import { migrateSpecialServiceStatusesSchema } from "../src/database/specialServiceStatusesRepository";
import { migrateSpecialServiceMovementTypesSchema } from "../src/database/specialServiceMovementTypesRepository";
import { ensureSpecialServiceAddonsTable } from "../src/database/specialServiceAddonsRepository";
import { migrateDebtsSchema } from "../src/database/debtsRepository";
import { migratePersonsSchema } from "../src/database/personsRepository";
import { ensureSpecialServiceWorkflowSchema } from "../src/database/specialServiceWorkflowRepository";

config();

async function main() {
    console.log("Ejecutando migraciones...");

    console.log("1/12 - Migrando petty_cash (columna concept)...");
    await migratePettyCashSchema();

    console.log("2/12 - Creando tabla dues y columnas faltantes...");
    await migrateDuesSchema();

    console.log("3/12 - Creando tabla pricing...");
    await ensurePricingTable();

    console.log("4/12 - Creando tabla services...");
    await ensureServicesTable();

    console.log("5/12 - Creando tabla service_records...");
    await migrateServiceRecordsSchema();

    console.log("6/12 - Creando tabla special_services...");
    await ensureSpecialServicesTable();

    console.log("7/12 - Creando tabla special_service_statuses...");
    await migrateSpecialServiceStatusesSchema();

    console.log("8/12 - Creando tabla special_service_records...");
    await migrateSpecialServiceRecordsSchema();

    console.log("9/13 - Creando tabla special_service_addons...");
    await ensureSpecialServiceAddonsTable();

    console.log("10/13 - Creando movimientos de servicios especiales...");
    await migrateSpecialServiceMovementTypesSchema();

    console.log("10b/13 - Creando configuración de estados y movimientos por servicio especial...");
    await ensureSpecialServiceWorkflowSchema();

    console.log("11/13 - Creando tabla debts...");
    await migrateDebtsSchema();

    console.log("12/13 - Migrando persons (columna brinda_servicios)...");
    await migratePersonsSchema();

    console.log("13/13 - Migraciones completadas sin errores.");
}

main().catch((error) => {
    console.error("Error en migración:", error);
    process.exit(1);
});
