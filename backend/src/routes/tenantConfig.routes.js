const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

router.get("/", async (req, res) => {
  try {
    const tenantKeyRaw =
      req.tenantKey ||
      req.headers["x-tenant"] ||
      req.headers["x-tenant-key"] ||
      req.headers["X-Tenant-Key"] || // (por si acaso)
      "default";

    const tenantKey = String(tenantKeyRaw).trim();

    // ✅ FIX MÍNIMO: si viene número ("5") busca por tenant_id; si viene texto ("elgallo") por business_name
    const whereCfg = /^\d+$/.test(tenantKey)
      ? { tenant_id: Number(tenantKey) }
      : { business_name: tenantKey.toLowerCase() };

    const cfg = await prisma.tenant_config.findFirst({
      where: whereCfg,
    });

    if (!cfg) {
      return res.json({
        adminPin: null,
        meseroPin: null,
        businessName: null,
        direccion: null,
        telefono: null,
        rfc: null,
        razonSocial: null,
      });
    }

    return res.json({
      adminPin: cfg.admin_pin ?? null,
      meseroPin: cfg.mesero_pin ?? null,
      businessName: cfg.business_name ?? null,

      direccion: cfg.direccion ?? null,
      telefono: cfg.telefono ?? null,
      rfc: cfg.rfc ?? null,
      razonSocial: cfg.razon_social ?? cfg.razonSocial ?? null,
    });
  } catch (e) {
    console.error("tenant-config error:", e);
    return res.json({
      adminPin: null,
      meseroPin: null,
      businessName: null,
      direccion: null,
      telefono: null,
      rfc: null,
      razonSocial: null,
    });
  }
});

module.exports = router;
