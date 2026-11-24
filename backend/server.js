const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { Pool } = require("pg");
const { randomBytes, randomInt, createHash } = require("crypto");
const { sendResetCode, smtpConfig } = require("./email");
const { clientOnly: client } = require("./roleAccess");
const V = require("./validation");
const { cents, discountedCents, personalizedPrice } = require("./pricing");
const {
  statuses,
  assertOrderEditable,
  assertOrderNotDeletable,
} = require("./orderStatus");
const app = express(),
  pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
app.use(
  cors({
    origin:
      process.env.FRONTEND_ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
  }),
);
app.use(express.json({ limit: "3mb" }));
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
    return res.status(400).json({ error: "Ожидается JSON-объект" });
  next();
});
const q = (sql, args = []) => pool.query(sql, args),
  hash = (x) => createHash("sha256").update(x).digest("hex"),
  token = () => randomBytes(32).toString("hex");
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const one = async (db, sql, args = [], message = "Ресурс не найден") => {
  const r = await db.query(sql, args);
  if (!r.rows.length) V.bad(message, 404);
  return r.rows[0];
};
async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
const userFields = "u.name,u.email,u.phone,u.address,r.name AS role";
const serviceFields =
  "s.name,s.description,s.duration_minutes,s.price,s.discount_percent,s.stock,s.image_url,c.name AS category_name,round(s.price*(100-s.discount_percent)/100,2) AS final_price";
const serviceJoin =
  " FROM services s JOIN categories c ON c.category_id=s.category_id ";
const auth = wrap(async (req, res, next) => {
  const t = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!/^[a-f0-9]{64}$/.test(t)) V.bad("Требуется авторизация", 401);
  const r = await q(
    `SELECT u.user_id,${userFields} FROM auth_sessions a JOIN users u ON u.user_id=a.user_id JOIN roles r ON r.role_id=u.role_id WHERE a.token_hash=$1 AND a.expires_at>now() AND u.active`,
    [hash(t)],
  );
  if (!r.rows.length) V.bad("Войдите в аккаунт заново", 401);
  req.user = r.rows[0];
  req.token = t;
  next();
});

const optionalAuth = (req, res, next) =>
  req.headers.authorization ? auth(req, res, next) : next();
const admin = (req, res, next) =>
  req.user.role === "admin"
    ? next()
    : next(
        Object.assign(new Error("Доступ только администратору"), {
          status: 403,
        }),
      );
const route = (method, path, fn, guard = []) =>
  app[method]("/api" + path, ...guard, wrap(fn));

const A = [auth, admin],
  U = [auth],
  C = [auth, client];
