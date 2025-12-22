// src/Login/LoginPage.jsx
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@pos.com");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:4000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Mensaje que venga del backend o uno genérico
        setError(data.message || "Credenciales incorrectas");
        return;
      }

      // Aquí asumimos que el backend devuelve { token, user }
      if (data.token) {
        localStorage.setItem("pos_token", data.token);
      }
      if (data.user) {
        localStorage.setItem("pos_user_name", data.user.name || "");
        localStorage.setItem("pos_user_role", data.user.role || "");
      }

if (res.ok) {      
alert(`✅ Login correcto, bienvenida ${data.user?.name || "Admin"}`);
  window.location.href = "/";   // 👈 manda al Dashboard
}

      // Ir al panel principal (Dashboard)
      window.location.href = "/";
    } catch (err) {
      console.error(err);
      setError("No se pudo conectar con el servidor. Revisa que el backend (puerto 4000) esté encendido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #0f172a 0, #020617 55%, #000 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#e5e7eb",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "rgba(15,23,42,0.96)",
          borderRadius: 24,
          padding: "32px 28px 26px",
          boxShadow: "0 30px 90px rgba(15,23,42,0.95)",
          border: "1px solid rgba(148,163,184,0.35)",
        }}
      >
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            textAlign: "center",
            marginBottom: 6,
          }}
        >
          POS Multi Bar
        </h1>
        <p
          style={{
            fontSize: 13,
            textAlign: "center",
            opacity: 0.85,
            marginBottom: 20,
          }}
        >
          Inicia sesión como administradora para continuar
        </p>

        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            Correo
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.5)",
              backgroundColor: "rgba(15,23,42,0.9)",
              color: "#e5e7eb",
              fontSize: 13,
              marginBottom: 12,
              outline: "none",
            }}
          />

          <label
            style={{
              display: "block",
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.5)",
              backgroundColor: "rgba(15,23,42,0.9)",
              color: "#e5e7eb",
              fontSize: 13,
              marginBottom: 10,
              outline: "none",
            }}
          />

          {error && (
            <p
              style={{
                fontSize: 12,
                color: "#f97373",
                textAlign: "center",
                marginBottom: 10,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 999,
              border: "none",
              background:
                "linear-gradient(135deg, #22c55e, #16a34a)",
              color: "#022c22",
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? "wait" : "pointer",
              marginTop: 4,
              marginBottom: 10,
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p
          style={{
            fontSize: 11,
            textAlign: "center",
            opacity: 0.7,
            marginTop: 4,
          }}
        >
          Usa: <strong>admin@pos.com</strong> / <strong>123456</strong>
        </p>
      </div>
    </div>
  );
}
