import React from "react";
import { Printer, Download, X } from "lucide-react";
import { toCurrency, numberToWords, formatRecordDate } from "../../utils/format";
import logoUrl from "../../assets/logo_ffaa.png";
import "./Comprobante.css";

export interface ComprobanteData {
  receipt_number: number;
  type: "ingreso" | "egreso";
  date: string;
  detail: string;
  amount: number;
  origin: string;
  payerName?: string;
  conceptDetail?: string;
  copies_to_print: number;
  paymentMethod?: string;
  anulado?: boolean;
}

interface ComprobanteProps {
  data: ComprobanteData;
  onClose: () => void;
}

const COPY_LABELS: Record<number, string> = {
  1: "ORIGINAL",
  2: "DUPLICADO",
  3: "TRIPLICADO",
};

function buildSingleReceiptHtml(data: ComprobanteData, copyLabel: string): string {
  const tipoRecibo = data.type === "ingreso" ? "RECIBO" : "COMPROBANTE DE EGRESO";
  const labelEntrega = data.type === "ingreso" ? "Recibí de" : "Pagué a";
  const formattedDate = formatRecordDate(data.date);

  return `
    <div class="receipt-page">
      ${data.anulado ? `<div class="receipt-watermark">ANULADO</div>` : ""}
      ${copyLabel ? `<div class="copy-label">${copyLabel}</div>` : ""}
      <div class="receipt-header">
        <div class="header-row-1">
          <div class="header-logo">
            <img src="${logoUrl}" alt="Logo" />
          </div>
          <div class="header-text">
            <div class="institution-name">Círculo de Suboficiales Retirados de las Fuerzas Armadas de la Nación</div>
            <div class="motto">"Honor y Patria"</div>
          </div>
          <div class="header-spacer"></div>
        </div>
        <div class="header-row-2">
          <div class="header-col">Dean Funes 536</div>
          <div class="header-col header-col-center">TEL: 0358-4624743</div>
          <div class="header-col">5800 Río Cuarto (CBA)</div>
        </div>
      </div>

      <div class="receipt-title">${tipoRecibo} AUTORIZADO N° ${String(data.receipt_number).padStart(6, "0")}, del día ${formattedDate}</div>

      <div class="receipt-body">
        <div class="field">
          <span class="field-label">${labelEntrega}:</span>
          <div class="field-value underline">${data.payerName || "—"}</div>
        </div>
        <div class="field">
          <span class="field-label">Importe:</span>
          <div class="field-value amount-numbers">${toCurrency(data.amount)}</div>
        </div>
        <div class="field">
          <span class="field-label">La cantidad de pesos:</span>
          <div class="field-value amount-words">${numberToWords(data.amount).toUpperCase()}</div>
        </div>
        ${data.paymentMethod ? `<div class="field"><span class="field-label">Forma de pago:</span> <span class="field-value">${data.paymentMethod}</span></div>` : ""}
      </div>

      <div class="receipt-concept">
        <span class="concept-label">En concepto de:</span>
        <div class="field-value">${(data.conceptDetail || data.detail || "—").replace(/\n/g, '<br>')}</div>
      </div>

      <div class="receipt-footer">
        <div class="footer-signature">
          <div class="sig-line">Firma</div>
          <div class="acl-line">Aclaración: <span></span></div>
        </div>
      </div>
    </div>
  `;
}

interface ReceiptSizes {
  padding: string;
  label: string;
  labelMb: string;
  gridCols: string;
  gap: string;
  logo: string;
  name: string;
  motto: string;
  mottoMt: string;
  addr: string;
  addrMt: string;
  headerMb: string;
  headerPb: string;
  row1Mb: string;
  title: string;
  titleMt: string;
  body: string;
  bodyLh: string;
  bodyMt: string;
  fieldMb: string;
  concept: string;
  conceptLh: string;
  conceptMt: string;
  amount: string;
  underlineMin: string;
  sigMinW: string;
  sigMt: string;
  aclMt: string;
  sig: string;
  aclW: string;
  watermark: string;
}

