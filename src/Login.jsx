import { validateProfile, validatePassword } from './validation';
import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { send } from './api';
import { useAuth } from './AuthContext';
import { Field, Notice, useAction } from './ui';
export default function Login({ mode }) { const { user, authenticate } = useAuth(), navigate = useNavigate(), a = useAction(), [form, setForm] = useState({ name: '', email: '', phone: '', password: '', code: '' }), [recovery, setRecovery] = useState(''); const reg = mode === 'register', reset = mode === 'reset'; const field = (k) => ({ value: form[k], onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) }); if (recovery)
    return <section className="login-form"><h2>Регистрация завершена</h2><p>Сохраните резервный код в безопасном месте. Он нужен, если вы забудете пароль.</p><code className="recovery">{recovery}</code><button onClick={() => navigate('/dashboard', { replace: true })}>Перейти в личный кабинет</button></section>; if (user)
    return <Navigate to="/dashboard" replace/>; async function submit(e) { e.preventDefault(); await a.run(async () => { if (reg)
    validateProfile(form); if (reg || reset)
    validatePassword(form.password); const data = await send(reset ? '/reset-password' : reg ? '/register' : '/login', 'POST', form); if (reset) {
    navigate('/login');
    return;
} authenticate(data); if (data.recovery_code)
    setRecovery(data.recovery_code);
else
    navigate('/dashboard'); }); } return <form className="login-form" onSubmit={submit}><h2>{reg ? 'Регистрация' : reset ? 'Восстановление пароля' : 'Вход'}</h2><fieldset disabled={a.busy}>{reg && <Field label="ФИО" required minLength={3} maxLength={100} autoComplete="name" {...field('name')}/>}<Field label="Email" type="email" required maxLength={150} autoComplete="email" {...field('email')}/>{reg && <Field label="Телефон" type="tel" required minLength={10} maxLength={30} autoComplete="tel" {...field('phone')}/>}{reset && <Field label="Резервный код" required minLength={32} maxLength={32} {...field('code')}/>}<Field label={reset ? 'Новый пароль' : 'Пароль'} type="password" required minLength={reg || reset ? 8 : 1} maxLength={72} autoComplete={reg || reset ? 'new-password' : 'current-password'} {...field('password')}/><Notice {...a}/><button>{reg ? 'Зарегистрироваться' : reset ? 'Сменить пароль' : 'Войти'}</button></fieldset>{reset ? <p>Нет кода? Обратитесь к администратору для получения нового кода после проверки личности.</p> : !reg && <p><Link to="/reset-password">Забыли пароль?</Link></p>}<Link to={reg || reset ? '/login' : '/register'}>{reg || reset ? 'Вернуться ко входу' : 'Создать аккаунт'}</Link></form>; }
