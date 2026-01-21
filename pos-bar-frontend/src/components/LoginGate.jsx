import React, { useEffect, useMemo, useRef, useState } from "react";

const LS_LOGO = "pos_login_logo_v1";
const LS_PIN_ADMIN = "pos_pin_admin_v1";
const LS_PIN_WAITER = "pos_pin_waiter_v1";
const LS_BIZ_NAME = "pos_business_name_v1";
const LS_TENANT_CFG = "pos_tenant_cfg_v1";

// ✅ misma key que usa tu app (sesión por pestaña)
const ROLE_STORAGE_KEY = "pos_user_role_v1";

function defaultLogo() {
  return null;
}

async function fileToDataUrlCompressed(file, maxW = 1400, quality = 0.86) {
  const img = new Image();
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  img.src = dataUrl;

  await new Promise((res) => (img.onload = res));

  const ratio = img.width / img.height;
  const w = Math.min(maxW, img.width);
  const h = Math.round(w / ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toDataURL("image/jpeg", quality);
}

export default function LoginGate({ children }) {
  // ✅ API (igual que el resto del proyecto)
  const API_URL = import.meta.env?.VITE_API_URL || "http://localhost:4000";

  // ✅ tenant actual: primero subdominio, si no hay, usa localStorage tenant_key
  const tenantKey = useMemo(() => {
    try {
      const host = window.location.hostname; // sin puerto
      const parts = host.split(".").filter(Boolean);

      // elgallo.localhost -> tenantKey = "elgallo"
      if (parts.length >= 2 && parts[parts.length - 1] === "localhost")
        return parts[0];

      // producción: elgallo.gadiapps.com -> "elgallo"
      if (parts.length >= 3) return parts[0];

      // fallback
      return localStorage.getItem("tenant_key") || "default";
    } catch {
      return "default";
    }
  }, []);

  const LS_TENANT_CFG_T = `${LS_TENANT_CFG}__${tenantKey}`;

  // ✅ Keys por tenant (para que cada restaurante tenga sus propios PINs/logo/nombre)
  const LS_LOGO_T = `${LS_LOGO}__${tenantKey}`;
  const LS_PIN_ADMIN_T = `${LS_PIN_ADMIN}__${tenantKey}`;
  const LS_PIN_WAITER_T = `${LS_PIN_WAITER}__${tenantKey}`;
  const LS_BIZ_NAME_T = `${LS_BIZ_NAME}__${tenantKey}`;

  // ✅ config por tenant desde backend (name/adminPin/meseroPin)
  // ✅ (AGREGADO) inicia desde cache para que NO parpadee "El Tridente" al refrescar
const [tenantConfig, setTenantConfig] = useState(() => {
  try {
    const raw = localStorage.getItem(LS_TENANT_CFG_T);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
});

// ✅ si ya hay cache, NO bloquees
const [loadingTenantConfig, setLoadingTenantConfig] = useState(() => {
  try {
    const raw = localStorage.getItem(LS_TENANT_CFG_T);
    return !raw; // true si NO hay cache
  } catch {
    return true;
  }
});


  // ✅ cargar config del tenant desde backend
  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        const res = await fetch(`${API_URL}/api/tenant-config`, {
          method: "GET",
          headers: {
            // ✅ el backend ya te está leyendo X-Tenant (por tus capturas)
            "X-Tenant": tenantKey,
          },
        });

        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!alive) return;

        setTenantConfig(data || null);

        // ✅ (AGREGADO) guarda cache por tenant para que al refrescar ya esté desde el inicio
       try {
  localStorage.setItem(LS_TENANT_CFG_T, JSON.stringify(data || null));
} catch {}

      } catch {
        if (!alive) return;
        setTenantConfig(null);
      } finally {
        // ✅ (AGREGADO) ya terminó intento de carga (con éxito o no)
        if (alive) setLoadingTenantConfig(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [API_URL, tenantKey, LS_TENANT_CFG_T]);

  // UI role selector: "waiter" | "admin"
  const [role, setRole] = useState("waiter");
  const roleRef = useRef("waiter");

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [successFlash, setSuccessFlash] = useState(false);
  const [authedRole, setAuthedRole] = useState(null); // null | "admin" | "mesero"

  const [logo, setLogo] = useState(defaultLogo());
  const fileRef = useRef(null);

  // ✅ PINs: primero tenantConfig, luego localStorage por-tenant, luego default
  const adminPin = useMemo(() => {
    return (
      String(tenantConfig?.adminPin ?? "").trim() ||
      localStorage.getItem(LS_PIN_ADMIN_T) ||
      "1234"
    );
  }, [tenantConfig, LS_PIN_ADMIN_T]);

  const waiterPin = useMemo(() => {
    return (
      String(tenantConfig?.meseroPin ?? "").trim() ||
      localStorage.getItem(LS_PIN_WAITER_T) ||
      "0000"
    );
  }, [tenantConfig, LS_PIN_WAITER_T]);

  // ✅ Mantener sesión por pestaña (refresh-safe)
  useEffect(() => {
    try {
      const savedRole = sessionStorage.getItem(ROLE_STORAGE_KEY);
      if (
        savedRole === "admin" ||
        savedRole === "mesero" ||
        savedRole === "encargado"
      ) {
        setAuthedRole(savedRole);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(LS_LOGO_T);
    if (saved) setLogo(saved);
  }, [LS_LOGO_T]);

  const press = (d) => {
    setError("");
    setPin((p) => (p.length >= 8 ? p : p + String(d)));
  };
  const back = () => setPin((p) => p.slice(0, -1));
  const clear = () => setPin("");

  const enter = () => {
    setError("");

    // ✅ (AGREGADO) evita entrar con defaults mientras aún está cargando config real
    if (loadingTenantConfig && !tenantConfig) {
  setError("Cargando configuración del negocio…");
  return;
}


    const selected = roleRef.current; // ✅ fuente única
    const expected = selected === "admin" ? adminPin : waiterPin;

    if (pin !== String(expected)) {
      setError(
        selected === "admin"
          ? "PIN de administrador incorrecto"
          : "PIN de empleado incorrecto"
      );
      setPin("");
      return;
    }

    // ✅ mapeo FINAL
    const finalRole = selected === "admin" ? "admin" : "mesero";

    // ✅ CLAVE: por pestaña, NO entre pestañas
    try {
      sessionStorage.setItem(ROLE_STORAGE_KEY, finalRole);
      // ✅ opcional: avisar a la pestaña actual (si lo escuchas)
      window.dispatchEvent(new Event("pos_role_changed"));
    } catch {}

    setSuccessFlash(true);
    setTimeout(() => setSuccessFlash(false), 380);

    setAuthedRole(finalRole);
    setPin("");
  };

  const onPickLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await fileToDataUrlCompressed(file, 1400, 0.86);
      localStorage.setItem(LS_LOGO_T, data);
      setLogo(data);
    } catch (err) {
      console.error(err);
      alert("No se pudo cargar la imagen.");
    } finally {
      e.target.value = "";
    }
  };

  const onRemoveLogo = () => {
    try {
      localStorage.removeItem(LS_LOGO_T);
    } catch {}
    setLogo(null);
  };

  const businessName = useMemo(() => {
    try {
      return (
        String(tenantConfig?.businessName ?? "").trim() ||
        localStorage.getItem(LS_BIZ_NAME_T) ||
        "El Tridente"
      );
    } catch {
      return String(tenantConfig?.businessName ?? "").trim() || "El Tridente";
    }
  }, [tenantConfig, LS_BIZ_NAME_T]);

  const subtitle = "Control de operación • mesas • ventas • inventario";
  const modeLabel = role === "admin" ? "Administrador" : "Empleado";

  if (authedRole) return <>{children}</>;

  // ======================
  // UI (modo software caro)
  // ======================
  const S = {
    page: {
      minHeight: "100vh",
      width: "100vw",
      display: "grid",
      gridTemplateRows: "auto 1fr auto",
      background:
        "radial-gradient(circle at 20% 10%, rgba(16,185,129,0.14), transparent 45%), " +
        "radial-gradient(circle at 90% 30%, rgba(59,130,246,0.12), transparent 45%), " +
        "linear-gradient(180deg, #f7fafc, #eef2f7)",
      color: "#0f172a",
    },
    topBar: {
      padding: "18px clamp(16px, 3vw, 34px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(15,23,42,0.10)",
      background: "rgba(255,255,255,0.70)",
      backdropFilter: "blur(10px)",
      boxShadow: "0 10px 28px rgba(2,6,23,0.06)",
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: 0.2,
    },
    body: {
      padding: "0 clamp(16px, 3vw, 34px) 18px",
      display: "grid",
      placeItems: "center",
    },
    lockShell: {
      width: "min(1200px, 100%)",
      height: "min(720px, calc(100vh - 160px))",
      borderRadius: 26,
      overflow: "hidden",
      border: "1px solid rgba(15,23,42,0.10)",
      background: "rgba(255,255,255,0.72)",
      backdropFilter: "blur(12px)",
      boxShadow: "0 26px 70px rgba(2,6,23,0.14)",
      display: "grid",
      gridTemplateColumns: "1.35fr 1fr",
    },
    left: {
      padding: "26px clamp(18px, 2.2vw, 28px)",
      display: "grid",
      gridTemplateRows: "auto auto 1fr auto",
      gap: 14,
      borderRight: "1px solid rgba(15,23,42,0.06)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.70), rgba(255,255,255,0.50))",
    },
    title: { fontSize: 44, lineHeight: 1.05, fontWeight: 900, margin: 0 },
    sub: {
      margin: "6px 0 0",
      fontSize: 14,
      color: "rgba(15,23,42,0.65)",
      fontWeight: 700,
    },
    logoWrap: {
      borderRadius: 22,
      border: "1px solid rgba(15,23,42,0.08)",
      background: "rgba(255,255,255,0.78)",
      boxShadow: "0 12px 28px rgba(2,6,23,0.08)",
      display: "grid",
      placeItems: "center",
      padding: 18,
      minHeight: 260,
    },
    logoImg: {
      width: "min(360px, 85%)",
      maxHeight: "70vh",
      objectFit: "contain",
      borderRadius: 18,
      boxShadow: "0 18px 40px rgba(2,6,23,0.12)",
      background: "rgba(255,255,255,0.6)",
    },
    leftActions: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
    },
    btn: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(15,23,42,0.10)",
      background: "rgba(255,255,255,0.78)",
      color: "#0f172a",
      cursor: "pointer",
      fontWeight: 900,
      fontSize: 12,
      transition:
        "transform .12s ease, box-shadow .18s ease, background .18s ease",
      boxShadow: "0 10px 22px rgba(2,6,23,0.08)",
    },
    btnDanger: {
      background: "rgba(244,63,94,0.10)",
      border: "1px solid rgba(244,63,94,0.22)",
      color: "#9f1239",
    },
    right: {
      padding: "26px clamp(18px, 2.2vw, 28px)",
      display: "grid",
      gridTemplateRows: "auto auto auto 1fr auto",
      gap: 14,
    },
    accessTitle: { margin: 0, fontWeight: 900, fontSize: 16 },
    accessSub: {
      margin: "4px 0 0",
      fontSize: 12,
      color: "rgba(15,23,42,0.60)",
      fontWeight: 700,
    },
    roleTabs: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      padding: 6,
      borderRadius: 16,
      border: "1px solid rgba(15,23,42,0.08)",
      background: "rgba(255,255,255,0.75)",
      boxShadow: "0 10px 22px rgba(2,6,23,0.06)",
    },
    tab: (active) => ({
      padding: "12px 12px",
      borderRadius: 12,
      border: "1px solid rgba(15,23,42,0.08)",
      background: active
        ? "rgba(16,185,129,0.16)"
        : "rgba(255,255,255,0.68)",
      color: "#0f172a",
      cursor: "pointer",
      fontWeight: 1000,
      letterSpacing: 0.6,
      transition:
        "transform .12s ease, background .18s ease, box-shadow .18s ease",
      boxShadow: active
        ? "0 12px 26px rgba(16,185,129,0.18)"
        : "0 10px 18px rgba(2,6,23,0.06)",
      textTransform: "uppercase",
      fontSize: 12,
    }),
    pinRow: {
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 10,
      alignItems: "center",
    },
    pinInput: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,0.10)",
      background: "rgba(255,255,255,0.85)",
      color: "#0f172a",
      fontSize: 16,
      letterSpacing: 3,
      fontWeight: 900,
      outline: "none",
      transition: "box-shadow .18s ease, transform .12s ease",
    },
    enterBtn: {
      padding: "12px 14px",
      borderRadius: 14,
      border: "1px solid rgba(16,185,129,0.35)",
      background: "rgba(16,185,129,0.16)",
      color: "#065f46",
      cursor: "pointer",
      fontWeight: 1000,
      letterSpacing: 0.6,
      transition:
        "transform .12s ease, box-shadow .18s ease, background .18s ease",
      boxShadow: "0 14px 32px rgba(16,185,129,0.14)",
    },
    keypad: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 10,
      alignContent: "start",
    },
    key: {
      padding: "16px 0",
      borderRadius: 16,
      border: "1px solid rgba(15,23,42,0.08)",
      background: "rgba(255,255,255,0.82)",
      color: "#0f172a",
      fontWeight: 1000,
      fontSize: 18,
      cursor: "pointer",
      transition:
        "transform .10s ease, box-shadow .18s ease, background .18s ease",
      boxShadow: "0 10px 22px rgba(2,6,23,0.06)",
      userSelect: "none",
    },
    keyAlt: {
      background: "rgba(15,23,42,0.04)",
    },
    keyDanger: {
      background: "rgba(244,63,94,0.10)",
      border: "1px solid rgba(244,63,94,0.22)",
      color: "#9f1239",
    },
    error: {
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(244,63,94,0.25)",
      background: "rgba(244,63,94,0.08)",
      color: "#9f1239",
      fontWeight: 900,
      fontSize: 12,
      animation: "shake .25s linear",
    },
    footer: {
      padding: "10px clamp(16px, 3vw, 34px) 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      color: "rgba(15,23,42,0.55)",
      fontSize: 12,
      fontWeight: 700,
    },
    successFlash: {
      position: "fixed",
      inset: 0,
      background: "rgba(16,185,129,0.10)",
      pointerEvents: "none",
      opacity: successFlash ? 1 : 0,
      transition: "opacity .22s ease",
    },
  };

  const TapFX = (e) => {
    e.currentTarget.style.transform = "scale(0.98)";
    setTimeout(() => {
      if (e.currentTarget) e.currentTarget.style.transform = "scale(1)";
    }, 90);
  };

  return (
    <div style={S.page}>
      {/* micro CSS animations */}
      <style>{`
        @keyframes shake { 0%{transform:translateX(0)} 25%{transform:translateX(-4px)} 50%{transform:translateX(4px)} 75%{transform:translateX(-3px)} 100%{transform:translateX(0)} }
        @media (max-width: 920px){
          .lockShellGrid{ grid-template-columns: 1fr !important; height: auto !important; }
          .leftPane{ border-right: none !important; border-bottom: 1px solid rgba(15,23,42,0.06) !important; }
        }
      `}</style>

      <div style={S.successFlash} />

      {/* Top */}
      <div style={S.topBar}>
        <div style={S.pill}>POS • Inicio seguro</div>
        <div style={S.pill}>Modo: {modeLabel}</div>
      </div>

      {/* Body */}
      <div style={S.body}>
        <div style={{ ...S.lockShell }} className="lockShellGrid">
          {/* Left */}
          <div style={S.left} className="leftPane">
            <div>
              <h1 style={S.title}>{businessName}</h1>
              <p style={S.sub}>{subtitle}</p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                onClick={(e) => {
                  TapFX(e);
                  roleRef.current = "waiter";
                  setRole("waiter");
                  setPin("");
                  setError("");
                }}
                style={S.tab(role === "waiter")}
              >
                Empleado
              </button>
              <button
                type="button"
                onClick={(e) => {
                  TapFX(e);
                  roleRef.current = "admin";
                  setRole("admin");
                  setPin("");
                  setError("");
                }}
                style={S.tab(role === "admin")}
              >
                Administrador
              </button>
            </div>

            <div style={S.logoWrap}>
              {logo ? (
                <img src={logo} alt="Logo" style={S.logoImg} />
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 1000 }}>
                    Logo del negocio
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "rgba(15,23,42,0.55)",
                      fontWeight: 700,
                    }}
                  >
                    Sube el logotipo desde Administrador
                  </div>
                </div>
              )}
            </div>

            {/* Admin logo tools */}
            <div style={S.leftActions}>
              {role === "admin" && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={onPickLogo}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      TapFX(e);
                      fileRef.current?.click();
                    }}
                    style={S.btn}
                  >
                    Cambiar logo
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      TapFX(e);
                      onRemoveLogo();
                    }}
                    style={{ ...S.btn, ...S.btnDanger }}
                  >
                    Quitar logo
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right */}
          <div style={S.right}>
            <div>
              <p style={S.accessTitle}>Acceso</p>
              <p style={S.accessSub}>
                Selecciona perfil e ingresa tu PIN para continuar.
              </p>
            </div>

            <div style={S.roleTabs}>
              <button
                type="button"
                onClick={(e) => {
                  TapFX(e);
                  roleRef.current = "waiter";
                  setRole("waiter");
                  setPin("");
                  setError("");
                }}
                style={S.tab(role === "waiter")}
              >
                Empleado
              </button>
              <button
                type="button"
                onClick={(e) => {
                  TapFX(e);
                  roleRef.current = "admin";
                  setRole("admin");
                  setPin("");
                  setError("");
                }}
                style={S.tab(role === "admin")}
              >
                Administrador
              </button>
            </div>

            <div style={S.pinRow}>
              <input
                value={pin}
                readOnly
                placeholder="PIN"
                style={{
                  ...S.pinInput,
                  boxShadow: error
                    ? "0 0 0 3px rgba(244,63,94,0.10)"
                    : "0 0 0 0 rgba(0,0,0,0)",
                }}
              />
             <button
  type="button"
  disabled={loadingTenantConfig && !tenantConfig}

  onClick={(e) => {
    TapFX(e);
    if (loadingTenantConfig) return;
    enter();
  }}
  style={{
    ...S.enterBtn,
    opacity: loadingTenantConfig ? 0.6 : 1,
    cursor: loadingTenantConfig ? "not-allowed" : "pointer",
  }}
>
  {loadingTenantConfig ? "CARGANDO..." : "ENTRAR"}
</button>

            </div>

            {error && <div style={S.error}>{error}</div>}

            <div style={S.keypad}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={(e) => {
                    TapFX(e);
                    press(n);
                  }}
                  style={S.key}
                >
                  {n}
                </button>
              ))}

              <button
                type="button"
                onClick={(e) => {
                  TapFX(e);
                  back();
                }}
                style={{ ...S.key, ...S.keyAlt }}
              >
                ⌫
              </button>

              <button
                type="button"
                onClick={(e) => {
                  TapFX(e);
                  press(0);
                }}
                style={S.key}
              >
                0
              </button>

              <button
                type="button"
                onClick={(e) => {
                  TapFX(e);
                  clear();
                }}
                style={{ ...S.key, ...S.keyDanger }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                fontSize: 11,
                color: "rgba(15,23,42,0.55)",
                fontWeight: 800,
              }}
            >
              PIN Admin default: 1234 • PIN Empleado default: 0000
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={S.footer}>
        <div>Acceso por pestaña (sessionStorage) • Roles: Admin / Mesero</div>
        <div>Tip: Admin puede abrir/cerrar turno global</div>
      </div>
    </div>
  );
}
