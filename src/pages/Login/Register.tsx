import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { EMAIL_RE, checkPasswordStrength, validatePassword } from "./passwordRules";
import logo from "../../assets/logo_ffaa-bg.png";
import "../Login/Login.css";

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { signUp, loading } = useAuthStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = checkPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("Completá todos los campos");
      return;
    }

    if (!EMAIL_RE.test(email)) {
      setError("El formato del email no es válido");
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

    const result = await signUp(name, email, password);
    if (result.error) {
      setError(result.error);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="login-root">
      <div className="login-header">
        <img src={logo} alt="Logo" className="login-logo" />
        <h1 className="login-title">Crear un nuevo usuario</h1>
        <p className="login-sub">Registrate para empezar a usar el sistema.</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        {error && <div className="login-error">{error}</div>}

        <div className="login-field">
          <label htmlFor="register-name">Nombre</label>
          <input
            id="register-name"
            type="text"
            className="login-input"
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
            autoComplete="name"
            autoFocus
          />
        </div>

        <div className="login-field">
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="text"
            className="login-input"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
            autoComplete="email"
          />
        </div>

        <div className="login-field">
          <label htmlFor="register-password">Contraseña</label>
          <div className="login-input-wrapper">
            <input
              id="register-password"
              type={showPassword ? "text" : "password"}
              className="login-input login-input-icon"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
              autoComplete="new-password"
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
          <label htmlFor="register-confirm">Repetir contraseña</label>
          <div className="login-input-wrapper">
            <input
              id="register-confirm"
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
              <Loader size={18} className="spin" /> Creando cuenta...
            </>
          ) : (
            "Registrarse"
          )}
        </button>

        <p className="login-link-text">
          ¿Ya tenés una cuenta?{" "}
          <Link to="/login" className="login-link">Iniciá sesión</Link>
        </p>
      </form>
    </div>
  );
};

export default Register;
