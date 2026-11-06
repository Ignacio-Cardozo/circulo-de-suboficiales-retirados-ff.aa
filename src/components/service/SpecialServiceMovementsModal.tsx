import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CircleHelp, ExternalLink, FileText, Loader } from "lucide-react";
import Modal from "../ui/Modal";
import {
    fetchSpecialServiceRecordMovements,
    type MovementMode,
    type SpecialServiceRecordMovementItem,
} from "../../services/specialServiceRecordMovementsApi";
import type { SpecialServiceRecordItem } from "../../services/specialServiceRecordsApi";
import { formatRecordDate, toCurrency } from "../../utils/format";
import "../../pages/Calendario/Calendario.css";

const MODE_LABELS: Record<MovementMode, string> = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    cuenta_corriente: "Cuenta corriente",
};

interface SpecialServiceMovementsModalProps {
    record: SpecialServiceRecordItem;
    onClose: () => void;
}

/** Lista de solo lectura con todos los movimientos de un servicio especial. */
const SpecialServiceMovementsModal: React.FC<SpecialServiceMovementsModalProps> = ({ record, onClose }) => {
    const [movements, setMovements] = useState<SpecialServiceRecordMovementItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        fetchSpecialServiceRecordMovements(record.id)
            .then((data) => {
                if (mounted) setMovements(data);
            })
            .catch((err) => {
                if (mounted) setError(err instanceof Error ? err.message : "Error al cargar los movimientos");
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, [record.id]);

    // Del más antiguo al más reciente.
    const ordered = useMemo(
        () =>
            [...movements].sort(
                (a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)
            ),
        [movements]
    );

    const total = useMemo(
        () =>
            movements
                .filter((m) => !m.movement_anulado)
                .reduce((sum, m) => sum + (m.movement_type === "egreso" ? -m.amount : m.amount), 0),
        [movements]
    );

    const titular = record.member_nombre ?? record.person_nombre ?? "Sin titular";

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={`Movimientos · ${record.special_service_name ?? "Servicio especial"}`}
            maxWidth={560}
        >
            <div className="ss-history-movements">
                <div className="ss-history-movements-head">
                    <span>{titular}</span>
                    {record.service_date && <span>Servicio: {formatRecordDate(record.service_date)}</span>}
                </div>

                {loading ? (
                    <div className="ss-loading">
                        <Loader size={16} className="spin" /> Cargando...
                    </div>
                ) : error ? (
                    <div className="ss-error">{error}</div>
                ) : ordered.length === 0 ? (
                    <p className="ss-movement-empty">Este servicio todavía no tiene movimientos.</p>
                ) : (
                    <>
                        <div className="ss-movement-list">
                            {ordered.map((movement) => (
                                <div
                                    key={movement.id}
                                    className={`ss-movement-item ${movement.movement_type}${
                                        movement.movement_anulado ? " is-annulled" : ""
                                    }`}
                                >
                                    <div className="ss-movement-item-top">
                                        <span className="ss-movement-item-label">{movement.label}</span>
                                        <span className="ss-movement-item-amount">
                                            {movement.movement_type === "egreso" ? "−" : "+"}
                                            {toCurrency(movement.amount)}
                                        </span>
                                    </div>
                                    <div className="ss-movement-item-meta">
                                        <span>{formatRecordDate(movement.date)}</span>
                                        <span>{MODE_LABELS[movement.mode] ?? movement.mode}</span>
                                        {!movement.includes_movement && movement.mode !== "cuenta_corriente" && (
                                            <span className="ss-movement-tag">Sin caja</span>
                                        )}
                                        {movement.movement_anulado && (
                                            <span className="ss-movement-tag annulled">
                                                <CircleHelp size={10} /> Anulado
                                            </span>
                                        )}
                                    </div>
                                    {movement.movement_id && (
                                        <div className="ss-movement-item-actions">
                                            <Link
                                                to={`/tesoreria/movimientos/detalle/${movement.movement_id}?comprobante=1`}
                                                className="ss-link-btn"
                                            >
                                                Ver comprobante <FileText size={12} />
                                            </Link>
                                            <Link
                                                to={`/tesoreria/movimientos/detalle/${movement.movement_id}`}
                                                className="ss-link-btn"
                                            >
                                                Ver movimiento <ExternalLink size={12} />
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="ss-history-movements-total">
                            <span>Total (sin anulados)</span>
                            <strong>{toCurrency(total)}</strong>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default SpecialServiceMovementsModal;
