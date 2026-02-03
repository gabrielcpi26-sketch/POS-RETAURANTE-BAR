// backend/src/routes/quickProducts.routes.js
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

// GET: traer config por tenant (items jsonb)
router.get("/", async (req, res) => {
  try {
    const tenantId = req.tenantId; // viene de tu middleware en server.js

    // ✅ NO ROMPER UI: si NO hay tenantId, NO tocamos DB y regresamos vacío
    if (!tenantId) {
      console.warn("⚠️ quick-products GET: tenantId missing (skipping DB)");
      return res.json({ items: [] });
    }

    const rows = await prisma.$queryRaw`
      select items
      from public.quick_menu_config
      where tenant_id = ${tenantId}
      limit 1
    `;

    if (!rows || rows.length === 0) {
      await prisma.$executeRaw`
        insert into public.quick_menu_config (tenant_id, items)
        values (${tenantId}, '[]'::jsonb)
        on conflict (tenant_id) do nothing
      `;
      return res.json({ items: [] });
    }

    const items = Array.isArray(rows?.[0]?.items) ? rows[0].items : [];
    return res.json({ items });
  } catch (e) {
    console.error("❌ quick-products GET error:", e);
    return res.status(500).json({ error: "quick-products GET failed" });
  }
});

// PUT: guardar (upsert) por tenant
router.put("/", async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // ✅ NO ROMPER UI: si NO hay tenantId, NO tocamos DB y regresamos ok
    if (!tenantId) {
      console.warn("⚠️ quick-products PUT: tenantId missing (skipping DB)");
      return res.json({ ok: true, skipped: true });
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    await prisma.$executeRaw`
      insert into public.quick_menu_config (tenant_id, items)
      values (${tenantId}, ${JSON.stringify(items)}::jsonb)
      on conflict (tenant_id)
      do update set
        items = excluded.items,
        updated_at = now()
    `;

    return res.json({ ok: true });
  } catch (e) {
    console.error("❌ quick-products PUT error:", e);
    return res.status(500).json({ error: "quick-products PUT failed" });
  }
});

module.exports = router;

