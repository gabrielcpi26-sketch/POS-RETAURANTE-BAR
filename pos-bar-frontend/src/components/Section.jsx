export default function Section({ title, children }) {
  return (
    <div
      style={{
        background: "#161B22",
        padding: "20px 22px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
        marginBottom: 18,
      }}
    >
      <h2
        style={{
          color: "#F3F4F6",
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 16,
        }}
      >
        {title}
      </h2>

      <div>{children}</div>
    </div>
  );
}
