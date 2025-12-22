export default function LoginPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#111",
        color: "white",
      }}
    >
      <h1>Login POS</h1>

      <div style={{ marginTop: 20 }}>
        <input
          placeholder="Email"
          style={{ padding: 10, marginBottom: 10, minWidth: 220 }}
        />
        <br />
        <input
          placeholder="Password"
          type="password"
          style={{ padding: 10, minWidth: 220 }}
        />
      </div>
    </div>
  );
}
