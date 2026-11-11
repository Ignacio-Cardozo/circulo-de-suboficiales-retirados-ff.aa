import React from "react";
import { useNavigate } from "react-router-dom";
import { DatabaseBackup, Settings, Shield } from "lucide-react";
import "./Config.css";

const Config: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="config-container custom-scroll">
            <div className="config-menu">
                <button
                    className="config-menu-card"
                    onClick={() => navigate("/usuarios")}
                >
                    <Shield size={32} style={{ color: "var(--azul-armada)" }} />
                    <div className="config-menu-text">
                        <h3>Administrar usuarios</h3>
                        <p>Gestionar roles y permisos de los usuarios del sistema.</p>
                    </div>
                </button>
                <button
                    className="config-menu-card"
                    onClick={() => navigate("/configuracion/variables")}
                >
                    <Settings size={32} style={{ color: "var(--azul-armada)" }} />
                    <div className="config-menu-text">
                        <h3>Variables del sistema</h3>
                        <p>Configurar tarifas, saldos iniciales y servicios.</p>
                    </div>
                </button>
                <button
                    className="config-menu-card"
                    onClick={() => navigate("/configuracion/respaldos")}
                >
                    <DatabaseBackup size={32} style={{ color: "var(--azul-armada)" }} />
                    <div className="config-menu-text">
                        <h3>Respaldos y migración</h3>
                        <p>Copias de seguridad diarias, descarga de datos y migración a otro servidor.</p>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default Config;
