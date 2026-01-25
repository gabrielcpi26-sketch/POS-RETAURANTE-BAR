/// src/utils/qzPrint.js
/* global qz */

const API_URL =
  import.meta.env.VITE_API_URL ||
  window.__VITE_API_URL__ ||
  "https://pos-retaurante-bar.onrender.com";

// Evita re-setear promises y que QZ se rompa por duplicados
let __qzPromisesReady = false;

// 1) Certificado: QZ lo pide aquí
async function fetchQzCert() {
  const res = await fetch(`${API_URL}/api/qz/cert`, { cache: "no-store" });
  if (!res.ok) throw new Error("No pude obtener el certificado de QZ");
  return await res.text(); // PEM
}

// 2) Firma: QZ manda "toSign" y tu backend regresa la firma
async function signQz(toSign) {
  const res = await fetch(`${API_URL}/api/qz/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request: toSign }),
  });

  if (!res.ok) throw new Error("No pude firmar con el backend (QZ)");
  return await res.text(); // firma (string)
}

export async function qzInit() {
  if (!window.qz) return false;

  // ✅ Promises correctas: se pasan FUNCIONES, no Promises
  if (!__qzPromisesReady) {
    qz.security.setCertificatePromise(() => {
      return fetchQzCert().then((t) => String(t || "").trim());
    });

    qz.security.setSignaturePromise((toSign) => {
      return signQz(toSign).then((sig) => String(sig || "").trim());
    });

    __qzPromisesReady = true;
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
    // NO tocamos nada más por ahora
  });

  const data = []
    .concat(lines.map((l) => ({ type: "raw", format: "plain", data: String(l) + "\n" })))
    .concat([{ type: "raw", format: "plain", data: "\n\n\n" }]);

  await qz.print(config, data);
  return true;
}
