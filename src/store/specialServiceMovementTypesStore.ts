import { create } from "zustand";
import {
    fetchSpecialServiceMovementTypes,
    type SpecialServiceMovementTypeItem,
} from "../services/specialServiceMovementTypesApi";

type SpecialServiceMovementTypesState = {
    movementTypes: SpecialServiceMovementTypeItem[];
    loading: boolean;
    loaded: boolean;
    error: string | null;
    load: (force?: boolean) => Promise<void>;
    setMovementTypes: (movementTypes: SpecialServiceMovementTypeItem[]) => void;
};

export const useSpecialServiceMovementTypesStore = create<SpecialServiceMovementTypesState>(
    (set, get) => ({
        movementTypes: [],
        loading: false,
        loaded: false,
        error: null,
        load: async (force = false) => {
            if (!force && (get().loaded || get().loading)) return;
            set({ loading: true, error: null });
            try {
                const movementTypes = await fetchSpecialServiceMovementTypes();
                set({ movementTypes, loaded: true });
            } catch (error) {
                set({
                    error:
                        error instanceof Error
                            ? error.message
                            : "Error al cargar los movimientos",
                });
            } finally {
                set({ loading: false });
            }
        },
        setMovementTypes: (movementTypes) =>
            set({ movementTypes, loaded: true, error: null }),
    })
);
