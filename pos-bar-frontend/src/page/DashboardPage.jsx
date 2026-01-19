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
import { qzListPrinters, qzPrintEscpos } from "../utils/qzPrint";












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

// ✅ Tenant key seguro (evita undefined)
const getTenantKeySafe = () => {
  try {
    const k = (localStorage.getItem("tenant_key") || "").toString().trim();
    return k || "default";
  } catch {
    return "default";
  }
};


const QUICK_KEY = `pos_quick_products_v1_${getTenantKeySafe()}`;

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
const TURNO_KEY_T = `pos_turno_global_abierto_${getTenantKeySafe()}`; // ✅ por tenant
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



function printTicket(order) {
  if (!window.qz) {
    alert("❌ QZ Tray no detectado");
    return;
  }

  const printer = localStorage.getItem("pos_selected_printer");
  if (!printer) {
    alert("❌ No hay impresora seleccionada");
    return;
  }

  const lines = [];

  lines.push("=== PEDIDO ===");
  lines.push(`Mesa: ${order.tableName || ""}`);
  lines.push("-------------------------");

  order.items.forEach((item) => {
    lines.push(`${item.name}  $${item.price.toFixed(2)}`);

    if (item.extras && item.extras.length > 0) {
      item.extras.forEach((e) => {
        lines.push(`  • ${e.name} (+$${e.price})`);
      });
    }

    if (item.note) {
      lines.push(`  Nota: ${item.note}`);
    }

    lines.push("");
  });

  lines.push("-------------------------");
  lines.push(`TOTAL: $${order.total.toFixed(2)}`);
  lines.push("\n\n");

  const config = qz.configs.create(printer);
  qz.print(config, [{
    type: "raw",
    format: "plain",
    data: lines.join("\n")
  }]);
}

// ======================
// KEYS POS (DEFINITIVAS)
// ======================
const SHIFT_BASELINE_KEY = (todayKey) => `pos_shift_baseline_v1_${todayKey}`;
const CASH_MOVES_KEY = (todayKey) => `pos_cash_moves_v1_${todayKey}`;



export default function DashboardPage() {

// ✅ Auto-tenant_key por hostname (evita que caiga en "default" y cambie el plan a los segundos)
useEffect(() => {
  try {
    const host = (window.location.hostname || "").toLowerCase(); // ej: client1.localhost
    const sub = host.split(".")[0]; // client1

    if (sub && sub !== "localhost" && sub !== "www") {
      localStorage.setItem("tenant_key", sub);
    }
  } catch {}
}, []);




useEffect(() => {
  let alive = true;

  const loadTenantPlan = async () => {
    try {
      const tenantKey =
        localStorage.getItem("tenant_key")?.toString().trim() || "default";

      const res = await fetch(`${API_URL}/api/tenant/plan`, {
        headers: {
          "X-Tenant-Key": tenantKey,
        },
      });

      if (!res.ok) return;

      const data = await res.json();
      const plan = (data?.plan || "FREE").toString();

      if (!alive) return;

      localStorage.setItem("tenant_plan", plan);
      setTenantPlan(plan);
    } catch {
      // ❗ no rompe nada, se queda en FREE
    }
  };

  loadTenantPlan();

  return () => {
    alive = false;
  };
}, []);


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

const [printerName, setPrinterName] = useState(() => {
  try { return localStorage.getItem("pos_printer_name_v1") || ""; } catch { return ""; }
});
const [printers, setPrinters] = useState([]);



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
      return localStorage.getItem(TURNO_KEY_T) === "1";
    } catch {
      return false;
    }
  });
