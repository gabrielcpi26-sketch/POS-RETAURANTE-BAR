// src/components/Accordion.jsx
import { useState } from "react";

export default function Accordion({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggle = () => setIsOpen((prev) => !prev);

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(148,163,184,0.35)",
        backgroundColor: "rgba(15,23,42,0.98)",
        marginBottom: 12,
        overflow: "hidden",
        boxShadow: "0 14px 35px rgba(15,23,42,0.8)",
      }}
    >
      {/* HEADER DEL ACORDEÓN */}
      <button
        type="button"
        onClick={toggle}
        style={{
          width: "100%",
          padding: "10px 14px",
          background:
            "linear-gradient(135deg, rgba(15,23,42,1), rgba(15,23,42,0.95))",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            color: "#E5E7EB",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {title}
        </span>

        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "999px",
            border: "1px solid rgba(148,163,184,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9CA3AF",
            fontSize: 14,
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          ❯
        </span>
      </button>

      {/* CONTENIDO DEL ACORDEÓN */}
      <div
        style={{
          maxHeight: isOpen ? "5000px" : 0, // ✅ CLAVE: evita que se corte el scroll
          overflow: "hidden",
          transition: "max-height 0.25s ease",
          borderTop: "1px solid rgba(31,41,55,0.9)",
        }}
      >
        <div
          style={{
            padding: isOpen ? "12px 14px 14px" : "0 14px",
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? "translateY(0px)" : "translateY(-4px)",
            transition: "opacity 0.2s ease, transform 0.2s ease",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
