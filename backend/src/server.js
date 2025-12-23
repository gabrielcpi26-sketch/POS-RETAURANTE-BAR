// backend/src/server.js
const express = require("express");
const cors = require("cors");

// Rutas
const authRoutes = require("./routes/auth.routes");
const areasRoutes = require("./routes/areas.routes");
const tablesRoutes = require("./routes/tables.routes");
const ordersRoutes = require("./routes/orders.routes");
const reportsRoutes = require("./routes/reports.routes");
const inventoryRoutes = require("./routes/inventory.routes");

const app = express();

app.use(
  cors({
    origin: function (origin, callback) {
      // requests sin origin (curl/postman) => permitir
      if (!origin) return callback(null, true);

      const allow =
        origin === "http://localhost:5173" ||
        origin === "https://pos-retaurante-bar.vercel.app" ||
        origin.endsWith(".vercel.app") || // ✅ cualquier preview/prod de Vercel
        origin === "https://pos-restaurante-bar.onrender.com"; // opcional

      return allow ? callback(null, true) : callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


app.use(express.json());

// Health checks
app.get("/", (req, res) => res.send("OK - POS backend running"));
app.get("/api", (req, res) => res.json({ ok: true }));
app.get("/__ping", (req, res) => res.json({ ok: true }));

// Routers
app.use("/api/auth", authRoutes);
app.use("/api/areas", areasRoutes);
app.use("/api/tables", tablesRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/inventory", inventoryRoutes);

// Puerto
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor POS-Multi-Bar escuchando en http://localhost:${PORT}`);
});