const profile = (u) => ({
  name: u.name,
  email: u.email,
  phone: u.phone,
  address: u.address,
  role: u.role,
});
route(
  "get",
  "/services",
  async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    const coupon = await bestCoupon(
      pool,
      req.user?.role === "client" ? req.user.user_id : null,
    );
    const rows = (
      await q(
        `SELECT ${serviceFields}${serviceJoin}WHERE s.active ORDER BY s.name`,
      )
    ).rows;
    res.json(rows.map((s) => personalizedPrice(s, coupon)));
  },
  [optionalAuth],
);
route("get", "/categories", async (req, res) =>
  res.json((await q("SELECT name FROM categories ORDER BY name")).rows),
);
route(
  "get",
  "/services/:name",
  async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    const coupon = await bestCoupon(
      pool,
      req.user?.role === "client" ? req.user.user_id : null,
    );
    const service = await one(
      pool,
      `SELECT ${serviceFields}${serviceJoin}WHERE s.active AND s.name=$1`,
      [req.params.name],
    );
    res.json(personalizedPrice(service, coupon));
  },
  [optionalAuth],
);
async function createSession(u, res) {
  const t = token();
  await q("INSERT INTO auth_sessions(token_hash,user_id) VALUES($1,$2)", [
    hash(t),
    u.user_id,
  ]);
  res.json({ user: profile(u), token: t });
}
route("post", "/login", async (req, res) => {
  const email = V.email(req.body.email),
    p = V.loginPassword(req.body.password);
  const r = await q(
    `SELECT u.user_id,${userFields} FROM users u JOIN roles r ON r.role_id=u.role_id WHERE lower(u.email)=$1 AND u.active AND u.password_hash=crypt($2,u.password_hash)`,
    [email, p],
  );
  if (!r.rows.length) V.bad("Неверный email или пароль", 401);
  await createSession(r.rows[0], res);
});
function userData(b) {
  return [
    V.clean(V.person(b.name), "ФИО", 100),
    V.email(b.email),
    V.phone(b.phone),
    b.address ? V.clean(b.address, "Адрес", 250, 5) : "",
  ];
}
route("post", "/register", async (req, res) => {
  let d = userData(req.body),
    p = V.password(req.body.password);
  const u = await one(
    pool,
    `INSERT INTO users(role_id,name,email,phone,address,password_hash,recovery_hash) SELECT role_id,$1,$2,$3,$4,crypt($5,gen_salt('bf')), NULL FROM roles WHERE name='client' RETURNING user_id,name,email,phone,address,'client' AS role`,
    [...d, p],
  );
  await createSession(u, res);
});
route(
  "post",
  "/logout",
  async (req, res) => {
    await q("DELETE FROM auth_sessions WHERE token_hash=$1", [hash(req.token)]);
    res.json({ ok: true });
  },
  U,
);
route("get", "/me", async (req, res) => res.json(profile(req.user)), U);
route(
  "put",
  "/me",
  async (req, res) => {
    const d = userData(req.body);
    const u = await one(
      pool,
      "UPDATE users SET name=$1,email=$2,phone=$3,address=$4 WHERE user_id=$5 RETURNING name,email,phone,address",
      [...d, req.user.user_id],
    );
    res.json({ ...u, role: req.user.role });
  },
  U,
);
route(
  "put",
  "/me/password",
  async (req, res) => {
    const p = V.password(req.body.password),
      old = V.loginPassword(req.body.old_password);
    await tx(async (c) => {
      const r = await c.query(
        "UPDATE users SET password_hash=crypt($1,gen_salt('bf')) WHERE user_id=$2 AND password_hash=crypt($3,password_hash) RETURNING user_id",
        [p, req.user.user_id, old],
      );
      if (!r.rowCount) V.bad("Неверный текущий пароль");
      await c.query(
        "DELETE FROM auth_sessions WHERE user_id=$1 AND token_hash<>$2",
        [req.user.user_id, hash(req.token)],
      );
    });
    res.json({ ok: true });
  },
  U,
);

const resetLimits = new Map();
function rateLimitReset(ip) {
  const now = Date.now(),
    state = resetLimits.get(ip);
  if (state && now - state.first < 15 * 60 * 1000 && state.count >= 10)
    V.bad("Слишком много запросов. Повторите позже", 429);
  resetLimits.set(
    ip,
    state && now - state.first < 15 * 60 * 1000
      ? { first: state.first, count: state.count + 1 }
      : { first: now, count: 1 },
  );
  if (resetLimits.size > 2000)
    for (const [k, v] of resetLimits) {
      if (now - v.first > 15 * 60 * 1000) resetLimits.delete(k);
    }
}
route("post", "/password-reset/request", async (req, res) => {
  const email = V.email(req.body.email);
  smtpConfig(); // Не сообщаем об успешной отправке, если SMTP вообще не настроен.
  rateLimitReset(req.ip || "local");
  try {
    await tx(async (c) => {
      const r = await c.query(
        "SELECT user_id FROM users WHERE lower(email)=$1 AND active FOR UPDATE",
        [email],
      );
      if (!r.rows.length) return;
      const uid = r.rows[0].user_id;
      const old = await c.query(
        "SELECT requested_at FROM password_reset_codes WHERE user_id=$1",
        [uid],
      );
      if (
        old.rows.length &&
        Date.now() - new Date(old.rows[0].requested_at).getTime() < 60_000
      )
        return;
      const code = String(randomInt(100000, 1000000));
      await c.query(
        `INSERT INTO password_reset_codes(user_id,code_hash,expires_at,attempts,requested_at)
                VALUES($1,crypt($2,gen_salt('bf')),now()+interval '10 minutes',0,now())
                ON CONFLICT(user_id) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,attempts=0,requested_at=now()`,
        [uid, code],
      );
      await sendResetCode(email, code);
    });
  } catch (e) {
    if (e.status) throw e;
    console.error("Ошибка отправки письма восстановления:", e.message);
    V.bad(
      "Не удалось отправить письмо. Проверьте SMTP-настройки и повторите попытку",
      503,
    );
  }
  res.json({
    message:
      "Если аккаунт с таким email существует, письмо с кодом отправлено. Проверьте также папку «Спам».",
  });
});
route("post", "/reset-password", async (req, res) => {
  const email = V.email(req.body.email),
    code = String(req.body.code ?? ""),
    p = V.password(req.body.password);
  if (!/^\d{6}$/.test(code)) V.bad("Введите шестизначный код из письма");
  const success = await tx(async (c) => {
    const r = await c.query(
      `SELECT u.user_id,r.code_hash,r.expires_at,r.attempts FROM users u
            JOIN password_reset_codes r ON r.user_id=u.user_id
            WHERE lower(u.email)=$1 AND u.active FOR UPDATE OF r`,
      [email],
    );
    if (!r.rows.length) return false;
    const row = r.rows[0];
    if (new Date(row.expires_at) < new Date() || row.attempts >= 5) {
      await c.query("DELETE FROM password_reset_codes WHERE user_id=$1", [
        row.user_id,
      ]);
      return false;
    }
    const valid = await c.query("SELECT ($1 = crypt($2,$1)) AS valid", [
      row.code_hash,
      code,
    ]);
    if (!valid.rows[0].valid) {
      await c.query(
        "UPDATE password_reset_codes SET attempts=attempts+1 WHERE user_id=$1",
        [row.user_id],
      );
      return false;
    }
    await c.query(
      "UPDATE users SET password_hash=crypt($1,gen_salt('bf')),recovery_hash=NULL WHERE user_id=$2",
      [p, row.user_id],
    );
    await c.query("DELETE FROM password_reset_codes WHERE user_id=$1", [
      row.user_id,
    ]);
    await c.query("DELETE FROM auth_sessions WHERE user_id=$1", [row.user_id]);
    return true;
  });
  if (!success) V.bad("Код недействителен, истёк или превышено число попыток");
  res.json({ ok: true });
});
const coupons = async (db, uid) =>
  (
    await db.query(
      "SELECT c.name,c.discount_percent FROM coupons c JOIN user_coupons uc ON c.coupon_id=uc.coupon_id JOIN users u ON u.user_id=uc.user_id WHERE u.user_id=$1 ORDER BY c.discount_percent DESC,c.name,c.coupon_id",
      [uid],
    )
  ).rows;

