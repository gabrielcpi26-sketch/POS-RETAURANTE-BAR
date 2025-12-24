import React from "react";
import ReactDOM from "react-dom/client";
import AppRouter from "./router/AppRouter";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);

/*
────────────────────────────────────────────
⚠️ SERVICE WORKER DESACTIVADO (INTENCIONAL)
────────────────────────────────────────────
Motivo:
- El Service Worker estaba cacheando bundles antiguos
- Esos bundles contenían fetch a http://localhost:4000
- En Vercel eso provoca CORS + ERR_CONNECTION_REFUSED
- Aunque el código ya esté corregido, el SW sigue sirviendo JS viejo

Conclusión:
- Para POS (apps internas) NO es obligatorio usar SW
- Se desactiva para evitar cache fantasma en producción
- Esto elimina definitivamente llamadas a localhost en Vercel

Si en el futuro quieres PWA:
- Se reactiva SOLO cuando el backend esté 100% estable
*/

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
}
