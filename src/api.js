const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
// Все запросы идут через API, включая данные корзины и профиля.
export async function request(path, options = {}) {
    const token = sessionStorage.getItem('token');
    let response;
    try {
        response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
    }
    catch {
        throw new Error('Нет связи с сервером. Проверьте подключение и повторите запрос.');
    }
    const data = await response.json().catch(() => ({ error: 'Некорректный ответ сервера' }));
    if (!response.ok) {
        if (response.status === 401 && token && !['/login', '/register', '/reset-password'].includes(path)) {
            sessionStorage.removeItem('token');
            window.dispatchEvent(new Event('session-expired'));
        }
        throw new Error(data.error || 'Ошибка запроса к API');
    }
    return data;
}
export const send = (path, method, body) => request(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
export const getServices = () => request('/services');
export const getCategories = () => request('/categories');
export const login = (email, password) => send('/login', 'POST', { email, password });
export const adminRequest = (path, method = 'GET', body) => send('/admin' + path, method, body);
export const getMyCoupons = () => request('/my-coupons');
export const keyPath = encodeURIComponent;
export const money = n => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
