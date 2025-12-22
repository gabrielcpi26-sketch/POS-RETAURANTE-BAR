// src/components/InventoryPanel.jsx
import { useEffect, useState, useMemo } from "react";

export default function InventoryPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [editingName, setEditingName] = useState("");

  // ✅ NUEVO: Alta rápida de producto de inventario
  const [newItemForm, setNewItemForm] = useState({
    name: "",
    unit: "pz",
    sku: "",
  });

  // ✅ NUEVO: edición de nombre (mínimo)
  const [editingItemId, setEditingItemId] = useState(null);

  const [movementForm, setMovementForm] = useState({
    itemId: "",
    type: "IN",
    quantity: 1,
    reason: "",
  });

  const [reportRange, setReportRange] = useState({
    from: "",
    to: "",
  });

  // ==========================
  // Helpers de stock / estados
  // ==========================
  function getStockNumber(item) {
    // currentStock viene del endpoint debug de órdenes
    const raw = item.currentStock ?? item.stock ?? 0;
    return Number(raw) || 0;
  }

  function isLowStock(item) {
    const stock = getStockNumber(item);
    return stock > 0 && stock <= 3; // alerta cuando está por terminarse
  }

  function isOutOfStock(item) {
    return getStockNumber(item) <= 0;
  }

  const stats = useMemo(() => {
    const totalProducts = items.length;
    const low = items.filter(isLowStock).length;
    const out = items.filter(isOutOfStock).length;
    const withStock = items.filter((i) => !isOutOfStock(i)).length;

    return { totalProducts, low, out, withStock };
  }, [items]);

  // ==========================
  // Cargar resumen de inventario
  // ==========================
  async function loadSummary() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(
        "http://localhost:4000/api/orders/debug/inventory-items"
      );
      if (!res.ok) {
        throw new Error("No se pudo cargar el inventario");
      }

      const data = await res.json();
      const normalizedItems = Array.isArray(data) ? data : data.items || [];
      setItems(normalizedItems);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al cargar inventario");
    } finally {
      setLoading(false);
    }
  }

  // ✅ NUEVO: guardar nombre en BD
  async function saveItemName(itemId) {
    try {
      if (!editingName || !editingName.trim()) {
        alert("El nombre no puede ir vacío.");
        return;
      }

      setLoading(true);
      setError("");

      const res = await fetch(`http://localhost:4000/api/inventory/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo guardar el nombre");
      }

      setEditingItemId(null);
      setEditingName("");
      await loadSummary();
      alert("✅ Nombre actualizado.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al guardar nombre");
      alert("❌ Error al guardar nombre");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Carga inicial al abrir la pestaña de inventario
    loadSummary();

    // Función global para refrescar inventario desde el POS
    window.refreshInventoryFromOrder = () => {
      loadSummary();
    };
  }, []);

  // ==========================
  // Form de movimientos
  // ==========================
  function handleChange(e) {
    const { name, value } = e.target;
    setMovementForm((prev) => ({
      ...prev,
      [name]: name === "quantity" ? Number(value) : value,
    }));
  }

  async function handleRegisterMovement(e) {
    e.preventDefault();
    if (!movementForm.itemId || !movementForm.quantity) {
      alert("Selecciona un producto y una cantidad válida.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await fetch("http://localhost:4000/api/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(movementForm),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo registrar el movimiento");
      }

      await loadSummary();
      setMovementForm((prev) => ({
        ...prev,
        quantity: 1,
        reason: "",
      }));
      alert("Movimiento registrado.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al registrar movimiento");
    } finally {
      setLoading(false);
    }
  }

  // ✅ NUEVO: crear producto de inventario desde UI
  async function handleCreateNewItem(e) {
    e.preventDefault();

    const name = String(newItemForm.name || "").trim();
    if (!name) {
      alert("Escribe el nombre del producto.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch("http://localhost:4000/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          unit: newItemForm.unit || "pz",
          sku: newItemForm.sku ? String(newItemForm.sku).trim() : null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo crear el producto");
      }

      await loadSummary();

      setNewItemForm({ name: "", unit: "pz", sku: "" });
      alert("Producto creado. Ahora ya aparece en la lista.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al crear producto");
    } finally {
      setLoading(false);
    }
  }

  // ==========================
  // Helpers para exportar CSV
  // ==========================
  function buildCsv(rows) {
    if (!rows || rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const lines = [];
    lines.push(headers.join(","));
    rows.forEach((row) => {
      const values = headers.map((key) => {
        const value = row[key];
        if (value === null || value === undefined) return "";
        const s = String(value).replace(/"/g, '""');
        if (s.includes(",") || s.includes("\n")) {
          return `"${s}"`;
        }
        return s;
      });
      lines.push(values.join(","));
    });
    return lines.join("\n");
  }

  function downloadCsv(filename, rows) {
    const csv = buildCsv(rows);
    if (!csv) {
      alert("No hay datos para exportar.");
      return;
    }
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function fetchAndExport(period) {
    // period: "week" | "month" | "custom"
    let from = reportRange.from;
    let to = reportRange.to;
    const today = new Date();

    if (period === "week") {
      const day = today.getDay(); // 0-domingo
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      from = monday.toISOString();
      to = sunday.toISOString();
    } else if (period === "month") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      first.setHours(0, 0, 0, 0);
      last.setHours(23, 59, 59, 999);
      from = first.toISOString();
      to = last.toISOString();
    } else if (period === "custom") {
      if (!from || !to) {
        alert("Selecciona fecha inicial y final.");
        return;
      }
    }

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);

      const res = await fetch(
        `http://localhost:4000/api/inventory/report?${params.toString()}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo obtener el reporte");
      }

      const data = await res.json();
      const rows = (data.rows || []).map((row) => ({
        Producto: row.itemName,
        SKU: row.sku,
        Unidad: row.unit,
        Entradas: row.entries,
        Salidas: row.outputs,
        Neto: row.netQuantity,
        "Stock final": row.finalStock,
      }));

      const label =
        period === "week" ? "semana" : period === "month" ? "mes" : "rango";

      downloadCsv(
        `reporte-inventario-${label}-${today.toISOString().slice(0, 10)}.csv`,
        rows
      );
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al exportar reporte");
    } finally {
      setLoading(false);
    }
  }

  // ==========================
  // RENDER
  // ==========================
  return (
    <section
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.99))",
        padding: 16,
        marginTop: 8,
        color: "#E5E7EB",
        fontSize: 13,
        boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div>
          <h3
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: "#F3F4F6",
              margin: 0,
            }}
          >
            Inventario — Entradas, salidas y stock
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "#9CA3AF",
            }}
          >
            Vista rápida para que como dueña veas existencias, productos por
            terminarse y puedas exportar tus reportes.
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          {loading && (
            <span
              style={{
                fontSize: 12,
                color: "#A5B4FC",
              }}
            >
              Cargando...
            </span>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 12,
            fontSize: 12,
            color: "#FCA5A5",
          }}
        >
          {error}
        </div>
      )}

      {/* RESUMEN RÁPIDO */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            background: "#161B22",
            borderRadius: 10,
            padding: "10px 12px",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <p style={{ color: "#9CA3AF", fontSize: 11, marginBottom: 2 }}>
            Productos totales
          </p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {stats.totalProducts}
          </p>
        </div>

        <div
          style={{
            background: "#161B22",
            borderRadius: 10,
            padding: "10px 12px",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <p style={{ color: "#9CA3AF", fontSize: 11, marginBottom: 2 }}>
            Con existencia
          </p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {stats.withStock}
          </p>
        </div>

        <div
          style={{
            background:
              stats.low > 0 ? "rgba(234,179,8,0.15)" : "rgba(22,27,34,1)",
            borderRadius: 10,
            padding: "10px 12px",
            border:
              stats.low > 0
                ? "1px solid rgba(234,179,8,0.8)"
                : "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <p style={{ color: "#EAB308", fontSize: 11, marginBottom: 2 }}>
            Por terminarse
          </p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {stats.low}
          </p>
        </div>

        <div
          style={{
            background:
              stats.out > 0 ? "rgba(239,68,68,0.16)" : "rgba(22,27,34,1)",
            borderRadius: 10,
            padding: "10px 12px",
            border:
              stats.out > 0
                ? "1px solid rgba(239,68,68,0.85)"
                : "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <p style={{ color: "#F97373", fontSize: 11, marginBottom: 2 }}>
            Agotados
          </p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {stats.out}
          </p>
        </div>
      </div>

      {/* CUERPO PRINCIPAL: TABLA + FORM + EXPORT */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1.6fr",
          gap: 16,
        }}
      >
        {/* TABLA DE INVENTARIO */}
        <div
          style={{
            backgroundColor: "#020617",
            borderRadius: 12,
            padding: 10,
            border: "1px solid rgba(31,41,55,0.9)",
            maxHeight: 320,
            overflow: "auto",
          }}
        >
          {/* Encabezado de columnas */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2.3fr 1fr 1fr",
              padding: "6px 8px",
              borderBottom: "1px solid rgba(51,65,85,0.9)",
              fontSize: 12,
              color: "#9CA3AF",
            }}
          >
            <span>Producto</span>
            <span style={{ textAlign: "right" }}>Stock</span>
            <span style={{ textAlign: "right" }}>Estado</span>
          </div>

          {/* Filas */}
          {items.length === 0 && (
            <div
              style={{
                padding: 14,
                textAlign: "center",
                fontSize: 12,
                color: "#6B7280",
              }}
            >
              Sin productos todavía.
            </div>
          )}

          {items.map((item) => {
            const stock = getStockNumber(item);
            const low = isLowStock(item);
            const out = isOutOfStock(item);

            let pillStyle = {
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 500,
              display: "inline-flex",
              justifyContent: "flex-end",
            };
            let pillText = "OK";
            if (low) {
              pillStyle = {
                ...pillStyle,
                background: "rgba(234,179,8,0.15)",
                border: "1px solid rgba(234,179,8,0.7)",
                color: "#FEF08A",
              };
              pillText = "Por terminarse";
            }
            if (out) {
              pillStyle = {
                ...pillStyle,
                background: "rgba(239,68,68,0.2)",
                border: "1px solid rgba(239,68,68,0.8)",
                color: "#FCA5A5",
              };
              pillText = "Agotado";
            }
            if (!low && !out) {
              pillStyle = {
                ...pillStyle,
                background: "rgba(34,197,94,0.16)",
                border: "1px solid rgba(34,197,94,0.7)",
                color: "#BBF7D0",
              };
              pillText = "OK";
            }

            return (
              <div
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2.3fr 1fr 1fr",
                  padding: "6px 8px",
                  borderBottom: "1px solid rgba(31,41,55,0.9)",
                  fontSize: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  {/* ✅ SOLO AQUÍ se hizo editable el nombre, manteniendo diseño */}
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#E5E7EB",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {editingItemId === item.id ? (
                      <>
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          style={{
                            flex: 1,
                            backgroundColor: "#020617",
                            borderRadius: 8,
                            border: "1px solid rgba(55,65,81,0.9)",
                            color: "#E5E7EB",
                            fontSize: 12,
                            padding: "6px 8px",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => saveItemName(item.id)}
                          style={{
                            borderRadius: 10,
                            border: "1px solid rgba(34,197,94,0.7)",
                            background: "rgba(34,197,94,0.12)",
                            color: "#BBF7D0",
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                          title="Guardar"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemId(null);
                            setEditingName("");
                          }}
                          style={{
                            borderRadius: 10,
                            border: "1px solid rgba(239,68,68,0.7)",
                            background: "rgba(239,68,68,0.12)",
                            color: "#FCA5A5",
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                          title="Cancelar"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1 }}>{item.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemId(item.id);
                            setEditingName(item.name || "");
                          }}
                          style={{
                            borderRadius: 10,
                            border: "1px solid rgba(148,163,184,0.35)",
                            background: "rgba(148,163,184,0.08)",
                            color: "#E5E7EB",
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                          title="Editar nombre"
                        >
                          ✏️
                        </button>
                      </>
                    )}
                  </div>

                  {item.unit && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#6B7280",
                      }}
                    >
                      Unidad: {item.unit}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    color: "#E5E7EB",
                  }}
                >
                  {stock} {item.unit || "pz"}
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={pillStyle}>{pillText}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* DERECHA: NUEVO PRODUCTO + MOVIMIENTOS + EXPORT */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* ✅ NUEVO: ALTA RÁPIDA (➕ Nuevo producto) */}
          <form
            onSubmit={handleCreateNewItem}
            style={{
              backgroundColor: "#020617",
              borderRadius: 12,
              padding: 12,
              border: "1px solid rgba(31,41,55,0.9)",
              display: "grid",
              gridTemplateColumns: "1.7fr 0.9fr 0.8fr",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              value={newItemForm.name}
              onChange={(e) =>
                setNewItemForm((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="➕ Nuevo producto (nombre)"
              style={{
                backgroundColor: "#020617",
                borderRadius: 8,
                border: "1px solid rgba(55,65,81,0.9)",
                color: "#E5E7EB",
                fontSize: 12,
                padding: "6px 8px",
              }}
            />

            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                value={newItemForm.unit}
                onChange={(e) =>
                  setNewItemForm((p) => ({ ...p, unit: e.target.value }))
                }
                placeholder="Unidad (pz/ml)"
                style={{
                  width: 110,
                  backgroundColor: "#020617",
                  borderRadius: 8,
                  border: "1px solid rgba(55,65,81,0.9)",
                  color: "#E5E7EB",
                  fontSize: 12,
                  padding: "6px 8px",
                }}
              />
              <input
                value={newItemForm.sku}
                onChange={(e) =>
                  setNewItemForm((p) => ({ ...p, sku: e.target.value }))
                }
                placeholder="SKU (opcional)"
                style={{
                  flex: 1,
                  backgroundColor: "#020617",
                  borderRadius: 8,
                  border: "1px solid rgba(55,65,81,0.9)",
                  color: "#E5E7EB",
                  fontSize: 12,
                  padding: "6px 8px",
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                borderRadius: 999,
                border: "none",
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                background:
                  "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.42))",
                color: "#BBF7D0",
                cursor: "pointer",
                justifySelf: "flex-end",
                borderColor: "rgba(34,197,94,0.6)",
              }}
            >
              Crear
            </button>

            <div
              style={{
                gridColumn: "1 / -1",
                marginTop: 4,
                fontSize: 11,
                color: "#9CA3AF",
              }}
            >
              Crea productos aquí para obtener su ID real y poder ligarlos al menú
              (modo PRO).
            </div>
          </form>

          {/* FORM MOVIMIENTO */}
          <form
            onSubmit={handleRegisterMovement}
            style={{
              backgroundColor: "#020617",
              borderRadius: 12,
              padding: 12,
              border: "1px solid rgba(31,41,55,0.9)",
              display: "grid",
              gridTemplateColumns: "1.7fr 0.9fr 0.8fr",
              gap: 8,
              alignItems: "center",
            }}
          >
            <select
              name="itemId"
              value={movementForm.itemId}
              onChange={handleChange}
              style={{
                backgroundColor: "#020617",
                borderRadius: 8,
                border: "1px solid rgba(55,65,81,0.9)",
                color: "#E5E7EB",
                fontSize: 12,
                padding: "6px 8px",
              }}
            >
              <option value="">Selecciona producto</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              <select
                name="type"
                value={movementForm.type}
                onChange={handleChange}
                style={{
                  backgroundColor: "#020617",
                  borderRadius: 8,
                  border: "1px solid rgba(55,65,81,0.9)",
                  color: "#E5E7EB",
                  fontSize: 12,
                  padding: "6px 8px",
                }}
              >
                <option value="IN">Entrada</option>
                <option value="OUT">Salida</option>
              </select>
              <input
                type="number"
                min={1}
                name="quantity"
                value={movementForm.quantity}
                onChange={handleChange}
                style={{
                  width: 70,
                  backgroundColor: "#020617",
                  borderRadius: 8,
                  border: "1px solid rgba(55,65,81,0.9)",
                  color: "#E5E7EB",
                  fontSize: 12,
                  padding: "6px 8px",
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                borderRadius: 999,
                border: "none",
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 600,
                background:
                  "linear-gradient(135deg, #22C55E, #16A34A, #22C55E)",
                color: "#020617",
                cursor: "pointer",
                justifySelf: "flex-end",
              }}
            >
              Registrar
            </button>

            <textarea
              name="reason"
              value={movementForm.reason}
              onChange={handleChange}
              rows={2}
              placeholder="Motivo / referencia (opcional)"
              style={{
                gridColumn: "1 / -1",
                marginTop: 8,
                backgroundColor: "#020617",
                borderRadius: 8,
                border: "1px solid rgba(55,65,81,0.9)",
                color: "#E5E7EB",
                fontSize: 12,
                padding: "6px 8px",
                resize: "vertical",
              }}
            />
          </form>

          {/* EXPORT REPORTES */}
          <div
            style={{
              backgroundColor: "#020617",
              borderRadius: 12,
              padding: 12,
              border: "1px solid rgba(31,41,55,0.9)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 12,
              color: "#E5E7EB",
            }}
          >
            <span style={{ fontWeight: 500 }}>
              Exportar reportes de inventario
            </span>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <button
                type="button"
                onClick={() => fetchAndExport("week")}
                style={{
                  borderRadius: 999,
                  border: "none",
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 500,
                  backgroundColor: "#0F766E",
                  color: "#E5E7EB",
                  cursor: "pointer",
                }}
              >
                Semana actual
              </button>
              <button
                type="button"
                onClick={() => fetchAndExport("month")}
                style={{
                  borderRadius: 999,
                  border: "none",
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 500,
                  backgroundColor: "#0EA5E9",
                  color: "#0F172A",
                  cursor: "pointer",
                }}
              >
                Mes actual
              </button>
              <span>o rango personalizado:</span>
              <input
                type="date"
                value={reportRange.from}
                onChange={(e) =>
                  setReportRange((prev) => ({
                    ...prev,
                    from: e.target.value,
                  }))
                }
                style={{
                  backgroundColor: "#020617",
                  borderRadius: 8,
                  border: "1px solid rgba(55,65,81,0.9)",
                  color: "#E5E7EB",
                  fontSize: 12,
                  padding: "4px 6px",
                }}
              />
              <input
                type="date"
                value={reportRange.to}
                onChange={(e) =>
                  setReportRange((prev) => ({
                    ...prev,
                    to: e.target.value,
                  }))
                }
                style={{
                  backgroundColor: "#020617",
                  borderRadius: 8,
                  border: "1px solid rgba(55,65,81,0.9)",
                  color: "#E5E7EB",
                  fontSize: 12,
                  padding: "4px 6px",
                }}
              />
              <button
                type="button"
                onClick={() => fetchAndExport("custom")}
                style={{
                  borderRadius: 999,
                  border: "none",
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 500,
                  backgroundColor: "#22C55E",
                  color: "#022C22",
                  cursor: "pointer",
                }}
              >
                Exportar rango
              </button>
            </div>
          </div>
        </div>
      </div>

      <p
        style={{
          marginTop: 10,
          color: "#6B7280",
          fontSize: 11,
        }}
      >
        Tip: cuando veas varios productos en “Por terminarse”, es momento de
        levantar pedido antes del fin de semana fuerte.
      </p>
    </section>
  );
}
