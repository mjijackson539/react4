function clientOnly(req, res, next) {
  if (req.user?.role === "client") return next();
  const error = new Error(
    "Администратор не может оформлять заказы или использовать корзину",
  );
  error.status = 403;
  next(error);
}
module.exports = { clientOnly };
