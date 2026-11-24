// Дополнительные проверки до запроса; сервер повторно проверяет все значения.
export function validateProfile(form) { if (!/^[\p{L}]+(?:[ -][\p{L}]+)+$/u.test(form.name.trim()))
    throw new Error('Введите имя и фамилию буквами'); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    throw new Error('Некорректный email'); validatePhone(form.phone); if (form.address && form.address.trim().length < 5)
    throw new Error('Адрес должен содержать минимум 5 символов'); }
export function validatePassword(p) { if (p.length < 8 || new TextEncoder().encode(p).length > 72 || !p.trim())
    throw new Error('Пароль: минимум 8 символов, максимум 72 байта'); }
export function validateAddress(address) { if (address.trim().length < 5)
    throw new Error('Адрес должен содержать минимум 5 символов'); }

// Российский номер: +7, 7 или 8 в начале и ровно 11 цифр.
export function validatePhone(value) {
  const p = String(value ?? '').trim();
  const digits = p.replace(/\D/g, '');
  if (!/^(?:\+7|7|8)[\d ()-]*$/.test(p) || digits.length !== 11) {
    throw new Error('Телефон должен начинаться с +7, 7 или 8 и содержать 11 цифр');
  }
  return p;
}
