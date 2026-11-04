import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  User,
  LogOut,
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
  History,
  Building2,
  Cross,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { getMainNavLinks } from "./navLinks";
import logo from "../../assets/logo_ffaa-bg.png";
import "./Sidebar.css";

interface SidebarProps {
  collapsed?: boolean;
  isHovering?: boolean;
  onHoverChange?: (hovering: boolean) => void;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  secretario: "Secretario/a",
};

const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  isHovering = false,
  onHoverChange,
}) => {
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const role = user?.role ?? "secretario";

  const toggleSubmenu = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenSubmenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleMouseEnter = () => {
    onHoverChange?.(true);
    if (collapsed) {
      setOpenSubmenus((prev) => ({
        ...prev,
        "/tesoreria/dashboard": true,
      }));
    }
  };

  const handleMouseLeave = () => {
    onHoverChange?.(false);
  };

  const links = getMainNavLinks(role);

  const submenuLinks = [
    { to: "/tesoreria/movimientos", label: "Movimientos", icon: ArrowRightLeft },
    { to: "/tesoreria/nuevo-movimiento", label: "Nuevo ingreso", icon: ArrowUp },
    { to: "/tesoreria/egresos/nuevo-egreso", label: "Nuevo egreso", icon: ArrowDown },
    { to: "/tesoreria/historial-servicios", label: "Historial de servicios", icon: History },
    { to: "/tesoreria/servicios-externos", label: "Serv. Externos / Impuestos", icon: Building2 },
    { to: "/tesoreria/cementerio", label: "Cementerio", icon: Cross },
  ];

  const displayName = user?.name || user?.email || "Administrador";

  const isExpanded = isHovering && collapsed;

  return (
    <aside
      className={`sidebar ${collapsed ? "collapsed" : ""} ${isExpanded ? "expanded" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="sidebar-brand">
        <img src={logo} alt="Logo FF.AA" className="sidebar-logo-img" />
        <div className="sidebar-brand-text">
          CÍRCULO DE SUBOFICIALES<br />RETIRADOS DE LAS<br />FUERZAS ARMADAS<br /> DE LA NACIÓN <br /> HONOR Y PATRIA
        </div>
      </div>

      <nav className="sidebar-nav custom-scroll">
        {links.map((l) => (
          <React.Fragment key={l.to}>
            <div className="sidebar-item">
              <NavLink
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
              >
                <div className="sidebar-link-inner">
                  <l.icon size={20} />
                  <span className="sidebar-label">{l.label}</span>
                </div>
              </NavLink>
              {l.hasSubmenu && (
                <button
                  className={`sidebar-chevron ${openSubmenus[l.to] ? "open" : ""}`}
                  onClick={(e) => toggleSubmenu(l.to, e)}
                  aria-label="Expandir submenú"
                >
                  <ChevronDown size={16} />
                </button>
              )}
            </div>

            {l.hasSubmenu && collapsed && !isExpanded ? (
              <div className="sidebar-submenu-collapsed">
                {submenuLinks.map((sub) => (
                  <NavLink
                    key={sub.to}
                    to={sub.to}
                    title={sub.label}
                    className={({ isActive }) =>
                      `sidebar-submenu-icon-link ${isActive ? "active-submenu" : ""}`
                    }
                  >
                    <sub.icon size={18} />
                  </NavLink>
                ))}
              </div>
            ) : l.hasSubmenu && (
              <div
                className={`sidebar-submenu ${openSubmenus[l.to] ? "open" : ""}`}
              >
                {submenuLinks.map((sub) => (
                  <NavLink
                    key={sub.to}
                    to={sub.to}
                    className={({ isActive }) =>
                      `sidebar-submenu-link ${isActive ? "active-submenu" : ""}`
                    }
                  >
                    {sub.label}
                  </NavLink>
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-inner">
          <div className="sidebar-avatar">
            <User size={20} color="#fff" />
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-username">{displayName}</div>
            <div className="sidebar-role">Rol: {ROLE_LABELS[role] ?? role}</div>
          </div>
        </div>
        <div className="sidebar-actions">
          <button
            className="sidebar-logout-btn"
            onClick={handleLogout}
            title="Cerrar sesion"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
