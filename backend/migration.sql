-- Выполнить в существующей salon_db после резервного копирования. Данные не удаляются.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone varchar(30) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '';
ALTER TABLE services ALTER COLUMN image_url TYPE text;
UPDATE services SET image_url='' WHERE image_url IS NULL;
ALTER TABLE services ALTER COLUMN image_url SET DEFAULT '';
ALTER TABLE services ALTER COLUMN image_url SET NOT NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 20 CHECK(stock >= 0);
ALTER TABLE services ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
-- Имена услуг и email используются в API как естественные ключи, ID остаются в БД.
-- В предоставленной БД две отдельные услуги «Уход за лицом» (10 и 12).
-- Сохраняем обе записи, их ID и связи; различаем названия для API.
UPDATE services SET name='Уход за лицом (вариант 2)'
WHERE service_id=12 AND name='Уход за лицом'
AND EXISTS (SELECT 1 FROM services s WHERE s.service_id=10 AND s.name='Уход за лицом');
CREATE UNIQUE INDEX IF NOT EXISTS services_name_unique ON services(lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users(lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_lower_unique ON categories(lower(name));
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_positive_price;
ALTER TABLE services ADD CONSTRAINT services_positive_price CHECK(price > 0);
INSERT INTO categories(name) VALUES ('Без категории') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS cart_items (
 user_id integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
 service_id integer NOT NULL REFERENCES services(service_id),
 quantity integer NOT NULL CHECK(quantity > 0), PRIMARY KEY(user_id,service_id)
);
CREATE TABLE IF NOT EXISTS orders (
 order_id serial PRIMARY KEY, number text UNIQUE NOT NULL DEFAULT upper(encode(gen_random_bytes(8),'hex')),
 user_id integer NOT NULL REFERENCES users(user_id), created_at timestamptz NOT NULL DEFAULT now(),
 address text NOT NULL, delivery_date date,
 status text NOT NULL DEFAULT 'Новый' CHECK(status IN ('Новый','В обработке','Выполнен','Отменён','Архивный')),
 subtotal numeric(14,2) NOT NULL CHECK(subtotal >= 0), total numeric(14,2) NOT NULL CHECK(total >= 0),
 coupon_name text, coupon_percent integer NOT NULL DEFAULT 0 CHECK(coupon_percent BETWEEN 0 AND 100),
 legacy boolean NOT NULL DEFAULT false
);
-- Старый orders уже есть в предоставленном бэкапе: дополняем его без удаления данных.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS number text DEFAULT upper(encode(gen_random_bytes(8),'hex'));
ALTER TABLE orders ALTER COLUMN number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_number_unique ON orders(number);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Новый';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal numeric(14,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_percent integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS legacy boolean NOT NULL DEFAULT false;
-- Новые заказы больше не используют JSON-столбец items, но старый JSON сохраняем.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='orders' AND column_name='items') THEN
   EXECUTE 'ALTER TABLE orders ALTER COLUMN items DROP NOT NULL';
   EXECUTE 'UPDATE orders SET legacy=true,status=''Архивный'',subtotal=total WHERE items IS NOT NULL AND NOT legacy';
 END IF;
END $$;
UPDATE orders SET subtotal=total WHERE subtotal IS NULL;
ALTER TABLE orders ALTER COLUMN subtotal SET NOT NULL;
ALTER TABLE orders ALTER COLUMN total TYPE numeric(14,2);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK(status IN ('Новый','В обработке','Выполнен','Отменён','Архивный'));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_required;
ALTER TABLE orders ADD CONSTRAINT orders_delivery_required CHECK(legacy OR (delivery_date IS NOT NULL AND length(trim(address))>=5));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_amounts_check;
ALTER TABLE orders ADD CONSTRAINT orders_amounts_check CHECK(subtotal>=0 AND total>=0 AND coupon_percent BETWEEN 0 AND 100);
CREATE TABLE IF NOT EXISTS order_items (
 order_id integer NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
 service_id integer NOT NULL REFERENCES services(service_id), service_name text NOT NULL,
 image_url text NOT NULL DEFAULT '', quantity integer NOT NULL CHECK(quantity > 0),
 unit_price numeric(10,2) NOT NULL CHECK(unit_price >= 0), PRIMARY KEY(order_id,service_id)
);
-- Переносим позиции старых заказов из JSON по действительным ключам услуг.
-- Для данного бэкапа все позиции соответствуют существующим услугам.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='orders' AND column_name='items') THEN
   EXECUTE $sql$
      INSERT INTO order_items(order_id,service_id,service_name,image_url,quantity,unit_price)
      SELECT o.order_id,s.service_id,COALESCE(j->>'name',s.name),s.image_url,(j->>'quantity')::integer,(j->>'price')::numeric
      FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) j
      JOIN services s ON s.service_id=(j->>'id')::integer
      WHERE o.legacy AND o.items IS NOT NULL
      ON CONFLICT(order_id,service_id) DO NOTHING
   $sql$;
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS reviews (
 review_id serial PRIMARY KEY, public_key text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12),'hex'),
 service_id integer NOT NULL REFERENCES services(service_id), user_id integer NOT NULL REFERENCES users(user_id),
 rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5), comment text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(service_id,user_id)
);
CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash text PRIMARY KEY, user_id integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL DEFAULT now()+ interval '7 days'
);
COMMIT;
