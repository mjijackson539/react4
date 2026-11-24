import {
  validateProfile,
  validatePassword,
  validateAddress,
} from "./validation";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import AdminReviews from "./AdminReviews";
import {
  adminRequest,
  getCategories,
  getServices,
  keyPath,
  today,
  money,
} from "./api";
import { useAuth } from "./AuthContext";
import {
  Field,
  SelectField,
  TextField,
  Picture,
  Notice,
  useAction,
  OrderView,
} from "./ui";
const sections = {
  services: "Услуги",
  categories: "Категории",
  coupons: "Купоны",
  users: "Пользователи",
  orders: "Заказы",
  "user-coupons": "Назначенные купоны",
};
const defaults = {
  services: {
    name: "",
    description: "",
    category_name: "",
    duration_minutes: "",
    price: "",
    discount_percent: 0,
    stock: 0,
    image_url: "",
  },
  categories: { name: "" },
  coupons: { name: "", discount_percent: 5 },
  users: { name: "", email: "", phone: "", address: "", password: "" },
  orders: {
    email: "",
    address: "",
    delivery_date: today(),
    coupon_name: "",
    items: [{ name: "", quantity: 1 }],
    status: "Новый",
  },
  "user-coupons": { email: "", coupon_name: "" },
};

const orderStatuses = [
  "Новый",
  "В обработке",
  "Выполнен",
  "Отменён",
  "Завершён",
];
const closedStatuses = ["Выполнен", "Отменён", "Завершён", "Архивный"];
const isClosedOrder = (row) => closedStatuses.includes(row?.status);
const ident = (type, row) =>
  type === "users" ? row.email : type === "orders" ? row.number : row.name;

