// backend/src/routes/onboarding.routes.js
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();
const bcrypt = require("bcryptjs");


// ======================
// ONBOARDING - CREAR TENANT (simple y vendible)
// ======================
// POST /api/onboarding/tenant
// body: { tenantKey, tenantName? }
router.post("/tenant", async (req, res) => {
  try {
    const tenantKeyRaw = (req.body?.tenantKey || "").toString().trim().toLowerCase();
    const tenantNameRaw = (req.body?.tenantName || tenantKeyRaw).toString().trim();

    // Validación mínima (segura)
    if (!tenantKeyRaw) {
      return res.status(400).json({ ok: false, error: "tenantKey es requerido" });
    }

    // Solo letras/números/guion (para subdominios futuros)
    if (!/^[a-z0-9-]{3,40}$/.test(tenantKeyRaw)) {
      return res.status(400).json({
        ok: false,
        error: "tenantKey inválido. Usa 3-40 chars: a-z, 0-9, guion (-).",
      });
    }

    // Crea o reutiliza
    const t = await prisma.tenant.upsert({
      where: { key: tenantKeyRaw },
      update: {
        name: tenantNameRaw || tenantKeyRaw,
      },
      create: {
        key: tenantKeyRaw,
        name: tenantNameRaw || tenantKeyRaw,
      },
      select: { id: true, key: true, name: true },
    });

    // Nota: id puede venir como BigInt según tu Prisma
    const tenantId =
      typeof t.id === "bigint" ? t.id.toString() : Number(t.id);

    return res.json({
      ok: true,
      tenant: { id: tenantId, key: t.key, name: t.name },
      next: {
        // En el micro-paso siguiente usaremos tu /api/auth para crear admin con este header
        header: { "X-Tenant-Key": t.key },
        hint: "Ahora crea el usuario admin usando /api/auth (register) con X-Tenant-Key = tenantKey",
      },
    });
  } catch (e) {
    console.error("❌ Onboarding tenant error:", e);
    return res.status(500).json({ ok: false, error: "Error creando tenant" });
  }
});

// ======================
// ONBOARDING - CREAR ADMIN
// ======================
// POST /api/onboarding/admin
// body: { email, password, name? }
// header: X-Tenant-Key
router.post("/admin", async (req, res) => {
  try {
    const tenantKey = (req.headers["x-tenant-key"] || "").toString().trim();
    if (!tenantKey) {
      return res.status(400).json({ ok: false, error: "X-Tenant-Key requerido" });
    }

    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email y password requeridos" });
    }

    // Reutiliza tu flujo existente de auth (NO cambia lógica)
    // Simulamos una llamada interna a /api/auth/register
    // Nota: ajusta el import si tu register vive en otro módulo
  const passwordHash = await bcrypt.hash(password, 10);

const result = await prisma.user.create({
  data: {
    email,
    passwordHash,
    name: name || "Admin",
    role: "ADMIN",
    tenantId: req.tenantId,
  },
  select: { id: true, email: true, role: true },
});


    return res.json({
      ok: true,
      admin: result,
      next: "Admin creado. Ya puede iniciar sesión.",
    });
  } catch (e) {
    console.error("❌ Onboarding admin error:", e);
    return res.status(500).json({ ok: false, error: "Error creando admin" });
  }
});


module.exports = router;
