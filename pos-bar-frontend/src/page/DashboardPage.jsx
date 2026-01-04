// src/page/DashboardPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import InventoryPanel from "../components/InventoryPanel.jsx";
import Accordion from "../components/Accordion.jsx";
import Section from "../components/Section.jsx";
import LoginGate from "../components/LoginGate.jsx";
import PosShell from "../components/PosShell.jsx";
import { Bar, Pie } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import TableQRCode from "../components/TableQRCode.jsx";



import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";


ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement);





// =======================
// =========================
// CONFIG
// =========================

// ⚠️ REGLA PRO:
// - El frontend NUNCA decide localhost vs prod
// - TODO se controla por Vercel ENV (VITE_API_URL)
// - Si no existe, falla explícitamente (mejor que romper en silencio)

const API_URL = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

if (!API_URL) {
  console.error("❌ VITE_API_URL no está definida en el entorno");
}

// Para que otros componentes puedan refrescar inventario (si lo usas)
window.dispatchInventoryRefresh = () => {
  loadInventoryOptions();
  loadLowStock();
};

// =======================
// TEMAS PRECONFIGURADOS
// =======================
const THEME_STORAGE_KEY = "pos_theme_v1";
const CUSTOM_PRIMARY_STORAGE_KEY = "pos_theme_primary_v1";

const THEME_PRESETS = {
  darkPro: {
    key: "darkPro",
    name: "Dark Pro",
    bgGradient:
      "radial-gradient(circle at top, #0f172a 0, #020617 55%, #000 100%)",
    cardBg: "rgba(15,23,42,0.98)",
    border: "rgba(148,163,184,0.25)",
    primary: "#22c55e",
    primarySoft: "rgba(34,197,94,0.4)",
    text: "#e5e7eb",
    danger: "#ef4444",
  },
  aqua: {
    key: "aqua",
    name: "Aqua",
    bgGradient:
      "radial-gradient(circle at top, #0f172a 0, #020617 40%, #022c3a 100%)",
    cardBg: "rgba(10,21,36,0.98)",
    border: "rgba(56,189,248,0.35)",
    primary: "#22d3ee",
    primarySoft: "rgba(34,211,238,0.4)",
    text: "#e0f2fe",
    danger: "#fb7185",
  },
  gold: {
    key: "gold",
    name: "Gold Luxury",
    bgGradient:
      "radial-gradient(circle at top, #1c1917 0, #0b0b0b 50%, #020617 100%)",
    cardBg: "rgba(24,20,15,0.98)",
    border: "rgba(234,179,8,0.5)",
    primary: "#eab308",
    primarySoft: "rgba(234,179,8,0.35)",
    text: "#fef9c3",
    danger: "#f97373",
  },
  redCola: {
    key: "redCola",
    name: "Red Cola",
    bgGradient:
      "radial-gradient(circle at top, #450a0a 0, #111827 50%, #020617 100%)",
    cardBg: "rgba(24,10,10,0.98)",
    border: "rgba(248,113,113,0.45)",
    primary: "#ef4444",
    primarySoft: "rgba(248,113,113,0.35)",
    text: "#fee2e2",
    danger: "#b91c1c",
  },
};

// =======================
// MENÚ RÁPIDO DEFAULT
// =======================
const DEFAULT_PRODUCTS = [
  { id: 1, section: "Bebidas", name: "Cerveza nacional", price: 35, category: "Cerveza" },
  { id: 2, section: "Bebidas", name: "Cerveza importada", price: 55, category: "Cerveza" },
  { id: 3, section: "Bebidas", name: "Cubeta 6 cervezas", price: 220, category: "Promos" },
  { id: 4, section: "Bebidas", name: "Tequila shot", price: 45, category: "Shots" },
  { id: 5, section: "Bebidas", name: "Whisky trago", price: 80, category: "Coctelería" },
  { id: 6, section: "Bebidas", name: "Vodka trago", price: 70, category: "Coctelería" },
  { id: 7, section: "Bebidas", name: "Refresco 355 ml", price: 25, category: "Refrescos" },
  { id: 8, section: "Bebidas", name: "Agua natural", price: 20, category: "Refrescos" },
  { id: 9, section: "Comida", name: "Botana mixta", price: 65, category: "Botanas" },
];

// Mapeo promos → inventario real (si quieres)
const PROMO_MAPPINGS = {
  "Cubeta 6 cervezas": { inventoryName: "Cerveza nacional", units: 6 },
};

function loadStoredProducts() {
  try {
    const raw = localStorage.getItem("pos_quick_products");
    if (!raw) return DEFAULT_PRODUCTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PRODUCTS;
    return parsed;
  } catch {
    return DEFAULT_PRODUCTS;
  }
}

function getAutoRange(days = 7) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}



// =======================
// ROLES
// =======================
const ROLES = {
  MESERO: "mesero",
  ENCARGADO: "encargado",
  ADMIN: "admin",
};

const ROLE_KEY = "pos_user_role_v1"; // en sessionStorage (por pestaña)
const TURNO_KEY = "pos_turno_global_abierto"; // en localStorage (global)
const SALES_BASELINE_KEY = "pos_sales_baseline_v1";
const ORDERS_BASELINE_KEY = "pos_orders_baseline_v1";
const isTurnoAbierto = () => localStorage.getItem(TURNO_KEY) === "1";




// =======================
// UI helpers
// =======================
function SummaryChip({ label, value, isOpen }) {
  return (
    <div
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: isOpen
          ? "1px solid rgba(34,197,94,0.75)"
          : "1px solid rgba(239,68,68,0.75)",
        background: isOpen ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        color: "#e5e7eb",
        fontSize: 12,
        fontWeight: 900,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ opacity: 0.85 }}>{label}:</span>
      <span style={{ color: isOpen ? "#86efac" : "#fca5a5" }}>{value}</span>
    </div>
  );
}


const fmtMoney = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    Number(n || 0)
  );

// ======================
// KEYS POS (DEFINITIVAS)
// ======================
const SHIFT_BASELINE_KEY = (todayKey) => `pos_shift_baseline_v1_${todayKey}`;
const CASH_MOVES_KEY = (todayKey) => `pos_cash_moves_v1_${todayKey}`;




export default function DashboardPage() {


// ======================
// RESUMEN DUEÑO + PEDIDOS
// ======================
const [adminSummary, setAdminSummary] = useState(null);
const [loadingSummary, setLoadingSummary] = useState(false);
const [summaryError, setSummaryError] = useState("");

const adminSummaryRef = useRef(null);
const adminSummaryReqIdRef = useRef(0);

  // =======================
  // TEMA
  // =======================
  const [themeKey, setThemeKey] = useState(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) || "darkPro";
    } catch {
      return "darkPro";
    }
  });

const [cashNote, setCashNote] = useState("");

