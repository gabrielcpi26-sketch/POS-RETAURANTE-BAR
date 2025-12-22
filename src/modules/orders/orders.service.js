// src/modules/orders/orders.service.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Crear un nuevo pedido
 */
async function createOrder({ tableId, items, total }) {
  // items viene del frontend como array [{ name, price, qty }]
  const created = await prisma.order.create({
    data: {
      tableId,
      total,
      items: {
        create: items.map((it) => ({
          name: it.name,
          price: it.price,
          qty: it.qty,
        })),
      },
    },
    include: {
      table: true,
      items: true,
    },
  });

  return created;
}

/**
 * Historial rápido: últimos N pedidos
 */
async function getLastOrders(limit = 5) {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      table: true,
      items: true,
    },
  });

  return orders;
}

/**
 * Resumen para el panel del dueño
 * (puedes luego agregar filtros de fecha si quieres)
 */
async function getAdminSummary() {
  // Puedes ajustar rango de fechas aquí si quieres (hoy, esta semana, etc.)
  const where = {}; // por ahora: todo

  // 1) Totales generales
  const totalOrders = await prisma.order.count({ where });

  const totalAgg = await prisma.order.aggregate({
    where,
    _sum: { total: true },
  });

  const totalRevenue = totalAgg._sum.total || 0;

  // 2) Ventas por mesa
  const byTable = await prisma.order.groupBy({
    by: ["tableId"],
    where,
    _count: { _all: true },
    _sum: { total: true },
  });

  // Juntamos nombre de la mesa
  const tables = await prisma.table.findMany();
  const tableNameById = {};
  tables.forEach((t) => {
    tableNameById[t.id] = t.name;
  });

  const ordersByTable = byTable.map((row) => ({
    tableId: row.tableId,
    tableName: tableNameById[row.tableId] || `Mesa ${row.tableId}`,
    ordersCount: row._count._all,
    total: row._sum.total || 0,
  }));

  // 3) Top productos (por cantidad vendida)
  const topProducts = await prisma.orderItem.groupBy({
    by: ["name"],
    _sum: { qty: true },
    _count: { _all: true },
    orderBy: {
      _sum: { qty: "desc" },
    },
    take: 5,
  });

  // 4) Últimos pedidos detallados (para lista)
  const lastOrders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      table: true,
      items: true,
    },
  });

  return {
    totalOrders,
    totalRevenue,
    ordersByTable,
    topProducts: topProducts.map((p) => ({
      name: p.name,
      qty: p._sum.qty || 0,
      times: p._count._all || 0,
    })),
    lastOrders,
  };
}

module.exports = {
  createOrder,
  getLastOrders,
  getAdminSummary,
};
