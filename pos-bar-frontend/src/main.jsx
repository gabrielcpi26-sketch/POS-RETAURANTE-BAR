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
 * IMPORTANTE:
 * - Service Worker puede cachear un build viejo y seguir sirviendo URLs como http://localhost:4000
 * - Por ahora lo desactivamos para evitar que Vercel se “quede pegado” con archivos antiguos.
 * - Si después quieres PWA, lo reactivamos bien con versión y estrategia correcta.
 */

// if ("serviceWorker" in navigator) {
//   window.addEventListener("load", () => {
//     navigator.serviceWorker
//       .register("/sw.js")
//       .catch((err) => console.error("SW error:", err));
//   });
// }
