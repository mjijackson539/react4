const test = require('node:test');
const assert = require('node:assert/strict');
const { statuses, isClosedStatus, assertOrderEditable } = require('../orderStatus');

test('Статусы Новый и В обработке разрешают редактирование', () => {
  for (const status of ['Новый','В обработке']) {
    assert.equal(isClosedStatus(status), false);
    assert.doesNotThrow(() => assertOrderEditable(status));
  }
});
test('Завершённый, выполненный, отменённый и архивный заказ заблокированы', () => {
  for (const status of ['Выполнен','Отменён','Завершён','Архивный']) {
    assert.equal(isClosedStatus(status), true);
    assert.throws(() => assertOrderEditable(status), {status:409});
  }
});
test('Администратору доступны все пять статусов', () => {
  assert.deepEqual(statuses, ['Новый','В обработке','Выполнен','Отменён','Завершён']);
});
