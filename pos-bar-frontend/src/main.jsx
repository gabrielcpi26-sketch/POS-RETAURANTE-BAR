import React from "react";
import ReactDOM from "react-dom/client";
import AppRouter from "./router/AppRouter";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);

/**
 * 🔴 IMPORTANTE
 * Se DESACTIVA el Service Worker para evitar:
 * - Cache viejo
 * - Requests hardcodeados a localhost:4000
 * - Fetch inyectados desde bundles antiguos
 *
 * (Esto NO afecta tu lógica de negocio)
 */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
}