async function bestCoupon(db, uid) {
  return uid == null ? null : (await coupons(db, uid))[0] || null;
}
route(
  "get",
  "/my-coupons",
  async (req, res) => res.json(await coupons(pool, req.user.user_id)),
  C,
);
const cart = async (db, uid) => {
  const coupon = await bestCoupon(db, uid);
  const rows = (
    await db.query(
      `SELECT ${serviceFields},ci.quantity${serviceJoin}JOIN cart_items ci ON ci.service_id=s.service_id JOIN users u ON u.user_id=ci.user_id WHERE u.user_id=$1 AND s.active ORDER BY s.name`,
      [uid],
    )
  ).rows;
  return rows.map((s) => personalizedPrice(s, coupon));
};
route(
  "get",
  "/cart",
  async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    res.json(await cart(pool, req.user.user_id));
  },
  C,
);
route(
  "put",
  "/cart",
  async (req, res) => {
    const name = V.str(req.body.name, "Услуга"),
      delta = Number(req.body.delta),
      qty =
        req.body.quantity === undefined
          ? null
          : V.num(req.body.quantity, "Количество", 0, 1000000);
    if (qty === null && ![1, -1].includes(delta))
      V.bad("Некорректное количество");
    const result = await tx(async (c) => {
      await one(
        c,
        "SELECT user_id FROM users WHERE user_id=$1 AND active FOR UPDATE",
        [req.user.user_id],
      );
      const s = await one(
        c,
        "SELECT service_id,stock FROM services WHERE name=$1 AND active FOR UPDATE",
        [name],
      );
      const r = await c.query(
        "SELECT quantity FROM cart_items WHERE user_id=$1 AND service_id=$2",
        [req.user.user_id, s.service_id],
      );
      const n = qty ?? Math.max(0, (r.rows[0]?.quantity || 0) + delta);
      if (n > s.stock && n > (r.rows[0]?.quantity || 0))
        V.bad("Недостаточно на складе");
      if (n === 0)
        await c.query(
          "DELETE FROM cart_items WHERE user_id=$1 AND service_id=$2",
          [req.user.user_id, s.service_id],
        );
      else
        await c.query(
          "INSERT INTO cart_items(user_id,service_id,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,service_id) DO UPDATE SET quantity=excluded.quantity",
          [req.user.user_id, s.service_id, n],
        );
      return cart(c, req.user.user_id);
    });
    res.json(result);
  },
  C,
);
const orderList = async (db, uid = null) => {
  const r = await db.query(
    `SELECT o.number,o.created_at,o.address,o.delivery_date::text,o.status,o.subtotal,o.total,o.coupon_name,o.coupon_percent,o.legacy,u.name AS customer,u.email,COALESCE(json_agg(json_build_object('name',i.service_name,'quantity',i.quantity,'unit_price',i.unit_price,'image_url',i.image_url) ORDER BY i.service_name) FILTER(WHERE i.service_id IS NOT NULL),'[]') AS items FROM orders o JOIN users u ON u.user_id=o.user_id LEFT JOIN order_items i ON i.order_id=o.order_id ${uid === null ? "" : "WHERE o.user_id=$1"} GROUP BY o.order_id,u.user_id ORDER BY o.created_at DESC`,
    uid === null ? [] : [uid],
  );
  return r.rows;
};

