/// src/utils/qzPrint.js
/* global qz */

/**
 * IMPORTANTE:
 * - QZ Tray NO tiene acceso a import.meta.env
 * - API_URL DEBE ser un string REAL y GLOBAL
 * - NO usar helpers dentro de qz.security
 */

// ✅ URL ABSOLUTA (PROD)
const API_URL = "https://pos-retaurante-bar.onrender.com";

// ================================
// INIT QZ
// ================================
export async function qzInit() {
  if (!window.qz) return false;

  // ===== CERTIFICADO =====
  qz.security.setCertificatePromise(function () {
    return fetch(`${API_URL}/api/qz/cert`, { cache: "no-store" })
      .then(res => {
        if (!res.ok) throw new Error("QZ cert fetch failed");
        return res.text();
      })
      .then(cert => cert.trim());
  });

  // ===== FIRMA =====
  qz.security.setSignaturePromise(function (toSign) {
    return fetch(`${API_URL}/api/qz/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request: toSign })
    })
      .then(res => {
        if (!res.ok) throw new Error("QZ sign failed");
        return res.text();
      })
      .then(signature => signature.trim());
  });

  // ===== WEBSOCKET =====
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect();
  }

  return true;
}

// ================================
// LISTAR IMPRESORAS
// ================================
export async function qzListPrinters() {
  if (!window.qz) return [];
  await qzInit();
  return await qz.printers.find();
}

// ================================
// IMPRIMIR TICKET (ESC/POS)
// ================================
export async function qzPrintEscpos(printerName, lines) {
  if (!window.qz) return false;

  await qzInit();

  const config = qz.configs.create(printerName, {
    encoding: "CP437"
  });

  const data = []
    .concat(
      lines.map(line => ({
        type: "raw",
        format: "plain",
        data: String(line) + "\n"
      }))
    )
    .concat([{ type: "raw", format: "plain", data: "\n\n\n" }]);

  await qz.print(config, data);
  return true;
}
