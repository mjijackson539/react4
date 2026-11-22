import { createContext, useEffect, useRef, useState, useContext } from 'react';
import { useAuth } from './AuthContext';
import { request, send } from './api';
export const CartContext = createContext();
export const useCart = () => useContext(CartContext);
// БД — единственный источник состояния корзины. Запросы изменения не пересекаются.
export function CartProvider({ children }) { const { user } = useAuth(); const [cart, setCart] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState(''); const lock = useRef(false), generation = useRef(0); useEffect(() => { const g = ++generation.current; setCart([]); setError(''); setBusy(!!user); lock.current = false; if (user)
    request('/cart').then(data => { if (g === generation.current)
        setCart(data); }).catch(e => { if (g === generation.current)
        setError(e.message); }).finally(() => { if (g === generation.current)
        setBusy(false); }); return () => { generation.current++; }; }, [user?.email]); async function change(name, delta, quantity) { if (!user || lock.current || busy)
    return false; lock.current = true; let g = generation.current; setBusy(true); setError(''); try {
    const data = await send('/cart', 'PUT', { name, ...(quantity === undefined ? { delta } : { quantity }) });
    if (g === generation.current)
        setCart(data);
    return true;
}
catch (e) {
    if (g === generation.current)
        setError(e.message);
    return false;
}
finally {
    if (g === generation.current) {
        setBusy(false);
        lock.current = false;
    }
} } async function reload() { const g = generation.current; const data = await request('/cart'); if (g === generation.current) { setCart(data); setError(''); } } return <CartContext.Provider value={{ cart, busy, error, change, reload }}>{children}</CartContext.Provider>; }
