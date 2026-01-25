/// src/utils/qzPrint.js
/* global qz, API_URL */

function getBaseUrl() {
  // respeta tu forma actual de usar backend (Dashboard usa API_URL / VITE_API_URL)
  return (import.meta?.env?.VITE_API_URL) || (typeof API_URL !== "undefined" && API_URL ? API_URL : "");
}

// 1) Certificado: QZ lo pide aquí
async function fetchQzCert() {
  const BASE_URL = getBaseUrl();
 const res = await fetch(`${BASE_URL}/api/qz/cert`, { cache: "no-store" });

  if (!res.ok) throw new Error("No pude obtener el certificado de QZ");
  return await res.text(); // PEM
}

// 2) Firma: QZ manda "toSign" y tu backend regresa la firma
async function signQz(toSign) {
  const BASE_URL = getBaseUrl();
  const res = await fetch(`${BASE_URL}/api/qz/sign`, {

    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request: toSign }),

  });
  if (!res.ok) throw new Error("No pude firmar con el backend (QZ)");
  return await res.text(); // firma (string)
}

const API_URL =
  import.meta.env.VITE_API_URL ||
  window.__VITE_API_URL__ ||
  "https://pos-retaurante-bar.onrender.com";

export async function qzInit() {
  if (!window.qz) return false;

  // ✅ ESTO es lo que te falta (cert + signature reales)
 qz.security.setCertificatePromise(() =>
  fetch(`${API_URL}/api/qz/cert`)
    .then(r => r.text())
    .then(t => t.trim())
);

qz.security.setSignaturePromise(toSign =>
  fetch(`${API_URL}/api/qz/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request: toSign }) // o { toSign } (da igual, tu backend soporta ambos)
  })
    .then(r => r.text())
    .then(sig => sig.trim())
);


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
    // si tu impresora ocupa otro, lo cambias después. Por ahora NO tocamos.
  });

  const data = []
    .concat(lines.map((l) => ({ type: "raw", format: "plain", data: String(l) + "\n" })))
    .concat([{ type: "raw", format: "plain", data: "\n\n\n" }]);

  await qz.print(config, data);
  return true;
}

