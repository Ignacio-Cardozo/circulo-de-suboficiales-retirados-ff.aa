import React from "react";
import { Link } from "react-router-dom";
import logo from "../../assets/logo_ffaa-bg.png";
import { useAuthStore } from "../../store/authStore";
import { getMainNavLinks } from "../../components/Sidebar/navLinks";
import "./Welcome.css";

const Welcome: React.FC = () => {
  const role = useAuthStore((state) => state.user?.role ?? "secretario");
  // Mismo nombre que muestra la barra lateral.
  const userName = useAuthStore((state) => state.user?.name || state.user?.email || "");
  // Mismos accesos que la barra lateral (según el rol), sin "Inicio".
  const shortcuts = getMainNavLinks(role).filter((link) => link.to !== "/");

  return (
    <div className="welcome-root">
      <img src={logo} alt="Logo" className="welcome-logo" />
      <h1 className="welcome-title">
        Bienvenido al Sistema
        {userName && (
          <>
            , <span className="welcome-username">{userName}</span>
          </>
        )}
      </h1>
      <nav className="welcome-shortcuts" aria-label="Accesos rápidos">
        {shortcuts.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="welcome-shortcut">
            <span className="welcome-shortcut-icon">
              <Icon size={34} strokeWidth={1.75} />
            </span>
            <span className="welcome-shortcut-label">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default Welcome;