const [turnoAbierto, setTurnoAbierto] = useState(
  localStorage.getItem(TURNO_KEY) === "1"
);


  const [customPrimary, setCustomPrimary] = useState(() => {
    try {
      return localStorage.getItem(CUSTOM_PRIMARY_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  const baseTheme = THEME_PRESETS[themeKey] || THEME_PRESETS.darkPro;
  const activeTheme = useMemo(
    () => ({ ...baseTheme, ...(customPrimary ? { primary: customPrimary } : {}) }),
    [baseTheme, customPrimary]
  );




  useEffect(() => {
    const root = document.documentElement;
    const t = activeTheme;
    root.style.setProperty("--pos-bg-gradient", t.bgGradient);
    root.style.setProperty("--pos-card-bg", t.cardBg);
    root.style.setProperty("--pos-border", t.border);
    root.style.setProperty("--pos-primary", t.primary);
    root.style.setProperty("--pos-primary-soft", t.primarySoft);
    root.style.setProperty("--pos-text", t.text);
    root.style.setProperty("--pos-danger", t.danger);
  }, [activeTheme]);

  // =======================
  // TABS
  // =======================
  const [activeTab, setActiveTab] = useState("home");



  // =======================
  // ROL (por pestaña) + rutas
  // =======================
  const isMeseroRoute =
    typeof window !== "undefined" && window.location.pathname === "/mesero";

  const [userRole, setUserRole] = useState(() => {
    try {
      const r = sessionStorage.getItem(ROLE_KEY);
      return r === ROLES.ADMIN || r === ROLES.MESERO || r === ROLES.ENCARGADO
        ? r
        : ROLES.MESERO;
    } catch {
      return ROLES.MESERO;
    }
  });

  useEffect(() => {
    const syncRole = () => {
      try {
        const r = sessionStorage.getItem(ROLE_KEY);
        if (r === ROLES.ADMIN || r === ROLES.MESERO || r === ROLES.ENCARGADO) {
          setUserRole(r);
        }
      } catch {}
    };




    syncRole();
    window.addEventListener("pos_role_changed", syncRole);
    return () => window.removeEventListener("pos_role_changed", syncRole);
  }, []);

  const isAdmin = !isMeseroRoute && userRole === ROLES.ADMIN;
  const isEncargado = !isMeseroRoute && userRole === ROLES.ENCARGADO;
  const isMesero = isMeseroRoute ? true : userRole === ROLES.MESERO;
  const canManage = isAdmin || isEncargado;

  function bounceToLogin() {
    try {
      sessionStorage.removeItem(ROLE_KEY);
    } catch {}
    window.location.href = "/";
  }

  // =======================
  // TURNO GLOBAL
  // =======================
  const [turnoGlobalAbierto, setTurnoGlobalAbierto] = useState(() => {
    try {
      return localStorage.getItem(TURNO_KEY) === "1";
    } catch {
      return false;
    }
  });
useEffect(() => {
  const syncTurno = () => {
    try {
      setTurnoGlobalAbierto(localStorage.getItem(TURNO_KEY) === "1");
    } catch {
      setTurnoGlobalAbierto(false);
    }
  };

  window.addEventListener("pos_turno_global_changed", syncTurno);
  window.addEventListener("storage", syncTurno); // por si hay otra pestaña
  syncTurno();

  return () => {
    window.removeEventListener("pos_turno_global_changed", syncTurno);
    window.removeEventListener("storage", syncTurno);
  };
}, []);


function abrirTurnoGlobal() {
  try {
    localStorage.setItem(TURNO_KEY, "1");
    window.dispatchEvent(new Event("pos_turno_global_changed"));
  } catch {}
  setTurnoGlobalAbierto(true); // ✅ AQUÍ
}

 function cerrarTurnoGlobal() {
  try {
    localStorage.setItem(TURNO_KEY, "0");
    window.dispatchEvent(new Event("pos_turno_global_changed"));
  } catch {}
  setTurnoGlobalAbierto(false); // ✅ AQUÍ
}

  useEffect(() => {
    const syncTurno = () => {
      try {
        setTurnoGlobalAbierto(localStorage.getItem(TURNO_KEY) === "1");
      } catch {}
    };

    syncTurno();
    window.addEventListener("pos_turno_global_changed", syncTurno);

    const onStorage = (e) => {
      if (e.key === TURNO_KEY) syncTurno();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("pos_turno_global_changed", syncTurno);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // =======================
  // PIN MESERO (solo /mesero)
  // =======================
  const [meseroPinInput, setMeseroPinInput] = useState("");
  const [meseroPinOk, setMeseroPinOk] = useState(false);
  const [meseroPinError, setMeseroPinError] = useState("");

  const MESERO_PIN = import.meta.env?.VITE_MESERO_PIN || "0000";

  function verifyMeseroPin() {
    const clean = String(meseroPinInput || "").trim();
    if (!clean) return setMeseroPinError("Ingresa el PIN");
    if (clean === String(MESERO_PIN)) {
      setMeseroPinError("");
      setMeseroPinOk(true);
      return;
    }
    setMeseroPinError("PIN incorrecto");
  }

  // =======================
  // LOGO
  // =======================
  const [logoUrl, setLogoUrl] = useState(() => {
    try {
      return localStorage.getItem("pos_logo_url") || "";
    } catch {
      return "";
    }
  });
  const [showLogoEditor, setShowLogoEditor] = useState(false);
  const [tempLogoUrl, setTempLogoUrl] = useState(() => logoUrl);

  function handleSaveLogo() {
    try {
      localStorage.setItem("pos_logo_url", tempLogoUrl || "");
    } catch {}
    setLogoUrl(tempLogoUrl || "");
    setShowLogoEditor(false);
  }

  // =======================
  // INVENTARIO (para mapeo)
  // =======================
  const [inventoryOptions, setInventoryOptions] = useState([]);
  async function loadInventoryOptions() {
    try {
      const res = await fetch(`${API_URL}/api/orders/debug/inventory-items`, {

        cache: "no-store",
      });
      if (!res.ok) return;

      const data = await res.json();
      setInventoryOptions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error cargando inventario:", err);
    }
  }

  const findInventoryIdByName = (name) => {
    const n = String(name || "").trim().toLowerCase();
    if (!n) return null;
    const hit = (inventoryOptions || []).find(
      (it) => String(it.name || "").trim().toLowerCase() === n
    );
    return hit ? Number(hit.id) : null;
  };

  // =======================
  // MENÚ RÁPIDO (con editor)
  // =======================
const [quickProducts, setQuickProducts] = useState(() => loadStoredProducts());
const [showMenuEditor, setShowMenuEditor] = useState(false);
// ❌ Eliminar platillo del menú rápido (ADMIN)
const handleDeleteMenuProduct = (productId) => {
  setQuickProducts((prev) => {
    const next = prev.filter((p) => p.id !== productId);
    localStorage.setItem("pos_quick_products_v1", JSON.stringify(next));
    return next;
  });
};



const [menuSections, setMenuSections] = useState(() => {
  try {
    const raw = localStorage.getItem("pos_menu_sections_v1");
    if (!raw) return ["Comida", "Bebidas"];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : ["Comida", "Bebidas"];
  } catch {
    return ["Comida", "Bebidas"];
  }
});

const CATEGORY_COLORS = {
  Comida: "#22c55e",
  Bebidas: "#38bdf8",
  Postres: "#f472b6",
  Otros: "#a3a3a3",
};

const [lastAddedId, setLastAddedId] = useState(null);


const [activeMenuSection, setActiveMenuSection] = useState(
  () => menuSections[0] || "Comida"
);

const handleAddMenuProduct = (sectionName) => {
  const targetSection = sectionName || activeMenuSection || "Comida";

  setQuickProducts((prev) => {
    const newItem = {
imageUrl: "",
imageData: "",

      id: Date.now(),
      section: targetSection,
      name: "Nuevo platillo",
      category: "",
      ingredients: "",
      price: 0,
      sizeSmallLabel: "",
      sizeSmallPrice: 0,
      sizeLargeLabel: "",
      sizeLargePrice: 0,
      inventoryItemId: null,
      menuRecipeId: null,
    };
    return [...prev, newItem];
  });
};




const getQuickProductsBySectionAndCategory = () => {
  const sections = {};
  for (const p of quickProducts) {
    const section = String(p.section || "Comida").trim();
    const cat = String(p.category || "Otros").trim() || "Otros";
    if (!sections[section]) sections[section] = {};
    if (!sections[section][cat]) sections[section][cat] = [];
    sections[section][cat].push(p);
  }
  return sections;
};


// =======================
// QUICK PICK MODAL (PRO) - selección por números
// =======================
const [quickPickOpen, setQuickPickOpen] = useState(false);
const [quickPickStep, setQuickPickStep] = useState("category"); // "category" | "size"
const [quickPickProduct, setQuickPickProduct] = useState(null);
const [quickPickOpts, setQuickPickOpts] = useState([]);
const [quickPickInput, setQuickPickInput] = useState("");

const closeQuickPick = () => {
  setQuickPickOpen(false);
  setQuickPickProduct(null);
  setQuickPickOpts([]);
  setQuickPickInput("");
  setQuickPickStep("category");
};

const submitQuickPickNumber = () => {
  const n = Number(String(quickPickInput || "").trim());
  if (!Number.isFinite(n) || n <= 0) return;

  const picked = quickPickOpts[n - 1];
  if (!picked) return;

  const p = quickPickProduct;
  if (!p) return closeQuickPick();



  // =======================
  // STEP 1: CATEGORÍA
  // =======================
  if (quickPickStep === "category") {
    const chosenCategory = picked.meta?.categoryChoice || "";

 // 2) tamaños (DETECTAR POR PRECIO, NO por label)
const hasSizes =
  Number(p.sizeSmallPrice || 0) > 0 || Number(p.sizeLargePrice || 0) > 0;

if (hasSizes) {
  const sizeOpts = [];

  if (Number(p.sizeSmallPrice || 0) > 0) {
    sizeOpts.push({
      key: "1",
      label: `${p.sizeSmallLabel || "Chico"} — ${fmtMoney(Number(p.sizeSmallPrice || 0))}`,
      meta: {
        sizeLabel: p.sizeSmallLabel || "Chico",
        price: Number(p.sizeSmallPrice || 0),
        categoryChoice: chosenCategory || "",
      },
    });
  }

  if (Number(p.sizeLargePrice || 0) > 0) {
    sizeOpts.push({
      key: "2",
      label: `${p.sizeLargeLabel || "Grande"} — ${fmtMoney(Number(p.sizeLargePrice || 0))}`,
      meta: {
        sizeLabel: p.sizeLargeLabel || "Grande",
        price: Number(p.sizeLargePrice || 0),
        categoryChoice: chosenCategory || "",
      },
    });
  }


  setQuickPickProduct(p);
  setQuickPickStep("size");
  setQuickPickOpts(sizeOpts);
  setQuickPickInput("");
  setQuickPickOpen(true);
  return;
}


    // 👉 SIN TAMAÑOS: AGREGA DIRECTO
    const finalPrice = Number(p.price || 0);

    handleAddProduct({
      id: `${p.id}-${Date.now()}`,
      baseProductId: p.id,
      name: p.name,
      displayName: `${p.name}${chosenCategory ? " " + chosenCategory : ""}`,
      price: finalPrice,
      sizeLabel: "",
      categoryChoice: chosenCategory,
      inventoryItemId: p.inventoryItemId ?? null,
      menuRecipeId: p.menuRecipeId ?? null,
    });

    return closeQuickPick();
  }

  // =======================
  // STEP 2: TAMAÑO (PRECIO CORRECTO)
  // =======================
  if (quickPickStep === "size") {
    const sizeLabel = picked.meta?.sizeLabel || "";
    const finalPrice = Number(picked.meta?.price || 0);
    const categoryChoice = picked.meta?.categoryChoice || "";

    handleAddProduct({
      id: `${p.id}-${Date.now()}`,
      baseProductId: p.id,
      name: p.name,
      displayName: `${p.name}${categoryChoice ? " " + categoryChoice : ""}${
        sizeLabel ? " " + sizeLabel : ""
      }`,
      price: finalPrice, // ✅ PRECIO SEGÚN TAMAÑO
      sizeLabel,
      categoryChoice,
      inventoryItemId: p.inventoryItemId ?? null,
      menuRecipeId: p.menuRecipeId ?? null,
    });

    return closeQuickPick();
  }
};

// teclado: Enter = aceptar, Esc = cerrar
useEffect(() => {
  if (!quickPickOpen) return;
  const onKey = (e) => {
    if (e.key === "Escape") closeQuickPick();
    if (e.key === "Enter") submitQuickPickNumber();
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [quickPickOpen, quickPickInput, quickPickOpts, quickPickStep, quickPickProduct]);


  // =======================
  // ÁREAS / MESAS
  // =======================
const [showCloseModal, setShowCloseModal] = useState(false);
const [closePaymentMethod, setClosePaymentMethod] = useState("CASH");
const [closePaymentRef, setClosePaymentRef] = useState("");
const [closingTable, setClosingTable] = useState(false);
const [openTableIds, setOpenTableIds] = useState(() => new Set());



const [areas, setAreas] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [areasError, setAreasError] = useState("");

  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);

  const [showAreaForm, setShowAreaForm] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaDescription, setNewAreaDescription] = useState("");

  const [editingAreaId, setEditingAreaId] = useState(null);
  const [editingAreaName, setEditingAreaName] = useState("");
  const [editingAreaDescription, setEditingAreaDescription] = useState("");

  const [savingArea, setSavingArea] = useState(false);
  const [creatingArea, setCreatingArea] = useState(false);

const [qrTarget, setQrTarget] = useState(null); 
// { areaId, table }


  const loadAreas = async () => {
    try {
      setLoadingAreas(true);
      setAreasError("");
      const res = await fetch(`${API_URL}/api/areas`, { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudieron cargar las áreas");
      const data = await res.json();
      setAreas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setAreasError(err.message || "Error al cargar áreas");
    } finally {
      setLoadingAreas(false);
    }
  };

const handleSelectTable = async (area, table) => {
  setSelectedArea(area);
  setSelectedTable(table);

  setOrdersByTable((prev) => {
    // ✅ SI YA EXISTE PEDIDO LOCAL, NO LO TOQUES
    if (prev[table.id]?.items?.length) {
      return prev;
    }
    return prev;
  });

  try {
    const res = await fetch(`${API_URL}/api/orders/open/table/${table.id}`);
    if (!res.ok) return;

    const data = await res.json();

    setOrdersByTable((prev) => {
      // 🔒 PROTECCIÓN FINAL: no sobrescribir si ya hay items
      if (prev[table.id]?.items?.length) {
        return prev;
      }

      return {
        ...prev,
        [table.id]: { items: data.items || [] },
      };
    });
  } catch (err) {
    console.error(err);
  }
};



  const isSelected = (areaId, tableId) =>
    selectedArea?.id === areaId && selectedTable?.id === tableId;

  const handleCreateArea = async () => {
    if (!newAreaName.trim()) return alert("Escribe un nombre para la nueva área");
    try {
      setCreatingArea(true);
      const res = await fetch(`${API_URL}/api/areas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAreaName.trim(),
          description: newAreaDescription.trim(),
        }),
      });
      if (!res.ok) throw new Error("No se pudo crear el área");
      const created = await res.json();
      setAreas((prev) => [...prev, created]);
      setNewAreaName("");
      setNewAreaDescription("");
      setShowAreaForm(false);
    } catch (err) {
      console.error(err);
      alert(err.message || "Error al crear área");
    } finally {
      setCreatingArea(false);
    }
  };

  const handleStartEditArea = (area) => {
    setEditingAreaId(area.id);
    setEditingAreaName(area.name || "");
    setEditingAreaDescription(area.description || "");
  };

  const handleCancelEditArea = () => {
    setEditingAreaId(null);
    setEditingAreaName("");
    setEditingAreaDescription("");
  };

  const handleSaveAreaEdit = async () => {
    if (!editingAreaId) return;
    if (!editingAreaName.trim()) return alert("El nombre del área no puede ir vacío");
    try {
      setSavingArea(true);
      const res = await fetch(`${API_URL}/api/areas/${editingAreaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingAreaName.trim(),
          description: editingAreaDescription.trim(),
        }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar el área");
      const updated = await res.json();
      setAreas((prev) =>
        prev.map((a) => (a.id === editingAreaId ? { ...a, ...updated } : a))
      );
      handleCancelEditArea();
    } catch (err) {
      console.error(err);
      alert(err.message || "Error al guardar área");
    } finally {
      setSavingArea(false);
    }
  };

  const handleDeleteArea = async (areaId) => {
    if (!window.confirm("¿Eliminar esta área y todas sus mesas?")) return;
    try {
      const res = await fetch(`${API_URL}/api/areas/${areaId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar el área");
      setAreas((prev) => prev.filter((a) => a.id !== areaId));
      if (selectedArea?.id === areaId) {
        setSelectedArea(null);
        setSelectedTable(null);
      }
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar el área");
    }
  };

const handleCloseTable = () => {
  if (!isTurnoAbierto()) {
    alert("⛔ Primero abre el turno para empezar el día.");
    return;
  }
  setShowCloseModal(true);
};

  const handleAddTableToArea = async (area) => {
    const nombreMesa = window.prompt(
      `Nombre de la nueva mesa en "${area.name}":`,
      `Mesa ${(area.tables?.length || 0) + 1}`
    );
    if (!nombreMesa?.trim()) return;

    try {
      const res = await fetch(`${API_URL}/api/tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nombreMesa.trim(), areaId: area.id }),
      });
      if (!res.ok) throw new Error("No se pudo crear la mesa");
      const createdTable = await res.json();
      setAreas((prev) =>
        prev.map((a) =>
          a.id === area.id ? { ...a, tables: [...(a.tables || []), createdTable] } : a
        )
      );
    } catch (err) {
      console.error(err);
      alert(err.message || "Error al crear mesa");
    }
  };

  // =======================
  // PEDIDOS (local por mesa)
  // =======================
  const [ordersByTable, setOrdersByTable] = useState({});

  const getCurrentOrder = () =>
    selectedTable ? ordersByTable[selectedTable.id] || { items: [] } : { items: [] };

  const calcTotal = (items) =>
    Array.isArray(items) ? items.reduce((sum, item) => sum + item.price * item.qty, 0) : 0;

  const currentOrder = getCurrentOrder();
  const currentTotal = calcTotal(currentOrder.items);

  const handleAddProduct = (product) => {
setLastAddedId(product.baseProductId || product.id);
setTimeout(() => setLastAddedId(null), 300);


// 🚨 BLOQUEO STOCK REAL (fuente de verdad)
// (evita que se agregue aunque el click venga de otra ruta)
if (product?.inventoryItemId != null) {
  const invId = Number(product.inventoryItemId);

  const inv = inventoryOptions.find((i) => Number(i.id) === invId);

  const stockVal = Number(
    inv?.stock ?? inv?.qty ?? inv?.quantity ?? inv?.currentStock ?? 0
  );

  if (Number.isFinite(stockVal) && stockVal <= 0) {
    alert("⛔ Producto sin stock disponible");
    return;
  }
}



    if (!selectedTable) return;

    setOrdersByTable((prev) => {
      const current = prev[selectedTable.id] || { items: [] };
      const items = [...current.items];

      // nota: product.id puede ser único (línea)
      const idx = items.findIndex((i) => i.productId === product.id);

      const displayName = product.displayName || product.name;

      if (idx >= 0) {
        items[idx] = { ...items[idx], qty: items[idx].qty + 1 };
      } else {
        items.push({
          productId: product.id,
          name: displayName,
          displayName,
          price: Number(product.price || 0),
          qty: 1,
          inventoryItemId: product.inventoryItemId ?? null,
          menuRecipeId: product.menuRecipeId ?? null,
          categoryChoice: product.categoryChoice || "",
          sizeLabel: product.sizeLabel || "",
          baseProductId: product.baseProductId || product.id,
        });
      }

      return { ...prev, [selectedTable.id]: { items } };
    });

// 🔥 DESCONTAR STOCK LOCAL INMEDIATO (UI)
if (product.inventoryItemId) {
  setInventoryOptions((prev) =>
    prev.map((i) => {
      if (i.id !== product.inventoryItemId) return i;

      const currentStock =
        Number(i.stock ?? i.qty ?? i.quantity ?? i.currentStock ?? 0);

      return {
        ...i,
        stock: Math.max(0, currentStock - (product.qty || 1)),
      };
    })
  );
}


  };


  const handleRemoveItem = (productId) => {
    if (!selectedTable) return;
    setOrdersByTable((prev) => {
      const current = prev[selectedTable.id] || { items: [] };
      const items = current.items.filter((i) => i.productId !== productId);
      return { ...prev, [selectedTable.id]: { items } };
    });
  };

  const handleChangeQty = (productId, delta) => {
    if (!selectedTable) return;
    setOrdersByTable((prev) => {
      const current = prev[selectedTable.id] || { items: [] };
      let items = current.items.map((i) =>
        i.productId === productId ? { ...i, qty: i.qty + delta } : i
      );
      items = items.filter((i) => i.qty > 0);
      return { ...prev, [selectedTable.id]: { items } };
    });
  };


const handleSetItemNote = (productId, note) => {
  if (!selectedTable) return;
  setOrdersByTable((prev) => {
    const current = prev[selectedTable.id] || { items: [] };
    return {
      ...prev,
      [selectedTable.id]: {
        ...current,
        items: (current.items || []).map((it) =>
          it.productId === productId ? { ...it, note } : it
        ),
      },
    };
  });
};


// =======================
// CLICK MENÚ RÁPIDO (PRO)
// =======================
const handleQuickProductClick = (p) => {
  if (!selectedTable) return;

  // 🚨 Validar stock antes de permitir agregar
  if (p.inventoryItemId) {
    const inv = (inventoryOptions || []).find((i) => i.id === p.inventoryItemId);
    const raw =
      inv?.stock ?? inv?.qty ?? inv?.quantity ?? inv?.currentStock ?? inv?.existencia ?? null;
    const stockNum = Number(raw);
    // 🔐 Bloquear SOLO si el stock es 0 confirmado
if (inv && Number.isFinite(stockNum) && stockNum === 0) {
  alert("⛔ Producto sin stock disponible");
  return;
}
  }

  // ✅ SIEMPRE declara estas 2 aquí (evita el error sizeLabel)
  let sizeLabel = "";
  let finalPrice = Number(p.price || 0);

  // 1) opciones de categoría/estilo (si viene "adobado, rojo, verde")
  const rawCat = String(p.category || "").trim();
  const catOpts = rawCat
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const hasMultiCategory = catOpts.length > 1;

  // 2) tamaños
  const hasSizes =
    (p.sizeSmallLabel && Number(p.sizeSmallPrice || 0) > 0) ||
    (p.sizeLargeLabel && Number(p.sizeLargePrice || 0) > 0);

  // 👉 Si hay categorías múltiples, abre QuickPick "category"
  if (hasMultiCategory) {
    setQuickPickProduct(p);
    setQuickPickStep("category");
    setQuickPickOpts(
      catOpts.map((c) => ({
        key: c,
        label: c,
        meta: { categoryChoice: c },
      }))
    );
    setQuickPickInput("");
    setQuickPickOpen(true);
    return;
  }

  // categoría única o vacía
  const chosenCategory = catOpts[0] || "";

  // 👉 Si hay tamaños, abre QuickPick "size"
  if (hasSizes) {
    const sizeOpts = [];
    if (p.sizeSmallLabel && Number(p.sizeSmallPrice || 0) > 0) {
      sizeOpts.push({
        key: "S",
        label: `${p.sizeSmallLabel || "Chico"} — ${fmtMoney(Number(p.sizeSmallPrice || 0))}`,
        meta: {
          sizeLabel: p.sizeSmallLabel || "Chico",
          price: Number(p.sizeSmallPrice || 0),
          categoryChoice: chosenCategory,
        },
      });
    }
    if (p.sizeLargeLabel && Number(p.sizeLargePrice || 0) > 0) {
      sizeOpts.push({
        key: "L",
        label: `${p.sizeLargeLabel || "Grande"} — ${fmtMoney(Number(p.sizeLargePrice || 0))}`,
        meta: {
          sizeLabel: p.sizeLargeLabel || "Grande",
          price: Number(p.sizeLargePrice || 0),
          categoryChoice: chosenCategory,
        },
      });
    }

    setQuickPickProduct(p);
    setQuickPickStep("size");
    setQuickPickOpts(sizeOpts);
    setQuickPickInput("");
    setQuickPickOpen(true);
    return;
  }

  // 👉 Sin tamaños: agrega directo
  sizeLabel = "";
  finalPrice = Number(p.price || 0);

  const displayName = `${p.name}${chosenCategory ? " " + chosenCategory : ""}${
    sizeLabel ? " " + sizeLabel : ""
  }`.trim();

  const uniqueLine = {
    id: `${p.id || "quick"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    baseProductId: p.id,
    name: p.name,
    displayName,
    price: finalPrice,
    sizeLabel,
    categoryChoice: chosenCategory,
    inventoryItemId: p.inventoryItemId ?? null,
    menuRecipeId: p.menuRecipeId ?? null,
  };

  handleAddProduct(uniqueLine);
};




  
// =======================
// GUARDAR PEDIDO (backend)
// =======================
const [savingOrder, setSavingOrder] = useState(false);
const [paymentMethod, setPaymentMethod] = useState("CASH"); // CASH | CARD | TRANSFER
const [paymentRef, setPaymentRef] = useState("");

const handleSaveOrder = async () => {
  // ⛔ BLOQUEO DURO POS (evita doble ejecución)
  if (savingOrder) return;

  if (!isTurnoAbierto()) {
    alert("⛔ Primero abre el turno para empezar el día.");
    return;
  }

  if (!selectedTable) return alert("Selecciona primero una mesa.");
  if (!currentOrder.items || currentOrder.items.length === 0)
    return alert("Aún no hay productos en el pedido.");

  setSavingOrder(true); // 🔥 se activa ANTES del flujo crítico

  try {
    const total = calcTotal(currentOrder.items);

    const expandedItems = [];
    currentOrder.items.forEach((item) => {
      const promo = PROMO_MAPPINGS[item.name];
      if (promo) {
        expandedItems.push({
          productId: item.productId,
          name: promo.inventoryName,
          price: promo.units > 0 ? Number(item.price) / promo.units : Number(item.price),
          qty: Number(item.qty) * promo.units,
          inventoryItemId: item.inventoryItemId ?? null,
          menuRecipeId: item.menuRecipeId ?? null,
        });
      } else {
        expandedItems.push({
          productId: item.productId,
          name: item.name,
          price: Number(item.price),
          qty: Number(item.qty),
          inventoryItemId: item.inventoryItemId ?? null,
          menuRecipeId: item.menuRecipeId ?? null,
        });
      }
    });

    const payload = {
      tableId: selectedTable.id,
      items: expandedItems,
      total: Number(total.toFixed(2)),
    };

   // ✅ POST con timeout + error real (NO cambia lógica)
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s

let res;
try {
  res = await fetch(`${API_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });
} finally {
  clearTimeout(timeoutId);
}

if (!res.ok) {
  const detail = await res.text().catch(() => "");
  console.error("❌ /api/orders error:", res.status, detail);
  throw new Error(detail || "No se pudo guardar el pedido");
}


    alert(
      `✅ Pedido guardado\nMesa: ${selectedTable.name}\nTotal: ${fmtMoney(total)}`
    );

    // ✅ Limpieza de UI INMEDIATA (no depende de refreshes)
    setOpenTableIds((prev) => {
      const next = new Set(prev);
      next.add(selectedTable.id);
      return next;
    });


    setPaymentRef("");
    setPaymentMethod("CASH");

    // 🔁 REFRESCOS (NO BLOQUEAN el guardado)
    Promise.allSettled([
      loadInventoryOptions(),
      loadRecentOrders(),
      loadDailyReports?.(),
      loadLowStock?.(),
    ]);

  } catch (err) {
    console.error(err);
    alert("❌ Error al guardar el pedido. Revisa tu backend.");
  } finally {
    setSavingOrder(false); // 🔓 SIEMPRE vuelve el botón
  }
};

const handlePrintQR = () => {
  window.print();
};


// =======================
// RESUMEN DUEÑO + PEDIDOS RECIENTES
// =======================


const handleLoadAdminSummary = async ({ silent = false } = {}) => {

  const reqId = ++adminSummaryReqIdRef.current;

  try {
    if (!silent) {
      setLoadingSummary(true);
      setSummaryError("");
    }

 const todayKey = new Date().toLocaleDateString("en-CA");
const raw = localStorage.getItem(SHIFT_BASELINE_KEY(todayKey));
const baseline = raw ? JSON.parse(raw) : { sales: 0, orders: 0 };

   const BASE_URL =
  typeof API_URL !== "undefined" && API_URL
    ? API_URL
    : "";

    const res = await fetch(
      `${BASE_URL}/api/orders/admin/summary-today`,
      { cache: "no-store" }
    );

    if (!res.ok) throw new Error("Respuesta no válida del servidor");

    const data = await res.json();

    // ⛔ evita rebote de requests viejos
    if (reqId !== adminSummaryReqIdRef.current) return;

    const uiSales = Math.max(0, data.totalSales - (baseline.sales || 0));
    const uiOrders = Math.max(0, data.totalOrders - (baseline.orders || 0));

    const finalSummary = {
      ...data,
      totalSales: uiSales,
      totalOrders: uiOrders,
    };

    setAdminSummary(finalSummary);
    adminSummaryRef.current = finalSummary;
  } catch (err) {
    console.error(err);
    setSummaryError(err.message || "Error al cargar resumen");
  } finally {
    if (!silent) setLoadingSummary(false);
  }
};

const loadAdminSummary = handleLoadAdminSummary;


// =======================
// PEDIDOS RECIENTES
// =======================
const [recentOrders, setRecentOrders] = useState([]);
const [loadingOrders, setLoadingOrders] = useState(false);
const [ordersError, setOrdersError] = useState("");
const recentOrdersRef = useRef([]);

const getOrderTableLabel = (order) => {
  if (!order) return "N/D";
  if (order.table && (order.table.name || order.table.number))
    return order.table.name || `Mesa ${order.table.number}`;
  if (typeof order.tableName === "string") return order.tableName;
  if (order.tableName && typeof order.tableName === "object")
    return order.tableName.name || `Mesa ${order.tableName.number || order.tableName.id}`;
  if (order.tableNumber || order.tableId) return `Mesa ${order.tableNumber || order.tableId}`;
  return "N/D";
};

const loadRecentOrders = async ({ silent = false } = {}) => {
  try {
    if (!silent) {
      setLoadingOrders(true);
      setOrdersError("");
    }
    const BASE_URL = (typeof API_URL !== "undefined" && API_URL) ? API_URL : "";

    const res = await fetch(`${BASE_URL}/api/orders`, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo cargar el historial");
    const data = await res.json();
    const list = Array.isArray(data) ? data.slice(0, 15) : [];

    const prev = JSON.stringify(recentOrdersRef.current);
    const next = JSON.stringify(list);
    if (prev !== next) {
      recentOrdersRef.current = list;
      setRecentOrders(list);
    }
  } catch (err) {
    console.error(err);
    if (!silent) setOrdersError(err.message || "Error inesperado");
  } finally {
    if (!silent) setLoadingOrders(false);
  }
};

  // =======================
  // INVENTARIO BAJO
  // =======================
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loadingLowStock, setLoadingLowStock] = useState(false);
  const [lowStockError, setLowStockError] = useState("");

  async function loadLowStock() {
    try {
      setLoadingLowStock(true);
      setLowStockError("");
      const res = await fetch(`${API_URL}/api/orders/debug/inventory-items`, { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudo cargar inventario");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
setInventoryOptions(list); // ✅ refresca inventario real para el menú rápido


      const low = list
        .map((item) => ({
          ...item,
          _qty: Number(item.currentStock ?? item.stock ?? item.quantity ?? 0),
        }))
        .filter((i) => i._qty <= 3)
        .sort((a, b) => a._qty - b._qty);
      setLowStockItems(low);
    } catch (err) {
      console.error(err);
      setLowStockError(err.message || "Error al cargar inventario bajo");
    } finally {
      setLoadingLowStock(false);
    }
  }

  // =======================
  // REPORTES DIARIOS (simple)
  // =======================
const [reportFrom, setReportFrom] = useState("");
const [reportTo, setReportTo] = useState("");
const [dailyReports, setDailyReports] = useState([]);
const [loadingReports, setLoadingReports] = useState(false);
const [reportsError, setReportsError] = useState("");

// ✅ NUEVO: REPORTE PRO DEL DUEÑO (KPIs + Top + Ventas por mesa)

const [loadingOwnerReport, setLoadingOwnerReport] = useState(false);
const [ownerError, setOwnerError] = useState("");
const [loadingOwner, setLoadingOwner] = useState(false);

const loadDailyReports = async () => {
  try {
    setLoadingReports(true);
    setReportsError("");

    const params = new URLSearchParams();
    if (reportFrom) params.append("from", reportFrom);
    if (reportTo) params.append("to", reportTo);

    const res = await fetch(
      `${API_URL}/api/reports/daily${params.toString() ? `?${params.toString()}` : ""}`
    );

    if (!res.ok) throw new Error("No se pudo cargar reportes diarios");

    const data = await res.json();
    setDailyReports(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error(err);
    setReportsError(err.message || "Error al cargar reportes diarios");
  } finally {
    setLoadingReports(false);
  }
};

const [ownerReport, setOwnerReport] = useState(null);



// =======================
// REPORTE PRO DEL DUEÑO
// =======================
const loadOwnerReport = async () => {
  try {
    setLoadingOwnerReport(true);
    setOwnerError("");

    // ✅ usa endpoint REAL que sí tienes en orders.routes.js
    const res = await fetch(`${API_URL}/api/orders/admin/summary`, {
      cache: "no-store",
    });

    if (!res.ok) throw new Error("No se pudo cargar el reporte del dueño");

    const data = await res.json();

    const totalSales = Number(data?.totalSales || 0);
    const totalOrders = Number(data?.totalOrders || 0);
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    setOwnerReport({
      kpis: { totalSales, totalOrders, avgTicket },
      topProducts: Array.isArray(data?.topProducts) ? data.topProducts : [],
      salesByTable: Array.isArray(data?.salesByTable) ? data.salesByTable : [],
    });
  } catch (err) {
    console.error(err);
    setOwnerError(err?.message || "Error al cargar reporte del dueño");
    setOwnerReport(null);
  } finally {
    setLoadingOwnerReport(false);
  }
};

  const handleExportDailyReports = () => {
    if (!dailyReports || dailyReports.length === 0) return alert("No hay reportes para exportar.");

    const header = ["Fecha", "Ventas", "Pedidos", "TicketPromedio"];
    const rows = dailyReports.map((r) => {
      const fecha = r.date || r.fecha || r.day || r.dayLabel || "";
      const ventas = Number(r.totalSales || r.total || 0).toFixed(2);
      const pedidos = Number(r.orders || r.pedidos || r.totalOrders || 0);
      const ticket = Number(r.avgTicket || r.ticketProm || r.ticket || 0).toFixed(2);
      return [fecha, ventas, pedidos, ticket];
    });

    const csvRows = [header, ...rows].map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    );
    const csvContent = csvRows.join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `reportes-diarios-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // =======================
  // CAJA (modal simple)
  // =======================
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashCount, setCashCount] = useState("");
  const [cashMoves, setCashMoves] = useState([]);
const [showCloseDayModal, setShowCloseDayModal] = useState(false);





const dayStamp = new Date().toDateString(); // cambia cuando cambia el día (en el próximo render)
const todayKey = useMemo(() => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}, [dayStamp]);

 
// keys por día (NO redefinir CASH_MOVES_KEY aquí)
const cashMovesKeyToday = CASH_MOVES_KEY(todayKey);
const shiftBaselineKeyToday = SHIFT_BASELINE_KEY(todayKey);


  useEffect(() => {
    try {
      const raw = localStorage.getItem(cashMovesKeyToday);

      if (raw) setCashMoves(JSON.parse(raw));
    } catch {}
  }, [CASH_MOVES_KEY]);

  useEffect(() => {
    try {
      localStorage.setItem(cashMovesKeyToday, JSON.stringify(moves));
    } catch {}
  }, [cashMoves, CASH_MOVES_KEY]);

  const sumIn = cashMoves
    .filter((m) => m.type === "in")
    .reduce((acc, m) => acc + Number(m.amount || 0), 0);
  const sumOut = cashMoves
    .filter((m) => m.type === "out")
    .reduce((acc, m) => acc + Number(m.amount || 0), 0);
  const netMoves = sumIn - sumOut;

useEffect(() => {
  const { from, to } = getAutoRange(7); // 🔥 PRO: últimos 7 días
  loadDailyReports(from, to);
}, []);



const totalSales = Math.max(
  0,
  Number(adminSummary?.totalSales || 0)
);


  const expectedCash = totalSales + netMoves;
  const counted = Number(String(cashCount || "0").replace(/[^\d.]/g, "")) || 0;
  const diff = counted - expectedCash;

  const addCashMove = (type) => {
    const label = type === "in" ? "Entrada" : "Salida";
    const a = window.prompt(`${label} de caja (MXN)`);
    if (!a) return;
    const amount = Number(String(a).replace(/[^\d.]/g, ""));
    if (!amount || amount <= 0) return;
    const note = window.prompt(`Nota de ${label.toLowerCase()} (opcional)`) || "";
    setCashMoves((prev) => [
      {
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        type,
        amount,
        note: String(note).slice(0, 140),
        ts: Date.now(),
      },
      ...prev,
    ]);
  };

  const removeCashMove = (id) => setCashMoves((prev) => prev.filter((m) => m.id !== id));

// ======================
// REPORTES (cierre de día)
// ======================
const REPORTS_KEY = "pos_reports_v1"; // <-- este será el “historial de cierres”




const buildCloseDayReport = () => {
  const now = new Date();
  const ventas = Number(adminSummary?.ventasTotal ?? 0);
  const pedidos = Number(adminSummary?.ordersCount ?? 0);

  const efectivoContado = Number(cashCount || 0);

  const entradas = (cashMoves || [])
    .filter((m) => m.type === "in")
    .reduce((a, b) => a + Number(b.amount || 0), 0);

  const salidas = (cashMoves || [])
    .filter((m) => m.type === "out")
    .reduce((a, b) => a + Number(b.amount || 0), 0);

  return {
    id: `${todayKey}-${now.getTime()}`,
    dateKey: todayKey,
    createdAt: now.toISOString(),
    ventas,
    pedidos,
    efectivoContado,
    entradas,
    salidas,
    movimientos: cashMoves || [],
    nota: cashNote || "",
  };
};


  // =======================
  // INIT + AUTOREFRESH
  // =======================
  useEffect(() => {
    loadAreas();
    loadInventoryOptions();
    loadLowStock();
    // No cargamos summary en automático para no “asustar”; pero sí puedes:
    // loadAdminSummary();
    window.dispatchInventoryRefresh = () => {
  loadInventoryOptions();
  loadLowStock();
};
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      loadRecentOrders({ silent: true });
      if (adminSummaryRef.current) loadAdminSummary({ silent: true });
    }, 30000);
    return () => clearInterval(id);
  }, []);

const handleCopyCashCut = async () => {
  try {
    const totalCash = Number(cashCount || 0);
    const totalIn = (cashMoves || [])
      .filter((m) => (m?.type || "") === "in")
      .reduce((a, m) => a + Number(m?.amount || 0), 0);
    const totalOut = (cashMoves || [])
      .filter((m) => (m?.type || "") === "out")
      .reduce((a, m) => a + Number(m?.amount || 0), 0);

    const text =
` CORTE / CIERRE DE TURNO
 ${todayKey}

 Efectivo contado: $${totalCash.toFixed(2)}
 Entradas: $${totalIn.toFixed(2)}
 Salidas/Gastos: $${totalOut.toFixed(2)}

 Neto (contado + entradas - salidas): $${(totalCash + totalIn - totalOut).toFixed(2)}
`;

    await navigator.clipboard.writeText(text);
    alert("✅ Corte copiado. Pégalo en WhatsApp.");
  } catch (e) {
    console.error(e);
    alert("❌ No se pudo copiar. Revisa permisos del navegador.");
  }
};

const openCloseDayModal = () => {
  if (!isAdmin) {
    alert("⛔ Solo el administrador puede cerrar el turno");
    return;
  }
  setShowCloseDayModal(true);
};

const closeCloseDayModal = () => {
  setShowCloseDayModal(false);
};

// ✅ WhatsApp: Resumen REAL del día (lee backend /api/reports/today)
const handleSendWhatsAppDailySummary = async () => {
  try {
    // 1) Traer reporte real del día (ventas + pagos por método)
    const res = await fetch(`${API_URL}/api/reports/today`);
    if (!res.ok) {
      alert("No se pudo leer el reporte del día");
      return;
    }
    const todayReport = await res.json();

    // 2) Pedir número
    const phone = prompt("Número de WhatsApp (con lada, ej. 521XXXXXXXXXX):");
    if (!phone) return;

    // 3) Formateo
    const fmtMoney = (n) =>
      new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
        Number(n || 0)
      );

    const totalOrders = Number(todayReport.totalOrders || 0);
    const totalSales = Number(todayReport.totalSales || 0);

    // 👇 ESTO ES LO IMPORTANTE (métodos de pago)
    const cash = Number(todayReport.paymentCash || 0);
    const card = Number(todayReport.paymentCard || 0);
    const transfer = Number(todayReport.paymentTransfer || 0);

    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    // 4) Mensaje PRO
    const now = new Date();
    const fecha = now.toLocaleDateString("es-MX");
    const hora = now.toLocaleTimeString("es-MX");

    const message = `
💳 CORTE DE CAJA — POS MULTI BAR
📅 Fecha: ${fecha}
🕒 Hora: ${hora}

━━━━━━━━━━━━━━━━━━
🧾 Pedidos: ${totalOrders}
💰 Ventas totales: ${fmtMoney(totalSales)}

💵 Efectivo: ${fmtMoney(cash)}
💳 Tarjeta: ${fmtMoney(card)}
🏦 Transferencia: ${fmtMoney(transfer)}

🎯 Ticket promedio: ${fmtMoney(avgTicket)}
━━━━━━━━━━━━━━━━━━
POS Mini-App PRO
`.trim();

    // 5) Abrir WhatsApp con el texto
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    console.error(e);
    alert("No se pudo enviar WhatsApp. Revisa consola.");
  }
};



// ======================
// CERRAR DÍA (corte + cerrar turno)
// ======================
async function handleCloseDay() {
  if (!isAdmin) {
    alert("⛔ Solo el administrador puede cerrar el día");
    return;
  }

  const ok = confirm(
    "¿Cerrar día?\n\nEsto hará corte (ventas/pedidos a 0) y limpiará caja."
  );
  if (!ok) return;

// ✅ 0) Generar corte en backend (esto llena DailyReport)
try {
  const res = await fetch(`${API_URL}/api/reports/close-day`, { method: "POST" });
  if (!res.ok) throw new Error("No se pudo generar el corte en el servidor");
} catch (e) {

  alert("⚠️ No se generó el corte en servidor. Revisa backend.\n" + (e.message || ""));
  return; // ⛔ no limpies nada si no se guardó el corte
}


  const todayKey = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local

  try {
    // 1) Traer resumen real DEL DÍA (antes del corte)
  b

    if (!res.ok) throw new Error("No se pudo leer resumen para cierre");

    const data = await res.json();
    const backendSales = Number(data?.totalSales || 0);
    const backendOrders = Number(data?.totalOrders || 0);

    // 2) Guardar baseline (shift) = “hasta aquí quedó el día”
    localStorage.setItem(
      SHIFT_BASELINE_KEY(todayKey),
      JSON.stringify({
        sales: backendSales,
        orders: backendOrders,
        closedAt: new Date().toISOString(),
      })
    );

    // 3) Limpiar caja del día (por key del día)
    localStorage.removeItem(CASH_MOVES_KEY(todayKey));
    setCashMoves([]);
    setCashCount("");

    // 4) (Opcional) endpoint de cierre
try {
  await fetch(
    `${import.meta.env.VITE_API_URL}/api/orders/close-day`,
    { method: "POST" }
  );
} catch {}


    // 5) Refrescar resumen (ya debe dar 0/0 por baseline)
    await handleLoadAdminSummary();

    alert("✅ Día cerrado. Ventas/Pedidos reiniciados y caja limpia.");
  } catch (err) {
    console.error(err);
    alert("❌ No se pudo cerrar el día.");
  }
}

const handleMenuFieldChange = (id, field, value) => {
  setQuickProducts((prev) => {
    const updated = prev.map((p) =>
      p.id === id ? { ...p, [field]: value } : p
    );
    try {
      localStorage.setItem("pos_quick_products", JSON.stringify(updated));
    } catch {}
    return updated;
  });
};

useEffect(() => {
  if (!isAdmin) {
    setActiveTab("mesas");
  }
}, [isAdmin]);


  // =======================
  // RENDER
  // =======================
  return (
    <LoginGate>
      <PosShell
        appName="POS"
        subtitle="Panel interno"
        topbarLeft={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="logo"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  objectFit: "cover",
                  border: "1px solid rgba(148,163,184,0.25)",
                }}
              />
            ) : null}
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>POS Multi Bar</h1>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
                Panel de control — Áreas, mesas y ventas
              </p>
            </div>
          </div>
        }
        topRight={null}
  sidebarItems={[
  // ✅ SOLO ADMIN
  ...(isAdmin
    ? [
        {
          key: "home",
          label: "Inicio",
          icon: "⌂",
          active: activeTab === "home",
          onClick: () => setActiveTab("home"),
        },
      ]
    : []),

  // ✅ ADMIN + MESERO (SIEMPRE)
  {
    key: "mesas",
    label: "Mesas",
    icon: "▦",
    active: activeTab === "mesas",
    onClick: () => setActiveTab("mesas"),
  },

  // ✅ SOLO ADMIN
  ...(isAdmin
    ? [
        {
          key: "ventas",
          label: "Ventas",
          icon: "$",
          active: activeTab === "ventas",
          onClick: () => setActiveTab("ventas"),
        },
        {
          key: "reportes",
          label: "Reportes",
          icon: "📊",
          active: activeTab === "reportes",
          onClick: () => setActiveTab("reportes"),
        },
        {
          key: "invent",
          label: "Inventario",
          icon: "⛁",
          active: activeTab === "invent",
          onClick: () => setActiveTab("invent"),
        },
        {
          key: "ajustes",
          label: "Ajustes",
          icon: "⚙",
          active: activeTab === "ajustes",
          onClick: () => setActiveTab("ajustes"),
        },
      ]
    : []),
]}

      >
        {/* ===== PIN /mesero ===== */}
        {isMeseroRoute && !meseroPinOk && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(2,6,23,0.92)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 360,
                borderRadius: 16,
                border: "1px solid rgba(148,163,184,0.35)",
                backgroundColor: "rgba(15,23,42,0.98)",
                padding: 14,
              }}
            >
              <p style={{ margin: 0, fontWeight: 900, fontSize: 14 }}>Modo mesero 🔒</p>
              <p style={{ margin: "6px 0 10px", fontSize: 12, opacity: 0.85 }}>
                Ingresa PIN para continuar
              </p>

              <input
                inputMode="numeric"
                value={meseroPinInput}
                onChange={(e) => {
                  setMeseroPinError("");
                  setMeseroPinInput(e.target.value);
                }}
                placeholder="PIN"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.35)",
                  backgroundColor: "rgba(2,6,23,0.6)",
                  color: "#e5e7eb",
                  fontSize: 14,
                  outline: "none",
                }}
              />

              {!!meseroPinError && (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#fecaca" }}>
                  {meseroPinError}
                </p>
              )}

              <button
                type="button"
                onClick={verifyMeseroPin}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(34,197,94,0.8)",
                  background:
                    "linear-gradient(135deg, rgba(34,197,94,0.16), rgba(34,197,94,0.35))",
                  color: "#bbf7d0",
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Entrar
              </button>
            </div>
          </div>
        )}

        {/* ===== TURNO GLOBAL (bloqueo mesero) ===== */}
        {userRole === ROLES.MESERO && !turnoGlobalAbierto && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9998,
              background: "rgba(2,6,23,0.72)",
              display: "grid",
              placeItems: "center",
              padding: 16,
            }}
          >
            <div
              style={{
                width: "min(520px, 92vw)",
                borderRadius: 18,
                background: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(15,23,42,0.10)",
                boxShadow: "0 22px 60px rgba(2,6,23,0.30)",
                padding: 16,
              }}
            >
              <div style={{ fontWeight: 1000, fontSize: 16 }}>Turno cerrado</div>
              <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13, fontWeight: 700 }}>
                Espera a que el administrador abra el turno para continuar.
              </div>

              <button
                type="button"
                onClick={bounceToLogin}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "12px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: "white",
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                Volver al inicio
              </button>
            </div>
          </div>
        )}

        
{showCloseModal && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "rgba(2,6,23,0.82)",
      display: "grid",
      placeItems: "center",
      padding: 16,
    }}
    onMouseDown={(e) => {
      if (e.target === e.currentTarget) setShowCloseModal(false);
    }}
  >
    <div
      style={{
        width: "min(420px, 96vw)",
        borderRadius: 16,
        border: "1px solid rgba(148,163,184,0.35)",
        background: "radial-gradient(circle at top left, #0f172a, #020617)",
        padding: 16,
        color: "#e5e7eb",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 10 }}>Cerrar cuenta</h3>

      {/* Métodos de pago */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        {["CASH", "CARD", "TRANSFER"].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setClosePaymentMethod(m)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border:
                closePaymentMethod === m
                  ? "2px solid #22c55e"
                  : "1px solid rgba(148,163,184,0.4)",
              background:
                closePaymentMethod === m
                  ? "rgba(34,197,94,0.15)"
                  : "transparent",
              color: "#e5e7eb",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {m === "CASH" && "💵 Efectivo"}
            {m === "CARD" && "💳 Tarjeta"}
            {m === "TRANSFER" && "🔁 Transferencia"}
          </button>
        ))}
      </div>

      {/* Referencia */}
      {closePaymentMethod === "TRANSFER" && (
        <input
          type="text"
          placeholder="Referencia"
          value={closePaymentRef}
          onChange={(e) => setClosePaymentRef(e.target.value)}
          style={{
            width: "100%",
            marginBottom: 10,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.4)",
            background: "rgba(2,6,23,0.6)",
            color: "#e5e7eb",
          }}
        />
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => setShowCloseModal(false)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.4)",
            background: "transparent",
            color: "#e5e7eb",
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>

        <button
          type="button"
          disabled={closingTable}
          onClick={async () => {
if (!isTurnoAbierto()) {
  alert("⛔ Turno cerrado. Abre turno para cobrar.");
  return;
}
            try {
              setClosingTable(true);
              await fetch(
                `${API_URL}/api/orders/close-table/${selectedTable.id}`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    paymentMethod: closePaymentMethod,
                    paymentRef:
                      closePaymentMethod === "TRANSFER"
                        ? closePaymentRef
                        : "",
                  }),
                }
              );

              alert("✅ Cuenta cerrada");
setOpenTableIds((prev) => {
  const next = new Set(prev);
  next.delete(selectedTable.id);
  return next;
});

              setShowCloseModal(false);
              setClosePaymentRef("");
              setClosePaymentMethod("CASH");

              // limpia la mesa en frontend
              setOrdersByTable((prev) => ({
                ...prev,
                [selectedTable.id]: { items: [] },
              }));
            } catch (err) {
              console.error(err);
              alert("❌ Error al cerrar cuenta");
            } finally {
              setClosingTable(false);
            }
          }}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid #22c55e",
            background: "rgba(34,197,94,0.2)",
            color: "#e5e7eb",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Confirmar pago
        </button>
      </div>
    </div>
  </div>
)}


{/* ===== MODAL CAJA (admin) ===== */}
        {showCashModal && isAdmin && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9997,
              background: "rgba(2,6,23,0.82)",
              display: "grid",
              placeItems: "center",
              padding: 16,
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowCashModal(false);
            }}
          >
            <div
              style={{
                width: "min(760px, 96vw)",
                borderRadius: 20,
                border: "1px solid rgba(148,163,184,0.35)",
                background:
                  "radial-gradient(circle at top left, rgba(15,23,42,0.98), rgba(2,6,23,0.95))",
                boxShadow: "0 28px 80px rgba(0,0,0,0.55)",
                padding: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 1000, fontSize: 14 }}>Caja del día</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    Entradas/Salidas + conteo vs esperado
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCashModal(false)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.5)",
                    background: "transparent",
                    color: "var(--pos-text, #e5e7eb)",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Cerrar
                </button>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                <SummaryChip label="Ventas (según resumen)" value={fmtMoney(totalSales)} />
                <SummaryChip label="Movimientos netos" value={fmtMoney(netMoves)} />
                <SummaryChip label="Efectivo esperado" value={fmtMoney(expectedCash)} />
                <SummaryChip label="Diferencia" value={fmtMoney(diff)} />
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => addCashMove("in")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(34,197,94,0.85)",
                    background: "rgba(34,197,94,0.12)",
                    color: "#bbf7d0",
                    fontWeight: 900,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  + Entrada
                </button>
                <button
                  type="button"
                  onClick={() => addCashMove("out")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(239,68,68,0.85)",
                    background: "rgba(239,68,68,0.10)",
                    color: "#fecaca",
                    fontWeight: 900,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  - Salida
                </button>

                <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, opacity: 0.85 }}>Efectivo contado:</span>
                  <input
                    value={cashCount}
                    onChange={(e) => setCashCount(e.target.value)}
                    placeholder="0"
                    style={{
                      width: 140,
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,0.35)",
                      background: "rgba(2,6,23,0.55)",
                      color: "#e5e7eb",
                      outline: "none",
                      fontSize: 12,
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                {cashMoves.length === 0 ? (
                  <p style={{ fontSize: 12, opacity: 0.75 }}>Sin movimientos capturados.</p>
                ) : (
                  <div
                    style={{
                      maxHeight: 260,
                      overflow: "auto",
                      borderRadius: 14,
                      border: "1px solid rgba(148,163,184,0.25)",
                      background: "rgba(2,6,23,0.35)",
                    }}
                  >
                    {cashMoves.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "10px 10px",
                          borderBottom: "1px solid rgba(30,41,59,0.8)",
                          fontSize: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {m.type === "in" ? "Entrada" : "Salida"} — {fmtMoney(m.amount)}
                          </div>
                          <div style={{ opacity: 0.75 }}>
                            {m.note || "(sin nota)"} ·{" "}
                            {new Date(m.ts).toLocaleString("es-MX", { hour12: false })}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCashMove(m.id)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 999,
                            border: "1px solid var(--pos-danger, #ef4444)",
                            background: "transparent",
                            color: "var(--pos-danger, #ef4444)",
                            cursor: "pointer",
                            fontWeight: 900,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== HOME ===== */}
        {activeTab === "home" && (
          <>
            <Section title="Resumen del dueño">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
  <button
    onClick={handleLoadAdminSummary}
    style={{
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(148,163,184,0.6)",
      backgroundColor: "rgba(15,23,42,0.9)",
      color: "var(--pos-text, #e5e7eb)",
      fontSize: 12,
      cursor: "pointer",
      fontWeight: 600,
    }}
  >
    Actualizar resumen
  </button>

  <button
    onClick={handleCopyCashCut}
    style={{
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(34,197,94,0.8)",
      background:
        "linear-gradient(135deg, rgba(34,197,94,0.16), rgba(34,197,94,0.35))",
      color: "#bbf7d0",
      fontSize: 12,
      cursor: "pointer",
      fontWeight: 700,
    }}
  >
    Copiar corte
  </button>

<button
  onClick={handleSendWhatsAppDailySummary}
  style={{
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.6)",
    background: "rgba(34,197,94,0.15)",
    color: "#bbf7d0",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  }}
>
  Enviar WhatsApp
</button>



  {/* ✅ TURNO GLOBAL (solo Admin) */}
  {isAdmin && (
    <>
      {turnoGlobalAbierto ? (
        <button
          onClick={cerrarTurnoGlobal}
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid rgba(239,68,68,0.8)",
            background:
              "linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.25))",
            color: "#fecaca",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Cerrar turno
        </button>
      ) : (
        <button
          onClick={abrirTurnoGlobal}
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid rgba(34,197,94,0.9)",
            background:
              "linear-gradient(135deg, rgba(34,197,94,0.16), rgba(34,197,94,0.35))",
            color: "#bbf7d0",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Abrir turno
        </button>
      )}
    </>
  )}

  <button
    onClick={handleCloseDay}
    style={{
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(239,68,68,0.8)",
      background:
        "linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.25))",
      color: "#fecaca",
      fontSize: 12,
      cursor: "pointer",
      fontWeight: 700,
    }}
  >
    Cerrar día
  </button>

  {/* Estado visual del turno */}
  <div
    style={{
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(148,163,184,0.35)",
      backgroundColor: turnoGlobalAbierto ? "rgba(22,163,74,0.18)" : "rgba(239,68,68,0.12)",
      color: "var(--pos-text, #e5e7eb)",
      fontSize: 11,
      fontWeight: 900,
      alignSelf: "center",
    }}
  >
    Turno: {turnoGlobalAbierto ? "ABIERTO" : "CERRADO"}
  </div>
</div>


              {loadingSummary && <p style={{ fontSize: 12, opacity: 0.8 }}>Cargando…</p>}
              {!!summaryError && <p style={{ fontSize: 12, color: "#fecaca" }}>{summaryError}</p>}

              {adminSummary ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      border: "1px solid rgba(148,163,184,0.35)",
                      backgroundColor: "rgba(2,6,23,0.35)",
                    }}
                  >
                    <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
                      Ventas acumuladas
                    </p>
                    <p style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
                      {fmtMoney(adminSummary.totalSales)}
                    </p>
                  </div>

                  <div
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      border: "1px solid rgba(148,163,184,0.35)",
                      backgroundColor: "rgba(2,6,23,0.35)",
                    }}
                  >
                    <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Pedidos</p>
                    <p style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
                      {Number(adminSummary.totalOrders || 0)}
                    </p>
                  </div>

                  <div
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      border: "1px solid rgba(148,163,184,0.35)",
                      backgroundColor: "rgba(2,6,23,0.35)",
                    }}
                  >
                    <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>Top productos</p>
                    {Array.isArray(adminSummary.topProducts) && adminSummary.topProducts.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {adminSummary.topProducts.slice(0, 6).map((p, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12 }}>{p.name}</span>
                            <span style={{ fontSize: 12, opacity: 0.85 }}>{p.qty} uds</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, opacity: 0.75, margin: 0 }}>Sin datos</p>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 12, opacity: 0.75 }}>
                  Pulsa <strong>Actualizar resumen</strong> para ver ventas y top productos.
                </p>
              )}
            </Section>

            <Section title="Inventario bajo (vista rápida)">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <button
                  onClick={loadLowStock}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.6)",
                    backgroundColor: "rgba(15,23,42,0.9)",
                    color: "var(--pos-text, #e5e7eb)",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  Actualizar inventario
                </button>
              </div>

              {loadingLowStock && <p style={{ fontSize: 12, opacity: 0.8 }}>Cargando…</p>}
              {!!lowStockError && (
                <p style={{ fontSize: 12, color: "var(--pos-danger, #ef4444)" }}>{lowStockError}</p>
              )}

              {!loadingLowStock && (!lowStockItems || lowStockItems.length === 0) ? (
                <p style={{ fontSize: 12, opacity: 0.8 }}>
                  No hay productos en nivel crítico (≤ 3 piezas).
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 8,
                  }}
                >
                  {lowStockItems.slice(0, 8).map((item) => (
                    <div
                      key={item.id || item.name}
                      style={{
                        borderRadius: 12,
                        padding: "8px 10px",
                        border: "1px solid rgba(248,113,113,0.6)",
                        backgroundColor: "rgba(127,29,29,0.30)",
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>{item.name || item.productName}</div>
                      <div style={{ opacity: 0.9 }}>Stock: <strong>{item._qty}</strong></div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}

        {/* ===== MESAS ===== */}
        {activeTab === "mesas" && (
          <>
            <Section title="Áreas y mesas">
              {loadingAreas && <p style={{ fontSize: 12, opacity: 0.8 }}>Cargando áreas…</p>}
              {!!areasError && <p style={{ fontSize: 12, color: "#fecaca" }}>{areasError}</p>}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <p style={{ fontSize: 12, opacity: 0.8, margin: 0 }}>
                  Selecciona una mesa para comenzar un pedido.
                </p>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => setShowAreaForm((v) => !v)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,0.6)",
                      backgroundColor: "rgba(15,23,42,0.9)",
                      color: "var(--pos-text, #e5e7eb)",
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: 800,
                    }}
                  >
                    {showAreaForm ? "Cerrar nueva área" : "Nueva área / salón"}
                  </button>

                  <button
                    onClick={loadAreas}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,0.6)",
                      backgroundColor: "transparent",
                      color: "var(--pos-text, #e5e7eb)",
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: 800,
                    }}
                  >
                    Refrescar
                  </button>
                </div>
              </div>

              {showAreaForm && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: 10,
                    borderRadius: 12,
                    border: "1px dashed rgba(148,163,184,0.6)",
                    backgroundColor: "rgba(15,23,42,0.9)",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      placeholder="Nombre del área (ej. Terraza, Barra)"
                      value={newAreaName}
                      onChange={(e) => setNewAreaName(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: 180,
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid rgba(75,85,99,0.9)",
                        backgroundColor: "rgba(15,23,42,0.95)",
                        color: "var(--pos-text, #e5e7eb)",
                        fontSize: 12,
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Descripción (opcional)"
                      value={newAreaDescription}
                      onChange={(e) => setNewAreaDescription(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: 160,
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid rgba(75,85,99,0.9)",
                        backgroundColor: "rgba(15,23,42,0.95)",
                        color: "var(--pos-text, #e5e7eb)",
                        fontSize: 12,
                      }}
                    />
                  </div>

                  <button
                    onClick={handleCreateArea}
                    disabled={creatingArea}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: "1px solid var(--pos-primary, #22c55e)",
                      background:
                        "linear-gradient(135deg, var(--pos-primary-soft, rgba(34,197,94,0.2)), rgba(15,23,42,1))",
                      color: "#bbf7d0",
                      fontSize: 11,
                      cursor: "pointer",
                      opacity: creatingArea ? 0.6 : 1,
                      fontWeight: 900,
                    }}
                  >
                    {creatingArea ? "Creando…" : "Guardar nueva área"}
                  </button>
                </div>
              )}

              {areas.length === 0 ? (
                <p style={{ fontSize: 12, opacity: 0.8 }}>
                  Aún no hay áreas registradas. Crea tu primera área para empezar.
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 12,
                  }}
                >
                  {areas.map((area) => (
                    <div
                      key={area.id}
                      style={{
                        borderRadius: 14,
                        padding: 10,
                        background:
                          "radial-gradient(circle at top left, rgba(15,23,42,0.95), rgba(15,23,42,0.98))",
                        border: "1px solid rgba(148,163,184,0.35)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          {editingAreaId === area.id ? (
                            <>
                              <input
                                value={editingAreaName}
                                onChange={(e) => setEditingAreaName(e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: 10,
                                  border: "1px solid rgba(148,163,184,0.55)",
                                  background: "rgba(2,6,23,0.35)",
                                  color: "#e5e7eb",
                                  fontSize: 12,
                                  marginBottom: 6,
                                }}
                              />
                              <input
                                value={editingAreaDescription}
                                onChange={(e) => setEditingAreaDescription(e.target.value)}
                                placeholder="Descripción"
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: 10,
                                  border: "1px solid rgba(148,163,184,0.30)",
                                  background: "rgba(2,6,23,0.35)",
                                  color: "#e5e7eb",
                                  fontSize: 12,
                                }}
                              />
                            </>
                          ) : (
                            <>
                              <div style={{ fontWeight: 900 }}>{area.name}</div>
                              {area.description ? (
                                <div style={{ fontSize: 11, opacity: 0.75 }}>{area.description}</div>
                              ) : null}
                            </>
                          )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {editingAreaId === area.id ? (
                            <>
                              <button
                                onClick={handleSaveAreaEdit}
                                disabled={savingArea}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 999,
                                  border: "1px solid rgba(34,197,94,0.85)",
                                  background: "rgba(34,197,94,0.12)",
                                  color: "#bbf7d0",
                                  cursor: "pointer",
                                  fontSize: 11,
                                  fontWeight: 900,
                                  opacity: savingArea ? 0.6 : 1,
                                }}
                              >
                                {savingArea ? "Guardando…" : "Guardar"}
                              </button>
                              <button
                                onClick={handleCancelEditArea}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 999,
                                  border: "1px solid rgba(148,163,184,0.5)",
                                  background: "transparent",
                                  color: "#e5e7eb",
                                  cursor: "pointer",
                                  fontSize: 11,
                                  fontWeight: 900,
                                }}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              {canManage && (
                                <>
                                  <button
                                    onClick={() => handleStartEditArea(area)}
                                    style={{
                                      padding: "6px 10px",
                                      borderRadius: 999,
                                      border: "1px solid rgba(148,163,184,0.5)",
                                      background: "transparent",
                                      color: "#e5e7eb",
                                      cursor: "pointer",
                                      fontSize: 11,
                                      fontWeight: 900,
                                    }}
                                  >
                                    Editar
                                  </button>

                                  <button
                                    onClick={() => handleAddTableToArea(area)}
                                    style={{
                                      padding: "6px 10px",
                                      borderRadius: 999,
                                      border: "1px solid rgba(34,197,94,0.85)",
                                      background: "rgba(34,197,94,0.12)",
                                      color: "#bbf7d0",
                                      cursor: "pointer",
                                      fontSize: 11,
                                      fontWeight: 900,
                                    }}
                                  >
                                    + Mesa
                                  </button>

                                  <button
                                    onClick={() => handleDeleteArea(area.id)}
                                    style={{
                                      padding: "6px 10px",
                                      borderRadius: 999,
                                      border: "1px solid rgba(239,68,68,0.8)",
                                      background: "rgba(239,68,68,0.10)",
                                      color: "#fecaca",
                                      cursor: "pointer",
                                      fontSize: 11,
                                      fontWeight: 900,
                                    }}
                                  >
                                    Eliminar
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                        {(area.tables || []).length === 0 ? (
                          <p style={{ fontSize: 11, opacity: 0.7 }}>Sin mesas.</p>
                        ) : (
                          (area.tables || []).map((table) => {
                            const current = ordersByTable[table.id] || { items: [] };
                          const hasItems =
  (current.items && current.items.length > 0) || openTableIds.has(table.id);

                            const selected = isSelected(area.id, table.id);

                            return (
                             <button
    key={table.id}
    onClick={() => handleSelectTable(area, table)}
    style={{
      padding: "6px 10px",
      borderRadius: 999,
      border: selected
        ? "1px solid var(--pos-primary, #22c55e)"
        : "1px solid rgba(148,163,184,0.6)",
      backgroundColor: selected
        ? "rgba(22,163,74,0.28)"
        : hasItems
        ? "rgba(30,64,175,0.25)"
        : "rgba(15,23,42,0.96)",
      color: "var(--pos-text, #e5e7eb)",
      fontSize: 11,
      cursor: "pointer",
      fontWeight: 800,
    }}
  >
    {table.name}

    {hasItems ? (
      <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.85 }}>
        ({current.items.length})
      </span>
    ) : null}

    {/* ✅ Botón/badge QR (sin envolver nada) */}
    <span
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setQrTarget({ areaId: area.id, table });
      }}
      title="Ver QR"
      style={{
        marginLeft: 8,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid rgba(148,163,184,0.55)",
        background: "rgba(0,0,0,0.15)",
        fontSize: 10,
        fontWeight: 900,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      QR
    </span>
  </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

{qrTarget && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "rgba(2,6,23,0.82)",
      display: "grid",
      placeItems: "center",
      padding: 16,
    }}
    onMouseDown={(e) => {
      if (e.target === e.currentTarget) setQrTarget(null);
    }}
  >
    {/* estilo impresión: imprime SOLO el QR */}
    <style>{`
      @media print {
        body * { visibility: hidden !important; }
        #print-qr, #print-qr * { visibility: visible !important; }
        #print-qr { position: fixed; inset: 0; display: grid; place-items: center; }
      }
    `}</style>

    <div
      id="print-qr"
      style={{
        width: "min(520px, 96vw)",
        borderRadius: 18,
        border: "1px solid rgba(148,163,184,0.35)",
        background: "white",
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 800, color: "#0f172a" }}>
          QR — {qrTarget?.table?.name || "Mesa"}
        </div>
        <button
          type="button"
          onClick={() => setQrTarget(null)}
          style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc" }}
        >
          Cerrar
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <TableQRCode areaId={qrTarget.areaId} tableId={qrTarget.table.id} size={260} />
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
        <button
          type="button"
          onClick={handlePrintQR}
          style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #94a3b8", background: "#0f172a", color: "white" }}
        >
          Imprimir
        </button>
      </div>
    </div>
  </div>
)}

{selectedTable && currentOrder.items.length > 0 && (
  <button
  type="button"
  onClick={handleCloseTable}
  style={{
    padding: "10px 18px",
    borderRadius: 14,
    border: "1px solid rgba(34,197,94,0.55)",
    background:
      "linear-gradient(180deg, rgba(34,197,94,0.25), rgba(22,163,74,0.15))",
    color: "#e5e7eb",
    fontWeight: 900,
    letterSpacing: 0.3,
    cursor: "pointer",
    boxShadow:
      "0 10px 24px rgba(34,197,94,0.25), inset 0 0 0 1px rgba(34,197,94,0.15)",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "translateY(-1px)";
    e.currentTarget.style.boxShadow =
      "0 14px 30px rgba(34,197,94,0.35), inset 0 0 0 1px rgba(34,197,94,0.25)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow =
      "0 10px 24px rgba(34,197,94,0.25), inset 0 0 0 1px rgba(34,197,94,0.15)";
  }}
>
  💳 Cerrar cuenta
</button>

)}


            <Section title="Pedido actual">
              {!selectedTable ? (
                <p style={{ fontSize: 12, opacity: 0.8 }}>
                  Selecciona una mesa arriba para comenzar.
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
                    gap: 10,
                  }}
                >
                  <div>
                    <p style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}>
                      Mesa: <strong>{selectedTable?.name}</strong>
                    </p>

                    {!currentOrder.items || currentOrder.items.length === 0 ? (
                      <p style={{ fontSize: 12, opacity: 0.8 }}>Aún no hay productos.</p>
                    ) : (
                      <div
                        style={{
                          borderRadius: 12,
                          border: "1px solid rgba(148,163,184,0.35)",
                          backgroundColor: "rgba(15,23,42,0.98)",
                        }}
                      >
                       {currentOrder.items.map((item, idx) => (
  <div
    key={`${item.productId ?? item.name ?? "item"}-${idx}`}

                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 10px",
                              borderBottom: "1px solid rgba(30,41,59,0.9)",
                              gap: 10,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 800 }}>
                                {item.displayName || item.name}
                              </div>
                              <div style={{ fontSize: 11, opacity: 0.75 }}>
                                {fmtMoney(item.price)} x {item.qty}
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <button
                                onClick={() => handleChangeQty(item.productId, -1)}
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 999,
                                  border: "1px solid rgba(148,163,184,0.7)",
                                  background: "transparent",
                                  color: "#e5e7eb",
                                  cursor: "pointer",
                                  fontWeight: 900,
                                }}
                              >
                                -
                              </button>
                              <span style={{ minWidth: 20, textAlign: "center", fontSize: 12 }}>
                                {item.qty}
                              </span>
                              <button
                                onClick={() => handleChangeQty(item.productId, 1)}
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 999,
                                  border: "1px solid var(--pos-primary, #22c55e)",
                                  background: "rgba(22,163,74,0.22)",
                                  color: "#bbf7d0",
                                  cursor: "pointer",
                                  fontWeight: 900,
                                }}
                              >
                                +
                              </button>
                              <button
                                onClick={() => handleRemoveItem(item.productId)}
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 999,
                                  border: "1px solid var(--pos-danger, #ef4444)",
                                  background: "transparent",
                                  color: "var(--pos-danger, #ef4444)",
                                  cursor: "pointer",
                                  fontWeight: 900,
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}

                        <div
                          style={{
                            padding: "10px 10px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 900 }}>Total</div>
                          <div style={{ fontSize: 15, fontWeight: 1000 }}>
                            {fmtMoney(currentTotal)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

    





        



 <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button
                      onClick={handleSaveOrder}
                      disabled={savingOrder || !currentOrder.items || currentOrder.items.length === 0}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid var(--pos-primary, #22c55e)",
                        background:
                          "linear-gradient(135deg, var(--pos-primary-soft, rgba(34,197,94,0.30)), rgba(15,23,42,1))",
                        color: "#bbf7d0",
                        fontSize: 13,
                        fontWeight: 1000,
                        cursor:
                          !currentOrder.items || currentOrder.items.length === 0
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          !currentOrder.items || currentOrder.items.length === 0 ? 0.5 : 1,
                      }}
                    >
                      {savingOrder ? "Guardando…" : "Guardar pedido"}
                    </button>

                    <p style={{ fontSize: 11, opacity: 0.75, margin: 0 }}>
                      Al guardar se manda al backend y se descuenta inventario según tu lógica del servidor.
                    </p>
                  </div>
                </div>
              )}
            </Section>

            <Section title="Menú rápido">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}



              >
                <p style={{ fontSize: 12, opacity: 0.8, margin: 0 }}>
                  Toca un producto para agregarlo al pedido de la mesa seleccionada.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    if (!isAdmin) {
                      alert("⛔ Solo el administrador puede editar el menú");
                      return;
                    }
                    setShowMenuEditor((v) => !v);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.6)",
                    backgroundColor: "transparent",
                    color: "var(--pos-text, #e5e7eb)",
                    fontSize: 11,
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  {showMenuEditor ? "Cerrar edición" : "Editar menú"}
                </button>
              </div>

 {!showMenuEditor && (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
      gap: 10,
    }}
  >
    {quickProducts
      .filter((p) => (p.section || "Comida") === activeMenuSection)
      .map((p) => {
       const inv = p.inventoryItemId
  ? inventoryOptions.find((i) => i.id === p.inventoryItemId)
  : null;

const stockVal = inv
  ? Number(
      inv.stock ??
      inv.qty ??
      inv.quantity ??
      inv.currentStock ??
      0
    )
  : null;
const catColor = CATEGORY_COLORS[p.section || "Otros"] || "#64748b";

// 🔒 SOLO bloquea si el producto TIENE inventario y es 0 o menor
const noStock = inv !== null && Number.isFinite(stockVal) && stockVal <= 0;




      return (
  <button
    key={p.id}
    type="button"
    onClick={() => {
      if (noStock) {
        alert("⛔ Producto sin stock disponible");
        return;
      }
      handleQuickProductClick(p);
    }}
    style={{
      textAlign: "left",
      padding: 12,
      borderRadius: 16,
      border: noStock
  ? "1px solid rgba(239,68,68,0.6)"
  : `1px solid ${catColor}`,
boxShadow: noStock ? "none" : `0 0 0 1px ${catColor}40`,

     background:
  lastAddedId === p.id
    ? "rgba(34,197,94,0.25)"
    : "rgba(2,6,23,0.35)",

      color: "var(--pos-text, #e5e7eb)",
      cursor: noStock ? "not-allowed" : "pointer",
      opacity: noStock ? 0.45 : 1,
    }}
  >
            
<div style={{ fontWeight: 900, fontSize: 13 }}>{p.name}</div>

{(p.imageData || p.imageUrl) && (
  <div
    style={{
  width: "calc(100% + 16px)",
  aspectRatio: "1 / 1",
  maxHeight: 120,
  margin: "-8px -8px 8px -8px", // full-bleed arriba y lados
  borderRadius: 14,
  overflow: "hidden",
  border: "1px solid rgba(148,163,184,0.20)",
  background: "rgba(2,6,23,0.25)",
}}

  >
    <img
      src={p.imageData || p.imageUrl}
      alt=""
      style={{ width: "100%", height: "100%", objectFit: "contain" }}

      loading="lazy"
    />
  </div>
)}
           

 <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
              ${Number(p.price || 0).toFixed(2)}
            </div>

            {(p.sizeSmallPrice || p.sizeLargePrice) && (
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
                {(p.sizeSmallLabel || "Ch")} ${p.sizeSmallPrice || "-"} ·{" "}
                {(p.sizeLargeLabel || "Gde")} ${p.sizeLargePrice || "-"}
              </div>
            )}

 {noStock && (
              <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>
                Sin stock
              </div>
            )}
          </button>
        );
      })}
  </div>
)}

           


{showMenuEditor && (
  <div
    style={{
      marginBottom: 10,
      padding: 12,
      borderRadius: 16,
      border: "1px solid rgba(148,163,184,0.35)",
      background:
        "radial-gradient(circle at top left, rgba(30,41,59,0.85), rgba(15,23,42,0.98))",
      boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      overflow: "hidden",
    }}
  >
    {/* HEADER / ACCIONES */}
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        padding: "8px 10px",
        borderRadius: 14,
        border: "1px solid rgba(148,163,184,0.18)",
        background: "rgba(2,6,23,0.22)",
      }}
    >
      <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 900 }}>
        Secciones:
      </span>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {menuSections.map((sec) => {
          const isActive = sec === activeMenuSection;
          return (
            <button
              key={sec}
              type="button"
              onClick={() => setActiveMenuSection(sec)}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: isActive
                  ? "1px solid var(--pos-primary, #22c55e)"
                  : "1px solid rgba(148,163,184,0.45)",
                backgroundColor: isActive ? "rgba(34,197,94,0.14)" : "rgba(2,6,23,0.25)",
                color: "var(--pos-text, #e5e7eb)",
                fontSize: 11,
                cursor: "pointer",
                fontWeight: 900,
                whiteSpace: "nowrap",
              }}
            >
              {sec}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            const name = window.prompt("Nombre de la nueva sección (ej. 'Postres')");
            if (!name) return;
            const clean = name.trim();
            if (!clean || menuSections.includes(clean)) return;
            const next = [...menuSections, clean];
            setMenuSections(next);
            saveMenuSections(next);
          }}
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            border: "1px solid rgba(148,163,184,0.55)",
            backgroundColor: "rgba(2,6,23,0.25)",
            color: "#e5e7eb",
            fontSize: 18,
            cursor: "pointer",
            fontWeight: 900,
            lineHeight: "28px",
          }}
          title="Agregar sección"
        >
          +
        </button>
      </div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => handleAddMenuProduct(activeMenuSection)}
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid rgba(34,197,94,0.85)",
            backgroundColor: "rgba(22,163,74,0.12)",
            color: "#bbf7d0",
            fontSize: 11,
            cursor: "pointer",
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          + Agregar platillo a {activeMenuSection}
        </button>
      </div>
    </div>

    {/* LISTA (scroll interno horizontal en móvil/tablet) */}
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        borderRadius: 14,
        border: "1px solid rgba(148,163,184,0.16)",
        background: "rgba(2,6,23,0.18)",
      }}
    >
      <div style={{ minWidth: 980, padding: 10, display: "grid", gap: 10 }}>
        {quickProducts
          .filter((p) => (p.section || "Comida") === activeMenuSection)
          .map((p) => (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "120px minmax(230px,1fr) 220px minmax(170px,1fr) 90px 220px 190px 52px",
                gap: 10,
                alignItems: "center",
                padding: "10px 10px",
                borderRadius: 16,
                border: "1px solid rgba(148,163,184,0.16)",
                background: "rgba(15,23,42,0.55)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
                boxSizing: "border-box",
              }}
            >
              {/* SECCIÓN */}
              <select
                value={p.section || "Comida"}
                onChange={(e) => handleMenuFieldChange(p.id, "section", e.target.value)}
                style={{
                  width: "100%",
                  minWidth: 0,
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(75,85,99,0.9)",
                  backgroundColor: "rgba(15,23,42,0.96)",
                  color: "var(--pos-text, #e5e7eb)",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {menuSections.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>

              {/* NOMBRE */}
              <input
                value={p.name}
                onDoubleClick={(e) => e.target.select()}
                placeholder="Nombre"
                onChange={(e) => handleMenuFieldChange(p.id, "name", e.target.value)}
                style={{
                  width: "100",
                  minWidth: 0,
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 13,
                  border: "1px solid rgba(75,85,99,0.9)",
                  backgroundColor: "rgba(15,23,42,0.96)",
                  color: "var(--pos-text, #e5e7eb)",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              />

              {/* FOTO (compacta) - en edición NO se muestra preview para que no ocupe espacio */}
<div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
  <details style={{ minWidth: 0, width: "100%" }}>
    <summary
      style={{
        cursor: "pointer",
        fontSize: 11,
        fontWeight: 900,
        opacity: 0.9,
        listStyle: "none",
        userSelect: "none",
        padding: "8px 10px",
        borderRadius: 999,
        border: "1px solid rgba(148,163,184,0.35)",
        background: "rgba(2,6,23,0.28)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      Foto <span style={{ fontSize: 10, opacity: 0.65 }}>(URL o subir)</span>
    </summary>

    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
      <input
        value={p.imageUrl || ""}
        placeholder="Pega URL (https://...)"
        onChange={(e) => handleMenuFieldChange(p.id, "imageUrl", e.target.value)}
        style={{
          width: "100%",
          minWidth: 0,
          padding: "8px 10px",
          borderRadius: 12,
          border: "1px solid rgba(75,85,99,0.9)",
          backgroundColor: "rgba(15,23,42,0.96)",
          color: "var(--pos-text, #e5e7eb)",
          fontSize: 11,
        }}
      />

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = String(reader.result || "");
            handleMenuFieldChange(p.id, "imageData", dataUrl);
          };
          reader.readAsDataURL(file);
          e.target.value = "";
        }}
        style={{
          width: "100%",
          minWidth: 0,
          padding: "8px 10px",
          borderRadius: 12,
          border: "1px solid rgba(75,85,99,0.9)",
          backgroundColor: "rgba(15,23,42,0.96)",
          color: "var(--pos-text, #e5e7eb)",
          fontSize: 11,
        }}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => {
            handleMenuFieldChange(p.id, "imageUrl", "");
            handleMenuFieldChange(p.id, "imageData", "");
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid rgba(239,68,68,0.55)",
            background: "rgba(239,68,68,0.10)",
            color: "var(--pos-text, #e5e7eb)",
            fontSize: 11,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Quitar foto
        </button>
      </div>
    </div>
  </details>
</div>


              {/* CATEGORÍA/OPCIONES */}
              <input
                value={p.category || ""}
                placeholder="Categoría (o opciones separadas por coma)"
                onChange={(e) => handleMenuFieldChange(p.id, "category", e.target.value)}
                style={{
                  width: "100%",
                  minWidth: 0,
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(75,85,99,0.9)",
                  backgroundColor: "rgba(15,23,42,0.96)",
                  color: "var(--pos-text, #e5e7eb)",
                  fontSize: 11,
                }}
              />

              {/* PRECIO BASE */}
              <input
                type="number"
                value={p.price || 0}
                placeholder="Precio"
                onChange={(e) => handleMenuFieldChange(p.id, "price", e.target.value)}
                style={{
                  width: "100%",
                  minWidth: 0,
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(75,85,99,0.9)",
                  backgroundColor: "rgba(15,23,42,0.96)",
                  color: "var(--pos-text, #e5e7eb)",
                  fontSize: 11,
                }}
              />

           {/* TAMAÑOS (compacto PRO: botón toggle + panel ABAJO en 2 filas) */}
<details
  style={{ width: "100%", minWidth: 0 }}
  onToggle={(e) => {
    // Si abres y aún no hay tamaños, los inicializa
    if (e.currentTarget.open) {
      if (
        Number(p.sizeSmallPrice || 0) <= 0 &&
        Number(p.sizeLargePrice || 0) <= 0
      ) {
        handleMenuFieldChange(p.id, "sizeSmallLabel", "Ch");
        handleMenuFieldChange(p.id, "sizeSmallPrice", 1);
        handleMenuFieldChange(p.id, "sizeLargeLabel", "Gde");
        handleMenuFieldChange(p.id, "sizeLargePrice", 1);
      }
    }
  }}
>
  <summary
    style={{
      cursor: "pointer",
      userSelect: "none",
      listStyle: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(148,163,184,0.35)",
      background: "rgba(2,6,23,0.28)",
      color: "var(--pos-text, #e5e7eb)",
      fontSize: 11,
      fontWeight: 900,
      whiteSpace: "nowrap",
    }}
  >
    {(Number(p.sizeSmallPrice || 0) > 0 || Number(p.sizeLargePrice || 0) > 0)
      ? "Activar / ocultar tamaños"
      : "Activar tamaños"}
  </summary>

  {/* Panel ABAJO (2x2) */}
  <div
    style={{
      marginTop: 8,
      padding: 10,
      borderRadius: 14,
      border: "1px solid rgba(148,163,184,0.25)",
      background: "rgba(2,6,23,0.22)",
      display: "grid",
      gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
      gap: 8,
      alignItems: "center",
      width: "100%",
      minWidth: 0,
    }}
  >
    <input
      value={p.sizeSmallLabel || ""}
      placeholder="Etiqueta chico (Ch)"
      onChange={(e) =>
        handleMenuFieldChange(p.id, "sizeSmallLabel", e.target.value)
      }
      style={{
        width: "100%",
        minWidth: 0,
        padding: "8px 10px",
        borderRadius: 12,
        border: "1px solid rgba(75,85,99,0.9)",
        backgroundColor: "rgba(15,23,42,0.96)",
        color: "var(--pos-text, #e5e7eb)",
        fontSize: 11,
      }}
    />

    <input
      type="number"
      value={p.sizeSmallPrice || 0}
      placeholder="Precio chico"
      onChange={(e) =>
        handleMenuFieldChange(p.id, "sizeSmallPrice", e.target.value)
      }
      style={{
        width: "100%",
        minWidth: 0,
        padding: "8px 10px",
        borderRadius: 12,
        border: "1px solid rgba(75,85,99,0.9)",
        backgroundColor: "rgba(15,23,42,0.96)",
        color: "var(--pos-text, #e5e7eb)",
        fontSize: 11,
      }}
    />

    <input
      value={p.sizeLargeLabel || ""}
      placeholder="Etiqueta grande (Gde)"
      onChange={(e) =>
        handleMenuFieldChange(p.id, "sizeLargeLabel", e.target.value)
      }
      style={{
        width: "100%",
        minWidth: 0,
        padding: "8px 10px",
        borderRadius: 12,
        border: "1px solid rgba(75,85,99,0.9)",
        backgroundColor: "rgba(15,23,42,0.96)",
        color: "var(--pos-text, #e5e7eb)",
        fontSize: 11,
      }}
    />

    <input
      type="number"
      value={p.sizeLargePrice || 0}
      placeholder="Precio grande"
      onChange={(e) =>
        handleMenuFieldChange(p.id, "sizeLargePrice", e.target.value)
      }
      style={{
        width: "100%",
        minWidth: 0,
        padding: "8px 10px",
        borderRadius: 12,
        border: "1px solid rgba(75,85,99,0.9)",
        backgroundColor: "rgba(15,23,42,0.96)",
        color: "var(--pos-text, #e5e7eb)",
        fontSize: 11,
      }}
    />
  </div>
</details>

              {/* INVENTARIO */}
              <select
                value={p.inventoryItemId ?? ""}
                onChange={(e) => handleMenuFieldChange(p.id, "inventoryItemId", e.target.value)}
                style={{
                  width: "100%",
                  minWidth: 0,
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(75,85,99,0.9)",
                  backgroundColor: "rgba(15,23,42,0.96)",
                  color: "var(--pos-text, #e5e7eb)",
                  fontSize: 11,
                }}
              >
                <option value="">(Sin inventario)</option>
                {(inventoryOptions || []).map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>

              {/* ELIMINAR */}
              <button
                type="button"
           onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  handleDeleteMenuProduct(p.id); // 👈 ESTE nombre debe existir
}}


                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: "1px solid rgba(239,68,68,0.70)",
                  backgroundColor: "rgba(239,68,68,0.08)",
                  color: "rgba(239,68,68,1)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
                title="Eliminar"
              >
                ✕
              </button>
            </div>
          ))}
      </div>
    </div>
  </div>
)}


{quickPickOpen && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "rgba(2,6,23,0.82)",
      display: "grid",
      placeItems: "center",
      padding: 16,
    }}
    onMouseDown={(e) => {
      if (e.target === e.currentTarget) closeQuickPick();
    }}
  >
    <div
      style={{
        width: "min(720px, 96vw)",
        borderRadius: 20,
        border: "1px solid rgba(148,163,184,0.35)",
        background:
          "radial-gradient(circle at top left, rgba(15,23,42,0.98), rgba(2,6,23,0.95))",
        boxShadow: "0 28px 80px rgba(0,0,0,0.55)",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 3 }}>
            {quickPickStep === "category" ? "Selecciona opción (número)" : "Selecciona tamaño (número)"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 900 }}>
            {quickPickProduct?.name || "Producto"}
          </div>
        </div>

        <button
          type="button"
          onClick={closeQuickPick}
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            border: "1px solid rgba(148,163,184,0.5)",
            background: "transparent",
            color: "var(--pos-text, #e5e7eb)",
            fontWeight: 900,
            cursor: "pointer",
          }}
          title="Cerrar (Esc)"
        >
          ✕
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 12,
          alignItems: "start",
        }}
      >
        {/* Opciones numeradas */}
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(15,23,42,0.6)",
            padding: 10,
          }}
        >
          {quickPickOpts.map((o, idx) => (
            <div
              key={o.key + idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 10px",
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.18)",
                marginBottom: 8,
                background: "rgba(2,6,23,0.30)",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 10,
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid rgba(34,197,94,0.55)",
                  background: "rgba(22,163,74,0.12)",
                  color: "#bbf7d0",
                  fontWeight: 1000,
                }}
              >
                {idx + 1}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{o.label}</div>
            </div>
          ))}
        </div>

        {/* Input numérico (abre teclado en móvil) */}
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(15,23,42,0.6)",
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <input
            value={quickPickInput}
            onChange={(e) => setQuickPickInput(e.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Escribe el número…"
            autoFocus
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(2,6,23,0.55)",
              color: "var(--pos-text, #e5e7eb)",
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: 1,
            }}
          />

          <button
            type="button"
            onClick={submitQuickPickNumber}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid var(--pos-primary, #22c55e)",
              background:
                "linear-gradient(135deg, var(--pos-primary-soft, rgba(34,197,94,0.30)), rgba(15,23,42,1))",
              color: "#bbf7d0",
              fontSize: 13,
              fontWeight: 1000,
              cursor: "pointer",
            }}
          >
            Aceptar (Enter)
          </button>

          <div style={{ fontSize: 11, opacity: 0.75 }}>
            Tip: el mesero solo teclea <b>1, 2, 3…</b> y listo.
          </div>
        </div>
      </div>
    </div>
  </div>
)}


              {/* Tabs para mesero */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {menuSections.map((sec) => {
                  const isActive = sec === activeMenuSection;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setActiveMenuSection(sec)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: isActive
                          ? "1px solid var(--pos-primary, #22c55e)"
                          : "1px solid rgba(148,163,184,0.6)",
                        backgroundColor: isActive ? "rgba(22,163,74,0.15)" : "transparent",
                        color: "var(--pos-text, #e5e7eb)",
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      {sec}
                    </button>
                  );
                })}
              </div>

              {/* grid agrupado por categoría */}
              {Object.entries(getQuickProductsBySectionAndCategory())
                .filter(([sectionName]) => sectionName === activeMenuSection)
                .map(([sectionName, cats]) => (
                  <div key={sectionName}>
                    {Object.entries(cats).map(([cat, items]) => (
                      <div key={cat} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 6 }}>{cat}</div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                            gap: 8,
                          }}
                        >
                         {/*
{items.map((p) => (
  <button
    key={p.id}
    type="button"
    onClick={() => handleQuickProductClick(p)}
  >
    ...
  </button>
))}
*/}

                        </div>
                      </div>
                    ))}
                  </div>
                ))}
            </Section>
          </>
        )}

        {/* ===== VENTAS (simple, funcional) ===== */}
        {activeTab === "ventas" && (
          <Accordion title="Ventas (tiempo real)" defaultOpen={true}>

            <Section title="Pedidos recientes">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <button
                  onClick={() => loadRecentOrders()}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.6)",
                    backgroundColor: "rgba(15,23,42,0.9)",
                    color: "var(--pos-text, #e5e7eb)",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Actualizar pedidos
                </button>

                <button
                  onClick={() => loadAdminSummary()}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(34,197,94,0.8)",
                    background: "rgba(34,197,94,0.12)",
                    color: "#bbf7d0",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Actualizar resumen
                </button>
              </div>

              {loadingOrders && <p style={{ fontSize: 12, opacity: 0.8 }}>Cargando…</p>}
              {!!ordersError && <p style={{ fontSize: 12, color: "#fecaca" }}>{ordersError}</p>}

              {!loadingOrders && (!recentOrders || recentOrders.length === 0) ? (
                <p style={{ fontSize: 12, opacity: 0.75 }}>Aún no hay pedidos.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {recentOrders.map((o) => {
                    const whenRaw = o.createdAt || o.date || o.fecha || o.timestamp;
                    let when = "";
                    try {
                      if (whenRaw) when = new Date(whenRaw).toLocaleString("es-MX", { hour12: false });
                    } catch {
                      when = String(whenRaw || "");
                    }

                    const tableLabel = getOrderTableLabel(o);
                    const total = Number(o.total || o.totalAmount || 0);

                    return (
                      <div
                        key={o.id || `${tableLabel}-${when}`}
                        style={{
                          borderRadius: 14,
                          border: "1px solid rgba(148,163,184,0.30)",
                          backgroundColor: "rgba(2,6,23,0.25)",
                          padding: 12,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontWeight: 1000 }}>{tableLabel}</div>
                            <div style={{ fontSize: 11, opacity: 0.75 }}>{when || "Sin fecha"}</div>
                          </div>
                          <div style={{ fontWeight: 1000 }}>{fmtMoney(total)}</div>
                        </div>

                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                          {(Array.isArray(o.items) ? o.items : []).map((it, idx) => (
                            <div
                              key={`${o.id || "o"}-${idx}`}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                                fontSize: 12,
                                padding: "6px 8px",
                                borderRadius: 10,
                                border: "1px solid rgba(148,163,184,0.18)",
                                backgroundColor: "rgba(15,23,42,0.55)",
                              }}
                            >
                              <span style={{ opacity: 0.95 }}>
                                {it.name} <span style={{ opacity: 0.75 }}>x {Number(it.qty || 1)}</span>
                              </span>
                              <span style={{ opacity: 0.9 }}>
                                {fmtMoney(Number(it.price || 0) * Number(it.qty || 1))}
                              </span>
                            </div>
                          ))}
                          {(!o.items || o.items.length === 0) && (
                            <p style={{ fontSize: 12, opacity: 0.75, margin: 0 }}>
                              (Este pedido no trae items en el response)
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </Accordion>
        )}

        {/* ===== REPORTES ===== */}
<pre style={{ fontSize: 11, opacity: 0.8 }}>
  {({ dailyReports, ownerReport }, null, 2)}
</pre>

        {activeTab === "reportes" && (
          <Accordion title="Reportes diarios" defaultOpen={true}>


            <Section title="Buscar reportes">
<div
  style={{
    maxHeight: "calc(100vh - 180px)",
    overflowY: "auto",
    paddingRight: 6,
  }}
>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 12, opacity: 0.85 }}>Desde</span>
                  <input
                    type="date"
                    value={reportFrom}
                    onChange={(e) => setReportFrom(e.target.value)}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 10,
                      border: "1px solid rgba(148,163,184,0.45)",
                      backgroundColor: "rgba(15,23,42,0.9)",
                      color: "var(--pos-text, #e5e7eb)",
                      fontSize: 12,
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 12, opacity: 0.85 }}>Hasta</span>
                  <input
                    type="date"
                    value={reportTo}
                    onChange={(e) => setReportTo(e.target.value)}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 10,
                      border: "1px solid rgba(148,163,184,0.45)",
                      backgroundColor: "rgba(15,23,42,0.9)",
                      color: "var(--pos-text, #e5e7eb)",
                      fontSize: 12,
                    }}
                  />
                </div>
<button
 onClick={async () => {
  await loadDailyReports();
  await loadOwnerReport();
}}
  style={{
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.6)",
    backgroundColor: "rgba(15,23,42,0.9)",
    color: "var(--pos-text, #e5e7eb)",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 900,
  }}
>
  Buscar
</button>




                <button
                  onClick={handleExportDailyReports}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(34,197,94,0.8)",
                    background:
                      "linear-gradient(135deg, rgba(34,197,94,0.16), rgba(34,197,94,0.35))",
                    color: "#bbf7d0",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 1000,
                  }}
                >
                  Exportar CSV
                </button>
              </div>

              {loadingReports && <p style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>Cargando…</p>}
              {!!reportsError && <p style={{ fontSize: 12, color: "#fecaca", marginTop: 8 }}>{reportsError}</p>}

{/* =========================
   ✅ VISTA PRO (KPI + GRÁFICA + TABLAS)
   ========================= */}

{/* KPI del dueño (ownerReport) */}
{ownerReport?.kpis && (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
    <div style={{ padding: 14, borderRadius: 16, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(2,6,23,0.35)" }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>Ventas (rango)</div>
      <div style={{ fontSize: 20, fontWeight: 1000 }}>{fmtMoney(ownerReport.kpis.totalSales || 0)}</div>
    </div>

    <div style={{ padding: 14, borderRadius: 16, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(2,6,23,0.35)" }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>Pedidos (rango)</div>
      <div style={{ fontSize: 20, fontWeight: 1000 }}>{Number(ownerReport.kpis.totalOrders || 0)}</div>
    </div>

    <div style={{ padding: 14, borderRadius: 16, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(2,6,23,0.35)" }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>Ticket promedio</div>
      <div style={{ fontSize: 20, fontWeight: 1000 }}>{fmtMoney(ownerReport.kpis.avgTicket || 0)}</div>
    </div>
  </div>
)}


{/* ✅ Top productos + Ventas por mesa (tablas pro) */}
{ownerReport && (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
    {/* Top productos */}
    <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(2,6,23,0.35)", overflow: "hidden" }}>
      <div style={{ padding: 12, fontWeight: 1000, background: "rgba(2,6,23,0.35)" }}>Top productos</div>

      <div style={{ padding: 12 }}>
        {Array.isArray(ownerReport.topProducts) && ownerReport.topProducts.length > 0 ? (
          ownerReport.topProducts.slice(0, 10).map((p, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: idx ? "1px solid rgba(30,41,59,0.8)" : "none", fontSize: 12 }}>
              <div style={{ opacity: 0.95 }}>{p.name}</div>
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ opacity: 0.8 }}>x{Number(p.units || 0)}</span>
                <span style={{ fontWeight: 900 }}>{fmtMoney(p.sales || 0)}</span>
              </div>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 12, opacity: 0.75, margin: 0 }}>Sin datos de productos en este rango.</p>
        )}
      </div>
    </div>

    {/* Ventas por mesa */}
    <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(2,6,23,0.35)", overflow: "hidden" }}>
      <div style={{ padding: 12, fontWeight: 1000, background: "rgba(2,6,23,0.35)" }}>Ventas por mesa</div>

      <div style={{ padding: 12 }}>
        {Array.isArray(ownerReport.salesByTable) && ownerReport.salesByTable.length > 0 ? (
          ownerReport.salesByTable.map((t, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.2fr .6fr .8fr", gap: 10, padding: "8px 0", borderTop: idx ? "1px solid rgba(30,41,59,0.8)" : "none", fontSize: 12 }}>
              <div style={{ opacity: 0.95 }}>{t.tableName}</div>
              <div style={{ opacity: 0.85 }}>{Number(t.orders || 0)} ped</div>
              <div style={{ fontWeight: 900, textAlign: "right" }}>{fmtMoney(t.total || 0)}</div>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 12, opacity: 0.75, margin: 0 }}>Sin ventas por mesa en este rango.</p>
        )}
      </div>
    </div>
  </div>
)}

{/* ✅ Tu tabla diaria (la que ya tenías) VA ABAJO de la gráfica */}



{Array.isArray(dailyReports) && dailyReports.length > 0 ? (
                <div
                  style={{
                    marginTop: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(148,163,184,0.35)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
                      padding: "10px 10px",
                      backgroundColor: "rgba(2,6,23,0.35)",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    <div>Fecha</div>
                    <div>Ventas</div>
                    <div>Pedidos</div>
                    <div>Ticket</div>
                  </div>

{/* 🍰 MÉTODOS DE PAGO – AUTO (últimos 7 días) */}
{Array.isArray(dailyReports) && dailyReports.length > 0 && (() => {
  const cash = dailyReports.reduce((s, r) => s + Number(r.paymentCash || 0), 0);
  const card = dailyReports.reduce((s, r) => s + Number(r.paymentCard || 0), 0);
  const transfer = dailyReports.reduce((s, r) => s + Number(r.paymentTransfer || 0), 0);

  const pieData = {
    labels: ["Efectivo", "Tarjeta", "Transferencia"],
    datasets: [
      {
        data: [cash, card, transfer],
        backgroundColor: [
          "rgba(34,197,94,0.9)",   // efectivo
          "rgba(59,130,246,0.9)",  // tarjeta
          "rgba(234,179,8,0.9)",   // transferencia
        ],
        borderWidth: 1,
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "rgba(226,232,240,0.85)",
          boxWidth: 14,
          boxHeight: 10,
          padding: 14,
          font: { size: 12, weight: "700" },
        },
      },
      tooltip: {
        backgroundColor: "rgba(2,6,23,0.95)",
        borderColor: "rgba(148,163,184,0.25)",
        borderWidth: 1,
        titleColor: "rgba(226,232,240,0.95)",
        bodyColor: "rgba(226,232,240,0.9)",
        padding: 12,
        cornerRadius: 12,
        callbacks: {
          label: (ctx) => {
            const val = Number(ctx.parsed || 0);
            const total = (ctx.dataset.data || []).reduce(
              (a, b) => a + Number(b || 0),
              0
            );
            const pct = total > 0 ? (val / total) * 100 : 0;
            const money = new Intl.NumberFormat("es-MX", {
              style: "currency",
              currency: "MXN",
            }).format(val);
            return ` ${ctx.label}: ${money} • ${pct.toFixed(1)}%`;
          },
        },
      },
      datalabels: {
        color: "rgba(255,255,255,0.95)",
        font: { weight: "900", size: 12 },
        textStrokeColor: "rgba(0,0,0,0.35)",
        textStrokeWidth: 3,
        formatter: (value, ctx) => {
          const data = ctx.chart.data.datasets[0].data || [];
          const total = data.reduce((a, b) => a + Number(b || 0), 0);
          const pct = total > 0 ? (Number(value || 0) / total) * 100 : 0;
          return pct >= 4 ? `${pct.toFixed(0)}%` : ""; // oculta rebanadas muy pequeñas
        },
      },
    },
  };

  return (
    <div
      style={{
        marginTop: 18,
        padding: 16,
        borderRadius: 16,
        border: "1px solid rgba(148,163,184,0.25)",
        background: "rgba(2,6,23,0.35)",
        maxWidth: 520,
      }}
    >
      {/* Header PRO + badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ fontWeight: 1000 }}>Métodos de pago</div>

        <span
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            border: "1px solid rgba(34,197,94,0.35)",
            background: "rgba(34,197,94,0.12)",
            color: "rgba(187,247,208,0.95)",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 0.3,
          }}
        >
          HOY
        </span>

        <span
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            border: "1px solid rgba(148,163,184,0.22)",
            background: "rgba(2,6,23,0.35)",
            color: "rgba(226,232,240,0.85)",
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          ÚLTIMOS 7 DÍAS
        </span>
      </div>

      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>
        Distribución automática basada en tus cierres diarios.
      </div>

      {/* ✅ Contenedor con alto fijo */}
      <div style={{ height: 340 }}>
        <Pie
          redraw
          key={`payments-pie-${dailyReports?.length || 0}-${cash}-${card}-${transfer}`}
          data={pieData}
          options={pieOptions}
        />
      </div>
    </div>
  );
})()}

{/* ✅ HISTÓRICO (Barras) */}
{Array.isArray(dailyReports) && dailyReports.length > 0 && (
  <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: "1px solid rgba(148,163,184,0.25)", background: "rgba(2,6,23,0.25)" }}>
    <div style={{ fontWeight: 1000, marginBottom: 8 }}>Histórico de ventas</div>

    <Bar
      data={{
        labels: dailyReports.map((r) => (r.date || r.fecha || "").slice(0, 10)),
        datasets: [
  {
    label: "Ventas",
    data: dailyReports.map((r) => Number(r.totalSales || r.total || 0)),
    backgroundColor: "rgba(34,197,94,0.85)",
    borderColor: "rgba(34,197,94,1)",
    borderWidth: 1,
    borderRadius: 10,
    maxBarThickness: 22,
 barThickness: 180,        // ⬅️ 6x más ancha
    maxBarThickness: 140,     // límite superior
    categoryPercentage: 0.9,
    barPercentage: 0.9,
  },
],

      }}
    options={{
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
  x: {
    offset: true,
    grid: { display: false },
    ticks: {
      color: "rgba(226,232,240,0.75)",
      font: { size: 12, weight: "600" },
    },
  },
  y: {
    beginAtZero: true,
    grid: { color: "rgba(148,163,184,0.14)" },
    ticks: {
      color: "rgba(226,232,240,0.75)",
      font: { size: 11 },
    },
  },
},
}}
    />
  </div>
)}

{dailyReports.map((r, idx) => {
                    const fecha = r.date || r.fecha || r.day || r.dayLabel || "";
                    const ventas = Number(r.totalSales || r.total || 0);
                    const pedidos = Number(r.orders || r.pedidos || r.totalOrders || 0);
                    const ticket = Number(r.avgTicket || r.ticketProm || r.ticket || 0);

                    return (
                      <div
                        key={idx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
                          padding: "10px 10px",
                          borderTop: "1px solid rgba(30,41,59,0.8)",
                          fontSize: 12,
                        }}
                      >
                        <div style={{ opacity: 0.9 }}>{fecha}</div>
                        <div>{fmtMoney(ventas)}</div>
                        <div>{pedidos}</div>
                        <div>{fmtMoney(ticket)}</div>
                      </div>
                    );
                  })}
                </div>
              ) : !loadingReports ? (
                <p style={{ fontSize: 12, opacity: 0.75, marginTop: 10 }}>
                  No hay reportes en el rango seleccionado.
                </p>
              ) : null}
</div>
            </Section>
          </Accordion>
        )}

        {/* ===== INVENTARIO ===== */}
        {activeTab === "invent" && (
          <>
            <Section title="Inventario bajo">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <button
                  onClick={loadLowStock}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.6)",
                    backgroundColor: "rgba(15,23,42,0.9)",
                    color: "var(--pos-text, #e5e7eb)",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Actualizar
                </button>
              </div>

              {loadingLowStock && <p style={{ fontSize: 12, opacity: 0.8 }}>Cargando…</p>}
              {!!lowStockError && <p style={{ fontSize: 12, color: "#fecaca" }}>{lowStockError}</p>}

              {!loadingLowStock && lowStockItems.length === 0 ? (
                <p style={{ fontSize: 12, opacity: 0.75 }}>Sin alertas críticas.</p>
              ) : (
                <div
                  style={{
                    maxHeight: 280,
                    overflow: "auto",
                    borderRadius: 12,
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(2,6,23,0.25)",
                  }}
                >
                  {lowStockItems.map((it) => (
                    <div
                      key={it.id || it.name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "10px 10px",
                        borderBottom: "1px solid rgba(30,41,59,0.8)",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ fontWeight: 900 }}>{it.name || it.productName}</span>
                      <span style={{ opacity: 0.9 }}>Stock: <strong>{it._qty}</strong></span>
                    </div>
                  ))}
                </div>
              )}

            </Section>


            <Section title="Inventario completo">
              <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                Panel completo (usa tu componente existente).
              </p>
              <InventoryPanel />
            </Section>
          </>
        )}

        {/* ===== AJUSTES ===== */}
        {activeTab === "ajustes" && (
          <>
            <Accordion title="Apariencia y tema" defaultOpen={true}>
              <Section title="Selecciona un tema">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {Object.values(THEME_PRESETS).map((theme) => {
                    const isActive = theme.key === themeKey;
                    return (
                      <button
                        key={theme.key}
                        onClick={() => {
                          setThemeKey(theme.key);
                          try {
                            localStorage.setItem(THEME_STORAGE_KEY, theme.key);
                          } catch {}
                        }}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 999,
                          border: isActive
                            ? "1px solid var(--pos-primary, #22c55e)"
                            : "1px solid rgba(148,163,184,0.6)",
                          backgroundColor: isActive ? "rgba(15,23,42,0.95)" : "transparent",
                          color: "var(--pos-text, #e5e7eb)",
                          fontSize: 11,
                          cursor: "pointer",
                          fontWeight: 900,
                        }}
                      >
                        {theme.name}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900 }}>Color primario personalizado</div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>
                      Se usa en botones y acentos del POS.
                    </div>
                  </div>
                  <input
                    type="color"
                    value={customPrimary || activeTheme.primary}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCustomPrimary(value);
                      try {
                        localStorage.setItem(CUSTOM_PRIMARY_STORAGE_KEY, value);
                      } catch {}
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      border: "1px solid rgba(148,163,184,0.6)",
                      padding: 0,
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  />
                </div>

                <button
                  onClick={() => {
                    setThemeKey("darkPro");
                    setCustomPrimary("");
                    try {
                      localStorage.setItem(THEME_STORAGE_KEY, "darkPro");
                      localStorage.removeItem(CUSTOM_PRIMARY_STORAGE_KEY);
                    } catch {}
                  }}
                  style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.7)",
                    backgroundColor: "transparent",
                    color: "var(--pos-text, #e5e7eb)",
                    fontSize: 11,
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Restablecer tema original
                </button>
              </Section>

              <Section title="Logo / imagen del negocio">
                <button
                  onClick={() => {
                    setTempLogoUrl(logoUrl || "");
                    setShowLogoEditor((v) => !v);
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.6)",
                    backgroundColor: "rgba(15,23,42,0.9)",
                    color: "var(--pos-text, #e5e7eb)",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  {showLogoEditor ? "Cerrar" : "Editar logo"}
                </button>

                {showLogoEditor && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      value={tempLogoUrl}
                      onChange={(e) => setTempLogoUrl(e.target.value)}
                      placeholder="Pega URL del logo (https://...)"
                      style={{
                        flex: 1,
                        minWidth: 240,
                        padding: "10px 10px",
                        borderRadius: 12,
                        border: "1px solid rgba(148,163,184,0.35)",
                        background: "rgba(2,6,23,0.55)",
                        color: "#e5e7eb",
                        outline: "none",
                        fontSize: 12,
                      }}
                    />
                    <button
                      onClick={handleSaveLogo}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 999,
                        border: "1px solid rgba(34,197,94,0.85)",
                        background: "rgba(34,197,94,0.12)",
                        color: "#bbf7d0",
                        fontWeight: 1000,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Guardar
                    </button>
                  </div>
                )}
              </Section>
            </Accordion>

            <Accordion title="Operación (Turno / Sesión)" defaultOpen={false}>
              <Section title="Turno global">
                <p style={{ fontSize: 12, opacity: 0.8, marginTop: 0 }}>
                  Si el turno está cerrado, el mesero queda bloqueado hasta que lo abras.
                </p>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                
 <SummaryChip
  label="Estado"
  value={turnoGlobalAbierto ? "Abierto" : "Cerrado"}
  isOpen={turnoGlobalAbierto}
/>


                  {isAdmin ? (
                    <>
                      <button
                        onClick={abrirTurnoGlobal}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 999,
                          border: "1px solid rgba(34,197,94,0.85)",
                          background: "rgba(34,197,94,0.12)",
                          color: "#bbf7d0",
                          fontWeight: 1000,
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Abrir turno
                      </button>
                      <button
                        onClick={cerrarTurnoGlobal}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 999,
                          border: "1px solid rgba(239,68,68,0.85)",
                          background: "rgba(239,68,68,0.10)",
                          color: "#fecaca",
                          fontWeight: 1000,
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Cerrar turno
                      </button>
                    </>
                  ) : (
                    <p style={{ fontSize: 12, opacity: 0.8, margin: 0 }}>
                      Solo admin puede abrir/cerrar.
                    </p>
                  )}
                </div>

                <button
                  onClick={bounceToLogin}
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(148,163,184,0.35)",
                    background: "rgba(2,6,23,0.35)",
                    color: "#e5e7eb",
                    cursor: "pointer",
                    fontWeight: 1000,
                  }}
                >
                  Cerrar sesión (volver a login)
                </button>
              </Section>
            </Accordion>
          </>
        )}

        {/* Botón flotante caja (admin + home) */}
        {isAdmin && activeTab === "home" && (
          <button
            type="button"
            onClick={() => setShowCashModal(true)}
            title="Movimientos de caja"
            style={{
              position: "fixed",
              right: 16,
              bottom: 16,
              zIndex: 9996,
              padding: "12px 14px",
              borderRadius: 999,
              border: "1px solid rgba(34,197,94,0.75)",
              background:
                "radial-gradient(circle at top left, rgba(34,197,94,0.22), rgba(15,23,42,0.98))",
              color: "#bbf7d0",
              fontSize: 13,
              fontWeight: 1000,
              cursor: "pointer",
              boxShadow: "0 14px 40px rgba(2,6,23,0.55)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>$</span>
            Caja
          </button>
        )}
      </PosShell>
    </LoginGate>
  );
}