useEffect(() => {
  const syncTurno = () => {
    try {
      setTurnoGlobalAbierto(localStorage.getItem(TURNO_KEY_T) === "1");
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


async function abrirTurnoGlobal() {
  try {
    // 1) Abrir turno (lo que ya hacías)
    localStorage.setItem(TURNO_KEY_T, "1");

    // ✅ compat: también marcamos el turno global clásico
    localStorage.setItem(TURNO_KEY, "1");
    setTurnoAbierto(true);

    window.dispatchEvent(new Event("pos_turno_global_changed"));
  } catch {}

  // 2) ✅ FIX 3: Guardar baseline COMPLETO al abrir turno (net/gross/cancel/orders)
  //    Si falla el fetch, NO rompe el POS: solo no se guarda baseline.
  try {
    const todayKey = new Date().toLocaleDateString("en-CA");

    const BASE_URL =
      typeof API_URL !== "undefined" && API_URL
        ? API_URL
        : "";

   const tenantKeyRaw = localStorage.getItem("tenant_key");
const tenantKey =
  tenantKeyRaw && tenantKeyRaw !== "null" && tenantKeyRaw !== "undefined"
    ? tenantKeyRaw
    : "default";

const TURNO_KEY_T = `pos_turno_global_abierto_${tenantKey}`;
const SHIFT_BASELINE_KEY_T = (todayKey) =>
  `pos_shift_baseline_v1_${todayKey}_${tenantKey}`;


const res = await fetch(`${BASE_URL}/api/orders/admin/summary-today`, {
  cache: "no-store",
 headers: {
  "Content-Type": "application/json",
  "x-tenant": tenantKey,
  "X-Tenant-Key": tenantKey, // opcional (compat)
},

});


    if (res.ok) {
      const data = await res.json();

      const netFromServer = Number(data.netSales ?? data.totalSales ?? 0);
      const ordersFromServer = Number(data.totalOrders ?? 0);
      const grossFromServer = Number(data.grossSales ?? 0);
      const cancelledFromServer = Number(data.cancelledSales ?? 0);

      const newBaseline = {
        sales: Math.max(0, netFromServer),
        orders: Math.max(0, ordersFromServer),
        grossSales: Math.max(0, grossFromServer),
        cancelledSales: Math.max(0, cancelledFromServer),
      };

      localStorage.setItem(
        SHIFT_BASELINE_KEY_T(todayKey)
(todayKey),
        JSON.stringify(newBaseline)
      );
    }
  } catch {}

  // 3) Estado UI (lo que ya tenías)
  setTurnoGlobalAbierto(true); // ✅ AQUÍ
}

function cerrarTurnoGlobal() {
  try {
    localStorage.setItem(TURNO_KEY_T, "0");

    // ✅ compat: también cerramos el turno global clásico
    localStorage.setItem(TURNO_KEY, "0");
    setTurnoAbierto(false);

    window.dispatchEvent(new Event("pos_turno_global_changed"));
  } catch {}

  setTurnoGlobalAbierto(false); // (deja lo tuyo tal cual)
}


 // ✅ DUPLICADO DESACTIVADO (ya existe el useEffect arriba)
if (false) useEffect(() => {

    const syncTurno = () => {
      try {
        setTurnoGlobalAbierto(localStorage.getItem(TURNO_KEY_T) === "1");
      } catch {}
    };

    syncTurno();
    window.addEventListener("pos_turno_global_changed", syncTurno);

    const onStorage = (e) => {
      if (e.key === TURNO_KEY_T) syncTurno();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("pos_turno_global_changed", syncTurno);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

const tenantPlan = localStorage.getItem("tenant_plan") || "FREE";

// ======================
// EXTRAS PRO (Upsell) — por restaurante (hostname)
// ======================

const EXTRAS_STORAGE_KEY = `pos_extras_catalog_${window.location.hostname}`;

function loadExtrasCatalog() {
  try {
    const raw = localStorage.getItem(EXTRAS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [
    { id: "extra-queso", name: "Queso extra", price: 15, appliesTo: "Comida" },
    { id: "extra-tocino", name: "Tocino", price: 20, appliesTo: "Comida" },
    { id: "extra-guac", name: "Guacamole", price: 25, appliesTo: "Comida" },
    { id: "extra-salsa", name: "Salsa especial", price: 10, appliesTo: "Comida" },
    { id: "extra-shot", name: "Shot extra", price: 25, appliesTo: "Bebidas" },
    { id: "extra-limon", name: "Limón extra", price: 5, appliesTo: "Bebidas" },
  ];
}

const [extrasCatalog, setExtrasCatalog] = useState(loadExtrasCatalog);

function saveExtrasCatalog(next) {
  setExtrasCatalog(next);
  localStorage.setItem(EXTRAS_STORAGE_KEY, JSON.stringify(next));
}

// ✅ Modal state
const [extrasOpen, setExtrasOpen] = useState(false);

// ✅ OJO: aquí guardamos la *línea final* (ya con displayName/precio/tamaño/categoría)
const [extrasLine, setExtrasLine] = useState(null);

// ✅ FIX: tu modal todavía usa extrasProduct
const extrasProduct = extrasLine;

const [extrasSelected, setExtrasSelected] = useState([]); // array de extras


const [showExtrasEditor, setShowExtrasEditor] = useState(false);
const [newExtra, setNewExtra] = useState({
  name: "",
  price: "",
  appliesTo: "Comida",
});



function openExtrasForProduct(finalLine) {
  // finalLine = uniqueLine o finalItem (ya listo)
  setExtrasLine(finalLine);
  setExtrasSelected([]);
  setExtrasOpen(true);
}

function toggleExtra(extra) {
  setExtrasSelected((prev) => {
    const exists = prev.some((x) => x.id === extra.id);

    // Quitar extra (si ya existe)
    if (exists) {
      return prev.filter((x) => x.id !== extra.id);
    }

    // 🚫 Máximo de extras
    if (prev.length >= MAX_EXTRAS) {
      alert(`Solo puedes elegir hasta ${MAX_EXTRAS} extras`);
      return prev;
    }

    // Agregar extra
    return [...prev, extra];
  });
}

function calcExtrasTotal(list) {
  return (list || []).reduce((sum, e) => sum + Number(e.price || 0), 0);
}

// ✅ Cerrar modal (helper)
function closeExtras() {
  setExtrasOpen(false);
  setExtrasLine(null);
  setExtrasSelected([]);
}

// ✅ Agregar SIN extras: NO vuelvas a handleQuickProductClick
function addWithoutExtras() {
  if (!extrasLine) return;
  handleAddProduct(extrasLine); // directo a la orden
  closeExtras();
}

// ✅ Agregar CON extras: suma a la línea final y NO re-entra a QuickPick
function addWithExtras() {
  if (!extrasLine) return;

  const extrasTotal = calcExtrasTotal(extrasSelected);

  const extrasText = (extrasSelected || []).map((e) => e.name).join(", ");

const lineWithExtras = {
  ...extrasLine,

// ✅ Nombre LIMPIO (PRO)
  displayName: extrasLine.displayName || extrasLine.name,

  // ✅ precio final al ticket
  price: Number(extrasLine.price || 0) + extrasTotal,

  extrasTotal,
  extras: (extrasSelected || []).map((e) => ({
    id: e.id,
    name: e.name,
    price: Number(e.price || 0),
  })),
};

  handleAddProduct(lineWithExtras); // ✅ directo
  closeExtras();
}

const editorSelectStyle = {
  width: "100%",
  minWidth: 0,
  height: 40,
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(75,85,99,0.9)",
  backgroundColor: "rgba(15,23,42,0.96)",
  color: "var(--pos-text, #e5e7eb)",
  colorScheme: "dark", // ✅ <-- AGREGA SOLO ESTO
  fontSize: 11,
  fontWeight: 800,
  boxSizing: "border-box",
  outline: "none",
WebkitTextFillColor: "var(--pos-text, #e5e7eb)",
  colorScheme: "dark",
};


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
  const tenantKeyRaw = localStorage.getItem("tenant_key");
const tenantKey =
  tenantKeyRaw && tenantKeyRaw !== "null" && tenantKeyRaw !== "undefined"
    ? tenantKeyRaw
    : "default";

const res = await fetch(`${API_URL}/api/orders/debug/inventory-items`, {
  cache: "no-store",
  headers: {
    "x-tenant": tenantKey, // ✅ SIEMPRE manda tenant válido
  },
});


      if (!res.ok) return;

      const data = await res.json();

const list = (Array.isArray(data) ? data : []).map((it) => ({
  ...it,
  id: Number(it.id),
  stock: Number(it.currentStock ?? it.stock ?? it.quantity ?? 0),
}));

setInventoryOptions(list);

    } catch (err) {
      console.error("Error cargando inventario:", err);
    }
  }

// =======================
// RECETAS PRO (CRUD)
// =======================
const [showRecipesPro, setShowRecipesPro] = useState(false);
const [menuRecipes, setMenuRecipes] = useState([]);
const [recipesLoading, setRecipesLoading] = useState(false);
const [recipesError, setRecipesError] = useState("");

const emptyRecipe = { id: null, menuName: "", items: [] };
const [recipeDraft, setRecipeDraft] = useState(emptyRecipe);

async function loadMenuRecipes() {
  setRecipesError("");
  setRecipesLoading(true);

  try {
    const tenantKey = getTenantKeySafe();

    const res = await fetch(`${API_URL}/api/menu-recipes`, {
      cache: "no-store",
   headers: {
  "x-tenant": tenantKey,
  "X-Tenant-Key": tenantKey, // opcional
},
    });

    if (!res.ok) throw new Error("No se pudo cargar recetas");

    const data = await res.json();
    setMenuRecipes(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error(e);
    setRecipesError(e.message || "Error cargando recetas");
    setMenuRecipes([]);
  } finally {
    setRecipesLoading(false);
  }
}

function addRecipeLine() {
  setRecipeDraft((prev) => ({
    ...prev,
    items: [...(prev.items || []), { inventoryItemId: "", qty: 1 }],
  }));
}

function updateRecipeLine(idx, key, value) {
  setRecipeDraft((prev) => {
    const next = [...(prev.items || [])];
    next[idx] = { ...(next[idx] || {}), [key]: value };
    return { ...prev, items: next };
  });
}

function removeRecipeLine(idx) {
  setRecipeDraft((prev) => {
    const next = [...(prev.items || [])];
    next.splice(idx, 1);
    return { ...prev, items: next };
  });
}

async function saveRecipeDraft() {
  setRecipesError("");
  try {
    const cleanName = String(recipeDraft.menuName || "").trim();
    if (!cleanName) {
      alert("Ponle nombre a la receta");
      return;
    }

    // qty entero (PRO): nada de 0.2
    const cleanItems = (Array.isArray(recipeDraft.items) ? recipeDraft.items : [])
      .map((it) => ({
        inventoryItemId: Number(it.inventoryItemId),
        qty: Number(it.qty),
      }))
      .filter((it) => Number.isFinite(it.inventoryItemId) && it.inventoryItemId > 0 && Number.isFinite(it.qty) && it.qty > 0);

    const payload = { menuName: cleanName, items: cleanItems };

const tenantKey = getTenantKeySafe();


    if (recipeDraft.id) {
    const res = await fetch(`${API_URL}/api/menu-recipes/${recipeDraft.id}`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    "X-Tenant-Key": tenantKey,
  },
  body: JSON.stringify(payload),
});
if (!res.ok) throw new Error("No se pudo actualizar receta");

    } else {
  const res = await fetch(`${API_URL}/api/menu-recipes`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Tenant-Key": tenantKey,
  },
  body: JSON.stringify(payload),
});
if (!res.ok) throw new Error("No se pudo crear receta");

    }

    await loadMenuRecipes();
    setRecipeDraft(emptyRecipe);
    alert("✅ Receta guardada");
  } catch (e) {
    console.error(e);
    setRecipesError(e.message || "Error guardando receta");
  }
}

async function deleteRecipeById(id) {
  try {
    const ok = window.confirm("¿Eliminar receta? (no afecta ventas pasadas)");
    if (!ok) return;

const tenantKey = getTenantKeySafe();
   
 const res = await fetch(`${API_URL}/api/menu-recipes/${id}`, {
  method: "DELETE",
  headers: {
    "X-Tenant-Key": tenantKey,
  },
});

    if (!res.ok) throw new Error("No se pudo eliminar receta");

    await loadMenuRecipes();
    setRecipeDraft(emptyRecipe);
  } catch (e) {
    console.error(e);
    setRecipesError(e.message || "Error eliminando receta");
  }
}


const visibleExtras = useMemo(() => {
  if (!extrasLine) return [];
  const ids = Array.isArray(extrasLine.allowedExtrasIds)
    ? extrasLine.allowedExtrasIds
    : [];

  // Si el platillo tiene extras definidos, mostrar solo esos
  if (ids.length > 0) {
    return (extrasCatalog || []).filter((e) => ids.includes(e.id));
  }

  // Si no definiste extras por platillo, fallback por sección (Comida/Bebidas)
  const sec = String(extrasLine.section || "").trim();
  if (!sec) return (extrasCatalog || []);

  return (extrasCatalog || []).filter(
    (e) => String(e.appliesTo || "").trim() === sec
  );
}, [extrasLine, extrasCatalog]);



  const findInventoryIdByName = (name) => {
    const n = String(name || "").trim().toLowerCase();
    if (!n) return null;
    const hit = (inventoryOptions || []).find(
      (it) => String(it.name || "").trim().toLowerCase() === n
    );
    return hit ? Number(hit.id) : null;
  };

const tenantKey = localStorage.getItem("tenant_key") || "default";



const QUICK_KEY = `pos_quick_products_v1_${tenantKey}`;
const SECTIONS_KEY = `pos_menu_sections_v1_${tenantKey}`;


// =======================
// MENÚ RÁPIDO (con editor)
// =======================
const [quickProducts, setQuickProducts] = useState(() => {
  const raw = localStorage.getItem(QUICK_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_PRODUCTS;
});

const quickHydratedRef = useRef(false);

// ======================
// QUICK MENU - DB (GET)
// ======================
useEffect(() => {
  let alive = true;

  const run = async () => {
    try {
      const base = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const res = await fetch(`${base}/api/quick-products`, {
        method: "GET",
        headers: {
          ...tenantHeaders(),
        },
      });

      if (!res.ok) return; // no rompas nada: si falla, te quedas con localStorage/default

      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];

      if (!alive) return;

      setQuickProducts(items);
      localStorage.setItem(QUICK_KEY, JSON.stringify(items));
    } catch {
      // silencioso para no romper
    } finally {
      // ya hidrato (aunque haya caído en fallback)
      quickHydratedRef.current = true;
    }
  };

  run();
  return () => {
    alive = false;
  };
  // IMPORTANTE: si cambia tenant, cambia QUICK_KEY
}, [QUICK_KEY]);

useEffect(() => {
  let alive = true;
  const run = async () => {
    try {
      const base = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const res = await fetch(`${base}/api/tenant/plan`, { headers: { ...tenantHeaders() } });
      if (!res.ok) return;
      const data = await res.json();
      if (!alive) return;
      localStorage.setItem("tenant_plan", (data?.plan || "FREE").toString());
    } catch {}
  };
  run();
  return () => { alive = false; };
}, [tenantKey]);



// 1) Cargar desde localStorage (SOLO lee) — por tenant
useEffect(() => {
  let cancelled = false;
  quickHydratedRef.current = false;

  const hydrate = async () => {
    // A) Fallback inmediato desde localStorage (para no dejar la UI vacía)
    try {
      const raw = localStorage.getItem(QUICK_KEY);
      if (raw && !cancelled) setQuickProducts(JSON.parse(raw));
      if (!raw && !cancelled) setQuickProducts(DEFAULT_PRODUCTS);
    } catch {
      if (!cancelled) setQuickProducts(DEFAULT_PRODUCTS);
    }

    // B) Fuente real: backend (Supabase vía Prisma)
    try {
      const resp = await fetch(`${API_URL}/api/quick-products`, {
        headers: { "x-tenant-key": tenantKey },
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      const items = Array.isArray(data?.items) ? data.items : [];

      // Si backend trae items, manda eso y cachea en localStorage
      if (!cancelled && items.length > 0) {
        setQuickProducts(items);
        localStorage.setItem(QUICK_KEY, JSON.stringify(items));
      }
    } catch (e) {
      // Si falla backend, nos quedamos con lo que ya cargamos de localStorage/default
      console.warn("QuickProducts hydrate backend failed:", e);
    } finally {
      if (!cancelled) quickHydratedRef.current = true;
    }
  };

  hydrate();

  return () => {
    cancelled = true;
  };
}, [tenantKey]);

const [showMenuEditor, setShowMenuEditor] = useState(false);

// ❌ Eliminar platillo del menú rápido (ADMIN)
const handleDeleteMenuProduct = (productId) => {
  setQuickProducts((prev) => prev.filter((p) => p.id !== productId));
};

const [menuSections, setMenuSections] = useState(() => {
  try {
    const raw = localStorage.getItem(SECTIONS_KEY);
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

      // ✅ CLAVE PARA EXTRAS
      allowExtras: true,
      // ✅ NUEVO: lista de extras permitidos para este platillo
      extrasIds: [],
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

const [recipeOptions, setRecipeOptions] = useState([]);






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
          label: `${p.sizeSmallLabel || "Chico"} — ${fmtMoney(
            Number(p.sizeSmallPrice || 0)
          )}`,
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
          label: `${p.sizeLargeLabel || "Grande"} — ${fmtMoney(
            Number(p.sizeLargePrice || 0)
          )}`,
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

    // 👉 SIN TAMAÑOS: arma el item final
    const finalPrice = Number(p.price || 0);

    const finalItem = {
      id: `${p.id}-${Date.now()}`,
      baseProductId: p.id,
      name: p.name,
      displayName: `${p.name}${chosenCategory ? " " + chosenCategory : ""}`,
      price: finalPrice,
      sizeLabel: "",
      categoryChoice: chosenCategory,
      inventoryItemId: p.inventoryItemId ?? null,
      menuRecipeId: p.menuRecipeId ?? null,
      allowedExtrasIds: Array.isArray(p.extrasIds) ? p.extrasIds : [],
      section: p.section || "",
    };

    // ✅ Si quiere extras, abre extras y NO agregues todavía
    if (p?.allowExtras) {
      closeQuickPick();
      openExtrasForProduct(finalItem);
      return;
    }

    handleAddProduct(finalItem);
    return closeQuickPick();
  }

  // =======================
  // STEP 2: TAMAÑO (PRECIO CORRECTO)
  // =======================
  if (quickPickStep === "size") {
    const sizeLabel = picked.meta?.sizeLabel || "";
    const finalPrice = Number(picked.meta?.price || 0);
    const categoryChoice = picked.meta?.categoryChoice || "";

   const finalItem = {
  id: `${p.id}-${Date.now()}`,
  baseProductId: p.id,
  name: p.name,
  displayName: `${p.name}${categoryChoice ? " " + categoryChoice : ""}${sizeLabel ? " " + sizeLabel : ""}`,
  price: finalPrice, // ✅ precio según tamaño
  sizeLabel,
  categoryChoice,
  inventoryItemId: p.inventoryItemId ?? null,
  menuRecipeId: p.menuRecipeId ?? null,
allowedExtrasIds: Array.isArray(p.extrasIds) ? p.extrasIds : [],
section: p.section || "",

};

// ✅ Si en QuickPick eligieron "con extras", abre extras ya con precio final (tamaño aplicado)
if (p?.allowExtras) {

  closeQuickPick();
  openExtrasForProduct(finalItem);
  return;
}

handleAddProduct(finalItem);
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


useEffect(() => {
  if (showMenuEditor) {
    loadRecipeOptions();
    loadInventoryOptions(); // 👈 SOLO esto se agrega
  }
}, [showMenuEditor]);

  // =======================
  // ÁREAS / MESAS
  // =======================
const [showCloseModal, setShowCloseModal] = useState(false);
const [closePaymentMethod, setClosePaymentMethod] = useState("CASH");
const [closePaymentRef, setClosePaymentRef] = useState("");
const [closingTable, setClosingTable] = useState(false);
const [openTableIds, setOpenTableIds] = useState(() => new Set());
const [extrasNote, setExtrasNote] = useState("");




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
  const tenantKey = localStorage.getItem("tenant_key") || "default";

const res = await fetch(`${API_URL}/api/areas`, {
  cache: "no-store",
  headers: {
    "X-Tenant": tenantKey,
  },
});

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
    const tenantKey = localStorage.getItem("tenant_key") || "default";

const res = await fetch(`${API_URL}/api/orders/open/table/${table.id}`, {
headers: {
  "x-tenant": tenantKey,
}

});

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
  if (!newAreaName.trim())
    return alert("Escribe un nombre para la nueva área");

  try {
    setCreatingArea(true);

 const tenantKey = localStorage.getItem("tenant_key") || "default";

const res = await fetch(`${API_URL}/api/areas`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Tenant": tenantKey,
  },
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
      const tenantKey = getTenantKeySafe();

const res = await fetch(`${API_URL}/api/areas/${editingAreaId}`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    "X-Tenant-Key": tenantKey,
  },
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
  if (!window.confirm("¿Eliminar esta area y todas sus mesas?")) return;
  try {
    const tenantKey = getTenantKeySafe();

    const res = await fetch(`${API_URL}/api/areas/${areaId}`, {
      method: "DELETE",
      headers: {
        "X-Tenant-Key": tenantKey,
      },
    });

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
    const tenantKey = getTenantKeySafe();

    const res = await fetch(`${API_URL}/api/tables`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Key": tenantKey,
      },
      body: JSON.stringify({
        name: nombreMesa.trim(),
        areaId: area.id,
      }),
    });

    if (!res.ok) throw new Error("No se pudo crear la mesa");
    const createdTable = await res.json();

    setAreas((prev) =>
      prev.map((a) =>
        a.id === area.id
          ? { ...a, tables: [...(a.tables || []), createdTable] }
          : a
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
// ✅ NUEVO (notas + extras persistentes)
  note: String(product.note || ""),
 // ✅ NUEVO
  extras: Array.isArray(product.extras) ? product.extras : [],
  extrasTotal: Number(product.extrasTotal || 0),

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
const wantsExtras = !!p?.allowExtras;




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
    meta: { categoryChoice: c, wantsExtras },
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
  wantsExtras,
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
  wantsExtras,
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
 // ✅ NUEVO: para filtrar extras en el modal
  allowedExtrasIds: Array.isArray(p.extrasIds) ? p.extrasIds : [],
  section: p.section || "",
  };

  // ✅ EXTRAS: abrir DESPUÉS de armar uniqueLine (ya trae nombre/precio final)
if (p?.allowExtras) {
  openExtrasForProduct(uniqueLine);
  return;
}

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
  const invId =
    item.inventoryItemId != null
      ? Number(item.inventoryItemId)
      : item.inventoryItemID != null
      ? Number(item.inventoryItemID)
      : null;

  const recId =
    item.menuRecipeId != null
      ? Number(item.menuRecipeId)
      : item.menuRecipeID != null
      ? Number(item.menuRecipeID)
      : null;

  const promo = PROMO_MAPPINGS[item.name];

  if (promo) {
    expandedItems.push({
      productId: item.productId,
      name: promo.inventoryName,
      price: promo.units > 0 ? Number(item.price) / promo.units : Number(item.price),
      qty: Number(item.qty) * promo.units,

      // ✅ mandamos ambas llaves (compat total)
      inventoryItemId: invId,
      inventoryItemID: invId,
      menuRecipeId: recId,
      menuRecipeID: recId,

      displayName: item.displayName || item.name,
      extras: Array.isArray(item.extras) ? item.extras : [],
      note: item.note || "",
    });
  } else {
    expandedItems.push({
      productId: item.productId,
      name: item.name,
      price: Number(item.price),
      qty: Number(item.qty),

      // ✅ mandamos ambas llaves (compat total)
      inventoryItemId: invId,
      inventoryItemID: invId,
      menuRecipeId: recId,
      menuRecipeID: recId,

      displayName: item.displayName || item.name,
      extras: Array.isArray(item.extras) ? item.extras : [],
      note: item.note || "",
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
  headers: {
    "Content-Type": "application/json",
    "X-Tenant-Key": localStorage.getItem("tenant_key") || "default",
  },
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

const tenantKeyRaw = localStorage.getItem("tenant_key");
const tenantKey =
  tenantKeyRaw && tenantKeyRaw !== "null" && tenantKeyRaw !== "undefined"
    ? tenantKeyRaw
    : "default";

const raw = localStorage.getItem(`pos_shift_baseline_v1_${todayKey}_${tenantKey}`);
const baseline = raw
  ? JSON.parse(raw)
  : { sales: 0, orders: 0, grossSales: 0, cancelledSales: 0 };


    const BASE_URL =
      typeof API_URL !== "undefined" && API_URL
        ? API_URL
        : "";

const res = await fetch(`${BASE_URL}/api/orders/admin/summary-today`, {
  cache: "no-store",
  headers: {
    "X-Tenant-Key": tenantKey,
  },
});


    if (!res.ok) throw new Error("Respuesta no válida del servidor");

    const data = await res.json();

    // ✅ FIX 1: NO restar cancelaciones en el front si el backend ya manda auditoría PRO
    const serverHasAudit =
      data?.grossSales != null ||
      data?.cancelledSales != null ||
      data?.netSales != null;

    if (!serverHasAudit) {
      // (modo compatibilidad viejo)
      const list = Array.isArray(recentOrdersRef.current) ? recentOrdersRef.current : [];

      const cancelledToday = list
        .filter((o) => o?.isCancelled && o?.isPaid)
        .reduce((sum, o) => sum + Number(o?.total || 0), 0);

      const cancelledCountToday = list
        .filter((o) => o?.isCancelled && o?.isPaid).length;

      data.cancelledSales = Number(cancelledToday.toFixed(2));
      data.cancelledOrders = cancelledCountToday;

      data.totalSales = Math.max(0, Number(data.totalSales || 0) - cancelledToday);
      data.totalOrders = Math.max(0, Number(data.totalOrders || 0) - cancelledCountToday);
    }

    if (reqId !== adminSummaryReqIdRef.current) return;

    // ✅ Valores del server (PRO si existen)
    const netFromServer = Number(data.netSales ?? data.totalSales ?? 0);
    const ordersFromServer = Number(data.totalOrders ?? 0);
    const grossFromServer = Number(data.grossSales ?? 0);
    const cancelledFromServer = Number(data.cancelledSales ?? 0);

    // ✅ FIX 2: baseline por turno a TODO
    const uiSales = Math.max(0, netFromServer - Number(baseline.sales || 0));
    const uiOrders = Math.max(0, ordersFromServer - Number(baseline.orders || 0));
    const uiCancelledSales = Math.max(
      0,
      cancelledFromServer - Number(baseline.cancelledSales || 0)
    );
    const uiGrossSales = Math.max(
      0,
      grossFromServer - Number(baseline.grossSales || 0)
    );

    const finalSummary = {
      ...data,
      totalSales: uiSales,              // netas (turno)
      totalOrders: uiOrders,            // pedidos (turno)
      cancelledSales: uiCancelledSales, // cancelaciones (turno)
      grossSales: uiGrossSales,         // brutas (turno)
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

// ✅ Persistencia local de cancelaciones (solo FRONT)
const CANCELLED_ORDERS_KEY = "pos_cancelled_orders_v1";

const readCancelledOrdersSet = () => {
  try {
    const raw = localStorage.getItem(CANCELLED_ORDERS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set((Array.isArray(arr) ? arr : []).map((x) => String(x)));
  } catch {
    return new Set();
  }
};

const writeCancelledOrdersSet = (setObj) => {
  try {
    localStorage.setItem(CANCELLED_ORDERS_KEY, JSON.stringify([...setObj]));
  } catch {}
};


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

    const tenantKeyRaw = localStorage.getItem("tenant_key");
const tenantKey =
  tenantKeyRaw && tenantKeyRaw !== "null" && tenantKeyRaw !== "undefined"
    ? tenantKeyRaw
    : "default";

const res = await fetch(`${API_URL}/api/orders`, {
  cache: "no-store",
  headers: {
    "X-Tenant-Key": tenantKey,
  },
});

    if (!res.ok) throw new Error("No se pudo cargar el historial");
    const data = await res.json();
    const list = Array.isArray(data) ? data.slice(0, 15) : [];

// ✅ Si backend no manda isCancelled, lo completamos con lo guardado local
const cancelledSet = readCancelledOrdersSet();
const listFixed = list.map((o) => {
  const id = o?.id ?? o?.orderId ?? o?._id;
  const isCancelled = Boolean(o?.isCancelled) || cancelledSet.has(String(id));
  return { ...o, isCancelled };
});


    const prev = JSON.stringify(recentOrdersRef.current);
   const next = JSON.stringify(listFixed);

    if (prev !== next) {
      recentOrdersRef.current = listFixed;
setRecentOrders(listFixed);
    }
  } catch (err) {
    console.error(err);
    if (!silent) setOrdersError(err.message || "Error inesperado");
  } finally {
    if (!silent) setLoadingOrders(false);
  }
};



// =======================
// CANCELAR / ROLLBACK (venta cerrada)
// =======================
const handleCancelOrder = async (orderId, total = 0) => {

  try {
    if (!orderId) return;

    const ok = window.confirm(
      `¿Cancelar/rollback la venta #${orderId}?\n\nEsto REVERSA inventario (IN) y marca la orden como cancelada.\nNo borra historial.`
    );
    if (!ok) return;

    const BASE_URL = (typeof API_URL !== "undefined" && API_URL) ? API_URL : "";

    const tenantKeyRaw = localStorage.getItem("tenant_key");
const tenantKey =
  tenantKeyRaw && tenantKeyRaw !== "null" && tenantKeyRaw !== "undefined"
    ? tenantKeyRaw
    : "default";

const res = await fetch(`${BASE_URL}/api/orders/cancel/${orderId}`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    "X-Tenant-Key": tenantKey,
  },
});


    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "No se pudo cancelar la venta");

// ✅ AJUSTE PRO BASELINE (para que no se te vaya a 350 después de cancelar)
try {
  const todayKey = new Date().toLocaleDateString("en-CA");
  const raw = localStorage.getItem(SHIFT_BASELINE_KEY_T(todayKey)
(todayKey));
  const baseline = raw ? JSON.parse(raw) : { sales: 0, orders: 0 };

  const cancelledAmount = Number(total || 0);
 // 👈 si tienes o.total disponible
  // Si NO tienes o.total aquí, usa el total que le llega a la función (te digo abajo)

  const newBaseline = {
    sales: Math.max(0, (baseline.sales || 0) - cancelledAmount),
    orders: Math.max(0, (baseline.orders || 0) - 1),
  };

  localStorage.setItem(SHIFT_BASELINE_KEY_T(todayKey)
(todayKey), JSON.stringify(newBaseline));
} catch {}


    alert(`✅ Venta cancelada: #${orderId}`);
// ✅ Guarda en localStorage para que al recargar "Ventas" siga saliendo CANCELADA
const s = readCancelledOrdersSet();
s.add(String(orderId));
writeCancelledOrdersSet(s);


// ✅ UI inmediata: marca como cancelada en el historial aunque el backend no lo mande
setRecentOrders((prev) =>
  (Array.isArray(prev) ? prev : []).map((o) =>
    String(o?.id) === String(orderId) ? { ...o, isCancelled: true } : o
  )
);


    // refrescos seguros
    Promise.allSettled([
      loadRecentOrders(),
      loadAdminSummary?.(),
      loadInventoryOptions?.(),
      loadLowStock?.(),
    ]);
  } catch (e) {
    console.error(e);
    alert(`❌ ${e?.message || "Error al cancelar"}`);
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
      const tenantKeyRaw = localStorage.getItem("tenant_key");
const tenantKey =
  tenantKeyRaw && tenantKeyRaw !== "null" && tenantKeyRaw !== "undefined"
    ? tenantKeyRaw
    : "default";

const res = await fetch(`${API_URL}/api/orders/debug/inventory-items`, {
  cache: "no-store",
  headers: {
    "x-tenant": tenantKey,
  },
});

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
const [reportsAutoLoaded, setReportsAutoLoaded] = useState(false);

const [dailyReports, setDailyReports] = useState([]);
const [loadingReports, setLoadingReports] = useState(false);
const [reportsError, setReportsError] = useState("");
const [ownerReport, setOwnerReport] = useState(null);


// ✅ NUEVO: REPORTE PRO DEL DUEÑO (KPIs + Top + Ventas por mesa)

const [loadingOwnerReport, setLoadingOwnerReport] = useState(false);
const [ownerError, setOwnerError] = useState("");
const [loadingOwner, setLoadingOwner] = useState(false);

const loadDailyReports = async (fromQ = "", toQ = "") => {
  try {
    setLoadingReports(true);
    setReportsError("");

    const params = new URLSearchParams();

    // ✅ override si viene desde auto-range o botón buscar
    const f = fromQ || reportFrom;
    const t = toQ || reportTo;

    if (f) params.append("from", f);
    if (t) params.append("to", t);

    const tenantKey = getTenantKeySafe();

    const res = await fetch(
      `${API_URL}/api/reports/daily${params.toString() ? `?${params.toString()}` : ""}`,
      {
        headers: {
          "X-Tenant-Key": tenantKey,
        },
      }
    );

    if (!res.ok) throw new Error("No se pudo cargar reportes diarios");

    const data = await res.json();

    // ✅ COMPAT: si el backend manda { dailyReports: [], ownerReport: {} }
    const list =
      (data && Array.isArray(data.dailyReports) && data.dailyReports) ||
      (data && Array.isArray(data.reports) && data.reports) ||
      (Array.isArray(data) ? data : []);

    setDailyReports(list);

    // ✅ COMPAT: si viene ownerReport en el mismo endpoint, lo guardamos también
    // (evita ownerReport is not defined y te regresa KPIs/Top/Mesas para UI)
    if (data && data.ownerReport !== undefined) {
      setOwnerReport(data.ownerReport);
    }
  } catch (err) {
    console.error(err);
    setReportsError(err.message || "Error al cargar reportes diarios");
  } finally {
    setLoadingReports(false);
  }
};


// =======================
// REPORTE PRO DEL DUEÑO
// =======================
const loadOwnerReport = async (fromOverride, toOverride) => {
  try {
    setLoadingOwnerReport(true);
    setOwnerError("");

    // ✅ (aunque este endpoint no use fechas, dejamos el override listo sin romper nada)
    const fromQ = fromOverride ?? reportFrom;
    const toQ = toOverride ?? reportTo;
    void fromQ;
    void toQ;

    // ✅ usa endpoint REAL que sí tienes en orders.routes.js
    const tenantKey = getTenantKeySafe();

    const res = await fetch(`${API_URL}/api/orders/admin/summary`, {
      cache: "no-store",
      headers: {
        "X-Tenant-Key": tenantKey,
      },
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
const cashHydratedRef = useRef(false);
const tenantKeyStable = useMemo(() => getTenantKeySafe(), []);
;







const dayStamp = new Date().toDateString(); // cambia cuando cambia el día (en el próximo render)
const todayKey = useMemo(() => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}, [dayStamp]);

 
// keys por día (NO redefinir CASH_MOVES_KEY aquí)

const cashMovesKeyToday = `pos_cash_moves_v1_${todayKey}_${tenantKeyStable}`;

const cashCountKeyToday = `pos_cash_count_v1_${todayKey}_${tenantKeyStable}`;




const shiftBaselineKeyToday = SHIFT_BASELINE_KEY(todayKey);

// 1️⃣ Cargar desde localStorage (SOLO lee)
useEffect(() => {
  try {
    const raw = localStorage.getItem(cashMovesKeyToday);
    if (raw) setCashMoves(JSON.parse(raw));
  } catch {}
}, [cashMovesKeyToday]);

// 2️⃣ Guardar en localStorage (NO pisa con vacío en mount)
useEffect(() => {
  if (cashMoves.length === 0) return; // 👈 CLAVE: evita borrar al refrescar
  try {
    localStorage.setItem(cashMovesKeyToday, JSON.stringify(cashMoves));
  } catch {}
}, [cashMoves, cashMovesKeyToday]);


const cashCountHydratedRef = useRef(false);

useEffect(() => {
  cashCountHydratedRef.current = false;
  try {
    const raw = localStorage.getItem(cashCountKeyToday);
    setCashCount(raw ? String(raw) : "");
  } catch {
    setCashCount("");
  } finally {
    cashCountHydratedRef.current = true;
  }
}, [cashCountKeyToday]);

useEffect(() => {
  if (!cashCountHydratedRef.current) return;
  try {
    localStorage.setItem(cashCountKeyToday, String(cashCount || ""));
  } catch {}
}, [cashCount, cashCountKeyToday]);




  const sumIn = cashMoves
    .filter((m) => m.type === "in")
    .reduce((acc, m) => acc + Number(m.amount || 0), 0);
  const sumOut = cashMoves
    .filter((m) => m.type === "out")
    .reduce((acc, m) => acc + Number(m.amount || 0), 0);
  const netMoves = sumIn - sumOut;

useEffect(() => {
  if (reportsAutoLoaded) return;

  const { from, to } = getAutoRange(7); // últimos 7 días
  setReportFrom(from);
  setReportTo(to);

  loadDailyReports(from, to);
  loadOwnerReport(); // tu resumen admin/summary

  setReportsAutoLoaded(true);
}, [reportsAutoLoaded]);




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
   const tenantKey = getTenantKeySafe();

const res = await fetch(`${API_URL}/api/reports/today`, {
  headers: {
    "X-Tenant-Key": tenantKey,
  },
});

const tenantPlan = localStorage.getItem("tenant_plan") || "FREE";
if (tenantPlan === "FREE") {
  alert("WhatsApp no disponible en el plan FREE");
  return;
}


    if (!res.ok) {
      alert("No se pudo leer el reporte del día");
      return;
    }
    const todayReport = await res.json();
  

    // ✅ Anti-crash: si el backend regresa null/undefined, no truena
    const safeReport =
      todayReport && typeof todayReport === "object" ? todayReport : {};

    if (!todayReport) {
      // opcional: aviso, pero no detiene si quieres mandar ceros
      // alert("Reporte del día vacío. Se enviará en ceros.");
    }


    // 2) Pedir número
    const phone = prompt("Número de WhatsApp (con lada, ej. 521XXXXXXXXXX):");
    if (!phone) return;

    // 3) Formateo
    const fmtMoney = (n) =>
      new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
        Number(n || 0)
      );

    const totalOrders = Number(safeReport.totalOrders || 0);
    const totalSales = Number(safeReport.totalSales || 0);

    const cash = Number(safeReport.paymentCash || 0);
    const card = Number(safeReport.paymentCard || 0);
    const transfer = Number(safeReport.paymentTransfer || 0);

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

  // ✅ FIX CRÍTICO: declarar BASE_URL UNA SOLA VEZ, antes de usarlo
  const BASE_URL = import.meta.env.VITE_API_URL || "";

  // ✅ 0) Generar corte en backend (esto llena DailyReport)
  try {
    const tenantKey = getTenantKeySafe();

const res = await fetch(`${BASE_URL}/api/reports/close-day`, {
  method: "POST",
  headers: {
    "X-Tenant-Key": tenantKey,
  },
});



    if (!res.ok) throw new Error("No se pudo generar el corte en el servidor");
  } catch (e) {
    alert(
      "⚠️ No se generó el corte en servidor. Revisa backend.\n" + (e.message || "")
    );
    return; // ⛔ no limpies nada si no se guardó el corte
  }

  const todayKey = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local

  try {
   // 1) Traer resumen real DEL DÍA (antes del corte)
const tenantKeyRaw = localStorage.getItem("tenant_key");
const tenantKey =
  tenantKeyRaw && tenantKeyRaw !== "null" && tenantKeyRaw !== "undefined"
    ? tenantKeyRaw
    : "default";
const baselineKey = `pos_shift_baseline_v1_${todayKey}_${tenantKey}`;

const resSum = await fetch(`${BASE_URL}/api/orders/admin/summary-today`, {
  cache: "no-store",
  headers: {
    "X-Tenant-Key": tenantKey,
  },
});

if (!resSum.ok) throw new Error("No se pudo leer resumen para cierre");

// ✅ FIX: el JSON viene de resSum (no de "res")
const data = await resSum.json();
const backendSales = Number(data?.totalSales || 0);
const backendOrders = Number(data?.totalOrders || 0);

// 2) Guardar baseline (shift) = “hasta aquí quedó el día”
localStorage.setItem(
  baselineKey,
  JSON.stringify({
    sales: backendSales,
    orders: backendOrders,
    grossSales: Number(data?.grossSales || 0),
    cancelledSales: Number(data?.cancelledSales || 0),
    closedAt: new Date().toISOString(),
  })
);


// 3) Limpiar caja del día (por key del día)
localStorage.removeItem(`pos_cash_moves_v1_${todayKey}_${tenantKey}`);

setCashMoves([]);
setCashCount("");

// ✅ CIERRE DE DÍA: NO LLAMAR /api/orders/close-day
// Ese endpoint es de órdenes y hoy está fallando en backend.
// El corte real ya se guardó con /api/reports/close-day.



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
      localStorage.setItem(QUICK_KEY, JSON.stringify(updated));
    } catch {}
    return updated;
  });
};

// ======================
// QUICK MENU - DB (PUT) autosave
// ======================
const quickSaveTimerRef = useRef(null);

useEffect(() => {
  // Solo autosave si ya hidrató (evita guardar basura al arrancar)
  if (!quickHydratedRef.current) return;
  if (!isAdmin) return;
  if (!showMenuEditor) return;

  if (quickSaveTimerRef.current) clearTimeout(quickSaveTimerRef.current);

  quickSaveTimerRef.current = setTimeout(async () => {
    try {
      const base = import.meta.env.VITE_API_URL || "http://localhost:4000";
      await fetch(`${base}/api/quick-products`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...tenantHeaders(),
        },
        body: JSON.stringify({ items: quickProducts }),
      });
    } catch {
      // silencioso para no romper
    }
  }, 700);

  return () => {
    if (quickSaveTimerRef.current) clearTimeout(quickSaveTimerRef.current);
  };
}, [quickProducts, showMenuEditor, isAdmin]);


useEffect(() => {
  if (!isAdmin) {
    setActiveTab("mesas");
  }
}, [isAdmin]);



const loadRecipeOptions = async () => {
  try {
    const BASE_URL = typeof API_URL !== "undefined" && API_URL ? API_URL : "";
    const tenantKey = getTenantKeySafe();

const res = await fetch(`${BASE_URL}/api/menu-recipes`, {
  cache: "no-store",
  headers: {
    "X-Tenant-Key": tenantKey,
  },
});

    if (!res.ok) return;
    const data = await res.json();
    setRecipeOptions(Array.isArray(data) ? data : []);
  } catch {}
};

const MAX_EXTRAS = 2;
const MIN_EXTRAS = 1; // ← si NO quieres obligatorio, pon 0


function getTenantKeySafe() {
  const t = localStorage.getItem("tenant_key");
  return t && t !== "null" && t !== "undefined" ? t : "default";
}

// Helper estándar para headers (RECOMENDADO)
function tenantHeaders(extra = {}) {
  return {
    ...extra,
    "Content-Type": "application/json",
    "X-Tenant-Key": getTenantKeySafe(),
  };
}

// Detectar tenant por subdominio
const host = window.location.hostname; // ej: cliente1.tudominio.com
const parts = host.split(".");
if (parts.length >= 3) {
  const subdomain = parts[0];
  localStorage.setItem("tenant_key", subdomain);
}


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
    const tenantKey = getTenantKeySafe();

    await fetch(
      `${API_URL}/api/orders/close-table/${selectedTable.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Key": tenantKey,
        },
        body: JSON.stringify({
          paymentMethod: closePaymentMethod,
          paymentRef:
            closePaymentMethod === "TRANSFER"
              ? closePaymentRef
              : "",
        }),
      }
    );

    // 🖨️ Imprimir ticket (si existe printTicket / QZ listo)
    try {
      const currentOrder = ordersByTable[selectedTable.id] || { items: [] };

      // ✅ IMPORTANTE: aquí llama TU función real de impresión
      // (la que ya usas en "Imprimir prueba" / QZ Tray)
      await printTicket({
        table: selectedTable,
        items: currentOrder.items,
        paymentMethod: closePaymentMethod,
        paymentRef: closePaymentRef,
      });
    } catch (e) {
      console.warn("printTicket falló:", e);
    }

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

{tenantPlan !== "FREE" && (
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
)}


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
{/* Ventas netas */}
<div
  style={{
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.35)",
    backgroundColor: "rgba(2,6,23,0.35)",
  }}
>
  <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
    Ventas netas
  </p>
  <p style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
    {fmtMoney(Number(adminSummary.totalSales || 0))}
  </p>
</div>

{/* Ventas brutas */}
<div
  style={{
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.35)",
    backgroundColor: "rgba(2,6,23,0.35)",
  }}
>
  <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
    Ventas brutas
  </p>
  <p style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
    {fmtMoney(Number(adminSummary.grossSales || 0))}
  </p>
</div>

{/* Cancelaciones */}
<div
  style={{
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(239,68,68,0.35)",
    backgroundColor: "rgba(239,68,68,0.08)",
  }}
>
  <p style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>
    Cancelaciones
  </p>
  <p style={{ fontSize: 22, fontWeight: 900, margin: 0, color: "#fecaca" }}>
    {fmtMoney(Number(adminSummary.cancelledSales || 0))}
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
<div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
  🖨️ Impresora: <b>{printerName ? printerName : "No configurada"}</b>
</div>


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
/* ✅ EXTRAS (para cocina) */}
{Array.isArray(item.extras) && item.extras.length > 0 && (
  <div style={{ marginTop: 6, display: "grid", gap: 2 }}>
    {item.extras.map((ex) => (
      <div
        key={ex.id || ex.name}
        style={{ fontSize: 11, opacity: 0.9, fontWeight: 700 }}
      >
        • {ex.name} ({fmtMoney(ex.price)})
      </div>
    ))}
  </div>
)}

{/* ✅ NOTA (para cocina) */}
{String(item.note || "").trim() && (
  <div style={{ marginTop: 6, fontSize: 11, opacity: 0.85 }}>
    <span style={{ fontWeight: 900 }}>Nota:</span> {String(item.note).trim()}
  </div>
)}


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



  // ✅ Si NO permite extras → agrega directo (tu lógica normal)
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

           
{showExtrasEditor && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(2,6,23,0.82)",
      zIndex: 10000,
      display: "grid",
      placeItems: "center",
      padding: 16,
    }}
  >
    <div
      style={{
        width: "min(560px, 96vw)",
        background:
          "radial-gradient(circle at top left, rgba(30,41,59,0.92), rgba(15,23,42,0.98))",
        border: "1px solid rgba(148,163,184,0.22)",
        borderRadius: 18,
        padding: 16,
        color: "var(--pos-text, #e5e7eb)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.50)",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          paddingBottom: 12,
          borderBottom: "1px solid rgba(148,163,184,0.18)",
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 1000, fontSize: 16, letterSpacing: 0.2 }}>
            Catálogo de extras
          </div>
          <div style={{ fontSize: 12, opacity: 0.82, marginTop: 4 }}>
            Agrega extras una vez y luego asígnalos a cada platillo con checks.
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowExtrasEditor(false)}
          style={{
            borderRadius: 999,
            border: "1px solid rgba(148,163,184,0.35)",
            background: "rgba(2,6,23,0.28)",
            color: "var(--pos-text, #e5e7eb)",
            padding: "8px 12px",
            cursor: "pointer",
            fontWeight: 900,
            height: 36,
            whiteSpace: "nowrap",
          }}
        >
          Cerrar
        </button>
      </div>

      {/* LISTA */}
      <div
        style={{
          display: "grid",
          gap: 10,
          maxHeight: "36vh",
          overflow: "auto",
          paddingRight: 2,
        }}
      >
        {extrasCatalog.length === 0 ? (
          <div
            style={{
              border: "1px dashed rgba(148,163,184,0.25)",
              background: "rgba(2,6,23,0.20)",
              borderRadius: 14,
              padding: 12,
              fontSize: 12,
              opacity: 0.85,
            }}
          >
            Aún no tienes extras. Agrega el primero abajo.
          </div>
        ) : (
          extrasCatalog.map((e, idx) => (
            <div
              key={e.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.18)",
                background: "rgba(2,6,23,0.22)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 13, lineHeight: 1.2 }}>
                  {e.name}{" "}
                  <span style={{ opacity: 0.75, fontWeight: 800 }}>
                    • {e.appliesTo}
                  </span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                  ${Number(e.price || 0).toFixed(2)}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  saveExtrasCatalog(extrasCatalog.filter((_, i) => i !== idx))
                }
                title="Eliminar"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid rgba(239,68,68,0.55)",
                  background: "rgba(239,68,68,0.12)",
                  color: "#fecaca",
                  cursor: "pointer",
                  fontWeight: 1000,
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* FORM */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid rgba(148,163,184,0.18)",
          display: "grid",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 140px",
            gap: 10,
          }}
        >
          <input
            placeholder="Nombre del extra"
            value={newExtra.name}
            onChange={(e) => setNewExtra({ ...newExtra, name: e.target.value })}
            style={{
              width: "100%",
              minWidth: 0,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(2,6,23,0.25)",
              color: "var(--pos-text, #e5e7eb)",
              fontWeight: 800,
              outline: "none",
              height: 40,
              boxSizing: "border-box",
            }}
          />

          <input
            type="number"
            placeholder="Precio"
            value={newExtra.price}
            onChange={(e) => setNewExtra({ ...newExtra, price: e.target.value })}
            style={{
              width: "100%",
              minWidth: 0,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(2,6,23,0.25)",
              color: "var(--pos-text, #e5e7eb)",
              fontWeight: 900,
              outline: "none",
              height: 40,
              boxSizing: "border-box",
            }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 10,
            alignItems: "center",
          }}
        >
          <select
            value={newExtra.appliesTo}
            onChange={(e) =>
              setNewExtra({ ...newExtra, appliesTo: e.target.value })
            }
            style={{
              width: "100%",
              minWidth: 0,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(2,6,23,0.25)",
              color: "var(--pos-text, #e5e7eb)",
              fontWeight: 900,
              outline: "none",
              height: 40,
              boxSizing: "border-box",
            }}
          >
            <option value="Comida">Comida</option>
            <option value="Bebidas">Bebidas</option>
          </select>

          <button
            type="button"
            onClick={() => {
              if (!newExtra.name || !newExtra.price) return;
              saveExtrasCatalog([
                ...extrasCatalog,
                {
                  id: "extra-" + Date.now(),
                  name: newExtra.name,
                  price: Number(newExtra.price),
                  appliesTo: newExtra.appliesTo,
                },
              ]);
              setNewExtra({ name: "", price: "", appliesTo: "Comida" });
            }}
            style={{
              borderRadius: 999,
              border: "1px solid rgba(34,197,94,0.75)",
              background: "rgba(22,163,74,0.14)",
              color: "#bbf7d0",
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 1000,
              height: 40,
              whiteSpace: "nowrap",
            }}
          >
            + Agregar extra
          </button>
        </div>
      </div>
    </div>
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
   "110px 240px 190px 260px 90px 170px 190px 160px 210px 210px 52px",

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
  style={editorSelectStyle}
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
               style={editorSelectStyle}

              />

              {/* FOTO (compacta) - en edición NO se muestra preview para que no ocupe espacio */}
<div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
  <details style={{ minWidth: 0, width: "100%" }}>
    <summary
 style={editorSelectStyle}
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
              style={editorSelectStyle}
              />

              {/* PRECIO BASE */}
              <input
                type="number"
                value={p.price || 0}
                placeholder="Precio"
                onChange={(e) => handleMenuFieldChange(p.id, "price", e.target.value)}
                style={editorSelectStyle}
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

<select
  value={p.menuRecipeId || ""}
  onChange={(e) => {
    const val = e.target.value ? Number(e.target.value) : null;

    // ✅ si eliges receta, opcionalmente limpiamos inventoryItemId para evitar confusión
    handleMenuFieldChange(p.id, "menuRecipeId", val);
// IMPORTANTE: NO borrar inventoryItemId aquí.
// Tu backend descuenta por inventoryItemId; si lo pones en null, no descuenta nada.

  }}
  style={editorSelectStyle}
>
  <option value="">(Sin receta)</option>
  {recipeOptions.map((r) => (
    <option key={r.id} value={r.id}>
      {r.menuName || r.name}
    </option>
  ))}
</select>

<select
  value={p.allowExtras ? "yes" : "no"}
  onChange={(e) =>
    handleMenuFieldChange(p.id, "allowExtras", e.target.value === "yes")
  }
  style={editorSelectStyle}
>
  <option value="no">Sin extras</option>
  <option value="yes">Con extras</option>
</select>


{p?.allowExtras && (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
      gap: 8,
      padding: 10,
      borderRadius: 12,
      border: "1px solid rgba(148,163,184,0.25)",
      background: "rgba(2,6,23,0.35)",
    }}
  >
    {(extrasCatalog || []).map((extra) => {
      const checked = Array.isArray(p.extrasIds)
        ? p.extrasIds.includes(extra.id)
        : false;

      return (
        <label
          key={extra.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            cursor: "pointer",
            opacity:
              extra.appliesTo &&
              p.section &&
              extra.appliesTo !== p.section
                ? 0.4
                : 1,
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              const current = Array.isArray(p.extrasIds)
                ? p.extrasIds
                : [];

              const next = e.target.checked
                ? [...current, extra.id]
                : current.filter((id) => id !== extra.id);

              handleMenuFieldChange(p.id, "extrasIds", next);
            }}
          />
          <span>
            {extra.name} (+${Number(extra.price || 0)})
          </span>
        </label>
      );
    })}
  </div>
)}


<button
  type="button"
  onClick={() => setShowExtrasEditor(true)}
  style={{
    width: "100%",
    minWidth: 0,
    height: 40,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(2,6,23,0.28)",
    color: "var(--pos-text, #e5e7eb)",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    boxSizing: "border-box",
  }}
>
  Editar catálogo de extras
</button>



{/* INVENTARIO */}
<select
 value={p.inventoryItemId ? String(p.inventoryItemId) : ""}
onChange={(e) =>
  handleMenuFieldChange(p.id, "inventoryItemId", e.target.value ? Number(e.target.value) : null)
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
    boxSizing: "border-box",
    height: 40,
  }}
>
  <option value="">(Sin inventario)</option>
<option value="">DEBUG: {Array.isArray(inventoryOptions) ? inventoryOptions.length : "NO_ARRAY"}</option>


  {(inventoryOptions || []).map((it) => (
    <option key={it.id} value={String(it.id)}>

      {it.name ?? it.nombre ?? `Item #${it.id}`}

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




{extrasOpen && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 10000,
      background: "rgba(2,6,23,0.82)",
      display: "grid",
      placeItems: "center",
      padding: 16,
    }}
  >
    <div
      style={{
        width: "min(720px, 96vw)",
        borderRadius: 18,
        padding: 16,
        border: "1px solid rgba(148,163,184,0.22)",
        background:
          "radial-gradient(circle at top left, rgba(30,41,59,0.92), rgba(15,23,42,0.98))",
        boxShadow: "0 24px 80px rgba(0,0,0,0.50)",
        color: "var(--pos-text, #e5e7eb)",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          padding: "6px 6px 12px",
          borderBottom: "1px solid rgba(148,163,184,0.18)",
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 1000, fontSize: 16, letterSpacing: 0.2 }}>
            Extras para: {extrasProduct?.name || "Producto"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.82, marginTop: 4 }}>
            Selecciona extras y confirma
          </div>
        </div>

        <button
          onClick={() => {
            setExtrasOpen(false);
            setExtrasProduct(null);
            setExtrasSelected([]);
          }}
          style={{
            borderRadius: 999,
            border: "1px solid rgba(148,163,184,0.35)",
            background: "rgba(2,6,23,0.28)",
            color: "var(--pos-text, #e5e7eb)",
            padding: "8px 12px",
            cursor: "pointer",
            fontWeight: 900,
            height: 36,
            whiteSpace: "nowrap",
          }}
        >
          Cerrar
        </button>
      </div>

      {/* LISTA */}
      <div
        style={{
          marginTop: 8,
          display: "grid",
          gap: 10,
          maxHeight: "52vh",
          overflow: "auto",
          paddingRight: 2,
        }}
      >
        {(visibleExtras || []).map((e) => {
          const active = extrasSelected.some((x) => x.id === e.id);
          return (
            <button
              key={e.id}
              onClick={() => toggleExtra(e)}
              style={{
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                padding: "12px 12px",
                borderRadius: 14,
                border: active
                  ? "1px solid rgba(34,197,94,0.75)"
                  : "1px solid rgba(148,163,184,0.22)",
                background: active
                  ? "rgba(34,197,94,0.14)"
                  : "rgba(2,6,23,0.22)",
                color: "var(--pos-text, #e5e7eb)",
                cursor: "pointer",
                boxShadow: active ? "0 10px 30px rgba(0,0,0,0.18)" : "none",
              }}
            >
              <span style={{ fontWeight: 900, fontSize: 13 }}>
                {e.name}
                <span style={{ fontSize: 11, opacity: 0.75, marginLeft: 8 }}>
                  {String(e.appliesTo || "") ? `• ${e.appliesTo}` : ""}
                </span>
              </span>

              <span style={{ fontWeight: 1000, fontSize: 13 }}>
                {fmtMoney(e.price)}
              </span>
            </button>
          );
        })}
      </div>



      {/* FOOTER */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          paddingTop: 12,
          borderTop: "1px solid rgba(148,163,184,0.18)",
        }}
      >
        <div style={{ fontWeight: 1000 }}>
          Extras: {fmtMoney(calcExtrasTotal(extrasSelected))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={addWithoutExtras}
            style={{
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(2,6,23,0.28)",
              color: "var(--pos-text, #e5e7eb)",
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 1000,
              height: 40,
              whiteSpace: "nowrap",
            }}
          >
            Sin extras
          </button>

          <button
  onClick={() => {
    if (extrasSelected.length < MIN_EXTRAS) {
      alert(`Debes elegir al menos ${MIN_EXTRAS} extra`);
      return;
    }
    addWithExtras();
  }}
>
  Agregar con extras
</button>

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
// ✅ Compatibilidad: si el backend usa otro nombre, igual la detectamos
const isCancelled =
  Boolean(o?.isCancelled) ||
  Boolean(o?.isCanceled) ||
  Boolean(o?.cancelledAt) ||
  Boolean(o?.rollbackAt) ||
  String(o?.status || "").toUpperCase() === "CANCELLED";


            return (
              <div
                key={o.id || `${tableLabel}-${when}`}
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(148,163,184,0.30)",
                  backgroundColor: "rgba(2,6,23,0.25)",
                  padding: 12,
                  opacity: o.isCancelled ? 0.75 : 1,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 1000 }}>{tableLabel}</div>

                      {/* ✅ badge opcional (si tu backend lo manda) */}
                      {o.isCancelled && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: "1px solid rgba(239,68,68,0.70)",
                            background: "rgba(239,68,68,0.14)",
                            color: "#fecaca",
                          }}
                        >
                          CANCELADA
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 11, opacity: 0.75 }}>{when || "Sin fecha"}</div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 1000 }}>{fmtMoney(total)}</div>

{isCancelled && (
  <span
    style={{
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 900,
      color: "#fecaca",
      border: "1px solid rgba(239,68,68,0.6)",
      background: "rgba(239,68,68,0.15)",
      marginLeft: 8,
      whiteSpace: "nowrap",
    }}
  >
    CANCELADA
  </span>
)}


                    {/* ✅ BOTÓN CANCELAR (solo admin + solo ventas pagadas + no cancelada) */}
                    {isAdmin && Boolean(o.isPaid) && !isCancelled && (
  <button
    type="button"
    onClick={() => handleCancelOrder(o.id, Number(o.total || 0))}

    style={{
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(239,68,68,0.85)",
      background: "rgba(239,68,68,0.12)",
      color: "#fecaca",
      fontSize: 12,
      cursor: "pointer",
      fontWeight: 900,
      whiteSpace: "nowrap",
    }}
    title="Cancela la venta y revierte inventario"
  >
    Cancelar
  </button>
                    )}
                  </div>
                </div>



                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
               {(Array.isArray(o.items) ? o.items : []).map((it, idx) => {
  const qty = Number(it.qty || 1);
  const price = Number(it.price || 0);

  return (
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
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ opacity: 0.95 }}>
          {(it.displayName || it.name)}{" "}
          <span style={{ opacity: 0.75 }}>x {qty}</span>
        </div>

        {/* ✅ EXTRAS (para cocina) */}
        {Array.isArray(it.extras) && it.extras.length > 0 && (
          <div style={{ display: "grid", gap: 2 }}>
            {it.extras.map((ex) => (
              <div
                key={ex.id || ex.name}
                style={{ fontSize: 11, opacity: 0.9, fontWeight: 700 }}
              >
                • {ex.name} ({fmtMoney(Number(ex.price || 0))})
              </div>
            ))}
          </div>
        )}

        {/* ✅ NOTA (para cocina) */}
        {String(it.note || "").trim() && (
          <div style={{ fontSize: 11, opacity: 0.85 }}>
            <span style={{ fontWeight: 900 }}>Nota:</span> {String(it.note).trim()}
          </div>
        )}
      </div>

      <div style={{ opacity: 0.9, alignSelf: "flex-start" }}>
        {fmtMoney(price * qty)}
      </div>
    </div>
  );
})}



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
{/*
{tenantPlan !== "FREE" && (
  <pre style={{ fontSize: 11, opacity: 0.8 }}>
    {JSON.stringify({ dailyReports, ownerReport }, null, 2)}
  </pre>
)}
*/}
        {activeTab === "reportes" && (
  tenantPlan === "FREE" ? (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        border: "1px solid rgba(239,68,68,0.35)",
        background: "rgba(2,6,23,0.35)",
        color: "var(--pos-text, #e5e7eb)",
        marginTop: 10,
      }}
    >
      <div style={{ fontWeight: 1000, marginBottom: 6 }}>
        🔒 Reportes bloqueados
      </div>
      <div style={{ fontSize: 12, opacity: 0.85 }}>
        Tu plan es <b>{tenantPlan}</b>. Para usar reportes necesitas <b>PRO</b> o <b>FULL</b>.
      </div>
    </div>
  ) : (

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
)
        )}

        {/* ===== INVENTARIO ===== */}
        {activeTab === "invent" && (
  tenantPlan !== "FULL" ? (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        border: "1px solid rgba(239,68,68,0.35)",
        background: "rgba(2,6,23,0.35)",
        color: "var(--pos-text, #e5e7eb)",
        marginTop: 10,
      }}
    >
      <div style={{ fontWeight: 1000, marginBottom: 6 }}>
        🔒 Inventario bloqueado
      </div>
      <div style={{ fontSize: 12, opacity: 0.85 }}>
        Tu plan es <b>{tenantPlan}</b>. Para usar inventario necesitas <b>FULL</b>.
      </div>
    </div>
  ) : (
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
<div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
  <button
    type="button"
    onClick={async () => {
      await loadMenuRecipes();
      setShowRecipesPro(true);
    }}
    style={{
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(34,197,94,0.75)",
      background: "rgba(22,163,74,0.12)",
      color: "#bbf7d0",
      fontSize: 12,
      cursor: "pointer",
      fontWeight: 900,
    }}
  >
    🍔 Recetas PRO
  </button>
</div>

              <InventoryPanel />
            </Section>
          </>
)
        )}

