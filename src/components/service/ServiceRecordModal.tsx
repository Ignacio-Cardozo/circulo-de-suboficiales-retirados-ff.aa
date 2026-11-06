import React from "react";
import { Link } from "react-router-dom";
import { Calendar, Briefcase, User, DollarSign, FileText, ExternalLink } from "lucide-react";
import { formatRecordDate, toCurrency } from "../../utils/format";
import Modal from "../ui/Modal";

interface ServiceRecordLink {
  id: string;
  service_name?: string | null;
  service_date?: string | null;
  service_amount?: number | null;
  member_id?: string | null;
  member_nombre?: string | null;
  member_numero_de_socio?: string | null;
  person_id?: string | null;
  person_nombre?: string | null;
  amount: number;
  date: string;
  detail?: string | null;
  movement_id?: string | null;
}

interface ServiceRecordModalProps {
  record: ServiceRecordLink | null;
  onClose: () => void;
  /** Muestra el acceso al movimiento vinculado. */
  showMovementLink?: boolean;
  /** Muestra el acceso al perfil del titular. */
  showTitularLink?: boolean;
}

/** Click izquierdo sin teclas modificadoras: navegación normal dentro de la misma pestaña. */
function isPlainLeftClick(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

function getTitularHref(r: ServiceRecordLink): string | null {
  if (r.member_id) return `/socios/detalle/${r.member_id}`;
  if (r.person_id) return `/terceros/detalle/${r.person_id}`;
  return null;
}

function getTitular(r: ServiceRecordLink): string {
  if (r.member_nombre) {
    return `${r.member_nombre}${r.member_numero_de_socio ? ` (N\u00BA ${r.member_numero_de_socio})` : ""}`;
  }
  return r.person_nombre ?? "\u2014";
}

const ServiceRecordModal: React.FC<ServiceRecordModalProps> = ({
  record,
  onClose,
  showMovementLink = false,
  showTitularLink = false,
}) => {
  if (!record) return null;
  const titularHref = showTitularLink ? getTitularHref(record) : null;
  // Cerrar el modal sólo si se navega en esta pestaña (no con la rueda o Ctrl+click).
  const closeOnPlainClick = (e: React.MouseEvent) => {
    if (isPlainLeftClick(e)) onClose();
  };

  return (
    <Modal isOpen={!!record} onClose={onClose} title="Detalle del Registro de Servicio">
      <div className="service-modal-body">
        <div className="service-modal-highlight">
          <span className="service-modal-amount">{toCurrency(record.amount)}</span>
          <span className="service-modal-date">
            <Calendar size={14} />
            {formatRecordDate(record.date)}
          </span>
        </div>

        <div className="service-modal-grid">
          <div className="service-modal-field">
            <span className="service-modal-icon"><Briefcase size={14} /></span>
            <div>
              <span className="service-modal-label">Servicio</span>
              <span className="service-modal-value">{record.service_name ?? "\u2014"}</span>
            </div>
          </div>
          <div className="service-modal-field">
            <span className="service-modal-icon"><User size={14} /></span>
            <div>
              <span className="service-modal-label">Titular</span>
              <span className="service-modal-value" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {getTitular(record)}
                {titularHref && (
                  <Link
                    to={titularHref}
                    className="service-modal-link-btn"
                    style={{ padding: "4px 10px", fontSize: 12, textDecoration: "none" }}
                    onClick={closeOnPlainClick}
                  >
                    Ver perfil <ExternalLink size={12} />
                  </Link>
                )}
              </span>
            </div>
          </div>
          <div className="service-modal-field">
            <span className="service-modal-icon"><Calendar size={14} /></span>
            <div>
              <span className="service-modal-label">Fecha de pago</span>
              <span className="service-modal-value">{formatRecordDate(record.date)}</span>
            </div>
          </div>
          {record.service_date && (
            <div className="service-modal-field">
              <span className="service-modal-icon"><Calendar size={14} /></span>
              <div>
                <span className="service-modal-label">Fecha del servicio</span>
                <span className="service-modal-value">{formatRecordDate(record.service_date)}</span>
              </div>
            </div>
          )}
          {record.service_amount != null && (
            <div className="service-modal-field">
              <span className="service-modal-icon"><DollarSign size={14} /></span>
              <div>
                <span className="service-modal-label">Monto base del servicio</span>
                <span className="service-modal-value">{toCurrency(record.service_amount)}</span>
              </div>
            </div>
          )}
          {record.detail && (
            <div className="service-modal-field">
              <span className="service-modal-icon"><FileText size={14} /></span>
              <div>
                <span className="service-modal-label">Detalle</span>
                <span className="service-modal-value">{record.detail}</span>
              </div>
            </div>
          )}
        </div>

        {record.movement_id && showMovementLink && (
          <div className="service-modal-link">
            <Link
              to={`/tesoreria/movimientos/detalle/${record.movement_id}`}
              className="service-modal-link-btn"
              style={{ textDecoration: "none" }}
              onClick={closeOnPlainClick}
            >
              Ver movimiento vinculado <ExternalLink size={13} />
            </Link>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ServiceRecordModal;
