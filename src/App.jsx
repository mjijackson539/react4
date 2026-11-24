import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./Home";
import About from "./About";
import Product from "./Product";
import Menu from "./Menu";
import Login from "./Login";
import Dashboard from "./Dashboard";
import Cart from "./Cart";
import Admin from "./Admin";
import { ThemeContext } from "./ThemeContext";
import { AuthProvider, useAuth } from "./AuthContext";
import { CartProvider } from "./CartContext";
import "./App.css";

function Protected({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Загрузка…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role)
    return (
      <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />
    );
  return children;
}

export default function App() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light",
  );
  useEffect(() => localStorage.setItem("theme", theme), [theme]);
  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme: () => setTheme((t) => (t === "light" ? "dark" : "light")),
      }}
    >
      <AuthProvider>
        <CartProvider>
          <div className={"app " + theme}>
            <BrowserRouter>
              <Menu />
              <main>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/product/:name" element={<Product />} />
                  <Route
                    path="/login"
                    element={<Login key="login" mode="login" />}
                  />
                  <Route
                    path="/register"
                    element={<Login key="register" mode="register" />}
                  />
                  <Route
                    path="/reset-password"
                    element={<Login key="reset" mode="reset" />}
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <Protected role="client">
                        <Dashboard />
                      </Protected>
                    }
                  />
                  <Route
                    path="/cart"
                    element={
                      <Protected role="client">
                        <Cart />
                      </Protected>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <Protected role="admin">
                        <Admin />
                      </Protected>
                    }
                  />
                  <Route
                    path="/admin/:section"
                    element={
                      <Protected role="admin">
                        <Admin />
                      </Protected>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </BrowserRouter>
          </div>
        </CartProvider>
      </AuthProvider>
    </ThemeContext.Provider>
  );
}
