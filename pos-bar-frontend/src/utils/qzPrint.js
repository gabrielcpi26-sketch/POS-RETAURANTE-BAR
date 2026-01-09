// src/utils/qzPrint.js
import qz from "qz-tray";

// ✅ 1) Conectar a QZ Tray (debe estar corriendo en la PC)
export async function qzConnect() {
  if (qz.websocket.isActive()) return;

  // Modo DEV rápido: aceptar certificado demo (para pruebas).
  // Para producción "silencioso", luego metemos firma/cert (QZ signing).
  qz.security.setCertificatePromise((resolve) => resolve("")); // dev only
  qz.security.setSignaturePromise((toSign) => (resolve) => resolve("")); // dev only

  await qz.websocket.connect();
}

// ✅ 2) Listar impresoras instaladas
export async function qzListPrinters() {
  await qzConnect();
  return await qz.printers.find();
}

// ✅ 3) Imprimir ticket ESC/POS raw
export async function qzPrintEscpos(printerName, lines = []) {
  await qzConnect();

  const config = qz.configs.create(printerName);

  // ESC/POS básico (inicializa + texto + corte)
  // Nota: Cada impresora puede variar, pero esto es el “baseline” típico.
  const ESC = "\x1B";
  const GS = "\x1D";
  const init = ESC + "@";
  const cut = GS + "V" + "\x00";

  const text = [init, ...lines, "\n\n", cut].join("\n");

  const data = [{ type: "raw", format: "plain", data: text }];

  await qz.print(config, data);
}
