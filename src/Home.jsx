import { useEffect, useState } from "react";
import ProductCard from "./ProductCard";
import { getServices, getCategories } from "./api";
import { useAction, Notice } from "./ui";
import { useAuth } from "./AuthContext";
export default function Home() {
  const { user, loading } = useAuth();
  return loading ? <p>Загрузка…</p> : <Catalog key={user?.email || "guest"} />;
}
function Catalog() {
  const [services, setServices] = useState([]),
    [categories, setCategories] = useState([]),
    [selected, setSelected] = useState([]),
    [search, setSearch] = useState(""),
    a = useAction();
  function load() {
    return a.run(async () => {
      const [s, c] = await Promise.all([getServices(), getCategories()]);
      setServices(s);
      setCategories(c);
    });
  }
  useEffect(() => {
    load();
  }, []);
  const list = services.filter(
    (s) =>
      (!selected.length || selected.includes(s.category_name)) &&
      s.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <h1>Каталог услуг</h1>
      <Notice {...a} />
      {a.error && <button onClick={load}>Повторить</button>}
      <div className="catalog-layout">
        <aside className="categories">
          <h3>Категории</h3>
          <input
            aria-label="Поиск услуг"
            placeholder="Поиск услуг"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {categories.map((c) => (
            <label key={c.name}>
              <input
                type="checkbox"
                checked={selected.includes(c.name)}
                onChange={() =>
                  setSelected((old) =>
                    old.includes(c.name)
                      ? old.filter((x) => x !== c.name)
                      : [...old, c.name],
                  )
                }
              />
              {c.name}
            </label>
          ))}
        </aside>
        <div className="products">
          {list.map((s) => (
            <ProductCard key={s.name} product={s} />
          ))}
          {!a.busy && !a.error && !list.length && <p>Услуги не найдены</p>}
        </div>
      </div>
    </>
  );
}
