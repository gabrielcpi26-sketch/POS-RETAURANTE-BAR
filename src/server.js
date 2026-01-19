/const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

// Rutas
const authRoutes = require("./routes/auth.routes");
const areasRoutes = require("./routes/areas.routes");
const tablesRoutes = require("./routes/tables.routes");
const ordersRoutes = require("./routes/orders.routes");
const reportsRoutes = require("./routes/reports.routes");
const inventoryRoutes = require("./routes/inventory.routes");

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());


// ======================
// MULTI-TENANT: detectar tenantKey
// prioridad:
// 1) header x-tenant
// 2) subdominio
// ======================
app.use((req, res, next) => {
  const headerTenant = req.headers["x-tenant"];
  if (headerTenant) {
    req.tenantKey = String(headerTenant).trim();
    return next();
  }

  const host = req.headers.host || "";
  const subdomain = host.split(".")[0];

  // evita localhost, vercel preview, etc
  if (subdomain && !subdomain.includes("localhost") && subdomain !== "www") {
    req.tenantKey = subdomain;
  } else {
    req.tenantKey = "default";
  }

  next();
});


// ======================
// MULTI-TENANT: resolver tenantId desde DB
// ======================
app.use(async (req, res, next) => {
  try {
    if (!req.path.startsWith("/api")) return next();

    const tenantKey = String(req.tenantKey || "default").trim();

    const tenant = await prisma.tenant.findUnique({
      where: { key: tenantKey },
      select: { id: true, key: true },
    });

    if (!tenant) {
      return res.status(404).json({
        error: "TENANT_NOT_FOUND",
        message: `Tenant '${tenantKey}' no existe`,
      });
    }

    req.tenantId = tenant.id;
    next();
  } catch (err) {
    console.error("TENANT ERROR:", err);
    res.status(500).json({ error: "TENANT_RESOLUTION_FAILED" });
  }
});


// ======================
// RUTAS API
// ======================
app.use("/api/auth", authRoutes);
app.use("/api/areas", areasRoutes);
app.use("/api/tables", tablesRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/inventory", inventoryRoutes);


// ======================
// PUERTO
// ======================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor POS-Multi-Bar escuchando en http://localhost:${PORT}`);
});

