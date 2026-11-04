import {
  BarChart2,
  Calendar,
  Home,
  Landmark,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface MainNavLink {
  to: string;
  label: string;
  icon: LucideIcon;
  hasSubmenu?: boolean;
}

/**
 * Menús principales de la barra lateral según el rol.
 * El rol "secretario" no ve Tesorería, Reportes ni Configuración.
 */
export function getMainNavLinks(role: string): MainNavLink[] {
  const isSecretario = role === "secretario";
  return [
    { to: "/", label: "Inicio", icon: Home },
    ...(!isSecretario
      ? [{ to: "/tesoreria/dashboard", label: "Tesorería", icon: Landmark, hasSubmenu: true }]
      : []),
    { to: "/socios", label: "Socios", icon: Users },
    { to: "/terceros", label: "Terceros", icon: User },
    ...(!isSecretario ? [{ to: "/reportes", label: "Reportes", icon: BarChart2 }] : []),
    { to: "/calendario", label: "Calendario", icon: Calendar },
    ...(!isSecretario ? [{ to: "/configuracion", label: "Configuración", icon: Settings }] : []),
  ];
}
