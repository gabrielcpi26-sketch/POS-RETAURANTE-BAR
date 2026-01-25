/// src/utils/qzPrint.js
/* global qz */

function normalizeBaseUrl(url) {
  if (!url) return "";
  return String(url).replace(/\/+$/, ""); // quita "/" al final
}

// ✅ UNA sola fuente de verdad para el backend
const QZ_API_BASE = normalizeBaseUrl(
  import.meta.env.VITE_API_URL ||
    window.__VITE_API_URL__ ||
    "https://pos-retaurante-bar.onrender.com"
);

// ====== helpers ======
async function fetchQzCertText() {
  const res = await fetch(`${QZ_API_BASE}/api/qz/cert`, { cache: "no-store" });
  if (!res.ok) throw new Error(`QZ CERT HTTP ${res.status}`);
  return (await res.text()).trim();
}

async function fetchQzSignText(toSign) {
  const res = await fetch(`${QZ_API_BASE}/api/qz/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // ✅ QZ manda un string grande; nosotros lo enviamos tal cual
    body: JSON.stringify({ request: String(toSign) }),
  });

  if (!res.ok) throw new Error(`QZ SIGN HTTP ${res.status}`);
  return (await res.text()).trim();
}

// ====== init ======
let _securityReady = false;

export async function qzInit() {
  if (!window.qz) return false;

  // ✅ setear security UNA SOLA VEZ (evita promesas duplicadas y estados raros)
  if (!_securityReady) {
    qz.security.setCertificatePromise(() => fetchQzCertText());

    qz.security.setSignaturePromise((toSign) => fetchQzSignText(toSign));

    _securityReady = true;
  }

  // conectar websocket si no está
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
    // no tocamos tu encoding
  });

  const data = []
    .concat(lines.map((l) => ({ type: "raw", format: "plain", data: String(l) + "\n" })))
    .concat([{ type: "raw", format: "plain", data: "\n\n\n" }]);

  await qz.print(config, data);
  return true;
}
