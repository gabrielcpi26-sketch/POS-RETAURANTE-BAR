// backend/src/modules/areas/areas.controller.js
import { createArea, listAreas } from "./areas.service.js";

export async function createAreaController(req, res) {
  try {
    const area = await createArea(req.body);
    res.status(201).json(area);
  } catch (error) {
    console.error("Error al crear área:", error);
    res.status(400).json({ error: error.message });
  }
}

export async function listAreasController(req, res) {
  try {
    const areas = await listAreas();
    res.json(areas);
  } catch (error) {
    console.error("Error al listar áreas:", error);
    res.status(500).json({ error: "Error al obtener las áreas" });
  }
}
