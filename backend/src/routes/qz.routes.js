// backend/src/routes/qz.routes.js
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// ✅ Lee la private key desde ENV (RECOMENDADO)
// (No la subas a git)
function getPrivateKeyPem() {
  const fromEnv = process.env.QZ_PRIVATE_KEY_PEM;
  if (fromEnv && fromEnv.trim()) {
    // Permite guardar en env con \n
    return fromEnv.replace(/\\n/g, "\n");
  }

  // Fallback local (solo para DEV local): backend/qz-keys/qz-private.pem
  const fallbackPath = path.join(__dirname, "../../qz-keys/qz-private.pem");
  if (fs.existsSync(fallbackPath)) {
    return fs.readFileSync(fallbackPath, "utf8");
  }

  throw new Error("No se encontró QZ_PRIVATE_KEY_PEM ni qz-private.pem local.");
}

// ✅ Devuelve el CERT público (sí se puede exponer)
router.get("/cert", (req, res) => {
  try {
    const certEnv = process.env.QZ_CERT_PEM;
    if (certEnv && certEnv.trim()) {
      return res.type("text/plain").send(certEnv.replace(/\\n/g, "\n"));
    }

    // Fallback local (solo DEV): backend/qz-keys/qz-cert.pem
    const certPath = path.join(__dirname, "../../qz-keys/qz-cert.pem");
    if (fs.existsSync(certPath)) {
      return res.type("text/plain").send(fs.readFileSync(certPath, "utf8"));
    }

    return res.status(500).send("Falta QZ_CERT_PEM y no existe qz-cert.pem local.");
  } catch (e) {
    return res.status(500).send(String(e.message || e));
  }
});

// ✅ Firma lo que QZ pide
router.post("/sign", (req, res) => {
  try {
    const request = req.body?.request;
    if (!request) return res.status(400).send("Falta body.request");

    const privateKeyPem = getPrivateKeyPem();

    const sign = crypto.createSign("RSA-SHA256");
    sign.update(request, "utf8");
    sign.end();

    const signatureB64 = sign.sign(privateKeyPem, "base64");
    return res.type("text/plain").send(signatureB64);
  } catch (e) {
    return res.status(500).send(String(e.message || e));
  }
});

module.exports = router;
