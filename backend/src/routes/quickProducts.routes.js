// backend/src/routes/quickProducts.routes.js
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

// GET: traer config por tenant (items jsonb)
router.get("/", async (req, res) => {
  try {
    const tenantId = req.tenantId; // viene de tu middleware en server.js

const rows = await prisma.$queryRaw`
  select config
  from public.quick_menu_config
  where tenant_id = ${tenantId}
  limit 1
`;

const items = rows?.[0]?.config?.items || [];

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
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    // upsert (requiere UNIQUE en tenant_id, ver SQL abajo)
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
