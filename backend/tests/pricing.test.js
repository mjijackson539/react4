const test = require('node:test');
const assert = require('node:assert/strict');
const { cents, discountedCents, personalizedPrice } = require('../pricing');
test('Гость видит цену без персонального купона', () => {
    assert.equal(personalizedPrice({ price: '1000.00', final_price: '900.00' }, null).final_price, 900);
});
test('Персональная скидка распространяется на каждую услугу и сочетается со скидкой услуги', () => {
    const c = { name: '15%', discount_percent: 15 };
    const rows = [{ price: '1000.00', final_price: '900.00' }, { price: '2000.00', final_price: '2000.00' }].map(s => personalizedPrice(s,c));
    assert.deepEqual(rows.map(s => s.final_price), [765, 1700]);
    assert.equal(rows[0].service_price, 900);
    assert.equal(rows[1].coupon_name, '15%');
});
test('Оформление и корзина одинаково округляют стоимость каждой единицы', () => {
    const row = personalizedPrice({ final_price: '0.03' }, { name: '15%', discount_percent: 15 });
    assert.equal(cents(row.final_price) * 3, discountedCents(3, 15) * 3);
    assert.equal(cents(row.final_price) * 3, 9);
});
