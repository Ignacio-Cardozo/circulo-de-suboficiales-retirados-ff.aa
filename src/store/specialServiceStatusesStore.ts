import { create } from "zustand";
import {
    fetchSpecialServiceStatuses,
    type SpecialServiceStatusItem,
} from "../services/specialServiceStatusesApi";

type SpecialServiceStatusesState = {
    statuses: SpecialServiceStatusItem[];
    loading: boolean;
    loaded: boolean;
    error: string | null;
    load: (force?: boolean) => Promise<void>;
    setStatuses: (statuses: SpecialServiceStatusItem[]) => void;
};

export const useSpecialServiceStatusesStore = create<SpecialServiceStatusesState>((set, get) => ({
    statuses: [],
    loading: false,
    loaded: false,
    error: null,
    load: async (force = false) => {
        if (!force && (get().loaded || get().loading)) return;
        set({ loading: true, error: null });
        try {
            const statuses = await fetchSpecialServiceStatuses();
            set({ statuses, loaded: true });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : "Error al cargar los estados" });
        } finally {
            set({ loading: false });
        }
    },
    setStatuses: (statuses) => set({ statuses, loaded: true, error: null }),
}));
