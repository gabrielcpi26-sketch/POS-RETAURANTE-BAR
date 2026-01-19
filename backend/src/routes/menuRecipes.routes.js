const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();


// GET /api/menu-recipes  -> lista para selector
router.get("/", async (req, res) => {
  try {
    const tenantId = req.tenantId; // ✅ TENANT

    const recipes = await prisma.menuRecipe.findMany({
      where: { tenantId }, // ✅ TENANT
      select: { id: true, menuName: true, items: true },
      orderBy: { menuName: "asc" },
    });

    // items viene TEXT (JSON). Lo parseamos.
    const parsed = recipes.map((r) => {
      let items = [];
      try { items = r.items ? JSON.parse(r.items) : []; } catch {}
      return { ...r, items };
    });

    res.json(parsed);
  } catch (err) {
    console.error("❌ Error listando recetas:", err);
    res.status(500).json({ error: "Error listando recetas" });
  }
});


// POST /api/menu-recipes
router.post("/", async (req, res) => {
  try {
    const tenantId = req.tenantId; // ✅ TENANT

    const { menuName, items } = req.body || {};
    if (!menuName) return res.status(400).json({ error: "menuName requerido" });

    const created = await prisma.menuRecipe.create({
      data: {
        tenantId, // ✅ TENANT
        menuName: String(menuName).trim(),
        items: JSON.stringify(Array.isArray(items) ? items : []),
      },
    });

    res.json(created);
  } catch (err) {
    console.error("❌ Error creando receta:", err);
    res.status(500).json({ error: "Error creando receta" });
  }
});


// PUT /api/menu-recipes/:id
router.put("/:id", async (req, res) => {
  try {
    const tenantId = req.tenantId; // ✅ TENANT

    const id = Number(req.params.id);
    const { menuName, items } = req.body || {};
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

    const updated = await prisma.menuRecipe.updateMany({
      where: { id, tenantId }, // ✅ TENANT
      data: {
        ...(menuName ? { menuName: String(menuName).trim() } : {}),
        ...(items ? { items: JSON.stringify(items) } : {}),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("❌ Error actualizando receta:", err);
    res.status(500).json({ error: "Error actualizando receta" });
  }
});


// DELETE /api/menu-recipes/:id
router.delete("/:id", async (req, res) => {
  try {
    const tenantId = req.tenantId; // ✅ TENANT

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

    await prisma.menuRecipe.deleteMany({
      where: { id, tenantId }, // ✅ TENANT
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error borrando receta:", err);
    res.status(500).json({ error: "Error borrando receta" });
  }
});


module.exports = router;
