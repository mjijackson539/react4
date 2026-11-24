const statuses = Object.freeze([
  "Новый",
  "В обработке",
  "Выполнен",
  "Отменён",
  "Завершён",
]);
const terminal = new Set(["Выполнен", "Отменён", "Завершён", "Архивный"]);
const isClosedStatus = (status) => terminal.has(status);
function assertOrderEditable(currentStatus) {
  if (isClosedStatus(currentStatus)) {
    const error = new Error(
      "Заказ имеет окончательный статус: изменять его больше нельзя",
    );
    error.status = 409;
    throw error;
  }
}
function assertOrderNotDeletable() {
  const error = new Error(
    "Удаление заказов запрещено. Заказы должны сохраняться в истории.",
  );
  error.status = 403;
  throw error;
}
module.exports = {
  statuses,
  isClosedStatus,
  assertOrderEditable,
  assertOrderNotDeletable,
};
