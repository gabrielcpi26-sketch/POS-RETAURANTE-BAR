/// src/utils/qzPrint.js
/* global qz */

function getBaseUrl() {
  // 1) Vite (PROD/DEV)
  const vite = (import.meta && import.meta.env && import.meta.env.VITE_API_URL) ? import.meta.env.VITE_API_URL : "";

  // 2) fallback opcional si tú lo usas
  const win = (typeof window !== "undefined" && window.__VITE_API_URL__) ? window.__VITE_API_URL__ : "";

  // 3) último fallback (tu render)
  const hard = "https://pos-retaurante-bar.onrender.com";

  return (vite || win || hard).replace(/\/$/, "");
}

// 1) Certificado (PEM)
async function fetchQzCert() {
  const BASE = getBaseUrl();
  const res = await fetch(`${BASE}/api/qz/cert`, { cache: "no-store" });
  if (!res.ok) throw new Error("No pude obtener el certificado de QZ");
  const txt = await res.text();
  return (txt || "").trim();
}

// 2) Firma (string base64)
async function signQz(toSign) {
  const BASE = getBaseUrl();
  const res = await fetch(`${BASE}/api/qz/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request: toSign }),
  });
  if (!res.ok) throw new Error("No pude firmar con el backend (QZ)");
  const txt = await res.text();

  // 🔥 CLAVE: QZ no tolera saltos de línea/espacios raros en la firma
  return (txt || "").replace(/\r?\n/g, "").trim();
}

let __securityReady = false;

export async function qzInit() {
  if (!window.qz) return false;

  // ✅ CLAVE: setear promises UNA SOLA VEZ (evita estados raros y “Promise resolver …”)
  if (!__securityReady) {
    qz.security.setCertificatePromise(() => fetchQzCert());
    qz.security.setSignaturePromise((toSign) => signQz(toSign));
    __securityReady = true;
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
    // NO tocamos esto ahorita.
  });

  const data = []
    .concat(lines.map((l) => ({ type: "raw", format: "plain", data: String(l) + "\n" })))
    .concat([{ type: "raw", format: "plain", data: "\n\n\n" }]);

  await qz.print(config, data);
  return true;
}