{showRecipesPro && (
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
      if (e.target === e.currentTarget) setShowRecipesPro(false);
    }}
  >
    <div
      style={{
        width: "min(980px, 96vw)",
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
          <div style={{ fontSize: 14, fontWeight: 1000 }}>Recetas PRO</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>
            Tip PRO: usa unidades mínimas (g/ml/pz) y cantidades enteras.
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowRecipesPro(false)}
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
          title="Cerrar"
        >
          ✕
        </button>
      </div>

      {!!recipesError && (
        <div style={{ fontSize: 12, color: "#fecaca", marginBottom: 8 }}>
          {recipesError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 12 }}>
        {/* LISTA */}
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(15,23,42,0.55)",
            padding: 10,
            maxHeight: 440,
            overflow: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>Tus recetas</div>
            <button
              type="button"
              onClick={() => setRecipeDraft(emptyRecipe)}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.45)",
                background: "rgba(2,6,23,0.25)",
                color: "var(--pos-text, #e5e7eb)",
                fontSize: 11,
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              + Nueva
            </button>
          </div>

          {recipesLoading ? (
            <div style={{ fontSize: 12, opacity: 0.75 }}>Cargando…</div>
          ) : menuRecipes.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.75 }}>Aún no hay recetas.</div>
          ) : (
            menuRecipes.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 10px",
                  borderRadius: 14,
                  border: "1px solid rgba(148,163,184,0.16)",
                  background: "rgba(2,6,23,0.30)",
                  marginBottom: 8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.menuName}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>
                    Ingredientes: {Array.isArray(r.items) ? r.items.length : 0}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setRecipeDraft({ id: r.id, menuName: r.menuName || "", items: Array.isArray(r.items) ? r.items : [] })}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,0.45)",
                      background: "rgba(2,6,23,0.25)",
                      color: "var(--pos-text, #e5e7eb)",
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteRecipeById(r.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(239,68,68,0.55)",
                      background: "rgba(239,68,68,0.10)",
                      color: "var(--pos-text, #e5e7eb)",
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* EDITOR */}
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(15,23,42,0.55)",
            padding: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85, marginBottom: 8 }}>
            {recipeDraft.id ? "Editar receta" : "Nueva receta"}
          </div>

          <input
            value={recipeDraft.menuName}
            onChange={(e) => setRecipeDraft((p) => ({ ...p, menuName: e.target.value }))}
            placeholder="Nombre receta (ej. Hamburguesa de pollo)"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(2,6,23,0.55)",
              color: "var(--pos-text, #e5e7eb)",
              fontSize: 12,
              fontWeight: 900,
              marginBottom: 10,
            }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 900 }}>Ingredientes</div>
            <button
              type="button"
              onClick={addRecipeLine}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(34,197,94,0.75)",
                background: "rgba(22,163,74,0.12)",
                color: "#bbf7d0",
                fontSize: 11,
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              + Agregar ingrediente
            </button>
          </div>

          {(recipeDraft.items || []).map((it, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 44px",
                gap: 8,
                alignItems: "center",
                padding: 8,
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.16)",
                background: "rgba(2,6,23,0.30)",
                marginBottom: 8,
              }}
            >
              <select
                value={it.inventoryItemId ?? ""}
                onChange={(e) => updateRecipeLine(idx, "inventoryItemId", e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(75,85,99,0.9)",
                  backgroundColor: "rgba(15,23,42,0.96)",
                  color: "var(--pos-text, #e5e7eb)",
                  fontSize: 11,
                }}
              >
                <option value="">(Selecciona inventario)</option>
                {(inventoryOptions || []).map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={it.qty ?? 1}
                onChange={(e) => updateRecipeLine(idx, "qty", e.target.value)}
                placeholder="Cantidad"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(75,85,99,0.9)",
                  backgroundColor: "rgba(15,23,42,0.96)",
                  color: "var(--pos-text, #e5e7eb)",
                  fontSize: 11,
                  fontWeight: 900,
                }}
              />

              <button
                type="button"
                onClick={() => removeRecipeLine(idx)}
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
                title="Quitar"
              >
                ✕
              </button>
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button
              type="button"
              onClick={saveRecipeDraft}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(34,197,94,0.75)",
                background:
                  "radial-gradient(circle at top left, rgba(34,197,94,0.22), rgba(15,23,42,0.98))",
                color: "#bbf7d0",
                fontSize: 12,
                fontWeight: 1000,
                cursor: "pointer",
              }}
            >
              Guardar receta
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
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
<Section title="Impresión (QZ Tray)">
  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
    <button
      type="button"
      onClick={async () => {
        const list = await qzListPrinters();
        setPrinters(list || []);
        alert("✅ Impresoras cargadas");
      }}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(148,163,184,0.35)",
        background: "rgba(2,6,23,0.25)",
        color: "#e5e7eb",
        fontSize: 11,
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      Detectar impresoras
    </button>

    <select
      value={printerName}
      onChange={(e) => {
        setPrinterName(e.target.value);
        try { localStorage.setItem("pos_printer_name_v1", e.target.value); } catch {}
      }}
      style={{
        padding: "8px 10px",
        borderRadius: 12,
        border: "1px solid rgba(75,85,99,0.9)",
        backgroundColor: "rgba(15,23,42,0.96)",
        color: "#e5e7eb",
        fontSize: 11,
        fontWeight: 800,
        height: 40,
        minWidth: 260,
      }}
    >
      <option value="">(Selecciona impresora)</option>
      {(printers || []).map((p) => (
        <option key={p} value={p}>{p}</option>
      ))}
    </select>

    <button
      type="button"
      onClick={async () => {
        if (!printerName) return alert("Selecciona impresora primero");
        await qzPrintEscpos(printerName, [
          "POS MULTI BAR",
          "--------------------------",
          "Ticket de prueba",
          `Fecha: ${new Date().toLocaleString("es-MX")}`,
          "Gracias :)",
        ]);
      }}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(34,197,94,0.55)",
        background: "rgba(34,197,94,0.18)",
        color: "#e5e7eb",
        fontSize: 11,
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      Imprimir prueba
    </button>
  </div>

  <div style={{ marginTop: 8, fontSize: 11, opacity: 0.75 }}>
    Estado: <b>{printerName ? printerName : "No configurada"}</b>
  </div>
