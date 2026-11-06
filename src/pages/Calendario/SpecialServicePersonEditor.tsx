import React, { useEffect, useState } from "react";
import { AlertCircle, Check, Loader, X } from "lucide-react";
import { fetchPersonById, savePerson } from "../../services/personsApi";
import type { Person } from "../../models/members";

export type PersonEditorMode = "create" | "edit";

interface SpecialServicePersonEditorProps {
    mode: PersonEditorMode;
    /** Persona a editar (modo "edit"). */
    person: Person | null;
    /** Personas cargadas, para avisar si el documento ya está registrado. */
    persons: Person[];
    onClose: () => void;
    onSaved: (person: Person, isNew: boolean) => void;
}

const DOC_TYPES = ["DNI", "LE", "LC", "Pasaporte"];

function emptyPerson(): Person {
    return {
        id: crypto.randomUUID(),
        nombre: "",
        tipoDoc: "DNI",
        documento: "",
        domicilio: "",
        telefono: "",
        brindaServicios: false,
    };
}

/** Panel lateral para dar de alta o editar una persona (tercero) desde "Agendar un servicio". */
const SpecialServicePersonEditor: React.FC<SpecialServicePersonEditorProps> = ({
    mode,
    person,
    persons,
    onClose,
    onSaved,
}) => {
    const isEdit = mode === "edit" && !!person;
    const [form, setForm] = useState<Person>(() => (isEdit ? { ...person! } : emptyPerson()));
    // Al editar se traen los datos completos (la lista puede no tener todos los campos).
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!isEdit || !person) return;
        let cancelled = false;
        fetchPersonById(person.id)
            .then((full) => {
                if (!cancelled) setForm({ ...full, id: person.id });
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Error al cargar la persona");
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isEdit, person]);

    const setField = <K extends keyof Person>(key: K, value: Person[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const documento = form.documento.trim();
    const duplicate = documento
        ? persons.find((item) => item.id !== form.id && item.documento.trim() === documento)
        : undefined;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!form.nombre.trim()) {
            setError("Ingresá el nombre de la persona.");
            return;
        }
        if (duplicate) {
            setError(`Ya hay una persona con ese documento: ${duplicate.nombre}.`);
            return;
        }
        setSaving(true);
        try {
            const toSave: Person = {
                ...form,
                nombre: form.nombre.trim(),
                documento,
                domicilio: form.domicilio.trim(),
                telefono: form.telefono.trim(),
            };
            await savePerson(toSave);
            setSaved(true);
            onSaved(toSave, !isEdit);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al guardar la persona");
        } finally {
            setSaving(false);
        }
    };

    if (saved) {
        return (
            <aside className="ss-editor">
                <div className="ss-editor-status">
                    <div className="ss-editor-status-icon ok">
                        <Check size={26} />
                    </div>
                    <h4>Persona guardada</h4>
                    <p>La persona quedó seleccionada como titular del servicio.</p>
                    <button type="button" className="ss-btn ss-btn-primary" onClick={onClose}>
                        <Check size={16} /> OK
                    </button>
                </div>
            </aside>
        );
    }

    const disabled = saving || loading;

    return (
        <aside className="ss-editor">
            <div className="ss-editor-head">
                <div>
                    <h4 className="ss-editor-title">{isEdit ? "Editar persona" : "Nueva persona"}</h4>
                    <p className="ss-editor-sub">
                        {isEdit
                            ? "Los cambios se guardan en el registro de la persona."
                            : "Se registra como tercero y queda como titular del servicio."}
                    </p>
                </div>
                <button type="button" className="ss-editor-close" onClick={onClose} title="Cerrar panel">
                    <X size={16} />
                </button>
            </div>

            <form className="ss-editor-form" onSubmit={handleSubmit}>
                {loading ? (
                    <div className="ss-loading">
                        <Loader size={16} className="spin" /> Cargando persona...
                    </div>
                ) : (
                    <>
                        <div className="ss-field">
                            <label>Nombre y apellido *</label>
                            <input
                                autoComplete="off"
                                type="text"
                                className="ss-input"
                                value={form.nombre}
                                onChange={(e) => setField("nombre", e.target.value)}
                                placeholder="Nombre de la persona"
                                disabled={disabled}
                            />
                        </div>

                        <div className="ss-row">
                            <div className="ss-field">
                                <label>Tipo de documento</label>
                                <select
                                    className="ss-input"
                                    value={form.tipoDoc || "DNI"}
                                    onChange={(e) => setField("tipoDoc", e.target.value)}
                                    disabled={disabled}
                                >
                                    {DOC_TYPES.map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="ss-field">
                                <label>Documento</label>
                                <input
                                    autoComplete="off"
                                    type="text"
                                    className="ss-input"
                                    value={form.documento}
                                    onChange={(e) => setField("documento", e.target.value)}
                                    placeholder="Número"
                                    disabled={disabled}
                                />
                                {duplicate && (
                                    <span className="ss-hint ss-hint-warning">
                                        Ya registrado: {duplicate.nombre}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="ss-field">
                            <label>Domicilio</label>
                            <input
                                autoComplete="off"
                                type="text"
                                className="ss-input"
                                value={form.domicilio}
                                onChange={(e) => setField("domicilio", e.target.value)}
                                placeholder="Calle, número, localidad"
                                disabled={disabled}
                            />
                        </div>

                        <div className="ss-field">
                            <label>Teléfono</label>
                            <input
                                autoComplete="off"
                                type="text"
                                className="ss-input"
                                value={form.telefono}
                                onChange={(e) => setField("telefono", e.target.value)}
                                placeholder="Teléfono de contacto"
                                disabled={disabled}
                            />
                        </div>
                    </>
                )}

                {error && (
                    <div className="ss-editor-error">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                <div className="ss-editor-actions">
                    <button type="button" className="ss-btn ss-btn-secondary" onClick={onClose} disabled={saving}>
                        <X size={16} /> Cancelar
                    </button>
                    <button type="submit" className="ss-btn ss-btn-primary" disabled={disabled}>
                        {saving ? (
                            <>
                                <Loader size={16} className="spin" /> Guardando...
                            </>
                        ) : (
                            <>
                                <Check size={16} /> Confirmar
                            </>
                        )}
                    </button>
                </div>
            </form>
        </aside>
    );
};

export default SpecialServicePersonEditor;
