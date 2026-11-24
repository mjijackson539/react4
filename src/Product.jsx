import ReviewText from "./ReviewText";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { request, send, keyPath } from "./api";
import { useAuth } from "./AuthContext";
import { Notice, useAction, SelectField, TextField } from "./ui";
import ProductCard from "./ProductCard";
export default function Product() {
  const { name } = useParams(),
    { user, loading } = useAuth();
  return loading ? (
    <p>Загрузка…</p>
  ) : (
    <ProductDetails key={JSON.stringify([name, user?.email])} />
  );
}
function ProductDetails() {
  const { name } = useParams(),
    { user } = useAuth(),
    [product, setProduct] = useState(null),
    [reviews, setReviews] = useState([]),
    [rating, setRating] = useState("5"),
    [comment, setComment] = useState(""),
    a = useAction(),
    b = useAction(),
    path = "/services/" + keyPath(name);
  async function load() {
    await a.run(async () => {
      const [p, r] = await Promise.all([
        request(path),
        request(path + "/reviews"),
      ]);
      setProduct(p);
      setReviews(r);
    });
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <Link to="/">← В каталог</Link>
      <Notice {...a} />
      {product && <ProductCard product={product} />}
      <h2>Отзывы</h2>
      {reviews.map((r) => (
        <article className="review" key={r.reference}>
          <strong>
            {r.author} · {r.rating}/5
          </strong>
          <ReviewText comment={r.comment} />
        </article>
      ))}
      {!reviews.length && !a.busy && <p>Пока нет отзывов</p>}
      {user?.role === "client" ? (
        <form
          className="panel review-form"
          onSubmit={(e) => {
            e.preventDefault();
            b.run(async () => {
              await send(path + "/reviews", "POST", { rating, comment });
              setReviews(await request(path + "/reviews"));
              setComment("");
            }, "Отзыв сохранён");
          }}
        >
          <h3>Оставить или обновить свой отзыв</h3>
          <fieldset disabled={b.busy}>
            <SelectField
              label="Оценка"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </SelectField>
            <TextField
              label="Комментарий"
              required
              maxLength={1000}
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <Notice {...b} />
            <button>Сохранить отзыв</button>
          </fieldset>
        </form>
      ) : !user ? (
        <Link to="/login">Войдите, чтобы оставить отзыв</Link>
      ) : (
        <p>Администратор может модерировать отзывы через админ-панель.</p>
      )}
    </>
  );
}
