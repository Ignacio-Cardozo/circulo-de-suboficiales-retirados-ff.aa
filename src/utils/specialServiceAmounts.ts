import type { MovementAmountSource } from "../services/specialServiceMovementTypesApi";
import type { SpecialServiceRecordMovementItem } from "../services/specialServiceRecordMovementsApi";
import type { SpecialServiceRecordItem } from "../services/specialServiceRecordsApi";

export const AMOUNT_SOURCE_OPTIONS: { value: MovementAmountSource; label: string; hint: string }[] = [
    { value: "total", label: "Total del servicio", hint: "El precio total del servicio" },
    { value: "sena", label: "Costo de la seña", hint: "El costo de la seña del servicio" },
    { value: "saldo", label: "Saldo (total − seña)", hint: "Lo que falta pagar después de la seña" },
    { value: "seguro", label: "Costo del seguro", hint: "El costo del seguro del servicio" },
    { value: "manual", label: "Sin sugerencia", hint: "El monto se completa a mano" },
];

export function getAmountSourceLabel(source: MovementAmountSource | null | undefined): string {
    return AMOUNT_SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? "Total del servicio";
}

/** Un movimiento cuenta si no fue anulado (y, si impacta en caja, si su movimiento de caja existe). */
function isActive(movement: SpecialServiceRecordMovementItem): boolean {
    if (movement.movement_anulado) return false;
    return !movement.includes_movement || Boolean(movement.movement_id);
}

/**
 * Monto a sugerir al registrar un movimiento de un servicio especial, según lo que tenga
 * configurado el tipo de movimiento. Para el saldo se descuenta la seña efectivamente
 * pagada (sin anular); si todavía no se pagó, el costo de la seña del servicio.
 *
 * `depositKeys`: tipos de movimiento que son la seña (los que sugieren "Costo de la seña").
 */
export function getSuggestedMovementAmount(
    source: MovementAmountSource | null | undefined,
    record: SpecialServiceRecordItem,
    movements: SpecialServiceRecordMovementItem[],
    depositKeys: ReadonlySet<string>
): number | null {
    const total = record.amount ?? 0;
    const deposit = record.deposit_cost ?? 0;
    switch (source ?? "total") {
        case "sena":
            return deposit;
        case "seguro":
            return record.insurance_cost ?? 0;
        case "saldo": {
            const paidDeposits = movements.filter(
                (movement) =>
                    isActive(movement) &&
                    movement.movement_type_key !== null &&
                    depositKeys.has(movement.movement_type_key)
            );
            const paid = paidDeposits.length > 0
                ? paidDeposits.reduce((sum, movement) => sum + movement.amount, 0)
                : deposit;
            return Math.max(total - paid, 0);
        }
        case "manual":
            return null;
        default:
            return total;
    }
}
