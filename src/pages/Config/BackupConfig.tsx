import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    DatabaseBackup,
    Download,
    FileSpreadsheet,
    Loader,
    RefreshCw,
    XCircle,
} from "lucide-react";
import {
    downloadBackup,
    exportTablesToCsv,
    fetchBackupStatus,
    startBackup,
    type BackupItem,
    type BackupRun,
    type BackupStatus,
} from "../../services/backupApi";
import "./Config.css";
import "./BackupConfig.css";

const POLL_MS = 10_000;
const STALE_HOURS = 48;

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" });
const shortDateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" });

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function hoursSince(iso: string): number {
    return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function isRunning(run: BackupRun | undefined): boolean {
    return !!run && run.status !== "completed";
}

const RunStatus: React.FC<{ run: BackupRun }> = ({ run }) => {
    if (isRunning(run)) {
        return (
            <div className="backup-banner backup-banner-info">
                <Loader size={18} className="spin" />
                <span>Se está generando una copia ({run.trigger}). Tarda alrededor de un minuto; esta pantalla se actualiza sola.</span>
            </div>
        );
    }
    if (run.conclusion !== "success") {
        return (
            <div className="backup-banner backup-banner-error">
                <XCircle size={18} />
                <span>
                    La última copia ({run.trigger}, {dateFmt.format(new Date(run.created_at))}) falló.{" "}
                    <a href={run.url} target="_blank" rel="noreferrer">Ver el detalle en GitHub</a>.
                </span>
            </div>
        );
    }
    return null;
};

const BackupConfig: React.FC = () => {
    const [status, setStatus] = useState<BackupStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [csvProgress, setCsvProgress] = useState<{ done: number; total: number; table: string } | null>(null);
    const [csvError, setCsvError] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const load = useCallback(
        () =>
            fetchBackupStatus()
                .then((s) => {
                    setStatus(s);
                    setError(null);
                })
                .catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : "No se pudo consultar el estado de los respaldos");
                })
                .finally(() => setLoading(false)),
        [],
    );

    const reload = () => {
        setLoading(true);
        void load();
    };

    useEffect(() => {
        fetchBackupStatus()
            .then((s) => {
                setStatus(s);
                setError(null);
            })
            .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "No se pudo consultar el estado de los respaldos");
            })
            .finally(() => setLoading(false));
    }, []);

    // Mientras haya una copia en curso, consultar cada 10 s.
    const running = isRunning(status?.runs[0]) || starting;
    useEffect(() => {
        if (!running) return;
        pollRef.current = setTimeout(() => void load(), POLL_MS);
        return () => {
            if (pollRef.current) clearTimeout(pollRef.current);
        };
    }, [running, status, load]);

    const handleStart = async () => {
        setStarting(true);
        setError(null);
        try {
            await startBackup();
            // GitHub tarda unos segundos en registrar la ejecución.
            await new Promise((r) => setTimeout(r, 4000));
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo iniciar la copia");
        } finally {
            setStarting(false);
        }
    };

    const handleDownload = async (item: BackupItem) => {
        setDownloadingId(item.id);
        setError(null);
        try {
            await downloadBackup(item);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo descargar la copia");
        } finally {
            setDownloadingId(null);
        }
    };

    const handleCsv = async () => {
        setCsvError(null);
        setCsvProgress({ done: 0, total: 0, table: "" });
        try {
            await exportTablesToCsv((done, total, table) => setCsvProgress({ done, total, table }));
        } catch (err) {
            setCsvError(err instanceof Error ? err.message : "No se pudo exportar");
        } finally {
            setCsvProgress(null);
        }
    };

    const latest = status?.backups[0];
    const lastRun = status?.runs[0];
    const configured = status?.configured.github && status?.configured.passphrase;

    return (
        <div className="config-container custom-scroll">
            <div className="backup-layout">
                {/* Copias automáticas */}
                <section className="config-card backup-card">
                    <header className="backup-card-head">
                        <DatabaseBackup size={24} />
                        <div>
                            <h3>Copias de seguridad automáticas</h3>
                            <p className="config-description">
                                Todos los días a las 03:00 se guarda una copia completa de la base de datos.
                                Se conservan 30 días; la del día 1 de cada mes, 90 días.
                            </p>
                        </div>
                    </header>

                    {loading && (
                        <div className="backup-muted"><Loader size={16} className="spin" /> Consultando copias…</div>
                    )}

                    {error && <div className="config-error">{error}</div>}

                    {!loading && status && !configured && (
                        <div className="backup-banner backup-banner-warn">
                            <AlertTriangle size={18} />
                            <span>
                                Los respaldos automáticos todavía no están configurados en el servidor
                                (faltan {[
                                    !status.configured.github && "BACKUP_GITHUB_TOKEN",
                                    !status.configured.passphrase && "BACKUP_PASSPHRASE",
                                ].filter(Boolean).join(" y ")}).
                                Los pasos están en <code>docs/BACKUPS.md</code>. Mientras tanto podés usar la exportación a Excel.
                            </span>
                        </div>
                    )}

                    {!loading && status && configured && !status.workflow && (
                        <div className="backup-banner backup-banner-warn">
                            <AlertTriangle size={18} />
                            <span>
                                El workflow de respaldos todavía no está en GitHub. Subí los cambios al repositorio
                                (<code>git push</code>) y tocá <strong>Actualizar</strong>.
                            </span>
                            <button type="button" className="backup-secondary-btn" onClick={reload}>
                                <RefreshCw size={14} /> Actualizar
                            </button>
                        </div>
                    )}

                    {!loading && status && configured && status.workflow && (
                        <>
                            {lastRun && <RunStatus run={lastRun} />}

                            {latest ? (
                                hoursSince(latest.created_at) > STALE_HOURS ? (
                                    <div className="backup-banner backup-banner-warn">
                                        <AlertTriangle size={18} />
                                        <span>La última copia es del {dateFmt.format(new Date(latest.created_at))}. Hace más de 2 días que no se genera una nueva.</span>
                                    </div>
                                ) : (
                                    <div className="backup-banner backup-banner-ok">
                                        <CheckCircle2 size={18} />
                                        <span>Última copia: {dateFmt.format(new Date(latest.created_at))}.</span>
                                    </div>
                                )
                            ) : (
                                !isRunning(lastRun) && (
                                    <div className="backup-banner backup-banner-warn">
                                        <AlertTriangle size={18} />
                                        <span>Todavía no hay copias guardadas. Creá la primera con el botón de abajo.</span>
                                    </div>
                                )
                            )}

                            <div className="backup-actions">
                                <button type="button" className="config-save-btn" onClick={handleStart} disabled={running}>
                                    {running ? <><Loader size={16} className="spin" /> Generando copia…</> : <><DatabaseBackup size={16} /> Crear copia ahora</>}
                                </button>
                                <button type="button" className="backup-secondary-btn" onClick={reload} disabled={loading}>
                                    <RefreshCw size={16} /> Actualizar
                                </button>
                            </div>

                            {status.backups.length > 0 && (
                                <div className="backup-table-wrapper">
                                    <table className="backup-table">
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Tipo</th>
                                                <th>Tamaño</th>
                                                <th>Disponible hasta</th>
                                                <th aria-label="Acciones" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {status.backups.map((b) => (
                                                <tr key={b.id}>
                                                    <td>{dateFmt.format(new Date(b.created_at))}</td>
                                                    <td>
                                                        <span className={`backup-tag backup-tag-${b.kind}`}>{b.kind === "mensual" ? "Mensual" : "Diaria"}</span>
                                                    </td>
                                                    <td>{formatSize(b.size)}</td>
                                                    <td className="backup-muted-cell">
                                                        <Clock size={13} /> {shortDateFmt.format(new Date(b.expires_at))}
                                                    </td>
                                                    <td className="backup-action-cell">
                                                        <button
                                                            type="button"
                                                            className="backup-secondary-btn"
                                                            onClick={() => void handleDownload(b)}
                                                            disabled={downloadingId !== null}
                                                        >
                                                            {downloadingId === b.id
                                                                ? <><Loader size={14} className="spin" /> Descargando…</>
                                                                : <><Download size={14} /> Descargar</>}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <p className="config-card-hint">
                                Las copias se borran solas al vencer. Si querés conservar alguna por más tiempo,
                                descargala y guardala en un pendrive o en tu nube personal (por ejemplo, una vez por mes).
                            </p>
                        </>
                    )}
                </section>

                {/* Exportación CSV */}
                <section className="config-card backup-card">
                    <header className="backup-card-head">
                        <FileSpreadsheet size={24} />
                        <div>
                            <h3>Exportar datos a Excel</h3>
                            <p className="config-description">
                                Descarga un archivo ZIP con una planilla (CSV) por cada tabla: socios, terceros,
                                movimientos, cuotas, cementerio, servicios, etc. Sirve para consultar los datos
                                sin conocimientos técnicos.
                            </p>
                        </div>
                    </header>
                    {csvError && <div className="config-error">{csvError}</div>}
                    <button type="button" className="config-save-btn" onClick={handleCsv} disabled={csvProgress !== null}>
                        {csvProgress
                            ? <><Loader size={16} className="spin" /> {csvProgress.total ? `Exportando ${Math.min(csvProgress.done + 1, csvProgress.total)} de ${csvProgress.total}…` : "Preparando…"}</>
                            : <><Download size={16} /> Descargar planillas (ZIP)</>}
                    </button>
                </section>
            </div>
        </div>
    );
};

export default BackupConfig;
