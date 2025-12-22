// src/pages/Login/LoginPage.jsx

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#050816",
        color: "white",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          padding: "32px 28px",
          borderRadius: 16,
          background:
            "radial-gradient(circle at top, rgba(56,189,248,0.25), transparent 60%), rgba(15,23,42,0.96)",
          boxShadow: "0 18px 45px rgba(0,0,0,0.75)",
          border: "1px solid rgba(148,163,184,0.4)",
        }}
      >
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
          POS Bar / Restaurante
        </h1>
        <p style={{ fontSize: 13, color: "#cbd5f5", marginBottom: 22 }}>
          Inicia sesión como administrador para gestionar mesas, pedidos e inventario.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "#e5e7eb" }}>Correo</label>
            <input
              type="email"
              placeholder="admin@pos.com"
              style={{
                marginTop: 4,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.65)",
                background: "rgba(15,23,42,0.9)",
                color: "white",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#e5e7eb" }}>Contraseña</label>
            <input
              type="password"
              placeholder="••••••"
              style={{
                marginTop: 4,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.65)",
                background: "rgba(15,23,42,0.9)",
                color: "white",
                outline: "none",
              }}
            />
          </div>

          <button
            style={{
              marginTop: 6,
              width: "100%",
              padding: "11px 14px",
              borderRadius: 999,
              border: "none",
              background:
                "linear-gradient(135deg, #22c55e, #16a34a, #22c55e)",
              color: "#0b1120",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Iniciar sesión
          </button>
        </div>

        <p
          style={{
            marginTop: 16,
            fontSize: 11,
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          Diana: por ahora este botón es solo visual, después conectamos con tu backend
          (login real con JWT).
        </p>
      </div>
    </div>
  );
}




