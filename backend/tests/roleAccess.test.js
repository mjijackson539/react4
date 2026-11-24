const test = require('node:test');
const assert = require('node:assert/strict');
const { clientOnly } = require('../roleAccess');
const { smtpConfig } = require('../email');

test('Клиент может использовать корзину и оформлять заказы', () => {
  let called = false;
  clientOnly({user:{role:'client'}}, {}, error => {assert.equal(error, undefined); called = true;});
  assert.ok(called);
});

test('Администратор не может использовать корзину и оформлять заказы', () => {
  let status;
  clientOnly({user:{role:'admin'}}, {}, error => {status = error.status;});
  assert.equal(status, 403);
});

test('Гость не может пройти проверку роли клиента', () => {
  let status;
  clientOnly({}, {}, error => {status = error.status;});
  assert.equal(status, 403);
});

test('SMTP сообщает об отсутствии настроек вместо ложного успеха', () => {
  const values = ['SMTP_HOST','SMTP_USER','SMTP_PASS','SMTP_FROM'];
  const previous = Object.fromEntries(values.map(k => [k,process.env[k]]));
  try {
    for (const key of values) delete process.env[key];
    assert.throws(() => smtpConfig(), {status:503});
  } finally {
    for (const key of values) previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key];
  }
});
