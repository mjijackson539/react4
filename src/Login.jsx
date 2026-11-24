import { validateProfile, validatePassword } from "./validation";
import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { send } from "./api";
import { useAuth } from "./AuthContext";
import { Field, Notice, useAction } from "./ui";

export default function Login({ mode }) {
  const { user, authenticate } = useAuth();
  const navigate = useNavigate();
  const action = useAction();
  const sending = useAction();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    code: "",
  });
  const [requested, setRequested] = useState(false);
  const reg = mode === "register",
    reset = mode === "reset";
  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  if (user)
    return (
      <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />
    );

  async function requestCode() {
    await sending.run(async () => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        throw new Error("Введите корректный email");
      await send("/password-reset/request", "POST", { email: form.email });
      setRequested(true);
    }, "Если аккаунт существует, письмо отправлено. Проверьте также папку «Спам».");
  }

  async function submit(e) {
    e.preventDefault();
    await action.run(async () => {
      if (reg) validateProfile(form);
      if (reg || reset) validatePassword(form.password);
      if (reset && !/^\d{6}$/.test(form.code.trim()))
        throw new Error("Введите 6 цифр из письма");
      const data = await send(
        reset ? "/reset-password" : reg ? "/register" : "/login",
        "POST",
        form,
      );
      if (reset) {
        navigate("/login", { replace: true });
        return;
      }
      authenticate(data);
      navigate(data.user.role === "admin" ? "/admin" : "/dashboard", {
        replace: true,
      });
    });
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <h2>{reg ? "Регистрация" : reset ? "Восстановление пароля" : "Вход"}</h2>
      <fieldset disabled={action.busy || sending.busy}>
        {reg && (
          <Field
            label="ФИО"
            required
            minLength={3}
            maxLength={100}
            autoComplete="name"
            {...field("name")}
          />
        )}
        <Field
          label="Email"
          type="email"
          required
          maxLength={150}
          autoComplete="email"
          {...field("email")}
        />
        {reg && (
          <Field
            label="Телефон"
            type="tel"
            required
            minLength={10}
            maxLength={30}
            autoComplete="tel"
            {...field("phone")}
          />
        )}
        {reset && (
          <>
            <button type="button" onClick={requestCode}>
              Отправить код на почту
            </button>
            <Notice {...sending} />
            {requested && (
              <p className="helper-text">
                Код действует 10 минут. Повторный запрос доступен примерно через
                минуту.
              </p>
            )}
            <Field
              label="Код из письма (6 цифр)"
              inputMode="numeric"
              pattern="[0-9]{6}"
              required
              minLength={6}
              maxLength={6}
              autoComplete="one-time-code"
              {...field("code")}
            />
          </>
        )}
        <Field
          label={reset ? "Новый пароль" : "Пароль"}
          type="password"
          required
          minLength={reg || reset ? 8 : 1}
          maxLength={72}
          autoComplete={reg || reset ? "new-password" : "current-password"}
          {...field("password")}
        />
        <Notice {...action} />
        <button disabled={reset && !requested}>
          {reg ? "Зарегистрироваться" : reset ? "Сменить пароль" : "Войти"}
        </button>
      </fieldset>
      {!reg && !reset && (
        <p>
          <Link to="/reset-password">Забыли пароль?</Link>
        </p>
      )}
      <Link to={reg || reset ? "/login" : "/register"}>
        {reg || reset ? "Вернуться ко входу" : "Создать аккаунт"}
      </Link>
    </form>
  );
}
