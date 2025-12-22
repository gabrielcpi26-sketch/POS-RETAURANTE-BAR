// src/controllers/orders.controller.js
import prisma from "../prisma/client.js";

// GET /api/orders  -> historial rápido
export async function getOrders(req, res) {
  try {
    const orders = await prisma.order.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // últimos 50 pedidos, por ejemplo
      include: {
        table: true, // para saber de qué mesa es
      },
    });

    // Parsear el JSON de items antes de enviarlo al frontend
    const parsed = orders.map((o) => {
      let items = [];
      try {
        items = o.items ? JSON.parse(o.items) : [];
      } catch (e) {
        items = [];
      }

      return {
        ...o,
        items,
      };
    });

    res.json(parsed);
  } catch (error) {
    console.error("Error al obtener pedidos:", error);
    res.status(500).json({ error: "No se pudieron obtener los pedidos" });
  }
}

// POST /api/orders  -> guardar pedido de una mesa
export async function createOrder(req, res) {
  try {
    const { tableId, items, total } = req.body;

    // Validaciones básicas (por si algo raro llega del front)
    if (!tableId) {
      return res.status(400).json({ error: "Falta tableId" });
    }

    // items debería ser un arreglo
    const safeItems = Array.isArray(items) ? items : [];

    // Guardamos los items como JSON string
    const itemsJson = JSON.stringify(safeItems);

    const newOrder = await prisma.order.create({
      data: {
        tableId,
        items: itemsJson,
        total: total ?? 0,
      },
      include: {
        table: true,
      },
    });

    // Devolvemos los items parseados para que el front los vea igual
    res.json({
      message: "Pedido guardado correctamente",
      order: {
        ...newOrder,
        items: safeItems,
      },
    });
  } catch (error) {
    console.error("Error al guardar pedido en DB:", error);
    res.status(500).json({ error: "Error al guardar el pedido" });
  }
}
