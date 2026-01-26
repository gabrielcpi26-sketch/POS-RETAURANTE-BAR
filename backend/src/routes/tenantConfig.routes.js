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

    const rows = await prisma.$queryRaw`
      select business_name, admin_pin, mesero_pin, direccion, telefono, rfc, razon_social
      from public.tenant_config
      where business_name = ${tenantKey}
      limit 1
    `;

    const row = rows && rows[0] ? rows[0] : null;

    if (!row) {
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
      adminPin: row.admin_pin ?? null,
      meseroPin: row.mesero_pin ?? null,
      businessName: row.business_name ?? null,
      direccion: row.direccion ?? null,
      telefono: row.telefono ?? null,
      rfc: row.rfc ?? null,
      razonSocial: row.razon_social ?? null,
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
