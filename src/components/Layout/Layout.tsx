import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import Sidebar from "../Sidebar/Sidebar";
import TopBar from "../../pages/Dashboard/components/TopBar/TopBar";
import argFlag from "../../assets/flag.png";
import logo from "../../assets/logo_ffaa-bg.png";
import "./Layout.css";

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hovering, setHovering] = useState(false);
  const location = useLocation();

  const getHeaderContent = (path: string) => {
    if (path === "/tesoreria/movimientos") return { title: "Movimientos", subtitle: "Consulta todos los movimientos registrados en la tesorería.", breadcrumbs: ["Tesorería", "Movimientos"] };
    if (path === "/tesoreria/nuevo-movimiento") return { title: "Nuevo ingreso", subtitle: "Registrá un nuevo ingreso en caja chica o banco.", breadcrumbs: ["Tesorería", "Nuevo ingreso"] };
    if (path === "/tesoreria/egresos/nuevo-egreso") return { title: "Nuevo egreso", subtitle: "Registrar un nuevo egreso del circulo", breadcrumbs: ["Tesorería", "Nuevo egreso"] };
    if (path === "/tesoreria/dashboard") return { title: "Dashboard Tesorería", subtitle: "Resumen general del estado financiero del circulo.", breadcrumbs: ["Tesorería", "Dashboard"] };
    if (path === "/socios") return { title: "Socios", subtitle: "Gestioná la información de los socios del circulo." };
    if (path === "/socios/nuevo") return { title: "Nuevo Socio", subtitle: "Registrar un nuevo socio en el circulo.", breadcrumbs: ["Socios", "Nuevo Socio"] };
    if (path.startsWith("/socios/detalle/")) return { title: "Detalle del Socio", subtitle: "Información y cuotas del socio.", breadcrumbs: ["Socios", "Detalle"] };
    if (path.startsWith("/socios/editar/")) return { title: "Editar Socio", subtitle: "Modificar los datos del socio.", breadcrumbs: ["Socios", "Editar"] };
    if (path === "/terceros") return { title: "Terceros", subtitle: "Gestioná la información de los terceros." };
    if (path === "/terceros/nuevo") return { title: "Nuevo Tercero", subtitle: "Registrar un nuevo tercero.", breadcrumbs: ["Terceros", "Nuevo Tercero"] };
    if (path.startsWith("/terceros/detalle/")) return { title: "Detalle de Tercero", subtitle: "Información y cuotas de cementerio.", breadcrumbs: ["Terceros", "Detalle"] };
    if (path.startsWith("/terceros/editar/")) return { title: "Editar Tercero", subtitle: "Modificar los datos del tercero.", breadcrumbs: ["Terceros", "Editar"] };
    if (path === "/") return { title: " ", subtitle: " " };
    if (path === "/configuracion") return { title: "Configuración", subtitle: "Administrá las variables y ajustes del sistema.", breadcrumbs: ["Configuración"] };
    if (path === "/configuracion/variables") return { title: "Variables del Sistema", subtitle: "Configurar tarifas, saldos iniciales y servicios.", breadcrumbs: ["Configuración", "Variables"] };
    if (path === "/tesoreria/servicios-externos") return { title: "Servicios Externos / Impuestos", subtitle: "Estado de pagos de servicios e impuestos.", breadcrumbs: ["Tesorería", "Servicios Externos"] };
    if (path === "/tesoreria/cementerio") return { title: "Cementerio", subtitle: "Gestión de nichos y pagos de cementerio.", breadcrumbs: ["Tesorería", "Cementerio"] };
    if (path === "/tesoreria/historial-servicios") return { title: "Historial de Servicios", subtitle: "Consulta del historial de servicios facturados.", breadcrumbs: ["Tesorería", "Historial de Servicios"] };
    if (path === "/calendario") return { title: "Calendario", subtitle: "Visualizá los servicios agendados y los próximos servicios.", breadcrumbs: ["Calendario"] };
    return { title: "Sistema de Gestión" };
  };

  const { title, subtitle, breadcrumbs } = getHeaderContent(location.pathname);
const isHome = location.pathname === "/";

  return (
    <div className="app-root">
      <Sidebar
        collapsed={!sidebarOpen}
        isHovering={hovering}
        onHoverChange={(hovering) => setHovering(hovering)}
      />
      <div className="main-wrapper">
        <img
          src={argFlag}
          alt="Fondo Bandera Argentina"
          className="layout-bg-image"
        />
        <TopBar
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          onMenuClick={() => setSidebarOpen((prev) => !prev)}
        />
        <main
          className="content"
          onClick={() => setSidebarOpen(false)}
        >
          <Outlet />
        </main>
        {!isHome && (
          <footer className="layout-footer">
            <div className="footer-left">
              <img src={logo} alt="Logo" className="footer-logo-img" />
              <span>
                Círculo de Suboficiales Retirados de las Fuerzas Armadas de la Nación "Honor y Patria"
              </span>
            </div>
            <div className="footer-right">
              <span>Sistema de Gestión - Versión 0.1.0</span>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};

export default Layout;
