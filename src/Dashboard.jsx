import { validateProfile, validatePassword } from "./validation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { request, send, getMyCoupons } from "./api";
import { Field, Notice, OrderView, useAction } from "./ui";
export default function Dashboard() {
  const { user, setUser } = useAuth(),
    [form, setForm] = useState({ ...user }),
    [orders, setOrders] = useState([]),
    [coupons, setCoupons] = useState([]),
    [old, setOld] = useState(""),
    [password, setPassword] = useState(""),
    a = useAction(),
    b = useAction(),
    c = useAction();
  const f = (k) => ({
    value: form[k] || "",
    onChange: (e) => setForm((p) => ({ ...p, [k]: e.target.value })),
  });
  function load() {
    a.run(async () => {
      const [o, cp] = await Promise.all([request("/orders"), getMyCoupons()]);
      setOrders(o);
      setCoupons(cp);
    });
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <h1>Личный кабинет</h1>
      <p>
        Вы вошли как {user.name} (
        {user.role === "admin" ? "администратор" : "пользователь"})
      </p>
      {user.role === "admin" && <Link to="/admin">Перейти в админ-панель</Link>}
      <div className="dashboard-grid">
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            b.run(async () => {
              validateProfile(form);
              const u = await send("/me", "PUT", form);
              setUser(u);
              setForm(u);
            }, "Данные сохранены");
          }}
        >
          <h2>Личная информация</h2>
          <fieldset disabled={b.busy}>
            <Field
              label="ФИО"
              required
              minLength={3}
              maxLength={100}
              {...f("name")}
            />
            <Field
              label="Email"
              required
              type="email"
              maxLength={150}
              {...f("email")}
            />
            <Field
              label="Телефон"
              required
              type="tel"
              minLength={10}
              maxLength={30}
              {...f("phone")}
            />
            <Field
              label="Адрес по умолчанию"
              maxLength={250}
              {...f("address")}
            />
            <Notice {...b} />
            <button>Сохранить</button>
          </fieldset>
        </form>
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            c.run(async () => {
              validatePassword(password);
              await send("/me/password", "PUT", {
                old_password: old,
                password,
              });
              setOld("");
              setPassword("");
            }, "Пароль изменён");
          }}
        >
          <h2>Безопасность</h2>
          <fieldset disabled={c.busy}>
            <Field
              label="Текущий пароль"
              type="password"
              required
              value={old}
              onChange={(e) => setOld(e.target.value)}
            />
            <Field
              label="Новый пароль"
              type="password"
              required
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Notice {...c} />
            <button>Изменить пароль</button>
          </fieldset>
        </form>
      </div>
      <h2>Мои купоны</h2>
      {coupons.map((c, i) => (
        <p key={c.name}>
          {c.name} — {c.discount_percent}%
          {i === 0 && " (автоматически применяется ко всем услугам)"}
        </p>
      ))}
      {!coupons.length && <p>Купоны не назначены</p>}
      <h2>Мои заказы</h2>
      <Notice {...a} />
      {a.error && <button onClick={load}>Повторить</button>}
      {orders.map((o) => (
        <OrderView key={o.number} order={o} />
      ))}
      {!a.busy && !orders.length && <p>Заказов пока нет</p>}
    </>
  );
}
