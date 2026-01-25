/// src/utils/qzPrint.js
/* global qz */

function getBaseUrl() {
  // 1) Vite env (frontend)
  const viteUrl = import.meta?.env?.VITE_API_URL;

  // 2) fallback si lo inyectas en index.html como window.__VITE_API_URL__
  const winUrl =
    typeof window !== "undefined" && window.__VITE_API_URL__
      ? window.__VITE_API_URL__
      : "";

  // 3) fallback final (tu backend prod)
  return (viteUrl || winUrl || "https://pos-retaurante-bar.onrender.com").replace(/\/$/, "");
}

// 1) Certificado (PEM)
async function fetchQzCert() {
  const BASE_URL = getBaseUrl();
  const res = await fetch(`${BASE_URL}/api/qz/cert`, { cache: "no-store" });
  if (!res.ok) throw new Error("No pude obtener el certificado de QZ");
  return (await res.text()).trim();
}

// 2) Firma (backend firma el string que QZ pide)
async function signQz(toSign) {
  const BASE_URL = getBaseUrl();
  const res = await fetch(`${BASE_URL}/api/qz/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request: toSign }),
  });
  if (!res.ok) throw new Error("No pude firmar con el backend (QZ)");
  return (await res.text()).trim();
}

export async function qzInit() {
  if (!window.qz) return false;

  // OJO: QZ exige FUNCIONES que regresen Promise (no Promises directos)
  qz.security.setCertificatePromise(function () {
    return fetchQzCert();
  });

  qz.security.setSignaturePromise(function (toSign) {
    return signQz(toSign);
  });

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
