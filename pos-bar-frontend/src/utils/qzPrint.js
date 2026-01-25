/// src/utils/qzPrint.js
/* global qz, API_URL */

function getBaseUrl() {
  // respeta tu forma actual de usar backend (Dashboard usa API_URL / VITE_API_URL)
  return (
    import.meta?.env?.VITE_API_URL ||
    (typeof API_URL !== "undefined" && API_URL ? API_URL : "") ||
    window.__VITE_API_URL__ ||
    "https://pos-retaurante-bar.onrender.com"
  );
}

// 1) Certificado: QZ lo pide aquí
async function fetchQzCert() {
  const BASE_URL = getBaseUrl();
  const res = await fetch(`${BASE_URL}/api/qz/cert`, { cache: "no-store" });
  if (!res.ok) throw new Error("No pude obtener el certificado de QZ");
  return (await res.text()).trim(); // PEM
}

// 2) Firma: QZ manda "toSign" y tu backend regresa la firma
async function signQz(toSign) {
  const BASE_URL = getBaseUrl();
  const res = await fetch(`${BASE_URL}/api/qz/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // tu backend soporta { request } (y si soporta { toSign } da igual, dejamos {request})
    body: JSON.stringify({ request: toSign }),
  });
  if (!res.ok) throw new Error("No pude firmar con el backend (QZ)");
  return (await res.text()).trim(); // firma (string base64)
}

export async function qzInit() {
  if (!window.qz) return false;

  // ✅ IMPORTANTE: QZ (según tu error) espera RESOLVER FUNCTIONS, no Promises directas.
  // Esto evita: "Promise resolver <#Promise> is not a function"
  if (!qzInit.__securityReady) {
    // CertificatePromise: resolver (resolve, reject)
    qz.security.setCertificatePromise((resolve, reject) => {
      fetchQzCert()
        .then(resolve)
        .catch(reject);
    });

    // SignaturePromise: recibe toSign y regresa resolver (resolve, reject)
    qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
      signQz(toSign)
        .then(resolve)
        .catch(reject);
    });

    qzInit.__securityReady = true;
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
    // si tu impresora ocupa otro, lo cambias después. Por ahora NO tocamos.
  });

  const data = []
    .concat(lines.map((l) => ({ type: "raw", format: "plain", data: String(l) + "\n" })))
    .concat([{ type: "raw", format: "plain", data: "\n\n\n" }]);

  await qz.print(config, data);
  return true;
}
