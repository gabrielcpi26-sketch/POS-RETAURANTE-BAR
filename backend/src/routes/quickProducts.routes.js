// backend/src/routes/quickProducts.routes.js
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

// GET: traer quick menu por tenant (items + config)
router.get("/", async (req, res) => {
  try {
    const tenantId = req.tenantId; // viene de tu middleware en server.js

    // ✅ NO ROMPER UI: si NO hay tenantId, NO tocamos DB y regresamos vacío
    if (!tenantId) {
      console.warn("⚠️ quick-products GET: tenantId missing (skipping DB)");
      return res.json({ items: [], config: {} });
    }

    const rows = await prisma.$queryRaw`
      select items, config
      from public.quick_menu_config
      where tenant_id = ${tenantId}
      limit 1
    `;

    // Si no existe fila, la creamos vacía (items=[] y config={})
    if (!rows || rows.length === 0) {
      await prisma.$executeRaw`
        insert into public.quick_menu_config (tenant_id, items, config)
        values (${tenantId}, '[]'::jsonb, '{}'::jsonb)
        on conflict (tenant_id) do nothing
      `;
      return res.json({ items: [], config: {} });
    }

    const items = Array.isArray(rows?.[0]?.items) ? rows[0].items : [];
    const config = rows?.[0]?.config ?? {};

    return res.json({ items, config });
  } catch (e) {
    console.error("❌ quick-products GET error:", e);
    return res.status(500).json({ error: "quick-products GET failed" });
  }
});

// PUT: guardar (upsert) por tenant (items + config)
router.put("/", async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // ✅ NO ROMPER UI: si NO hay tenantId, NO tocamos DB y regresamos ok
    if (!tenantId) {
      console.warn("⚠️ quick-products PUT: tenantId missing (skipping DB)");
      return res.json({ ok: true, skipped: true });
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const config = req.body?.config ?? null;

    await prisma.$executeRaw`
      insert into public.quick_menu_config (tenant_id, items, config)
      values (
        ${tenantId},
        ${JSON.stringify(items)}::jsonb,
        ${config ? JSON.stringify(config) : null}::jsonb
      )
      on conflict (tenant_id)
      do update set
        items = excluded.items,
        config = coalesce(excluded.config, public.quick_menu_config.config),
        updated_at = now()
    `;

    return res.json({ ok: true });
  } catch (e) {
    console.error("❌ quick-products PUT error:", e);
    return res.status(500).json({ error: "quick-products PUT failed" });
  }
});

module.exports = router;
