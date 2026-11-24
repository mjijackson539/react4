// Единая серверная валидация: браузер не является доверенным источником данных.
function bad(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
function str(v, label, max = 150, min = 1) { if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max)
    bad(`${label}: от ${min} до ${max} символов`); return v.trim(); }
function email(v) { v = str(v, 'Email', 150).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    bad('Некорректный email'); return v; }
function loginPassword(v) { if (typeof v !== 'string' || !v.trim() || Buffer.byteLength(v) > 72)
    bad('Введите пароль'); return v; }
function password(v) { if (typeof v !== 'string' || v.length < 8 || Buffer.byteLength(v) > 72 || !v.trim())
    bad('Пароль: минимум 8 символов, максимум 72 байта'); return v; }
function phone(v) {
  v = str(v, 'Телефон', 30);
  const digits = v.replace(/\D/g, '');
  if (!/^(?:\+7|7|8)[\d ()-]*$/.test(v) || digits.length !== 11)
    bad('Телефон должен начинаться с +7, 7 или 8 и содержать 11 цифр');
  return v;
}
function person(v) { v = str(v, 'ФИО', 100, 3); if (!/^[\p{L}]+(?:[ -][\p{L}]+)+$/u.test(v))
    bad('Введите имя и фамилию буквами'); return v; }
function num(v, label, min, max, integer = true) { if (!['string', 'number'].includes(typeof v) || String(v).trim() === '' || !/^\d+(?:\.\d{1,2})?$/.test(String(v)))
    bad(`${label}: некорректное число`); let n = Number(v); if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n)))
    bad(`${label}: от ${min} до ${max}${integer ? ' (целое число)' : ''}`); return n; }
function date(v, future = true) { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v))
    bad('Укажите дату доставки'); const d = new Date(v + 'T00:00:00Z'); if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== v || v < '1900-01-01')
    bad('Некорректная дата'); const today = new Intl.DateTimeFormat('sv-SE', { timeZone: process.env.APP_TIMEZONE || 'Europe/Moscow' }).format(new Date()); if (future && v < today)
    bad('Дата доставки не может быть раньше текущей'); return v; }
function image(v) { if (v === '' || v == null)
    return ''; if (typeof v === 'string' && v.length <= 2048 && /^https:\/\/[^\s]+$/i.test(v)) { try { const u = new URL(v); if (u.hostname && !u.username && !u.password) return v; } catch {} } if (typeof v !== 'string' || v.length > 2800000 || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(v))
    bad('Изображение: PNG, JPEG, WEBP или GIF до 2 МБ'); const b = Buffer.from(v.split(',')[1], 'base64'); if (b.length > 2097152 || !(b.subarray(0, 3).equals(Buffer.from([255, 216, 255])) || b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || b.toString('ascii', 0, 3) === 'GIF' || (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP')))
    bad('Некорректный файл изображения'); return v; }
// Нормализуем похожие латинские буквы, транслит, цифры и разделители.
function clean(v, label = 'Комментарий', max = 1000, min = 1) { v = str(v, label, max, min); const map = { 'a': 'а', 'b': 'в', 'c': 'с', 'e': 'е', 'h': 'н', 'k': 'к', 'm': 'м', 'o': 'о', 'p': 'р', 't': 'т', 'x': 'х', 'y': 'у', '0': 'о', '3': 'з', '6': 'б', '9': 'я', '@': 'а', 'ё': 'е' }; let s = v.toLowerCase().normalize('NFKC').replace(/[abcehkmoptxy0369@ё]/g, c => map[c]).replace(/[^а-яa-z]/g, ''); const translit = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ы': 'y', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ъ': '', 'ь': '' }; let latin = v.toLowerCase().normalize('NFKC').replace(/[а-яё]/g, c => translit[c] ?? c).replace(/[^a-z]/g, ''); if (/(?:х[уy][йиiеeяю]|п[иi][зz]д|(?:^|не|за|по|вы|на|у|про|пере|до|от|раз)[еe]б(?:а|у|л|н|и|т)|бл[яa][дт]?|мудак|д[еe]рьмо|сука|гандон|гондон|мудил|залуп|пид[оа]р|шлюх)/i.test(s) || /(?:fuck|shit|bitch|cunt|asshole|motherfucker|huy|hui|khuy|pizd|blya|bljad|suka|mudak|jebat|yebat|ebat)/i.test(latin))
    bad('Нецензурная лексика запрещена'); return v; }
module.exports = { bad, str, email, loginPassword, password, phone, person, num, date, image, clean };