function getSizes(copies: number): ReceiptSizes {
  if (copies === 3) {
    return {
      padding: "5px 10px",
      label: "10px",
      labelMb: "4px",
      gridCols: "32px 1fr 32px",
      gap: "5px",
      logo: "28px",
      name: "12px",
      motto: "11px",
      mottoMt: "1px",
      addr: "8px",
      addrMt: "2px",
      headerMb: "4px",
      headerPb: "4px",
      row1Mb: "2px",
      title: "12px",
      titleMt: "6px 0",
      body: "11px",
      bodyLh: "1.25",
      bodyMt: "4px 0",
      fieldMb: "3px",
      concept: "11px",
      conceptLh: "1.25",
      conceptMt: "3px 0",
      amount: "13px",
      underlineMin: "100px",
      sigMinW: "100px",
      sigMt: "8px",
      aclMt: "4px",
      sig: "10px",
      aclW: "80px",
      watermark: "20px",
    };
  }
  if (copies === 2) {
    return {
      padding: "8px 14px",
      label: "12px",
      labelMb: "6px",
      gridCols: "40px 1fr 40px",
      gap: "6px",
      logo: "36px",
      name: "16px",
      motto: "15px",
      mottoMt: "2px",
      addr: "10px",
      addrMt: "3px",
      headerMb: "6px",
      headerPb: "6px",
      row1Mb: "3px",
      title: "15px",
      titleMt: "8px 0",
      body: "15px",
      bodyLh: "1.35",
      bodyMt: "6px 0",
      fieldMb: "4px",
      concept: "15px",
      conceptLh: "1.3",
      conceptMt: "5px 0",
      amount: "16px",
      underlineMin: "120px",
      sigMinW: "120px",
      sigMt: "12px",
      aclMt: "6px",
      sig: "12px",
      aclW: "90px",
      watermark: "26px",
    };
  }
  return {
    padding: "16px 20px",
    label: "16px",
    labelMb: "12px",
    gridCols: "50px 1fr 50px",
    gap: "8px",
    logo: "46px",
    name: "19px",
    motto: "19px",
    mottoMt: "4px",
    addr: "13px",
    addrMt: "8px",
    headerMb: "16px",
    headerPb: "14px",
    row1Mb: "8px",
    title: "18px",
    titleMt: "14px 0",
    body: "17px",
    bodyLh: "1.7",
    bodyMt: "16px 0",
    fieldMb: "10px",
    concept: "17px",
    conceptLh: "1.6",
    conceptMt: "14px 0",
    amount: "19px",
    underlineMin: "160px",
    sigMinW: "160px",
    sigMt: "50px",
    aclMt: "16px",
    sig: "15px",
    aclW: "150px",
    watermark: "34px",
  };
}