async function place(c, uid, b, fromCart = true) {
  await one(
    c,
    "SELECT user_id FROM users WHERE user_id=$1 AND active FOR UPDATE",
    [uid],
  );
  const address = V.clean(b.address, "Адрес доставки", 250, 5),
    date = V.date(b.delivery_date);
  let lines = fromCart
    ? (
        await c.query(
          "SELECT s.name,ci.quantity FROM cart_items ci JOIN services s ON s.service_id=ci.service_id WHERE ci.user_id=$1 ORDER BY s.name",
          [uid],
        )
      ).rows
    : b.items;
  if (!Array.isArray(lines) || !lines.length || lines.length > 100)
    V.bad("Выберите услуги для заказа");
  let merged = new Map();
  for (const line of lines) {
    const name = V.str(line.name, "Услуга");
    merged.set(
      name,
      (merged.get(name) || 0) + V.num(line.quantity, "Количество", 1, 1000000),
    );
  }
  const coupon = await bestCoupon(c, uid);
  const percent = Number(coupon?.discount_percent || 0);
  let chosen = [],
    subtotal = 0,
    total = 0;
  for (const [name, n] of [...merged].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const s = await one(
      c,
      "SELECT service_id,name,image_url,stock,round(price*(100-discount_percent)/100,2) AS unit_price FROM services WHERE name=$1 AND active FOR UPDATE",
      [name],
      "Услуга недоступна",
    );
    if (n > s.stock) V.bad(`Недостаточно на складе: ${name}`);
    const base = cents(s.unit_price);
    subtotal += base * n;
    total += discountedCents(base, percent) * n;
    chosen.push({ ...s, quantity: n });
  }
  if (
    fromCart &&
    b.expected_total_cents !== undefined &&
    (b.expected_total_cents !== total ||
      (b.coupon_name || null) !== (coupon?.name || null))
  )
    V.bad(
      "Цена или персональный купон изменились. Проверьте обновлённую корзину и повторите заказ",
      409,
    );
  const o = await one(
    c,
    "INSERT INTO orders(user_id,address,delivery_date,subtotal,total,coupon_name,coupon_percent) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING order_id,number",
    [
      uid,
      address,
      date,
      subtotal / 100,
      total / 100,
      coupon?.name || null,
      percent,
    ],
  );
  for (const s of chosen) {
    await c.query(
      "INSERT INTO order_items(order_id,service_id,service_name,image_url,quantity,unit_price) VALUES($1,$2,$3,$4,$5,$6)",
      [o.order_id, s.service_id, s.name, s.image_url, s.quantity, s.unit_price],
    );
    await c.query("UPDATE services SET stock=stock-$1 WHERE service_id=$2", [
      s.quantity,
      s.service_id,
    ]);
  }
  if (fromCart) await c.query("DELETE FROM cart_items WHERE user_id=$1", [uid]);
  return { number: o.number };
}
route(
  "post",
  "/orders",
  async (req, res) =>
    res.status(201).json(await tx((c) => place(c, req.user.user_id, req.body))),
  C,
);
route(
  "get",
  "/orders",
  async (req, res) => res.json(await orderList(pool, req.user.user_id)),
  C,
);
const reviewFields =
  "r.public_key AS reference,s.name AS service,u.name AS author,u.email,r.rating,r.comment,r.created_at";
