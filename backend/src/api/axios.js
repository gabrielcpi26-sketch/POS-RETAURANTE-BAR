import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4000/api",
});

// Interceptor para agregar token + tenant automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // ✅ tenant: desde localStorage (para pruebas) o default
  const tenantKey = localStorage.getItem("tenant_key") || "default";
  config.headers["x-tenant"] = tenantKey;

  return config;
});

export default api;
