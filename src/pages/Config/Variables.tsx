import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
    AlertCircle,
    ArrowLeftRight,
    ChevronRight,
    Coins,
    FileText,
    Loader,
    Sparkles,
    Tags,
    TrendingDown,
    TrendingUp,
    Wallet,
    type LucideIcon,
} from "lucide-react";
import {
    fetchInitialBalances,
} from "../../services/initialBalancesApi";
import {
    fetchDuesConfig,
} from "../../services/duesConfigApi";
import {
    fetchServices,
    type ServiceItem,
} from "../../services/servicesApi";
import {
    fetchExternalServices,
    type ExternalServiceItem,
} from "../../services/externalServicesApi";
import {
    fetchSpecialServices,
    type SpecialServiceItem,
} from "../../services/specialServicesApi";
import {
    fetchReceiptConcepts,
    type ReceiptConcept,
} from "../../services/receiptCopiesConfigApi";
import { formatNumberInput } from "../../utils/format";
import BalancesConfig from "./BalancesConfig";
import DuesConfig from "./DuesConfig";
import ServicesConfig from "./ServicesConfig";
import ExternalServicesConfig from "./ExternalServicesConfig";
import SpecialServicesConfig from "./SpecialServicesConfig";
import SpecialServiceStatusesConfig from "./SpecialServiceStatusesConfig";
import SpecialServiceMovementTypesConfig from "./SpecialServiceMovementTypesConfig";
import ReceiptCopiesConfig from "./ReceiptCopiesConfig";
import "./Config.css";

type SectionId =
    | "saldos"
    | "cuotas"
    | "ingresos"
    | "egresos"
    | "comprobantes"
    | "especiales"
    | "estados"
    | "movimientos";

interface SectionDef {
    id: SectionId;
    group: string;
    title: string;
    description: string;
    icon: LucideIcon;
}

const SECTIONS: SectionDef[] = [
    { id: "saldos", group: "Finanzas", title: "Valores Iniciales", description: "Saldos iniciales de cajas y próximos números de comprobante.", icon: Wallet },
    { id: "cuotas", group: "Finanzas", title: "Cuotas", description: "Tarifas por tipo de socio, recargos por servicios y cuotas de cementerio.", icon: Coins },
    { id: "ingresos", group: "Ingresos y Egresos", title: "Ingresos", description: "Servicios que generan ingresos.", icon: TrendingUp },
    { id: "egresos", group: "Ingresos y Egresos", title: "Egresos", description: "Servicios que generan egresos.", icon: TrendingDown },
    { id: "comprobantes", group: "Ingresos y Egresos", title: "Conceptos y Comprobantes", description: "Conceptos de ingresos/egresos, cantidad de copias y destino por concepto.", icon: FileText },
    { id: "especiales", group: "Servicios", title: "Nuestros Servicios", description: "Catálogo de servicios, precios y señas.", icon: Sparkles },
    { id: "estados", group: "Servicios", title: "Estados", description: "Nombres y colores de los estados de servicios.", icon: Tags },
    { id: "movimientos", group: "Servicios", title: "Movimientos", description: "Tipos de movimiento, dirección e impacto en caja.", icon: ArrowLeftRight },
];

