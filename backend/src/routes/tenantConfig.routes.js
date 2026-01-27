const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

router.get("/", async (req, res) => {
  try {
    const tenantKey = (req.tenantKey || req.headers["x-tenant"] || req.headers["x-tenant-key"] || "default")
      .toString()
      .trim()
      .toLowerCase();

    // ✅ FIX MINIMO: NO usar queryRaw con columnas que pueden no existir (ej. "direccion")
    const cfg = await prisma.tenant_config.findFirst({
      where: { business_name: tenantKey },
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

      // ✅ estos quedan “seguros”: si no existen en DB/Prisma, regresan null
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

