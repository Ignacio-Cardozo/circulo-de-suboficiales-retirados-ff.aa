import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import logo from "../../assets/logo_ffaa-bg.png";
import "./Login.css";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, loading } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Completá todos los campos");
      return;
    }

    const result = await login(email, password);
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
        <h1 className="login-title">Bienvenido al Sistema</h1>
        <p className="login-sub">Iniciá sesión para continuar.</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        {error && <div className="login-error">{error}</div>}

        <div className="login-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="text"
            className="login-input"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
            autoComplete="email"
            autoFocus
          />
        </div>

        <div className="login-field">
          <label htmlFor="login-password">Contraseña</label>
          <div className="login-input-wrapper">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              className="login-input login-input-icon"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
              autoComplete="current-password"
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
        </div>

        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? (
            <>
              <Loader size={18} className="spin" /> Ingresando...
            </>
          ) : (
            "Iniciar Sesión"
          )}
        </button>

        <p className="login-link-text">
          <Link to="/recuperar-contrasena" className="login-link">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>

        <p className="login-link-text">
          ¿No tenés una cuenta?{" "}
          <Link to="/register" className="login-link">Creá una</Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