route("get", "/services/:name/reviews", async (req, res) =>
  res.json(
    (
      await q(
        `SELECT r.public_key AS reference,u.name AS author,r.rating,r.comment,r.created_at FROM reviews r JOIN users u ON u.user_id=r.user_id JOIN services s ON s.service_id=r.service_id WHERE s.name=$1 AND s.active ORDER BY r.created_at DESC`,
        [req.params.name],
      )
    ).rows,
  ),
);
route(
  "post",
  "/services/:name/reviews",
  async (req, res) => {
    const rating = V.num(req.body.rating, "Оценка", 1, 5),
      comment = V.clean(req.body.comment);
    const r = await q(
      "INSERT INTO reviews(service_id,user_id,rating,comment) SELECT service_id,$2,$3,$4 FROM services WHERE name=$1 AND active ON CONFLICT(service_id,user_id) DO UPDATE SET rating=excluded.rating,comment=excluded.comment,created_at=now() RETURNING public_key",
      [req.params.name, req.user.user_id, rating, comment],
    );
    if (!r.rowCount) V.bad("Услуга не найдена", 404);
    res.json({ ok: true });
  },
  C,
);
const fallback = async (c) => {
  await c.query(
    "INSERT INTO categories(name) VALUES('Без категории') ON CONFLICT DO NOTHING",
  );
  return one(
    c,
    "SELECT category_id FROM categories WHERE name='Без категории'",
  );
};
const catName = (b) => {
  const n = V.clean(b.name, "Название категории", 100);
  return n.toLowerCase() === "без категории" ? "Без категории" : n;
};
route(
  "post",
  "/admin/categories",
  async (req, res) => {
    await q("INSERT INTO categories(name) VALUES($1)", [catName(req.body)]);
    res.json({ ok: true });
  },
  A,
);
route(
  "put",
  "/admin/categories/:name",
  async (req, res) => {
    await tx(async (c) => {
      await c.query("LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE");
      const old = await one(
        c,
        "SELECT category_id FROM categories WHERE name=$1",
        [req.params.name],
      );
      await c.query("UPDATE categories SET name=$1 WHERE category_id=$2", [
        catName(req.body),
        old.category_id,
      ]);
      await fallback(c);
    });
    res.json({ ok: true });
  },
  A,
);
route(
  "delete",
  "/admin/categories/:name",
  async (req, res) => {
    if (req.params.name === "Без категории")
      V.bad("Системную категорию можно переименовать, но нельзя удалить");
    await tx(async (c) => {
      await c.query("LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE");
      const f = await fallback(c);
      const old = await one(
        c,
        "SELECT category_id FROM categories WHERE name=$1",
        [req.params.name],
      );
      await c.query("UPDATE services SET category_id=$1 WHERE category_id=$2", [
        f.category_id,
        old.category_id,
      ]);
      await c.query("DELETE FROM categories WHERE category_id=$1", [
        old.category_id,
      ]);
    });
    res.json({ ok: true });
  },
  A,
);
async function serviceData(c, b) {
  const cat = await one(
    c,
    "SELECT category_id FROM categories WHERE name=$1",
    [b.category_name || "Без категории"],
    "Категория не найдена",
  );
  return [
    cat.category_id,
    V.clean(b.name, "Название", 150),
    V.clean(b.description, "Описание", 2000),
    V.num(b.duration_minutes, "Длительность", 1, 1440),
    V.num(b.price, "Цена", 0.01, 99999999.99, false),
    V.num(b.discount_percent, "Скидка", 0, 100),
    V.num(b.stock, "Остаток", 0, 1000000),
    V.image(b.image_url),
  ];
}
route(
  "post",
  "/admin/services",
  async (req, res) => {
    await tx(async (c) =>
      c.query(
        "INSERT INTO services(category_id,name,description,duration_minutes,price,discount_percent,stock,image_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        await serviceData(c, req.body),
      ),
    );
    res.json({ ok: true });
  },
  A,
);
route(
  "put",
  "/admin/services/:name",
  async (req, res) => {
    await tx(async (c) =>
      one(
        c,
        "UPDATE services SET category_id=$1,name=$2,description=$3,duration_minutes=$4,price=$5,discount_percent=$6,stock=$7,image_url=$8 WHERE name=$9 AND active RETURNING service_id",
        [...(await serviceData(c, req.body)), req.params.name],
      ),
    );
    res.json({ ok: true });
  },
  A,
);
route(
  "delete",
  "/admin/services/:name",
  async (req, res) => {
    await tx(async (c) => {
      const s = await one(
        c,
        "UPDATE services SET active=false WHERE name=$1 AND active RETURNING service_id",
        [req.params.name],
      );
      await c.query("DELETE FROM cart_items WHERE service_id=$1", [
        s.service_id,
      ]);
    });
    res.json({ ok: true });
  },
  A,
);
route(
  "get",
  "/admin/coupons",
  async (req, res) =>
    res.json(
      (await q("SELECT name,discount_percent FROM coupons ORDER BY name")).rows,
    ),
  A,
);
const couponData = (b) => [
  V.clean(b.name, "Название купона", 100),
  V.num(b.discount_percent, "Скидка", 1, 100),
];
route(
  "post",
  "/admin/coupons",
  async (req, res) => {
    await q(
      "INSERT INTO coupons(name,discount_percent) VALUES($1,$2)",
      couponData(req.body),
    );
    res.json({ ok: true });
  },
  A,
);
route(
  "put",
  "/admin/coupons/:name",
  async (req, res) => {
    await one(
      pool,
      "UPDATE coupons SET name=$1,discount_percent=$2 WHERE name=$3 RETURNING coupon_id",
      [...couponData(req.body), req.params.name],
    );
    res.json({ ok: true });
  },
  A,
);
route(
  "delete",
  "/admin/coupons/:name",
  async (req, res) => {
    await tx(async (c) => {
      const cp = await one(c, "SELECT coupon_id FROM coupons WHERE name=$1", [
        req.params.name,
      ]);
      await c.query("DELETE FROM user_coupons WHERE coupon_id=$1", [
        cp.coupon_id,
      ]);
      await c.query("DELETE FROM coupons WHERE coupon_id=$1", [cp.coupon_id]);
    });
    res.json({ ok: true });
  },
  A,
);
route(
  "get",
  "/admin/user-coupons",
  async (req, res) =>
    res.json(
      (
        await q(
          "SELECT u.email,u.name AS customer,c.name AS coupon_name,c.discount_percent FROM user_coupons uc JOIN users u ON u.user_id=uc.user_id JOIN coupons c ON c.coupon_id=uc.coupon_id WHERE u.active ORDER BY u.email,c.name",
        )
      ).rows,
    ),
  A,
);
route(
  "post",
  "/admin/user-coupons",
  async (req, res) => {
    await tx(async (c) => {
      const u = await one(
        c,
        "SELECT user_id FROM users WHERE lower(email)=$1 AND active",
        [V.email(req.body.email)],
      );
      const cp = await one(c, "SELECT coupon_id FROM coupons WHERE name=$1", [
        V.str(req.body.coupon_name, "Купон", 100),
      ]);
      await c.query(
        "INSERT INTO user_coupons(user_id,coupon_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [u.user_id, cp.coupon_id],
      );
    });
    res.json({ ok: true });
  },
  A,
);
route(
  "put",
  "/admin/user-coupons",
  async (req, res) => {
    await tx(async (c) => {
      const b = req.body,
        old = b.previous || {},
        u = await one(
          c,
          "SELECT user_id FROM users WHERE lower(email)=$1 AND active",
          [V.email(b.email)],
        ),
        cp = await one(c, "SELECT coupon_id FROM coupons WHERE name=$1", [
          V.str(b.coupon_name, "Купон", 100),
        ]);
      await c.query(
        "DELETE FROM user_coupons uc USING users u,coupons c WHERE uc.user_id=u.user_id AND uc.coupon_id=c.coupon_id AND lower(u.email)=$1 AND c.name=$2",
        [V.email(old.email), V.str(old.coupon_name, "Купон", 100)],
      );
      await c.query(
        "INSERT INTO user_coupons(user_id,coupon_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [u.user_id, cp.coupon_id],
      );
    });
    res.json({ ok: true });
  },
  A,
);
route(
  "delete",
  "/admin/user-coupons",
  async (req, res) => {
    await q(
      "DELETE FROM user_coupons uc USING users u,coupons c WHERE uc.user_id=u.user_id AND uc.coupon_id=c.coupon_id AND lower(u.email)=$1 AND c.name=$2",
      [V.email(req.body.email), V.str(req.body.coupon_name, "Купон", 100)],
    );
    res.json({ ok: true });
  },
  A,
);
route(
  "get",
  "/admin/users",
  async (req, res) =>
    res.json(
      (
        await q(
          `SELECT ${userFields} FROM users u JOIN roles r ON r.role_id=u.role_id WHERE u.active ORDER BY u.email`,
        )
      ).rows,
    ),
  A,
);
route(
  "post",
  "/admin/users",
  async (req, res) => {
    await q(
      "INSERT INTO users(role_id,name,email,phone,address,password_hash,recovery_hash) SELECT role_id,$1,$2,$3,$4,crypt($5,gen_salt('bf')),NULL FROM roles WHERE name='client'",
      [...userData(req.body), V.password(req.body.password)],
    );
    res.json({ ok: true });
  },
  A,
);
route(
  "put",
  "/admin/users/:email",
  async (req, res) => {
    const d = userData(req.body);
    await one(
      pool,
      "UPDATE users SET name=$1,email=$2,phone=$3,address=$4 WHERE lower(email)=$5 AND active RETURNING user_id",
      [...d, V.email(req.params.email)],
    );
    res.json({ ok: true });
  },
  A,
);
route(
  "delete",
  "/admin/users/:email",
  async (req, res) => {
    await tx(async (c) => {
      const u = await one(
        c,
        "UPDATE users u SET active=false FROM roles r WHERE u.role_id=r.role_id AND r.name='client' AND lower(u.email)=$1 AND u.active RETURNING u.user_id",
        [V.email(req.params.email)],
        "Можно удалять только клиентов",
      );
      await c.query("DELETE FROM auth_sessions WHERE user_id=$1", [u.user_id]);
      await c.query("DELETE FROM cart_items WHERE user_id=$1", [u.user_id]);
    });
    res.json({ ok: true });
  },
  A,
);
route(
  "get",
  "/admin/orders",
  async (req, res) => res.json(await orderList(pool)),
  A,
);

