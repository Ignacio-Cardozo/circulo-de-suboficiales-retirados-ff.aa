import React, { useEffect, useState } from "react";
import {
    fetchInitialBalances,
} from "../../services/initialBalancesApi";
import {
    fetchDuesConfig,
} from "../../services/duesConfigApi";import {
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
import CollapsibleCard from "../../components/ui/CollapsibleCard";
import BalancesConfig from "./BalancesConfig";
import DuesConfig from "./DuesConfig";
import ServicesConfig from "./ServicesConfig";
import ExternalServicesConfig from "./ExternalServicesConfig";
import SpecialServicesConfig from "./SpecialServicesConfig";
import SpecialServiceStatusesConfig from "./SpecialServiceStatusesConfig";
import SpecialServiceMovementTypesConfig from "./SpecialServiceMovementTypesConfig";
import ReceiptCopiesConfig from "./ReceiptCopiesConfig";
import "./Config.css";

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

    if (loading) return <div className="dashboard-loading">Cargando...</div>;
    if (error) return <div className="dashboard-loading" style={{ color: "var(--danger)" }}>{error}</div>;

    return (
        <div className="config-container custom-scroll">
            <div className="config-grid">
                <CollapsibleCard
                    title="Valores Iniciales"
                    className="config-card"
                    defaultOpen={false}
                    headerExtra={<span className="config-card-hint">Saldos iniciales de cajas</span>}
                >
                    <BalancesConfig initialCajaChica={cajaChica} initialBanco={banco} initialComprobanteIngreso={comprobanteIngreso} initialComprobanteEgreso={comprobanteEgreso} />
                </CollapsibleCard>
                <CollapsibleCard
                    title="Cuotas"
                    className="config-card"
                    defaultOpen={false}
                    headerExtra={<span className="config-card-hint">Tarifas, montos y servicios</span>}
                >
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
                </CollapsibleCard>
                <CollapsibleCard
                    title="Ingresos"
                    className="config-card"
                    defaultOpen={false}
                    headerExtra={<span className="config-card-hint">Configurar servicios que generan ingresos</span>}
                >
                    <ServicesConfig initialServices={services} />
                </CollapsibleCard>
                <CollapsibleCard
                    title="Egresos"
                    className="config-card"
                    defaultOpen={false}
                    headerExtra={<span className="config-card-hint">Configurar servicios que generan egresos</span>}
                >
                    <ExternalServicesConfig initialServices={externalServices} />
                </CollapsibleCard>
                <CollapsibleCard
                    title="Servicios Especiales"
                    className="config-card"
                    defaultOpen={false}
                    headerExtra={<span className="config-card-hint">Catálogo de servicios especiales, precios y señas</span>}
                >
                    <SpecialServicesConfig initialServices={specialServices} />
                </CollapsibleCard>
                <CollapsibleCard
                    title="Estados de Servicios Especiales"
                    className="config-card"
                    defaultOpen={false}
                    headerExtra={<span className="config-card-hint">Nombres y colores de los estados</span>}
                >
                    <SpecialServiceStatusesConfig />
                </CollapsibleCard>
                <CollapsibleCard
                    title="Movimientos de Servicios Especiales"
                    className="config-card"
                    defaultOpen={false}
                    headerExtra={<span className="config-card-hint">Tipos, dirección e impacto en caja</span>}
                >
                    <SpecialServiceMovementTypesConfig />
                </CollapsibleCard>
                <CollapsibleCard
                    title="Valores Ingresos/Egresos, Comprobantes"
                    className="config-card"
                    defaultOpen={false}
                    headerExtra={<span className="config-card-hint">Conceptos, copias y destino por concepto</span>}
                >
                    <ReceiptCopiesConfig initialConcepts={receiptConcepts} />
                </CollapsibleCard>
            </div>
        </div>
    );
};

export default Variables;
