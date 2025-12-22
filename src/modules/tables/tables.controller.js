// backend/src/modules/tables/tables.controller.js
import {
  createTable,
  listTablesByArea,
} from "./tables.service.js";

export async function createTableController(req, res) {
  try {
    const table = await createTable(req.body);
    res.status(201).json(table);
  } catch (error) {
    console.error("Error al crear mesa:", error);
    res.status(400).json({ error: error.message });
  }
}

export async function listTablesByAreaController(req, res) {
  try {
    const { areaId } = req.params;
    const tables = await listTablesByArea(areaId);
    res.json(tables);
  } catch (error) {
    console.error("Error al listar mesas:", error);
    res.status(400).json({ error: error.message });
  }
}
