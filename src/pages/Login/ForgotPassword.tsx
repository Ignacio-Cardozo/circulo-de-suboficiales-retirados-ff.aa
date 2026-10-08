import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Loader, MailCheck } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { EMAIL_RE } from "./passwordRules";
import logo from "../../assets/logo_ffaa-bg.png";
import "./Login.css";

const ForgotPassword: React.FC = () => {
  const { requestPasswordReset, loading } = useAuthStore();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Completá todos los campos");
      return;
    }

    if (!EMAIL_RE.test(email)) {
      setError("El formato del email no es válido");
      return;
    }

    const result = await requestPasswordReset(email.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="login-root">
      <div className="login-header">
        <img src={logo} alt="Logo" className="login-logo" />
        <h1 className="login-title">Recuperar contraseña</h1>
        <p className="login-sub">
          Ingresá tu email y te enviamos un link para restablecerla.
        </p>
      </div>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        {sent ? (
          <div className="login-state">
            <div className="login-state-icon">
              <MailCheck size={26} />
            </div>
            <h2 className="login-state-title">Revisá tu email</h2>
            <p className="login-state-text">
              Si el email <strong>{email.trim()}</strong> está registrado, vas a
              recibir un link para crear una nueva contraseña. El link vence en 1
              hora.
            </p>
            <button
              type="button"
              className="login-btn"
              onClick={() => setSent(false)}
            >
              Usar otro email
            </button>
            <p className="login-link-text">
              ¿Recordás la contraseña?{" "}
              <Link to="/login" className="login-link">Iniciá sesión</Link>
            </p>
          </div>
        ) : (
          <>
            {error && <div className="login-error">{error}</div>}

            <div className="login-field">
              <label htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                type="text"
                className="login-input"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                autoComplete="email"
                autoFocus
              />
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? (
                <>
                  <Loader size={18} className="spin" /> Enviando...
                </>
              ) : (
                "Enviar link"
              )}
            </button>

            <p className="login-link-text">
              ¿Recordás la contraseña?{" "}
              <Link to="/login" className="login-link">Iniciá sesión</Link>
            </p>
          </>
        )}
      </form>
    </div>
  );
};

export default ForgotPassword;