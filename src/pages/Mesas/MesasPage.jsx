import { useEffect, useState } from "react";
import api from "../../api/axios";

export default function MesasPage() {
  const [areas, setAreas] = useState([]);

  const loadAreas = async () => {
    const { data } = await api.get("/areas");
    setAreas(data);
  };

  useEffect(() => {
    loadAreas();
  }, []);

  return (
    <div>
      <h1>Mesas</h1>

      {areas.map((area) => (
        <div
          key={area.id}
          style={{
            marginBottom: 30,
            padding: 20,
            background: "#1a1d24",
            borderRadius: 10,
          }}
        >
          <h2>{area.name}</h2>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {area.tables.map((mesa) => (
              <div
                key={mesa.id}
                style={{
                  width: 120,
                  height: 120,
                  background: mesa.status === "FREE" ? "#2ecc71" : "#e74c3c",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: 12,
                  fontSize: 20,
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                {mesa.name}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
