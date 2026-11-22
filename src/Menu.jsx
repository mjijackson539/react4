import { NavLink, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';
import { useAuth } from './AuthContext';
import { useAction, Notice } from './ui';
import { useCart } from './CartContext';
export default function Menu() { const { theme, toggleTheme } = useContext(ThemeContext), { user, logout, error } = useAuth(), { cart } = useCart(), navigate = useNavigate(), a = useAction(); return <header><nav><NavLink to="/" end>Каталог</NavLink><NavLink to="/about">О нас</NavLink><NavLink to="/cart">Корзина{user ? ` (${cart.reduce((s, i) => s + i.quantity, 0)})` : ''}</NavLink>{user ? <><NavLink to="/dashboard">Личный кабинет</NavLink>{user.role === 'admin' && <NavLink to="/admin">Админ-панель</NavLink>}</> : <><NavLink to="/login">Войти</NavLink><NavLink to="/register">Регистрация</NavLink></>}<span className="nav-spacer"/><button onClick={toggleTheme}>Тема: {theme === 'light' ? 'светлая' : 'тёмная'}</button>{user && <button disabled={a.busy} onClick={() => a.run(async () => { await logout(); navigate('/'); })}>Выйти</button>}</nav>{(a.busy || a.error || error) && <Notice {...a} error={a.error || error}/>}</header>; }