</Section>

            </Accordion>
          </>
        )}


{false && (
  <>
    <button
      type="button"
      onClick={async () => {
        const list = await qzListPrinters();
        setPrinters(list || []);
        alert("✅ Impresoras cargadas");
      }}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(148,163,184,0.35)",
        background: "rgba(2,6,23,0.25)",
        color: "#e5e7eb",
        fontSize: 11,
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      Detectar impresoras
    </button>

    <select
      value={printerName}
      onChange={(e) => {
        setPrinterName(e.target.value);
        try { localStorage.setItem("pos_printer_name_v1", e.target.value); } catch {}
      }}
      style={{
        padding: "8px 10px",
        borderRadius: 12,
        border: "1px solid rgba(75,85,99,0.9)",
        backgroundColor: "rgba(15,23,42,0.96)",
        color: "#e5e7eb",
        fontSize: 11,
        fontWeight: 800,
        height: 40,
        minWidth: 260,
      }}
    >
      <option value="">(Selecciona impresora)</option>
      {(printers || []).map((p) => (
        <option key={p} value={p}>{p}</option>
      ))}
    </select>

    <button
      type="button"
      onClick={async () => {
        if (!printerName) return alert("Selecciona impresora primero");
        await qzPrintEscpos(printerName, [
          "POS MULTI BAR",
          "--------------------------",
          "Ticket de prueba",
          `Fecha: ${new Date().toLocaleString("es-MX")}`,
          "Gracias :)",
        ]);
      }}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(34,197,94,0.55)",
        background: "rgba(34,197,94,0.18)",
        color: "#e5e7eb",
        fontSize: 11,
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      Imprimir prueba
    </button>
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
