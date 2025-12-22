import { Outlet, Link } from "react-router-dom";

export default function DashboardLayout() {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      
      {/* Sidebar */}
      <div
        style={{
          width: 240,
          background: "#13151a",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h2 style={{ color: "#8e44ff" }}>POS BAR</h2>

        <Link to="/mesas" style={linkStyle}>Mesas</Link>
        <Link to="/cocina" style={linkStyle}>Cocina</Link>
        <Link to="/barra" style={linkStyle}>Barra</Link>
        <Link to="/inventario" style={linkStyle}>Inventario</Link>
    <Link to="/configuracion" style={linkStyle}>Configuración</Link>

        <button
          onClick={() => {
            localStorage.removeItem("token");
            window.location.href = "/login";
          }}
          style={{
            marginTop: "auto",
            padding: 12,
            background: "#22252b",
            border: "none",
            color: "#e74c3c",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </div>

      {/* Contenido dinámico */}
      <div style={{ flex: 1, padding: 20 }}>
        <Outlet />
      </div>
    </div>
  );
}

const linkStyle = {
  color: "white",
  textDecoration: "none",
  padding: "10px 15px",
  borderRadius: 6,
  background: "#1e2026",
};