function buildPrintHtml(data: ComprobanteData, overrideLabel?: string): string {
  const copies = overrideLabel ? 1 : Math.max(1, Math.min(3, data.copies_to_print));
  const pages: string[] = [];

  for (let i = 0; i < copies; i++) {
    pages.push(buildSingleReceiptHtml(data, overrideLabel ?? COPY_LABELS[i + 1] ?? ""));
  }

  const s = getSizes(copies);
  const pageHeightRule = copies === 1 ? "flex: none; height: 50%;" : "flex: 1 1 0; min-height: 0;";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page {
          size: A4;
          margin: 10mm;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { height: 100%; }
        body {
          font-family: Arial, sans-serif;
          color: #333;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .receipts-row {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .receipt-page {
          ${pageHeightRule}
          padding: ${s.padding};
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .receipt-page + .receipt-page { border-top: 2px dashed #aaa; }

        .receipt-watermark {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 10;
        }
        .receipt-watermark::before {
          content: "ANULADO";
          color: rgba(220, 38, 38, 0.3);
          border: 4px solid rgba(220, 38, 38, 0.3);
          border-radius: 12px;
          padding: 8px 28px;
          font-size: ${s.watermark};
          font-weight: 900;
          letter-spacing: 6px;
          text-transform: uppercase;
          transform: rotate(45deg);
          white-space: nowrap;
        }

        .copy-label {
          text-align: center;
          font-size: ${s.label};
          font-weight: 700;
          color: #999;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: ${s.labelMb};
          padding: 2px 0;
          border-bottom: 1px dashed #ccc;
        }

        .receipt-header {
          margin-bottom: ${s.headerMb};
          padding-bottom: ${s.headerPb};
          border-bottom: 2px solid #1a3a5c;
        }
        .header-row-1 {
          display: grid;
          grid-template-columns: ${s.gridCols};
          align-items: center;
          gap: ${s.gap};
          margin-bottom: ${s.row1Mb};
        }
        .header-logo { text-align: center; }
        .header-logo img { width: ${s.logo}; height: auto; }
        .header-text { text-align: center; }
        .header-text .institution-name {
          font-size: ${s.name};
          font-weight: 700;
          color: #1a3a5c;
          line-height: 1.2;
        }
        .header-text .motto {
          font-size: ${s.motto};
          font-weight: 700;
          color: #1a3a5c;
          margin-top: ${s.mottoMt};
        }
        .header-spacer { }
        .header-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          align-items: center;
          text-align: center;
          font-size: ${s.addr};
          color: #555;
          margin-top: ${s.addrMt};
        }

        .receipt-title { text-align: center; font-size: ${s.title}; font-weight: 700; color: #1a3a5c; margin: ${s.titleMt}; text-transform: uppercase; }

        .receipt-body { font-size: ${s.body}; line-height: ${s.bodyLh}; margin: ${s.bodyMt}; }
        .receipt-body .field { margin-bottom: ${s.fieldMb}; }
        .receipt-body .field-label { font-weight: 600; }
        .receipt-body .field-value { margin-top: 2px; }
        .receipt-body .underline { border-bottom: 1px solid #999; display: inline-block; min-width: ${s.underlineMin}; }
        .receipt-body .amount-words { font-style: italic; margin-top: 4px; }
        .receipt-body .amount-numbers { font-weight: 700; font-size: ${s.amount}; color: #1a3a5c; }

        .receipt-concept { margin: ${s.conceptMt}; font-size: ${s.concept}; line-height: ${s.conceptLh}; }
        .receipt-concept .concept-label { font-weight: 600; }

        .receipt-footer { margin-top: auto; display: flex; justify-content: flex-end; align-items: flex-end; }
        .footer-signature { text-align: center; min-width: ${s.sigMinW}; }
        .footer-signature .sig-line { border-top: 1px solid #333; margin-top: ${s.sigMt}; padding-top: 3px; font-size: ${s.sig}; color: #555; }
        .footer-signature .acl-line { margin-top: ${s.aclMt}; font-size: ${s.sig}; color: #555; }
        .footer-signature .acl-line span { border-bottom: 1px solid #333; display: inline-block; min-width: ${s.aclW}; }
      </style>
    </head>
    <body>
      <div class="receipts-row">
        ${pages.join("")}
      </div>
    </body>
    </html>
  `;
}

function handlePrint(data: ComprobanteData) {
  const num = String(data.receipt_number).padStart(6, "0");
  const fileName = `comprobante-${data.type}-N${num}`;
  const html = buildPrintHtml(data);
  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.title = fileName;
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); }, 300);
}

function handleDownloadPdf(data: ComprobanteData) {
  const num = String(data.receipt_number).padStart(6, "0");
  const fileName = `comprobante-${data.type}-N${num}`;
  const html = buildPrintHtml(data);
  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.title = fileName;
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    setTimeout(() => printWindow.close(), 500);
  }, 300);
}

function handlePrintCopy(data: ComprobanteData) {
  const num = String(data.receipt_number).padStart(6, "0");
  const fileName = `copia-comprobante-${data.type}-N${num}`;
  const html = buildPrintHtml(data, "COPIA");
  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.title = fileName;
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    setTimeout(() => printWindow.close(), 500);
  }, 300);
}

const Comprobante: React.FC<ComprobanteProps> = ({ data, onClose }) => {
  const typeLabel = data.type === "ingreso" ? "INGRESO" : "EGRESO";
  const formattedDate = formatRecordDate(data.date);
  const labelEntrega = data.type === "ingreso" ? "Recibido de" : "Pagado a";

  return (
    <div className="comprobante-overlay">
      <div className="comprobante-modal" onClick={(e) => e.stopPropagation()}>
        <button className="comprobante-close-btn" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="comprobante-content">
          <div className="comprobante-detail-card">
            <div className="comprobante-detail-row">
              <span className="comprobante-detail-label">Comprobante N°</span>
              <span className="comprobante-detail-value">{String(data.receipt_number).padStart(6, "0")}</span>
            </div>
            <div className="comprobante-detail-row">
              <span className="comprobante-detail-label">Tipo</span>
              <span className={`comprobante-type-badge ${data.type === "ingreso" ? "type-ingreso" : "type-egreso"}`}>{typeLabel}</span>
            </div>
            <div className="comprobante-detail-row">
              <span className="comprobante-detail-label">Fecha</span>
              <span className="comprobante-detail-value">{formattedDate}</span>
            </div>
            {data.payerName && (
              <div className="comprobante-detail-row">
                <span className="comprobante-detail-label">{labelEntrega}</span>
                <span className="comprobante-detail-value">{data.payerName}</span>
              </div>
            )}
            <div className="comprobante-detail-row">
              <span className="comprobante-detail-label">Detalle</span>
              <span className="comprobante-detail-value" style={{ whiteSpace: "pre-line" }}>{data.conceptDetail ?? data.detail}</span>
            </div>
            <div className="comprobante-detail-row">
              <span className="comprobante-detail-label">Importe</span>
              <span className="comprobante-detail-value comprobante-amount-value">{toCurrency(data.amount)}</span>
            </div>
            {data.paymentMethod && (
              <div className="comprobante-detail-row">
                <span className="comprobante-detail-label">Forma de pago</span>
                <span className="comprobante-detail-value">{data.paymentMethod}</span>
              </div>
            )}
          </div>
        </div>

        <div className="comprobante-actions no-print">
          <button className="comprobante-print-btn" onClick={() => handlePrint(data)}>
            <Printer size={16} /> Imprimir
          </button>
          <button className="comprobante-print-btn comprobante-copy-btn" onClick={() => handlePrintCopy(data)}>
            <Printer size={16} /> Imprimir Copia
          </button>
          <button className="comprobante-download-btn" onClick={() => handleDownloadPdf(data)}>
            <Download size={16} /> Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default Comprobante;
