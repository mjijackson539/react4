import { useEffect, useRef, useState } from "react";
import { money } from "./api";

export function Notice({ busy, error, message }) {
  return (
    <div className="notice" aria-live="polite">
      {error ? (
        <span className="error">{error}</span>
      ) : busy ? (
        <span>Загрузка…</span>
      ) : message ? (
        <span>{message}</span>
      ) : null}
    </div>
  );
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  async function run(fn, msg = "") {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(msg);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, message, run, setError, setMessage };
}
export function Field({ label, ...props }) {
  return (
    <label className="field">
      {label}
      <input {...props} />
    </label>
  );
}
export function SelectField({ label, children, ...props }) {
  return (
    <label className="field">
      {label}
      <select {...props}>{children}</select>
    </label>
  );
}
export function TextField({ label, ...props }) {
  return (
    <label className="field">
      {label}
      <textarea {...props} />
    </label>
  );
}
export function Picture({ src, alt = "Фото услуги", className = "" }) {
  return (
    <img
      className={"service-image " + className}
      src={src || "/service-placeholder.svg"}
      alt={alt}
      onError={(e) => {
        if (!e.currentTarget.src.endsWith("/service-placeholder.svg"))
          e.currentTarget.src = "/service-placeholder.svg";
      }}
    />
  );
}
export function Modal({ title, onClose, children }) {
  const ref = useRef();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button type="button" onClick={onClose}>
          Закрыть ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function OrderView({ order, admin = false }) {
  return (
    <article className="order">
      <h3>
        Заказ № {order.number} — {order.status}
      </h3>
      {admin && (
        <p>
          {order.customer} ({order.email})
        </p>
      )}
      <p>
        Оформлен: {new Date(order.created_at).toLocaleString("ru-RU")} ·
        Доставка: {order.delivery_date || "не указана"}
      </p>
      <p>Адрес: {order.address || "не указан"}</p>
      {order.items.map((s) => (
        <div key={s.name} className="line">
          <Picture src={s.image_url} alt={s.name} className="thumb" />
          <span>
            {s.name} × {s.quantity}
          </span>
          <span>
            {money(s.unit_price)} / шт.{order.coupon_name && " (до купона)"}
          </span>
          <strong>{money(Number(s.unit_price) * s.quantity)}</strong>
        </div>
      ))}
      <p>Сумма до персональной скидки: {money(order.subtotal)}</p>
      <p>
        Купон:{" "}
        {order.coupon_name
          ? `${order.coupon_name} (−${order.coupon_percent}%)`
          : order.legacy
            ? "нет данных"
            : "не применён"}
      </p>
      <strong>Итого: {money(order.total)}</strong>
    </article>
  );
}
