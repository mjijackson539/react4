import { validateAddress } from "./validation";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "./CartContext";
import { useAuth } from "./AuthContext";
import { send, money, today } from "./api";
import { Field, Notice, Picture, useAction } from "./ui";

export default function Cart() {
  const { cart, busy, error, change, reload } = useCart();
  const { user } = useAuth(),
    navigate = useNavigate();
  const [address, setAddress] = useState(user.address || ""),
    [date, setDate] = useState(today());
  const a = useAction(),
    loading = useAction();
  useEffect(() => {
    loading.run(reload);
  }, []);
  const coupon = cart[0]?.coupon_name;
  const percent = cart[0]?.coupon_percent || 0;
  const subtotal = cart.reduce(
    (sum, s) => sum + Math.round(Number(s.service_price) * 100) * s.quantity,
    0,
  );
  const total = cart.reduce(
    (sum, s) => sum + Math.round(Number(s.final_price) * 100) * s.quantity,
    0,
  );
  const invalid = cart.some((i) => i.quantity > i.stock);
  const disabled = busy || a.busy || loading.busy;
  return (
    <>
      <h1>Корзина</h1>
      <Notice busy={busy || loading.busy} error={error || loading.error} />
      {loading.error && (
        <button onClick={() => loading.run(reload)}>Повторить</button>
      )}
      {!cart.length && !disabled ? (
        <p>
          Корзина пуста. <Link to="/">Перейти в каталог</Link>
        </p>
      ) : (
        cart.map((s) => (
          <div key={s.name} className="line cart-line">
            <Picture src={s.image_url} className="thumb" alt={s.name} />
            <div>
              <strong>{s.name}</strong>
              <p>
                {Number(s.final_price) < Number(s.price) && (
                  <>
                    <s>{money(s.price)}</s>{" "}
                  </>
                )}
                {money(s.final_price)} / шт. · Доступно: {s.stock}
              </p>
            </div>
            <div className="quantity">
              <button disabled={disabled} onClick={() => change(s.name, -1)}>
                −
              </button>
              <span>{s.quantity}</span>
              <button
                disabled={disabled || s.quantity >= s.stock}
                onClick={() => change(s.name, 1)}
              >
                +
              </button>
            </div>
            <strong>
              {money(
                (Math.round(Number(s.final_price) * 100) * s.quantity) / 100,
              )}
            </strong>
            <button disabled={disabled} onClick={() => change(s.name, 0, 0)}>
              Удалить
            </button>
          </div>
        ))
      )}
      {cart.length > 0 && (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            a.run(async () => {
              validateAddress(address);
              if (date < today())
                throw new Error("Дата доставки не может быть раньше текущей");
              try {
                await send("/orders", "POST", {
                  address,
                  delivery_date: date,
                  coupon_name: coupon || null,
                  expected_total_cents: total,
                });
              } catch (err) {
                await reload().catch(() => {});
                throw err;
              }
              await reload().catch(() => {});
              navigate("/dashboard");
            });
          }}
        >
          <fieldset disabled={disabled || !!loading.error}>
            <h3>Оформление заказа</h3>
            <p>
              Персональный купон:{" "}
              {coupon ? (
                <strong>
                  {coupon} (−{percent}%) — применён автоматически ко всем
                  услугам
                </strong>
              ) : (
                "Не назначен"
              )}
            </p>
            <p>Сумма до персональной скидки: {money(subtotal / 100)}</p>
            {coupon && (
              <p>Экономия по купону: {money((subtotal - total) / 100)}</p>
            )}
            <h3>К оплате: {money(total / 100)}</h3>
            <Field
              label="Адрес доставки"
              required
              minLength={5}
              maxLength={250}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <Field
              label="Дата доставки"
              type="date"
              required
              min={today()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Notice
              {...a}
              error={
                a.error ||
                (invalid
                  ? "Уменьшите количество: доступное количество изменилось"
                  : "")
              }
            />
            <button disabled={invalid}>Оформить заказ</button>
          </fieldset>
        </form>
      )}
    </>
  );
}
