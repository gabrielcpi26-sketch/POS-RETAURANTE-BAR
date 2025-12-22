// src/router/AppRouter.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "../Login/LoginPage";
import DashboardPage from "../page/DashboardPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login */}
        <Route path="/login" element={<LoginPage />} />

        {/* Panel principal del POS */}
        <Route path="/" element={<DashboardPage />} />

        {/* ✅ Vista mesero (sin login) */}
        <Route path="/mesero" element={<DashboardPage />} />

        {/* Cualquier otra ruta redirige al login */}
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}
