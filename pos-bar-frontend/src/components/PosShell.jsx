import React, { useEffect, useMemo, useState } from "react";

export default function PosShell({
  appName = "POS",
  subtitle = "",
  logoUrl = "",
  roleLabel = "",
  sidebarItems = [],
  topRight = null,

  // ✅ NUEVO (opcional): para que funcionen los botones aunque no tengan onClick
  sidebarActiveKey = "",
  onSidebarSelect = null,

  children,
}) {
  const SS_KEY = "pos_shell_sidebar_collapsed_v1";
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return sessionStorage.getItem(SS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(SS_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  const S = useMemo(() => {
    return {
      page: {
        minHeight: "100vh",
        width: "100%",
        background:
          "radial-gradient(circle at 12% 10%, rgba(16,185,129,0.10), transparent 40%)," +
          "radial-gradient(circle at 90% 20%, rgba(59,130,246,0.10), transparent 44%)," +
          "linear-gradient(180deg, rgba(2,6,23,1), rgba(0,0,0,1))",
        color: "var(--pos-text, #e5e7eb)",
        overflowX: "hidden",
      },

      shell: {
        display: "grid",
        gridTemplateColumns: collapsed ? "86px 1fr" : "280px 1fr",
        minHeight: "100vh",
      },

      // Sidebar
      sidebar: {
        position: "sticky",
        top: 0,
        height: "100vh",
        borderRight: "1px solid rgba(148,163,184,0.16)",
        background:
          "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(2,6,23,0.96))",
        backdropFilter: "blur(10px)",
        padding: 12,
        display: "grid",
        gridTemplateRows: "auto auto 1fr auto",
        gap: 12,
        zIndex: 5,
      },

      brandRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        gap: 10,
        padding: "10px 10px",
        borderRadius: 16,
        border: "1px solid rgba(148,163,184,0.14)",
        background: "rgba(15,23,42,0.65)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
      },
      brandLeft: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
      },
      logo: {
        width: 38,
        height: 38,
        borderRadius: 12,
        border: "1px solid rgba(148,163,184,0.22)",
        overflow: "hidden",
        background: "rgba(2,6,23,0.6)",
        display: "grid",
        placeItems: "center",
        flex: "0 0 auto",
      },
      logoImg: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
      },
      brandText: {
        display: collapsed ? "none" : "grid",
        gap: 2,
        minWidth: 0,
      },
      appName: {
        fontWeight: 900,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      },
      subtitle: {
        fontSize: 11,
        opacity: 0.72,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      },

      iconBtn: {
        border: "1px solid rgba(148,163,184,0.20)",
        background: "rgba(15,23,42,0.70)",
        color: "var(--pos-text, #e5e7eb)",
        borderRadius: 12,
        padding: "10px 10px",
        cursor: "pointer",
        boxShadow: "0 12px 24px rgba(0,0,0,0.25)",
        userSelect: "none",
      },

      nav: {
        display: "grid",
        gap: 8,
        padding: "2px 2px",
      },
      navItem: (active) => ({
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: 10,
        padding: collapsed ? "12px 10px" : "12px 12px",
        borderRadius: 14,
        border: active
          ? "1px solid rgba(34,197,94,0.55)"
          : "1px solid rgba(148,163,184,0.14)",
        background: active
          ? "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(15,23,42,0.72))"
          : "rgba(15,23,42,0.55)",
        boxShadow: active
          ? "0 18px 44px rgba(16,185,129,0.14)"
          : "0 14px 36px rgba(0,0,0,0.25)",
        cursor: "pointer",
        color: "var(--pos-text, #e5e7eb)",
        userSelect: "none",
        outline: "none",
      }),
      navIcon: {
        width: 22,
        height: 22,
        borderRadius: 10,
        border: "1px solid rgba(148,163,184,0.20)",
        display: "grid",
        placeItems: "center",
        background: "rgba(2,6,23,0.55)",
        fontSize: 12,
        flex: "0 0 auto",
      },
      navLabel: {
        display: collapsed ? "none" : "block",
        fontSize: 12,
        fontWeight: 850,
        letterSpacing: 0.2,
      },

      sidebarFooter: {
        display: "grid",
        gap: 8,
        paddingTop: 6,
      },

      // Main
      main: {
        display: "grid",
        gridTemplateRows: "auto 1fr",
        minWidth: 0,
      },

      topbar: {
        position: "sticky",
        top: 0,
        zIndex: 4,
        borderBottom: "1px solid rgba(148,163,184,0.14)",
        background:
          "linear-gradient(180deg, rgba(2,6,23,0.82), rgba(2,6,23,0.62))",
        backdropFilter: "blur(10px)",
      },

      topbarInner: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px clamp(12px, 2.2vw, 22px)",
      },

      leftTop: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
      },

      titleBlock: {
        minWidth: 0,
      },
      title: {
        margin: 0,
        fontSize: 14,
        fontWeight: 950,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      },
      hint: {
        margin: 0,
        fontSize: 11,
        opacity: 0.70,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      },

      pill: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 999,
        border: "1px solid rgba(148,163,184,0.20)",
        background: "rgba(15,23,42,0.70)",
        fontSize: 11,
        fontWeight: 900,
        boxShadow: "0 14px 30px rgba(0,0,0,0.25)",
        whiteSpace: "nowrap",
      },

      content: {
        padding: "14px clamp(12px, 2.2vw, 22px) 22px",
        minWidth: 0,
      },

      // Mobile drawer overlay
      mobileOverlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 99,
        display: mobileOpen ? "block" : "none",
      },
      mobileDrawer: {
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        width: "min(86vw, 320px)",
        zIndex: 100,
        transform: mobileOpen ? "translateX(0)" : "translateX(-110%)",
        transition: "transform .18s ease",
      },
    };
  }, [collapsed, mobileOpen]);

  // Simple auto-icons (sin librerías)
  const iconFor = (key, fallback = "•") => {
    const map = {
      home: "⌂",
      mesas: "🍽️",
      pedidos: "🧾",
      ventas: "$",
      reportes: "📈",
      invent: "📦",
      inventario: "📦",
      menu: "🗂️",
      ajustes: "⚙️",
      usuarios: "👤",
    };
    return map[key] || fallback;
  };

  const SidebarContent = ({ forceExpanded = false }) => (
    <div style={{ ...S.sidebar, height: "100vh" }}>
      <div style={S.brandRow}>
        <div style={S.brandLeft}>
          <div style={S.logo}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={S.logoImg} />
            ) : (
              <div style={{ fontSize: 14, opacity: 0.9 }}>◎</div>
            )}
          </div>

          <div
            style={
              forceExpanded ? { ...S.brandText, display: "grid" } : S.brandText
            }
          >
            <div style={S.appName}>{appName}</div>
            <div style={S.subtitle}>{subtitle}</div>
          </div>
        </div>

        <button
          type="button"
          title={collapsed ? "Expandir" : "Colapsar"}
          onClick={() => setCollapsed((v) => !v)}
          style={{
            ...S.iconBtn,
            display: forceExpanded ? "none" : collapsed ? "none" : "inline-flex",
          }}
        >
          ◀
        </button>
      </div>

      <div style={S.nav}>
        {sidebarItems
          .filter((it) => it && it.visible !== false)
          .map((it) => {
            // ✅ Active: respeta it.active si viene, si no usa sidebarActiveKey
            const active =
              typeof it.active === "boolean"
                ? it.active
                : sidebarActiveKey
                ? sidebarActiveKey === it.key
                : false;

            // ✅ Click: si it.onClick no existe, usamos onSidebarSelect(it.key)
            const handleClick = () => {
              if (typeof it.onClick === "function") {
                it.onClick();
              } else if (typeof onSidebarSelect === "function") {
                onSidebarSelect(it.key);
              }
              // en móvil, cerrar drawer al elegir
              if (mobileOpen) setMobileOpen(false);
            };

            return (
              <button
                key={it.key}
                type="button"
                onClick={handleClick}
                style={S.navItem(active)}
                title={it.label}
              >
                <span style={S.navIcon}>{it.icon || iconFor(it.key)}</span>
                <span
                  style={
                    forceExpanded
                      ? { ...S.navLabel, display: "block" }
                      : S.navLabel
                  }
                >
                  {it.label}
                </span>
              </button>
            );
          })}
      </div>

      <div style={S.sidebarFooter}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ ...S.pill, opacity: 0.9 }}>
            {roleLabel ? `Rol: ${roleLabel}` : "Sesión activa"}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      {/* Micro CSS responsive (sin librerías) */}
      <style>{`
        @media (max-width: 980px){
          .posShellGrid{ grid-template-columns: 1fr !important; }
          .posShellSidebarDesktop{ display: none !important; }
          .posShellMain{ grid-template-rows: auto 1fr !important; }
        }
        @media (min-width: 981px){
          .posShellSidebarMobile{ display: none !important; }
        }
      `}</style>

      {/* Mobile overlay */}
      <div
        style={S.mobileOverlay}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <div className="posShellSidebarMobile" style={S.mobileDrawer}>
        <SidebarContent forceExpanded />
      </div>

      <div className="posShellGrid" style={S.shell}>
        {/* Desktop sidebar */}
        <div className="posShellSidebarDesktop">
          <SidebarContent />
        </div>

        {/* Main */}
        <div className="posShellMain" style={S.main}>
          {/* Topbar */}
          <div style={S.topbar}>
            <div style={S.topbarInner}>
              <div style={S.leftTop}>
                {/* mobile burger */}
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  style={{ ...S.iconBtn, padding: "10px 12px" }}
                >
                  ☰
                </button>

                <div style={S.titleBlock}>
                  <p style={S.title}>{appName}</p>
                  <p style={S.hint}>{subtitle || "Panel interno"}</p>
                </div>

                {roleLabel ? <div style={S.pill}>{roleLabel}</div> : null}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {topRight}
              </div>
            </div>
          </div>

          {/* CONTENT */}
          <div style={S.content}>{children}</div>
        </div>
      </div>
    </div>
  );
}
