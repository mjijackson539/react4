import { NavLink, useNavigate } from "react-router-dom";
import { useContext } from "react";
import { ThemeContext } from "./ThemeContext";
import { useAuth } from "./AuthContext";
import { useAction, Notice } from "./ui";
import { useCart } from "./CartContext";

export default function Menu() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { user, logout, error } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const a = useAction();
  const isAdmin = user?.role === "admin";
  const isClient = user?.role === "client";

  return (
    <header>
      <nav>
        <NavLink to="/" end>
          Каталог
        </NavLink>
        <NavLink to="/about">О нас</NavLink>
        {isClient && (
          <>
            <NavLink to="/cart">
              Корзина ({cart.reduce((sum, item) => sum + item.quantity, 0)})
            </NavLink>
            <NavLink to="/dashboard">Личный кабинет</NavLink>
          </>
        )}
        {isAdmin && <NavLink to="/admin">Админ-панель</NavLink>}
        {!user && (
          <>
            <NavLink to="/login">Войти</NavLink>
            <NavLink to="/register">Регистрация</NavLink>
          </>
        )}
        <span className="nav-spacer" />
        <button type="button" onClick={toggleTheme}>
          Тема: {theme === "light" ? "светлая" : "тёмная"}
        </button>
        {user && (
          <button
            type="button"
            disabled={a.busy}
            onClick={() =>
              a.run(async () => {
                await logout();
                navigate("/");
              })
            }
          >
            Выйти
          </button>
        )}
      </nav>
      {(a.busy || a.error || error) && (
        <Notice {...a} error={a.error || error} />
      )}
    </header>
  );
}
