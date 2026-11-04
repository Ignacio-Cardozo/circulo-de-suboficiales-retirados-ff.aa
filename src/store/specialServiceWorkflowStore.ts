import { useEffect } from "react";
import { create } from "zustand";
import {
    fetchSpecialServiceWorkflow,
    type SpecialServiceWorkflow,
} from "../services/specialServiceWorkflowApi";

const BASE_KEY = "__base__";

type SpecialServiceWorkflowState = {
    /** Configuración efectiva por id de servicio (BASE_KEY = lista base). */
    byService: Record<string, SpecialServiceWorkflow>;
    errors: Record<string, string>;
    load: (serviceId: string | null, force?: boolean) => Promise<SpecialServiceWorkflow | null>;
    setWorkflow: (workflow: SpecialServiceWorkflow) => void;
    /** Descarta todo lo cacheado (p. ej. al cambiar el catálogo global de estados/movimientos). */
    clear: () => void;
};

const inflight = new Map<string, Promise<SpecialServiceWorkflow | null>>();

export const useSpecialServiceWorkflowStore = create<SpecialServiceWorkflowState>((set, get) => ({
    byService: {},
    errors: {},
    load: async (serviceId, force = false) => {
        const key = serviceId ?? BASE_KEY;
        if (!force) {
            const cached = get().byService[key];
            if (cached) return cached;
            const pending = inflight.get(key);
            if (pending) return pending;
        }
        const request = fetchSpecialServiceWorkflow(serviceId)
            .then((workflow) => {
                set((state) => {
                    const errors = { ...state.errors };
                    delete errors[key];
                    return { byService: { ...state.byService, [key]: workflow }, errors };
                });
                return workflow;
            })
            .catch((error: unknown) => {
                set((state) => ({
                    errors: {
                        ...state.errors,
                        [key]: error instanceof Error ? error.message : "Error al cargar la configuración",
                    },
                }));
                return null;
            })
            .finally(() => {
                inflight.delete(key);
            });
        inflight.set(key, request);
        return request;
    },
    setWorkflow: (workflow) =>
        set((state) => ({
            byService: {
                ...state.byService,
                [workflow.special_service_id ?? BASE_KEY]: workflow,
            },
        })),
    clear: () => {
        inflight.clear();
        set({ byService: {}, errors: {} });
    },
}));

/**
 * Devuelve la configuración efectiva (estados y movimientos) del servicio indicado,
 * o la lista base si serviceId es null. Carga bajo demanda y comparte la caché.
 */
export function useSpecialServiceWorkflow(serviceId: string | null | undefined): {
    workflow: SpecialServiceWorkflow | null;
    error: string | null;
} {
    const key = serviceId || BASE_KEY;
    const workflow = useSpecialServiceWorkflowStore((state) => state.byService[key] ?? null);
    const error = useSpecialServiceWorkflowStore((state) => state.errors[key] ?? null);
    const load = useSpecialServiceWorkflowStore((state) => state.load);

    useEffect(() => {
        void load(serviceId || null);
    }, [load, serviceId, workflow]);

    return { workflow, error };
}