route(
  "put",
  "/admin/orders/:number",
  async (req, res) => {
    await tx(async (c) => {
      const o = await one(
        c,
        "SELECT *,delivery_date::text AS delivery_day FROM orders WHERE number=$1 FOR UPDATE",
        [req.params.number],
      );
      assertOrderEditable(o.status);
      const status = req.body.status ?? o.status;
      if (!statuses.includes(status)) V.bad("Некорректный статус заказа");
      const date =
        o.legacy && !req.body.delivery_date
          ? null
          : V.date(
              req.body.delivery_date,
              req.body.delivery_date !== o.delivery_day,
            );
      const address =
        o.legacy && !req.body.address
          ? ""
          : V.clean(req.body.address, "Адрес доставки", 250, 5);
      if (status === "Отменён" && o.status !== "Отменён")
        await stockBack(c, o, 1);
      await c.query(
        "UPDATE orders SET status=$1,address=$2,delivery_date=$3 WHERE order_id=$4",
        [status, address, date, o.order_id],
      );
    });
    res.json({ ok: true });
  },
  A,
);

route(
  "delete",
  "/admin/orders/:number",
  async () => assertOrderNotDeletable(),
  A,
);
route(
  "get",
  "/admin/reviews",
  async (req, res) =>
    res.json(
      (
        await q(
          `SELECT ${reviewFields} FROM reviews r JOIN users u ON u.user_id=r.user_id JOIN services s ON s.service_id=r.service_id ORDER BY r.created_at DESC`,
        )
      ).rows,
    ),
  A,
);
route(
  "delete",
  "/admin/reviews/:ref",
  async (req, res) => {
    await one(
      pool,
      "DELETE FROM reviews WHERE public_key=$1 RETURNING review_id",
      [req.params.ref],
    );
    res.json({ ok: true });
  },
  A,
);
app.use((req, res) => res.status(404).json({ error: "Маршрут не найден" }));
app.use((e, req, res, next) => {
  if (e.status)
    return res.status(e.status).json({
      error: e.type === "entity.too.large" ? "Файл слишком большой" : e.message,
    });
  if (e.code === "23505")
    return res
      .status(409)
      .json({ error: "Запись с таким названием или email уже существует" });
  if (["23503", "23514", "22003", "22P02", "22008"].includes(e.code))
    return res.status(400).json({ error: "Проверьте введённые данные" });
  console.error(e);
  res.status(500).json({ error: "Ошибка сервера или базы данных" });
});
if (require.main === module)
  app.listen(process.env.PORT || 3001, () => console.log("Сервер запущен"));
module.exports = { app, pool };
