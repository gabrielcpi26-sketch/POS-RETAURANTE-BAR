/// src/utils/qzPrint.js
/* global qz */

const API_URL =
  import.meta.env.VITE_API_URL ||
  window.__VITE_API_URL__ ||
  "https://pos-retaurante-bar.onrender.com";

// -------------------------
// Helpers (NO cambia lógica)
// -------------------------
async function httpText(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} en ${url} :: ${txt}`);
  }
  return (await res.text()).trim();
}

// -------------------------
// QZ Init
// -------------------------
export async function qzInit() {
  if (!window.qz) return false;

  // MUY IMPORTANTE:
  // setCertificatePromise y setSignaturePromise deben recibir una FUNCIÓN
  // que REGRESE un Promise (no un Promise directo, no llaves sin return)
  qz.security.setCertificatePromise(() => {
    return httpText(`${API_URL}/api/qz/cert`, { cache: "no-store" });
  });

  qz.security.setSignaturePromise((toSign) => {
    return httpText(`${API_URL}/api/qz/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ request: toSign }),
    });
  });

  // Conectar websocket si no está
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect();
  }

  return true;
}

export async function qzListPrinters() {
  if (!window.qz) return [];
  await qzInit();
  return await qz.printers.find();
}

export async function qzPrintEscpos(printerName, lines) {
  if (!window.qz) return false;

  await qzInit();

  const config = qz.configs.create(printerName, {
    encoding: "CP437",
  });

  const data = []
    .concat(lines.map((l) => ({ type: "raw", format: "plain", data: String(l) + "\n" })))
    .concat([{ type: "raw", format: "plain", data: "\n\n\n" }]);

  await qz.print(config, data);
  return true;
}
