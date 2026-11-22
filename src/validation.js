// Дополнительные проверки до запроса; сервер повторно проверяет все значения.
export function validateProfile(form) { if (!/^[\p{L}]+(?:[ -][\p{L}]+)+$/u.test(form.name.trim()))
    throw new Error('Введите имя и фамилию буквами'); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    throw new Error('Некорректный email'); const p = form.phone.trim(); if (!/^\+?[\d ()-]+$/.test(p) || p.replace(/\D/g, '').length < 10 || p.replace(/\D/g, '').length > 15)
    throw new Error('Телефон: 10–15 цифр'); if (form.address && form.address.trim().length < 5)
    throw new Error('Адрес должен содержать минимум 5 символов'); }
export function validatePassword(p) { if (p.length < 8 || new TextEncoder().encode(p).length > 72 || !p.trim())
    throw new Error('Пароль: минимум 8 символов, максимум 72 байта'); }
export function validateAddress(address) { if (address.trim().length < 5)
    throw new Error('Адрес должен содержать минимум 5 символов'); }
