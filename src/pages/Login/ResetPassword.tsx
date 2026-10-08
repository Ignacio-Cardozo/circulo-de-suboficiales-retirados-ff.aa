import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader, Eye, EyeOff, KeyRound, TriangleAlert } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { checkPasswordStrength, validatePassword } from "./passwordRules";
import logo from "../../assets/logo_ffaa-bg.png";
import "./Login.css";

const ResetPassword: React.FC = () => {
  const { resetPassword, loading } = useAuthStore();
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token");
  const linkError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const strength = checkPasswordStrength(password);
  const invalidToken = Boolean(linkError) || !token;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim() || !confirmPassword.trim()) {
      setError("Completá todos los campos");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    const result = await resetPassword(password, token ?? "");
    if (result.error) {
      setError(result.error);
    } else {
      setDone(true);
    }
  };

  return (
    <div className="login-root">
      <div className="login-header">
        <img src={logo} alt="Logo" className="login-logo" />
        <h1 className="login-title">Crear una nueva contraseña</h1>
        <p className="login-sub">Elegí una contraseña que no hayas usado antes.</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        {invalidToken ? (
          <div className="login-state">
            <div className="login-state-icon login-state-icon-danger">
              <TriangleAlert size={26} />
            </div>
            <h2 className="login-state-title">Link inválido</h2>
            <p className="login-state-text">
              El link de restablecimiento venció o ya fue utilizado. Pedí uno nuevo
              para continuar.
            </p>
            <Link to="/recuperar-contrasena" className="login-btn login-btn-link">
              Pedir un nuevo link
            </Link>
            <p className="login-link-text">
              <Link to="/login" className="login-link">Volver al inicio de sesión</Link>
            </p>
          </div>
        ) : done ? (
          <div className="login-state">
            <div className="login-state-icon">
              <KeyRound size={26} />
            </div>
            <h2 className="login-state-title">Contraseña actualizada</h2>
            <p className="login-state-text">
              Ya podés iniciar sesión con tu nueva contraseña.
            </p>
            <Link to="/login" className="login-btn login-btn-link">
              Iniciar Sesión
            </Link>
          </div>
        ) : (
          <>
            {error && <div className="login-error">{error}</div>}

            <div className="login-field">
              <label htmlFor="reset-password">Nueva contraseña</label>
              <div className="login-input-wrapper">
                <input
                  id="reset-password"
                  type={showPassword ? "text" : "password"}
                  className="login-input login-input-icon"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="pw-strength">
                  <div className="pw-strength-bar">
                    <div
                      className="pw-strength-fill"
                      style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }}
                    />
                  </div>
                  <span className="pw-strength-label" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            <div className="login-field">
              <label htmlFor="reset-confirm">Repetir contraseña</label>
              <div className="login-input-wrapper">
                <input
                  id="reset-confirm"
                  type={showConfirm ? "text" : "password"}
                  className="login-input login-input-icon"
                  placeholder="Tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(null); }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowConfirm((v) => !v)}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <span className="pw-match-error">Las contraseñas no coinciden</span>
              )}
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? (
                <>
                  <Loader size={18} className="spin" /> Guardando...
                </>
              ) : (
                "Guardar contraseña"
              )}
            </button>
          </>
        )}
      </form>
    </div>
  );
};

export default ResetPassword;