import express from "express";
import prisma from "../../db.js";

const router = express.Router();

function getTenantKey(req) {
  return (req.headers["x-tenant-key"] || "default").toString();
}

// GET: lista del menú rápido del tenant
router.get("/", async (req, res) => {
  try {
    const tenantKey = getTenantKey(req);

    const tenant = await prisma.tenant.findUnique({
      where: { key: tenantKey },
      select: { id: true },
    });
    if (!tenant) return res.status(404).json({ error: "Tenant no existe" });

    const rows = await prisma.quickProduct.findMany({
      where: { tenantId: tenant.id },
      orderBy: { sort: "asc" },
    });

    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error loading quick products" });
  }
});

// PUT: reemplaza toda la lista (simple y robusto para demo)
router.put("/", async (req, res) => {
  try {
    const tenantKey = getTenantKey(req);
    const items = Array.isArray(req.body) ? req.body : [];

    const tenant = await prisma.tenant.findUnique({
      where: { key: tenantKey },
      select: { id: true },
    });
    if (!tenant) return res.status(404).json({ error: "Tenant no existe" });

    // Transacción: borra y vuelve a insertar (minimalista, sin lógica rara)
    await prisma.$transaction(async (tx) => {
      await tx.quickProduct.deleteMany({ where: { tenantId: tenant.id } });

      if (items.length) {
        await tx.quickProduct.createMany({
          data: items.map((p, i) => ({
            tenantId: tenant.id,
            name: String(p.name || ""),
            price: Number(p.price || 0),
            category: p.category ? String(p.category) : null,
            sort: Number.isFinite(p.sort) ? p.sort : i,
          })),
        });
      }
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error saving quick products" });
  }
});

export default router;
