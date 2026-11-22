
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS roles (
 role_id SERIAL PRIMARY KEY, name VARCHAR(30) UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
 user_id SERIAL PRIMARY KEY, role_id INTEGER NOT NULL REFERENCES roles(role_id),
 name VARCHAR(100) NOT NULL, email VARCHAR(150) UNIQUE NOT NULL,
 password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
 category_id SERIAL PRIMARY KEY, name VARCHAR(100) UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS services (
 service_id SERIAL PRIMARY KEY, category_id INTEGER NOT NULL REFERENCES categories(category_id),
 name VARCHAR(150) NOT NULL, description TEXT NOT NULL,
 duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0),
 price NUMERIC(10,2) NOT NULL CHECK(price >= 0),
 discount_percent INTEGER NOT NULL DEFAULT 0 CHECK(discount_percent BETWEEN 0 AND 100)
);
CREATE TABLE IF NOT EXISTS coupons (
 coupon_id SERIAL PRIMARY KEY, name VARCHAR(100) UNIQUE NOT NULL,
 discount_percent INTEGER NOT NULL CHECK(discount_percent BETWEEN 1 AND 100)
);
CREATE TABLE IF NOT EXISTS user_coupons (
 user_id INTEGER NOT NULL REFERENCES users(user_id), coupon_id INTEGER NOT NULL REFERENCES coupons(coupon_id),
 PRIMARY KEY(user_id,coupon_id)
);
CREATE TABLE IF NOT EXISTS appointments (
 appointment_id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(user_id),
 service_id INTEGER NOT NULL REFERENCES services(service_id),
 appointment_date DATE NOT NULL, appointment_time TIME NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'scheduled', notes TEXT
);
CREATE TABLE IF NOT EXISTS payments (
 payment_id SERIAL PRIMARY KEY, appointment_id INTEGER NOT NULL REFERENCES appointments(appointment_id),
 amount NUMERIC(10,2) NOT NULL CHECK(amount >= 0),
 status VARCHAR(30) NOT NULL DEFAULT 'pending', paid_at TIMESTAMP
);
INSERT INTO roles(name) VALUES ('admin'),('client') ON CONFLICT DO NOTHING;
INSERT INTO categories(name) VALUES ('Волосы'),('Ногти'),('Лицо') ON CONFLICT DO NOTHING;
INSERT INTO coupons(name,discount_percent) VALUES ('Персональный 5%',5),('Персональный 10%',10),('Персональный 15%',15) ON CONFLICT DO NOTHING;
INSERT INTO services(category_id,name,description,duration_minutes,price,discount_percent)
SELECT c.category_id,v.name,v.description,v.duration,v.price,v.discount
FROM (VALUES
('Волосы','Стрижка','Женская стрижка',60,2000,10),
('Волосы','Окрашивание','Окрашивание волос',120,5000,0),
('Волосы','Укладка','Укладка волос',45,1500,0),
('Ногти','Маникюр','Маникюр с покрытием',90,2200,15),
('Ногти','Педикюр','Педикюр с покрытием',90,2600,0),
('Лицо','Уход за лицом','Очищение и уход',60,3000,0),
('Лицо','Массаж лица','Расслабляющий массаж',40,1800,0),
('Ногти','Снятие покрытия','Снятие гель-лака',30,700,0),
('Волосы','Восстановление волос','Уход и восстановление',90,3500,20),
('Лицо','Маска для лица','Увлажняющая маска',30,1200,0)
) AS v(category,name,description,duration,price,discount)
JOIN categories c ON c.name=v.category
WHERE NOT EXISTS (SELECT 1 FROM services);
