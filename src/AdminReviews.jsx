import ReviewText from "./ReviewText";
import { useEffect, useState } from "react";
import { adminRequest, keyPath } from "./api";
import { Notice, useAction } from "./ui";
export default function AdminReviews() {
  const [rows, setRows] = useState([]),
    [search, setSearch] = useState(""),
    a = useAction();
  const load = async () => setRows(await adminRequest("/reviews"));
  useEffect(() => {
    a.run(load);
  }, []);
  return (
    <div className="admin-reviews-page">
      <h1>Модерация отзывов</h1>
      <input
        className="search"
        placeholder="Поиск по услуге, автору, тексту"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Notice {...a} />
      {a.error && <button onClick={() => a.run(load)}>Повторить</button>}
      {rows
        .filter((r) =>
          [r.service, r.author, r.email, r.comment, String(r.rating)]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .map((r) => (
          <article className="review" key={r.reference}>
            <strong>
              {r.service} · {r.rating}/5
            </strong>
            <p>
              {r.author} ({r.email})
            </p>
            <ReviewText comment={r.comment} />
            <button
              disabled={a.busy}
              onClick={() => {
                if (confirm("Удалить отзыв за нарушение правил?"))
                  a.run(async () => {
                    await adminRequest(
                      "/reviews/" + keyPath(r.reference),
                      "DELETE",
                    );
                    await load();
                  }, "Отзыв удалён");
              }}
            >
              Удалить отзыв
            </button>
          </article>
        ))}
      {!a.busy && !rows.length && <p>Отзывов нет</p>}
    </div>
  );
}
