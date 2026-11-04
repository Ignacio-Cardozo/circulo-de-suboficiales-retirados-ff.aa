import type {
    SpecialServiceWorkflow,
    SpecialServiceWorkflowInput,
} from "../services/specialServiceWorkflowApi";

/** Configuración de un servicio nuevo: usa la lista base de estados y de movimientos. */
export function emptyWorkflowDraft(): SpecialServiceWorkflowInput {
    return {
        custom_statuses: false,
        status_keys: [],
        custom_movement_types: false,
        movement_type_keys: [],
    };
}

/** Convierte la configuración efectiva guardada en el borrador editable del formulario. */
export function workflowToDraft(workflow: SpecialServiceWorkflow): SpecialServiceWorkflowInput {
    return {
        custom_statuses: workflow.custom_statuses,
        status_keys: workflow.custom_statuses ? workflow.statuses.map((item) => item.key) : [],
        custom_movement_types: workflow.custom_movement_types,
        movement_type_keys: workflow.custom_movement_types
            ? workflow.movement_types.map((item) => item.key)
            : [],
    };
}

/** Mensaje de error si el borrador no se puede guardar, o null si es válido. */
export function getWorkflowDraftError(draft: SpecialServiceWorkflowInput): string | null {
    if (draft.custom_statuses && draft.status_keys.length === 0) {
        return "Elegí al menos un estado para el servicio o usá la lista base.";
    }
    if (draft.custom_movement_types && draft.movement_type_keys.length === 0) {
        return "Elegí al menos un movimiento para el servicio o usá la lista base.";
    }
    return null;
}
