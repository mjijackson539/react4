import { Link, useNavigate } from "react-router-dom";
import { useCart } from "./CartContext";
import { useAuth } from "./AuthContext";
import { money, keyPath } from "./api";
import { Picture, Notice } from "./ui";
import { useState } from "react";
export default function ProductCard({ product: s }) {
  const { cart, busy, error, change } = useCart(),
    { user } = useAuth(),
    navigate = useNavigate(),
    [clicked, setClicked] = useState(false);
  const count = cart.find((x) => x.name === s.name)?.quantity || 0;
  async function add() {
    if (user?.role === "admin") return;
    if (!user) {
      navigate("/login");
      return;
    }
    setClicked(true);
    await change(s.name, 1);
  }
  return (
    <article className="productcard">
      <Picture src={s.image_url} alt={s.name} />
      <h2>
        <Link to={"/product/" + keyPath(s.name)}>{s.name}</Link>
      </h2>
      <p>{s.description}</p>
      <p>
        {s.category_name} · {s.duration_minutes} мин.
      </p>
      <p>Доступно: {s.stock}</p>
      <p className="price">
        {money(s.final_price)}{" "}
        {Number(s.final_price) < Number(s.price) && <s>{money(s.price)}</s>}
      </p>
      {s.coupon_name && <p>Персональная скидка: −{s.coupon_percent}%</p>}
      {user?.role !== "admin" && (
        <button disabled={busy || count >= s.stock} onClick={add}>
          {s.stock === 0
            ? "Нет в наличии"
            : count >= s.stock
              ? "Достигнут лимит"
              : "В корзину"}
        </button>
      )}
      <Notice
        busy={clicked && busy}
        error={clicked ? error : ""}
        message={count ? `В корзине: ${count}` : ""}
      />
    </article>
  );
}
