import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home';
import About from './About';
import Product from './Product';
import Menu from './Menu';
import Login from './Login';
import Dashboard from './Dashboard';
import Cart from './Cart';
import Admin from './Admin';
import AdminReviews from './AdminReviews';
import { ThemeContext } from './ThemeContext';
import { AuthProvider, useAuth } from './AuthContext';
import { CartProvider } from './CartContext';
import './App.css';
function Protected({ children, admin = false }) { const { user, loading } = useAuth(); if (loading)
    return <p>Загрузка…</p>; if (!user)
    return <Navigate to="/login" replace/>; if (admin && user.role !== 'admin')
    return <Navigate to="/dashboard" replace/>; return children; }
export default function App() { const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light'); useEffect(() => localStorage.setItem('theme', theme), [theme]); return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light') }}><AuthProvider><CartProvider><div className={'app ' + theme}><BrowserRouter><Menu /><main><Routes><Route path="/" element={<Home />}/><Route path="/about" element={<About />}/><Route path="/product/:name" element={<Product />}/><Route path="/login" element={<Login key="login" mode="login"/>}/><Route path="/register" element={<Login key="register" mode="register"/>}/><Route path="/reset-password" element={<Login key="reset" mode="reset"/>}/><Route path="/dashboard" element={<Protected><Dashboard /></Protected>}/><Route path="/cart" element={<Protected><Cart /></Protected>}/><Route path="/admin" element={<Protected admin><Admin /></Protected>}/><Route path="/admin/reviews" element={<Protected admin><AdminReviews /></Protected>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></main></BrowserRouter></div></CartProvider></AuthProvider></ThemeContext.Provider>; }
