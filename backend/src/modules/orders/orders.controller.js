// src/modules/orders/orders.controller.js
const {
  createOrder,
  getLastOrders,
  getAdminSummary,
} = require("./orders.service");

/**
 * POST /api/orders
 */
async function createOrderController(req, res) {
  try {
    const { tableId, items, total } = req.body;

    if (!tableId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Datos de pedido incompletos" });
    }

    const order = await createOrder({ tableId, items, total });
    return res.json({ message: "Pedido guardado correctamente", order });
  } catch (err) {
    console.error("Error al crear pedido:", err);
    return res
      .status(500)
      .json({ error: "Error al guardar el pedido en el servidor" });
  }
}

/**
 * GET /api/orders/last?limit=5
 */
async function getLastOrdersController(req, res) {
  try {
    const limit = parseInt(req.query.limit || "5", 10);
    const orders = await getLastOrders(limit);
    return res.json({ orders });
  } catch (err) {
    console.error("Error al obtener últimos pedidos:", err);
    return res
      .status(500)
      .json({ error: "Error al cargar historial de pedidos" });
  }
}

/**
 * GET /api/orders/admin/summary
 */
async function getAdminSummaryController(req, res) {
  try {
    const summary = await getAdminSummary();
    return res.json(summary);
  } catch (err) {
    console.error("Error al obtener resumen admin:", err);
    return res
      .status(500)
      .json({ error: "Error al cargar resumen para el dueño" });
  }
}

module.exports = {
  createOrderController,
  getLastOrdersController,
  getAdminSummaryController,
};
