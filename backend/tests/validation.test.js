const { test } = require('node:test');
const assert = require('node:assert/strict');
const V = require('../validation');
test('Цена строго больше нуля', () => { for (const n of [0, -1, '', null, 'abc', '0.001'])
    assert.throws(() => V.num(n, 'Цена', 0.01, 99999999.99, false)); assert.equal(V.num('0.01', 'Цена', 0.01, 99999999.99, false), 0.01); });
test('Количество и оценка целые', () => { for (const n of [0, -1, 1.5, 6])
    assert.throws(() => V.num(n, 'Оценка', 1, 5)); assert.equal(V.num(5, 'Оценка', 1, 5), 5); });
test('Личные данные', () => { assert.equal(V.email('TEST@MAIL.RU'), 'test@mail.ru'); for (const n of ['bad', 'a@b', 'a @b.ru'])
    assert.throws(() => V.email(n)); assert.throws(() => V.phone('123')); assert.throws(() => V.person('12345')); assert.throws(() => V.password('123')); assert.equal(V.person('Иван Иванов'), 'Иван Иванов'); assert.equal(V.phone('+7 (999) 123-45-67'), '+7 (999) 123-45-67'); });
test('Дата доставки', () => { assert.throws(() => V.date('2025-02-30')); assert.throws(() => V.date('1900-01-01')); assert.equal(V.date('2099-12-31'), '2099-12-31'); });
test('Фильтр мата и подмены букв', () => { for (const n of ['хуй', 'xуй', 'xуi', 'пизда', 'п.и.з.д.а', 'бля', 'бл9', 'fuck', 'huy', 'pizda', 'pizда', 'сука'])
    assert.throws(() => V.clean(n), undefined, n); assert.equal(V.clean('Прекрасная стрижка'), 'Прекрасная стрижка'); assert.equal(V.clean('Учеба'), 'Учеба'); });
test('Тип и размер изображения', () => { assert.equal(V.image(''), ''); assert.throws(() => V.image('data:image/svg+xml;base64,abc')); assert.throws(() => V.image('data:image/png;base64,abc')); });
