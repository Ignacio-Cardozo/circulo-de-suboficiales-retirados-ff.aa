import { create } from "zustand";
import { authClient } from "../auth";

export type AppRole = "owner" | "admin" | "secretario";

type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role: AppRole;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error?: string }>;
  resetPassword: (newPassword: string, token: string) => Promise<{ error?: string }>;
  checkSession: () => Promise<void>;
};

async function fetchUserRole(authUserId: string): Promise<AppRole> {
  try {
    const res = await fetch(`/api/users?auth_user_id=${encodeURIComponent(authUserId)}`);
    if (!res.ok) return "secretario";
    const users = await res.json();
    const user = Array.isArray(users)
      ? users.find((u: { auth_user_id: string }) => u.auth_user_id === authUserId)
      : null;
    return user?.role ?? "secretario";
  } catch {
    return "secretario";
  }
}

async function ensureAppUser(authUserId: string, email: string, name: string | null): Promise<AppRole> {
  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth_user_id: authUserId, email, name }),
    });
    if (!res.ok) return "secretario";
    const user = await res.json();
    return user?.role ?? "secretario";
  } catch {
    return "secretario";
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  checkSession: async () => {
    set({ loading: true });
    try {
      const result = await authClient.getSession();
      if (result.data?.session && result.data?.user) {
        const authUser = result.data.user;
        const role = await fetchUserRole(authUser.id);
        set({
          user: {
            id: authUser.id,
            email: authUser.email ?? "",
            name: (authUser as Record<string, unknown>).name as string | undefined,
            role,
          },
          loading: false,
          initialized: true,
        });
      } else {
        set({ user: null, loading: false, initialized: true });
      }
    } catch {
      set({ user: null, loading: false, initialized: true });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        set({ loading: false });
        return { error: result.error.message };
      }
      const sessionResult = await authClient.getSession();
      if (sessionResult.data?.session && sessionResult.data?.user) {
        const authUser = sessionResult.data.user;
        const name = (authUser as Record<string, unknown>).name as string | undefined;
        const role = await fetchUserRole(authUser.id);
        set({
          user: {
            id: authUser.id,
            email: authUser.email ?? "",
            name,
            role,
          },
          loading: false,
        });
      } else {
        set({ loading: false });
      }
      return {};
    } catch (err) {
      set({ loading: false });
      return {
        error:
          err instanceof Error ? err.message : "Error al iniciar sesion",
      };
    }
  },

  signUp: async (name, email, password) => {
    set({ loading: true });
    try {
      const result = await authClient.signUp.email({ name, email, password });
      if (result.error) {
        set({ loading: false });
        return { error: result.error.message };
      }
      const sessionResult = await authClient.getSession();
      if (sessionResult.data?.session && sessionResult.data?.user) {
        const authUser = sessionResult.data.user;
        const role = await ensureAppUser(authUser.id, email, name);
        set({
          user: {
            id: authUser.id,
            email: authUser.email ?? "",
            name: (authUser as Record<string, unknown>).name as string | undefined,
            role,
          },
          loading: false,
        });
      } else {
        set({ loading: false });
      }
      return {};
    } catch (err) {
      set({ loading: false });
      return {
        error:
          err instanceof Error ? err.message : "Error al crear la cuenta",
      };
    }
  },

  logout: async () => {
    try {
      await authClient.signOut();
    } finally {
      set({ user: null });
    }
  },

  requestPasswordReset: async (email) => {
    set({ loading: true });
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/restablecer-contrasena`,
      });
      set({ loading: false });
      if (result.error) {
        return {
          error: result.error.message ?? "No se pudo enviar el email de recuperación",
        };
      }
      return {};
    } catch (err) {
      set({ loading: false });
      return {
        error:
          err instanceof Error
            ? err.message
            : "Error al solicitar el restablecimiento de contraseña",
      };
    }
  },

  resetPassword: async (newPassword, token) => {
    set({ loading: true });
    try {
      const result = await authClient.resetPassword({ newPassword, token });
      set({ loading: false });
      if (result.error) {
        return {
          error: result.error.message ?? "No se pudo restablecer la contraseña",
        };
      }
      return {};
    } catch (err) {
      set({ loading: false });
      return {
        error:
          err instanceof Error
            ? err.message
            : "Error al restablecer la contraseña",
      };
    }
  },
}));
