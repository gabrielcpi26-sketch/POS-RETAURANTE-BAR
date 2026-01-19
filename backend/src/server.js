require("dotenv").config({ path: ".env.dev" });

// backend/src/server.js
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const prisma = require("./prisma");


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


const app = express();

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const allow =
        origin === "http://localhost:5173" ||
        origin.endsWith(".localhost:5173") ||
        origin === "https://pos-restaurante-bar.vercel.app" ||
        origin.endsWith(".vercel.app") ||
        origin === "https://pos-restaurante-bar.onrender.com";

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
    ],
  })
);

app.use(express.json());

// ======================
// TENANT (multi-negocio) - detección por subdominio o header
// ======================
app.use((req, _res, next) => {
  const fromHeader = (req.headers["x-tenant-key"] || req.headers["x-tenant"] || "")
    .toString()
    .trim();

  const host = (req.headers.host || "").toString().split(":")[0];
  const parts = host.split(".");
  const subdomain = parts.length >= 2 && parts[parts.length - 1] === "localhost" ? parts[0] : (parts.length >= 3 ? parts[0] : "");


  req.tenantKey = fromHeader || subdomain || "default";
  next();
});

// ======================
// ✅ RESOLVER tenantId desde tenantKey (NO rompe: default siempre)
// ======================
app.use(async (req, _res, next) => {
  try {
    const key = (req.tenantKey || "default").toString().trim() || "default";

// ✅ findUnique SIEMPRE debe llevar where con campo UNIQUE
let t = await prisma.tenant.findUnique({
 where: { key: key }
 // <-- si tu campo NO se llama "key", lee nota abajo
});

if (!t) {
  t = await prisma.tenant.create({
    data: { key: key, name: key },
  });
}


    req.tenantId = t.id; // BigInt

    // ✅ PLAN por tenant (default FREE si no existe registro)
    req.tenantPlan = "FREE";
    try {
      const rows = await prisma.$queryRaw`
        select plan from public.tenant_plan
        where tenant_id = ${req.tenantId}
        limit 1
      `;
      req.tenantPlan = ((rows && rows[0] && rows[0].plan) ? rows[0].plan : "FREE").toString();
    } catch (e) {
      req.tenantPlan = "FREE";
    }

    return next();
  } catch (e) {
    console.error("❌ TENANT resolve error:", e);
    return next(e);
  }
});

// Health checks
app.get("/", (_req, res) => res.send("OK - POS backend running"));
app.get("/api", (_req, res) => res.json({ ok: true }));
app.get("/__ping", (_req, res) => res.json({ ok: true }));
app.get("/api/tenant/plan", (req, res) => {
  res.json({ ok: true, tenantKey: req.tenantKey, plan: req.tenantPlan || "FREE" });
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

// Puerto
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor POS-Multi-Bar escuchando en http://localhost:${PORT}`);
});
