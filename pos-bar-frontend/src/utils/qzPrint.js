/// src/utils/qzPrint.js
/* global qz */

function getBaseUrl() {
  // Respeta tu forma actual: VITE_API_URL / window.__VITE_API_URL__ / global API_URL si existiera
  // + fallback a tu Render
  return (
    (import.meta?.env?.VITE_API_URL) ||
    (typeof window !== "undefined" && window.__VITE_API_URL__) ||
    (typeof API_URL !== "undefined" && API_URL ? API_URL : "") ||
    "https://pos-retaurante-bar.onrender.com"
  );
}

const API_URL = getBaseUrl();

// 1) Certificado: QZ lo pide aquí
async function fetchQzCert() {
  const res = await fetch(`${API_URL}/api/qz/cert`, { cache: "no-store" });
  if (!res.ok) throw new Error("No pude obtener el certificado de QZ");
  const pem = await res.text();
  return (pem || "").trim(); // PEM
}

// 2) Firma: QZ manda "toSign" y tu backend regresa la firma
async function signQz(toSign) {
  const res = await fetch(`${API_URL}/api/qz/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request: toSign }),
  });
  if (!res.ok) throw new Error("No pude firmar con el backend (QZ)");
  const sig = await res.text();
  return (sig || "").trim(); // firma (string)
}

// Evita reconfigurar security en cada llamada
let __qzSecurityConfigured = false;

export async function qzInit() {
  if (!window.qz) return false;

  // ✅ IMPORTANTE: QZ quiere FUNCIONES que regresen Promises (NO Promises directas)
  if (!__qzSecurityConfigured) {
    qz.security.setCertificatePromise(() => fetchQzCert());
    qz.security.setSignaturePromise((toSign) => signQz(toSign));
    __qzSecurityConfigured = true;
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
    // NO tocamos más.
  });

  const data = []
    .concat(
      (lines || []).map((l) => ({
        type: "raw",
        format: "plain",
        data: String(l) + "\n",
      }))
    )
    .concat([{ type: "raw", format: "plain", data: "\n\n\n" }]);

  await qz.print(config, data);
  return true;
}
