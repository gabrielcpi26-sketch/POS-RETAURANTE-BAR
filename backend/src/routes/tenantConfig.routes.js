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

const cfgRows = /^\d+$/.test(String(tenantKey))
  ? await prisma.$queryRaw`
      select admin_pin, mesero_pin, business_name, display_name, direccion, telefono, rfc, razon_social
      from tenant_config
      where tenant_id = ${Number(tenantKey)}
      limit 1
    `
  : await prisma.$queryRaw`
      select admin_pin, mesero_pin, business_name, display_name, direccion, telefono, rfc, razon_social
      from tenant_config
      where lower(business_name) = ${String(tenantKey).toLowerCase()}
      limit 1
    `;



const cfg = Array.isArray(cfgRows) && cfgRows.length ? cfgRows[0] : null;


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
  businessName: cfg.display_name ?? cfg.business_name ?? null,

  direccion: cfg.direccion ?? null,
  telefono: cfg.telefono ?? null,
  rfc: cfg.rfc ?? null,
  razonSocial: cfg.razon_social ?? null,
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
