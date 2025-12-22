// src/routes/orders.routes.js
const express = require("express");
const {
  createOrderController,
  getLastOrdersController,
  getAdminSummaryController,
} = require("../modules/orders/orders.controller");

const router = express.Router();

// Guardar pedido
router.post("/", createOrderController);

// Historial rápido (que ya usábamos en el panel)
router.get("/last", getLastOrdersController);

// 🔥 NUEVO: resumen para el dueño
router.get("/admin/summary", getAdminSummaryController);

module.exports = router;
