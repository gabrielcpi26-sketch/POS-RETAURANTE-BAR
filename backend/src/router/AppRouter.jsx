// src/router/AppRouter.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "../pages/Login/LoginPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}