export default function Admin() {
  const { section } = useParams();
  const valid = section && Object.hasOwn(sections, section);
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar" aria-label="Разделы администрирования">
        <h2>Управление</h2>
        <NavLink end to="/admin">
          Обзор
        </NavLink>
        {Object.entries(sections).map(([key, title]) => (
          <NavLink key={key} to={"/admin/" + key}>
            {title}
          </NavLink>
        ))}
        <NavLink to="/admin/reviews">Отзывы</NavLink>
      </aside>
      <section className="admin-content">
        {!section ? (
          <>
            <h1>Административная панель</h1>
            <p>Выберите раздел в меню слева.</p>
            <div className="admin-actions">
              {Object.entries(sections).map(([key, title]) => (
                <Link className="button-link" key={key} to={"/admin/" + key}>
                  {title}
                </Link>
              ))}
              <Link className="button-link" to="/admin/reviews">
                Отзывы
              </Link>
            </div>
          </>
        ) : section === "reviews" ? (
          <AdminReviews />
        ) : valid ? (
          <Manager key={section} type={section} />
        ) : (
          <>
            <h1>Раздел не найден</h1>
            <Link to="/admin">Вернуться к панели</Link>
          </>
        )}
      </section>
    </div>
  );
}
function Manager({ type }) {
  const { user, setUser } = useAuth(),
    [rows, setRows] = useState([]),
    [cats, setCats] = useState([]),
    [users, setUsers] = useState([]),
    [coupons, setCoupons] = useState([]),
    [services, setServices] = useState([]),
    [assigns, setAssigns] = useState([]),
    [search, setSearch] = useState(""),
    [userSearch, setUserSearch] = useState(""),
    [couponSearch, setCouponSearch] = useState(""),
    [editor, setEditor] = useState(null),
    [form, setForm] = useState({}),
    a = useAction(),
    b = useAction();
  const self = type === "users" && editor?.row?.email === user.email;
  const base = "/" + type;
  const f = (k) => ({
    value: form[k] ?? "",
    onChange: (e) => setForm((old) => ({ ...old, [k]: e.target.value })),
  });
  async function load() {
    const data = await (type === "services"
      ? getServices()
      : type === "categories"
        ? getCategories()
        : adminRequest(base));
    setRows(data);
    if (type === "services") setCats(await getCategories());
    if (["user-coupons", "orders"].includes(type)) {
      const [u, c, s, as] = await Promise.all([
        adminRequest("/users"),
        adminRequest("/coupons"),
        getServices(),
        adminRequest("/user-coupons"),
      ]);
      setUsers(u);
      setCoupons(c);
      setServices(s);
      setAssigns(as);
    }
  }
  useEffect(() => {
    a.run(load);
  }, []);
  const pageTopRef = useRef(null);
  useEffect(() => {
    if (editor)
      pageTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }, [editor]);
  function edit(row) {
    if (type === "orders" && !row) return;
    if (type === "orders" && isClosedOrder(row)) {
      b.setError(
        "Этот заказ имеет окончательный статус и больше не может быть изменён.",
      );
      return;
    }
    b.setError("");
    b.setMessage("");
    setUserSearch("");
    setCouponSearch("");
    setEditor({ row });
    setForm(row ? { ...row } : structuredClone(defaults[type]));
  }
  async function save(e) {
    e.preventDefault();
    await b.run(async () => {
      const row = editor.row;
      const body = { ...form };
      if (type === "users") {
        validateProfile(body);
        if (!row) validatePassword(body.password);
      }
      if (type === "orders" && (!row?.legacy || body.address))
        validateAddress(body.address);
      if (
        ["services", "categories", "coupons"].includes(type) &&
        !body.name.trim()
      )
        throw new Error("Название не может быть пустым");
      if (type === "services" && !body.description.trim())
        throw new Error("Введите описание");
      if (type === "orders" && row) {
        delete body.items;

        if (isClosedOrder(row))
          throw new Error(
            "Изменение заказа с окончательным статусом запрещено",
          );
      }
      if (type === "user-coupons" && row) {
        await adminRequest(base, "PUT", {
          ...body,
          previous: { email: row.email, coupon_name: row.coupon_name },
        });
        setEditor(null);
        await load();
        return;
      }
      const path = row ? base + "/" + keyPath(ident(type, row)) : base;
      const result = await adminRequest(path, row ? "PUT" : "POST", body);
      if (self)
        setUser({
          ...user,
          name: body.name,
          email: body.email,
          phone: body.phone,
          address: body.address,
        });
      setEditor(null);
      await load();
    }, "Изменения сохранены");
  }
  function remove(row) {
    if (type === "orders") {
      b.setError("Удаление заказов запрещено. Заказы сохраняются в истории.");
      return;
    }
    if (!window.confirm("Удалить запись?")) return;
    b.run(async () => {
      await adminRequest(
        type === "user-coupons" ? base : base + "/" + keyPath(ident(type, row)),
        "DELETE",
        type === "user-coupons" ? row : undefined,
      );
      if (editor?.row === row) setEditor(null);
      await load();
    }, "Запись удалена");
  }
  function readImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        file.type,
      ) ||
      file.size > 2097152
    ) {
      b.setError("Выберите PNG, JPEG, WEBP или GIF до 2 МБ");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((x) => ({ ...x, image_url: reader.result }));
      b.setError("");
    };
    reader.onerror = () => b.setError("Не удалось прочитать изображение");
    reader.readAsDataURL(file);
  }
  function line(i, k, v) {
    setForm((x) => ({
      ...x,
      items: x.items.map((r, j) => (j === i ? { ...r, [k]: v } : r)),
    }));
  }
  const list = rows.filter((row) =>
    Object.entries(row)
      .filter(([k]) => k !== "image_url")
      .map(([k, v]) =>
        k === "items" ? v.map((i) => i.name).join(" ") : String(v ?? ""),
      )
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const couponUsers = users.filter((u) => u.role !== "admin");
  const normalizedUserSearch = userSearch.trim().toLocaleLowerCase("ru-RU");
  const matchingCouponUsers = couponUsers.filter(
    (u) =>
      !normalizedUserSearch ||
      `${u.name} ${u.email}`
        .toLocaleLowerCase("ru-RU")
        .includes(normalizedUserSearch),
  );
  const visibleCouponUsers = couponUsers.filter(
    (u) =>
      matchingCouponUsers.some((match) => match.email === u.email) ||
      u.email === form.email,
  );

  const normalizedCouponSearch = couponSearch.trim().toLocaleLowerCase("ru-RU");
  const matchingCoupons = coupons.filter(
    (c) =>
      !normalizedCouponSearch ||
      `${c.name} ${c.discount_percent} ${c.discount_percent}%`
        .toLocaleLowerCase("ru-RU")
        .includes(normalizedCouponSearch),
  );
  const visibleCoupons = coupons.filter(
    (c) =>
      matchingCoupons.some((match) => match.name === c.name) ||
      c.name === form.coupon_name,
  );
  return (
    <div className="admin-manager" ref={pageTopRef}>
      <h1>{sections[type]}</h1>
      <input
        className="search"
        placeholder={
          type === "coupons"
            ? "Поиск купона по названию или скидке"
            : type === "user-coupons"
              ? "Поиск назначений по пользователю или купону"
              : "Поиск"
        }
        aria-label={"Поиск: " + sections[type]}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Notice {...a} />
      {a.error && (
        <button disabled={a.busy} onClick={() => a.run(load)}>
          Повторить
        </button>
      )}
      {type !== "orders" && (
        <button disabled={b.busy || a.busy} onClick={() => edit(null)}>
          Добавить
        </button>
      )}
      <Notice {...b} />
      {editor && (
        <form className="admin-editor" onSubmit={save}>
          <h3>{editor.row ? "Редактирование" : "Новая запись"}</h3>
          <fieldset disabled={b.busy}>
            {["services", "categories", "coupons", "users"].includes(type) && (
              <Field
                label={type === "users" ? "ФИО" : "Название"}
                required
                maxLength={type === "services" ? 150 : 100}
                {...f("name")}
              />
            )}
            {type === "services" && (
              <>
                <TextField
                  label="Описание"
                  required
                  maxLength={2000}
                  {...f("description")}
                />
                <SelectField label="Категория" {...f("category_name")}>
                  <option value="">Без категории (по умолчанию)</option>
                  {cats.map((c) => (
                    <option key={c.name}>{c.name}</option>
                  ))}
                </SelectField>
                <Field
                  label="Длительность, мин."
                  type="number"
                  required
                  min={1}
                  max={1440}
                  step={1}
                  {...f("duration_minutes")}
                />
                <Field
                  label="Цена, ₽"
                  type="number"
                  required
                  min="0.01"
                  max="99999999.99"
                  step="0.01"
                  {...f("price")}
                />
                <Field
                  label="Доступное количество"
                  type="number"
                  required
                  min={0}
                  max={1000000}
                  step={1}
                  {...f("stock")}
                />
                <Picture src={form.image_url} alt="Предпросмотр" />
                <Field
                  label="Загрузить фото"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={readImage}
                />
                <button
                  type="button"
                  onClick={() => setForm((x) => ({ ...x, image_url: "" }))}
                >
                  Удалить фотографию
                </button>
              </>
            )}
            {["services", "coupons"].includes(type) && (
              <Field
                label="Скидка, %"
                type="number"
                required
                min={type === "services" ? 0 : 1}
                max={100}
                step={1}
                {...f("discount_percent")}
              />
            )}
            {type === "users" && (
              <>
                <Field
                  label="Email"
                  type="email"
                  required
                  maxLength={150}
                  {...f("email")}
                />
                <Field
                  label="Телефон"
                  type="tel"
                  required
                  minLength={10}
                  maxLength={30}
                  {...f("phone")}
                />
                <Field
                  label="Адрес по умолчанию"
                  maxLength={250}
                  {...f("address")}
                />
                {!editor.row && (
                  <Field
                    label="Временный пароль"
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    {...f("password")}
                  />
                )}
              </>
            )}
            {type === "user-coupons" && (
              <>
                <Field
                  label="Поиск пользователя по ФИО или email"
                  type="search"
                  placeholder="Например, Клиент или client@example.com"
                  autoComplete="off"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <p className="user-search-hint" aria-live="polite">
                  {normalizedUserSearch
                    ? `Найдено пользователей: ${matchingCouponUsers.length}`
                    : `Доступно пользователей: ${couponUsers.length}`}
                </p>
              </>
            )}
            {(type === "user-coupons" ||
              (type === "orders" && !editor.row)) && (
              <SelectField
                label="Пользователь"
                required
                value={form.email}
                onChange={(e) =>
                  setForm((x) => ({
                    ...x,
                    email: e.target.value,
                    coupon_name: "",
                    ...(type === "orders"
                      ? {
                          address:
                            users.find((u) => u.email === e.target.value)
                              ?.address || "",
                        }
                      : {}),
                  }))
                }
              >
                <option value="">Выберите пользователя</option>
                {(type === "user-coupons" ? visibleCouponUsers : users).map(
                  (u) => (
                    <option key={u.email} value={u.email}>
                      {u.name} ({u.email})
                    </option>
                  ),
                )}
              </SelectField>
            )}
            {type === "user-coupons" &&
              normalizedUserSearch &&
              matchingCouponUsers.length === 0 && (
                <p className="user-search-hint">
                  По запросу ничего не найдено. Попробуйте другую часть имени
                  или email.
                </p>
              )}
            {type === "user-coupons" && (
              <>
                <Field
                  label="Поиск купона по названию или скидке"
                  type="search"
                  placeholder="Например, Персональный или 15%"
                  autoComplete="off"
                  value={couponSearch}
                  onChange={(e) => setCouponSearch(e.target.value)}
                />
                <p className="user-search-hint" aria-live="polite">
                  {normalizedCouponSearch
                    ? `Найдено купонов: ${matchingCoupons.length}`
                    : `Доступно купонов: ${coupons.length}`}
                </p>
                <SelectField label="Купон" required {...f("coupon_name")}>
                  <option value="">Выберите купон</option>
                  {visibleCoupons.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} — {c.discount_percent}%
                    </option>
                  ))}
                </SelectField>
                {normalizedCouponSearch && matchingCoupons.length === 0 && (
                  <p className="user-search-hint">
                    Купоны не найдены. Попробуйте другое название или процент
                    скидки.
                  </p>
                )}
              </>
            )}
            {type === "orders" && !editor.row && (
              <p>
                Персональный купон:{" "}
                {form.email
                  ? (assigns
                      .filter((a) => a.email === form.email)
                      .sort(
                        (a, b) =>
                          Number(b.discount_percent) -
                          Number(a.discount_percent),
                      )[0]?.discount_percent || 0) + "% (автоматически)"
                  : "Выберите пользователя"}
              </p>
            )}
            {type === "orders" && (
              <>
                <Field
                  label="Адрес доставки"
                  required={!editor.row?.legacy}
                  minLength={5}
                  maxLength={250}
                  {...f("address")}
                />
                <Field
                  label="Дата доставки"
                  type="date"
                  required={!editor.row?.legacy}
                  min={
                    editor.row?.delivery_date < today()
                      ? editor.row.delivery_date
                      : today()
                  }
                  {...f("delivery_date")}
                />
                {editor.row ? (
                  <SelectField label="Статус" required {...f("status")}>
                    {orderStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </SelectField>
                ) : (
                  <>
                    <h4>Позиции заказа</h4>
                    {form.items.map((item, i) => (
                      <div className="order-line-edit" key={i}>
                        <SelectField
                          label="Услуга"
                          required
                          value={item.name}
                          onChange={(e) => line(i, "name", e.target.value)}
                        >
                          <option value="">Выберите</option>
                          {services.map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.name} ({s.stock} шт.)
                            </option>
                          ))}
                        </SelectField>
                        <Field
                          label="Количество"
                          type="number"
                          required
                          min={1}
                          max={
                            services.find((s) => s.name === item.name)?.stock ||
                            1
                          }
                          value={item.quantity}
                          onChange={(e) => line(i, "quantity", e.target.value)}
                        />
                        <button
                          type="button"
                          disabled={form.items.length === 1}
                          onClick={() =>
                            setForm((x) => ({
                              ...x,
                              items: x.items.filter((_, j) => j !== i),
                            }))
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setForm((x) => ({
                          ...x,
                          items: [...x.items, { name: "", quantity: 1 }],
                        }))
                      }
                    >
                      Добавить позицию
                    </button>
                  </>
                )}
              </>
            )}
            <button>Сохранить</button>
            <button type="button" onClick={() => setEditor(null)}>
              Отмена
            </button>
          </fieldset>
        </form>
      )}
      <div className="admin-list">
        {list.map((row) => (
          <div
            key={
              type === "user-coupons"
                ? `${row.email}/${row.coupon_name}`
                : ident(type, row)
            }
            className="admin-record"
          >
            {type === "orders" ? (
              <OrderView order={row} admin />
            ) : (
              <div className="line">
                {type === "services" && (
                  <Picture
                    className="thumb"
                    src={row.image_url}
                    alt={row.name}
                  />
                )}
                <span>
                  <strong>
                    {type === "user-coupons"
                      ? `${row.customer} — ${row.coupon_name}`
                      : row.name}
                  </strong>
                  {type === "services" && (
                    <p>
                      {row.category_name} · {money(row.price)} · доступно{" "}
                      {row.stock}
                      {Number(row.discount_percent) > 0
                        ? ` · скидка ${row.discount_percent}%`
                        : ""}
                    </p>
                  )}
                  {type === "users" && (
                    <p>
                      {row.email} · {row.phone || "телефон не указан"} ·{" "}
                      {row.role}
                    </p>
                  )}
                  {type === "coupons" && <p>{row.discount_percent}%</p>}
                  {type === "user-coupons" && <p>{row.email}</p>}
                </span>
              </div>
            )}
            <div className="line-actions">
              <button
                disabled={b.busy || (type === "orders" && isClosedOrder(row))}
                title={
                  type === "orders" && isClosedOrder(row)
                    ? "Заказ уже выполнен, отменён или завершён"
                    : undefined
                }
                onClick={() => edit(row)}
              >
                Изменить
              </button>
              {type === "orders" && isClosedOrder(row) && (
                <span className="user-search-hint">
                  Статус окончательный — редактирование закрыто
                </span>
              )}
              {type !== "orders" && (
                <button
                  disabled={
                    b.busy ||
                    (type === "categories" && row.name === "Без категории") ||
                    (type === "users" && row.role === "admin")
                  }
                  onClick={() => remove(row)}
                >
                  Удалить
                </button>
              )}
            </div>
          </div>
        ))}
        {!a.busy && !list.length && <p>Ничего не найдено</p>}
      </div>
    </div>
  );
}