const Variables: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [cajaChica, setCajaChica] = useState("0");
    const [banco, setBanco] = useState("0");
    const [comprobanteIngreso, setComprobanteIngreso] = useState(1);
    const [comprobanteEgreso, setComprobanteEgreso] = useState(1);
    const [memberFee, setMemberFee] = useState("0");
    const [considerationYears, setConsiderationYears] = useState("0");
    const [nichoMemberFee, setNichoMemberFee] = useState("0");
    const [nichoNonMemberFee, setNichoNonMemberFee] = useState("0");
    const [urnaMemberFee, setUrnaMemberFee] = useState("0");
    const [urnaNonMemberFee, setUrnaNonMemberFee] = useState("0");
    const [bolsaMemberFee, setBolsaMemberFee] = useState("0");
    const [bolsaNonMemberFee, setBolsaNonMemberFee] = useState("0");
    const [asistencialFee, setAsistencialFee] = useState("0");
    const [planSaludFee, setPlanSaludFee] = useState("0");
    const [feeAct, setFeeAct] = useState("0");
    const [feeActA, setFeeActA] = useState("0");
    const [feeAdh, setFeeAdh] = useState("0");
    const [feePart, setFeePart] = useState("0");
    const [feeVit, setFeeVit] = useState("0");
    const [services, setServices] = useState<ServiceItem[]>([]);
    const [externalServices, setExternalServices] = useState<ExternalServiceItem[]>([]);
    const [specialServices, setSpecialServices] = useState<SpecialServiceItem[]>([]);
    const [receiptConcepts, setReceiptConcepts] = useState<ReceiptConcept[]>([]);

    useEffect(() => {
        Promise.all([
            fetchInitialBalances(),
            fetchDuesConfig(),
            fetchServices(),
            fetchExternalServices(),
            fetchSpecialServices(),
            fetchReceiptConcepts(),
        ])
            .then(([balances, duesCfg, svcs, extSvcs, specialSvcs, receiptCfg]) => {
                if (balances) {
                    setCajaChica(formatNumberInput(balances.caja_chica));
                    setBanco(formatNumberInput(balances.banco));
                    setComprobanteIngreso(balances.comprobante_ingreso ?? 1);
                    setComprobanteEgreso(balances.comprobante_egreso ?? 1);
                }
                if (duesCfg) {
                    setMemberFee(duesCfg.member_fee.toString());
                    setConsiderationYears(duesCfg.consideration_years.toString());
                    setNichoMemberFee(duesCfg.nicho_member_fee.toString());
                    setNichoNonMemberFee(duesCfg.nicho_non_member_fee.toString());
                    setUrnaMemberFee(duesCfg.urna_member_fee.toString());
                    setUrnaNonMemberFee(duesCfg.urna_non_member_fee.toString());
                    setBolsaMemberFee(duesCfg.bolsa_member_fee.toString());
                    setBolsaNonMemberFee(duesCfg.bolsa_non_member_fee.toString());
                    setAsistencialFee(duesCfg.asistencial_fee.toString());
                    setPlanSaludFee(duesCfg.plan_salud_fee.toString());
                    setFeeAct(duesCfg.fee_act.toString());
                    setFeeActA(duesCfg.fee_act_a.toString());
                    setFeeAdh(duesCfg.fee_adh.toString());
                    setFeePart(duesCfg.fee_part.toString());
                    setFeeVit(duesCfg.fee_vit.toString());
                }
                setServices(svcs);
                setExternalServices(extSvcs);
                setSpecialServices(specialSvcs);
                setReceiptConcepts(receiptCfg);
            })
            .catch((err) => setError(err.message || "Error al cargar datos"))
            .finally(() => setLoading(false));
    }, []);

    const [searchParams, setSearchParams] = useSearchParams();
    const requested = searchParams.get("seccion") as SectionId | null;
    const activeId: SectionId = SECTIONS.some((s) => s.id === requested) ? (requested as SectionId) : SECTIONS[0].id;
    const active = SECTIONS.find((s) => s.id === activeId)!;

    const selectSection = (id: SectionId) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("seccion", id);
            return next;
        }, { replace: true });
    };

    if (loading) {
        return (
            <div className="config-container">
                <div className="vars-state">
                    <Loader size={20} className="spin" />
                    <span>Cargando variables del sistema…</span>
                </div>
            </div>
        );
    }
    if (error) {
        return (
            <div className="config-container">
                <div className="vars-state vars-state-error" role="alert">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    const renderSection = (id: SectionId) => {
        switch (id) {
            case "saldos":
                return <BalancesConfig initialCajaChica={cajaChica} initialBanco={banco} initialComprobanteIngreso={comprobanteIngreso} initialComprobanteEgreso={comprobanteEgreso} />;
            case "cuotas":
                return (
                    <DuesConfig
                        initialMemberFee={memberFee}
                        initialConsiderationYears={considerationYears}
                        initialNichoMemberFee={nichoMemberFee}
                        initialNichoNonMemberFee={nichoNonMemberFee}
                        initialUrnaMemberFee={urnaMemberFee}
                        initialUrnaNonMemberFee={urnaNonMemberFee}
                        initialBolsaMemberFee={bolsaMemberFee}
                        initialBolsaNonMemberFee={bolsaNonMemberFee}
                        initialAsistencialFee={asistencialFee}
                        initialPlanSaludFee={planSaludFee}
                        initialFeeAct={feeAct}
                        initialFeeActA={feeActA}
                        initialFeeAdh={feeAdh}
                        initialFeePart={feePart}
                        initialFeeVit={feeVit}
                    />
                );
            case "ingresos":
                return <ServicesConfig initialServices={services} />;
            case "egresos":
                return <ExternalServicesConfig initialServices={externalServices} />;
            case "comprobantes":
                return <ReceiptCopiesConfig initialConcepts={receiptConcepts} />;
            case "especiales":
                return <SpecialServicesConfig initialServices={specialServices} />;
            case "estados":
                return <SpecialServiceStatusesConfig />;
            case "movimientos":
                return <SpecialServiceMovementTypesConfig />;
        }
    };

    const groups = Array.from(new Set(SECTIONS.map((s) => s.group)));
    const ActiveIcon = active.icon;

    return (
        <div className="config-container custom-scroll">
            <div className="vars-layout">
                <nav className="vars-nav" aria-label="Secciones de variables">
                    {groups.map((group) => (
                        <div key={group} className="vars-nav-group">
                            <div className="vars-nav-group-title">{group}</div>
                            {SECTIONS.filter((s) => s.group === group).map((s) => {
                                const Icon = s.icon;
                                const isActive = s.id === activeId;
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        className={`vars-nav-item${isActive ? " active" : ""}`}
                                        aria-current={isActive ? "page" : undefined}
                                        onClick={() => selectSection(s.id)}
                                    >
                                        <span className="vars-nav-icon"><Icon size={16} /></span>
                                        <span className="vars-nav-label">{s.title}</span>
                                        <ChevronRight size={14} className="vars-nav-chevron" />
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <section className="vars-panel" aria-labelledby="vars-panel-title">
                    <header className="vars-panel-header">
                        <span className="vars-panel-icon"><ActiveIcon size={20} /></span>
                        <div className="vars-panel-heading">
                            <span className="vars-panel-eyebrow">{active.group}</span>
                            <h2 id="vars-panel-title">{active.title}</h2>
                            <p>{active.description}</p>
                        </div>
                    </header>
                    <div className="vars-panel-body" key={activeId}>
                        {renderSection(activeId)}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Variables;
