require("dotenv").config({ path: ".env.dev" });

// backend/src/server.js
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const prisma = require("./prisma");
const qzRoutes = require("./routes/qz.routes");



console.log(
  "DB URL host:",
  (process.env.DATABASE_URL || "").split("@")[1]?.split("/")[0]
);

// Rutas
const authRoutes = require("./routes/auth.routes");
const areasRoutes = require("./routes/areas.routes");
const tablesRoutes = require("./routes/tables.routes");
const ordersRoutes = require("./routes/orders.routes");
const reportsRoutes = require("./routes/reports.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const menuRecipesRoutes = require("./routes/menuRecipes.routes");
const quickProductsRoutes = require("./routes/quickProducts.routes");
const onboardingRoutes = require("./routes/onboarding.routes");
const tenantConfigRoutes = require("./routes/tenantConfig.routes");


const app = express();

// ===============================
// TENANT KEY automático por dominio
// ===============================
app.use((req, res, next) => {
  try {
    // 1) Prioridad: header explícito (frontend)
    const fromHeader =
      req.headers["x-tenant"] ||
      req.headers["x-tenant-key"] ||
      req.headers["tenant"];

    if (fromHeader) {
      req.tenantKey = String(fromHeader).trim().toLowerCase();
      return next();
    }

    // 2) Si viene detrás de proxy (render/vercel)
    const rawHost =
      req.headers["x-forwarded-host"] ||
      req.headers["host"] ||
      "";

    const host = String(rawHost).split(",")[0].trim().toLowerCase();
    const hostname = host.split(":")[0]; // quita puerto

    // localhost => default
    if (!hostname || hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
      req.tenantKey = "default";
      return next();
    }

    // subdominio.gadiapps.com => subdominio
    const parts = hostname.split(".");
    req.tenantKey = parts[0] || "default";

    return next();
  } catch (e) {
    req.tenantKey = "default";
    return next();
  }
});


app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const allow =
  origin === "http://localhost:5173" ||
  origin.endsWith(".localhost:5173") ||
  origin === "https://pos-restaurante-bar.vercel.app" ||
  origin.endsWith(".vercel.app") ||
  origin === "https://pos-restaurante-bar.onrender.com" ||
  origin === "https://elgallo.gadiapps.com" ||   // ✅
  origin.endsWith(".gadiapps.com");               // ✅

      return allow
        ? callback(null, true)
        : callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-tenant", // ✅ ÚNICO header multi-tenant
      "x-tenant-key", // 👈 AGREGA ESTA
 "x-device"        // ✅ AGREGAR ESTA (URGENTE)
    ],
  })
);

app.use(express.json());

// ======================
// TENANT (multi-negocio) - detección por subdominio o header
// ======================
app.use((req, _res, next) => {
  // ✅ SI YA VIENE SETEADO ARRIBA, NO LO PISES
  if (req.tenantKey) return next();

  const fromHeader = (req.headers["x-tenant-key"] || req.headers["x-tenant"] || "")
    .toString()
    .trim();

  const host = (req.headers.host || "").toString().split(":")[0];
  const parts = host.split(".");
  const subdomain = parts.length >= 2 && parts[parts.length - 1] === "localhost" ? parts[0] : (parts.length >= 3 ? parts[0] : "");

  req.tenantKey = fromHeader || subdomain || "default";
  next();
});

// ==============================
// ✅ RESOLVER tenantId desde tenantKey (SIN prisma.tenant.*)
// ==============================
app.use(async (req, _res, next) => {
  try {
    const keyRaw = (req.tenantKey || "default").toString().trim() || "default";

    // 1) Si el tenantKey ya viene numérico (ej "5"), úsalo directo
    const asNum = Number(keyRaw);
    if (Number.isFinite(asNum) && asNum > 0) {
      req.tenantId = asNum;
    } else {
      // 2) Fallback: intentar resolver por tenant_config (si existe)
      req.tenantId = null;
      try {
        // OJO: dejo EXACTO tu prisma.tenant_config, no toco tu estructura
        const cfg = await prisma.tenant_config.findFirst({
          where: { business_name: keyRaw },
          select: { tenant_id: true },
        });
        if (cfg?.tenant_id != null) req.tenantId = Number(cfg.tenant_id);
      } catch (e) {
        req.tenantId = null;
      }
    }

    // 3) ✅ PLAN por tenant (mantiene tu lógica de planes)
    req.tenantPlan = "FREE";
    if (req.tenantId) {
      try {
        const rows = await prisma.$queryRaw`
          select plan from public.tenant_plan
          where tenant_id = ${req.tenantId}
          limit 1
        `;
        req.tenantPlan = ((rows && rows[0] && rows[0].plan) ? rows[0].plan : "FREE").toString();
      } catch {
        req.tenantPlan = "FREE";
      }
    }

    return next();
  } catch (e) {
    console.error("❌ TENANT resolve error:", e);
    return next();
  }
});



// Health checks
app.get("/", (_req, res) => res.send("OK - POS backend running"));
app.get("/api", (_req, res) => res.json({ ok: true }));
app.get("/__ping", (_req, res) => res.json({ ok: true }));
app.get("/api/tenant/plan", (req, res) => {
  res.json({ ok: true, tenantKey: req.tenantKey, plan: req.tenantPlan || "FREE" });
});

app.get("/api/tenant/config", async (req, res) => {
  try {
    const tenantKey = (req.headers["x-tenant-key"] || req.headers["x-tenant"] || req.tenantKey || "")
      .toString()
      .trim()
      .toLowerCase();

    if (!tenantKey) return res.status(400).json({ error: "Missing tenant key" });

  const cfg = await prisma.tenant_config.findFirst({
  where: { business_name: tenantKey },
});

    if (!cfg) {
      return res.status(404).json({ error: "TENANT_NOT_FOUND", tenantKey });
    }

    return res.json({
      businessName: cfg.business_name,
      adminPin: cfg.admin_pin || "1234",
      meseroPin: cfg.mesero_pin || "0000",
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});


// Routers
app.use("/api/auth", authRoutes);
app.use("/api/areas", areasRoutes);
app.use("/api/tables", tablesRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/menu-recipes", menuRecipesRoutes);
app.use("/api/quick-products", quickProductsRoutes.default || quickProductsRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/tenant-config", tenantConfigRoutes);
app.use("/qz", qzRoutes);
app.use("/api/qz", require("./routes/qz.routes"));
app.use("/api/print-jobs", require("./routes/printJobs.routes"));



// Puerto
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor POS-Multi-Bar escuchando en http://localhost:${PORT}`);
});
