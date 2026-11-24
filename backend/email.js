const tls = require('node:tls');

function smtpConfig() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  const port = Number(process.env.SMTP_PORT || 465);
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    const error = new Error('Отправка писем не настроена. Укажите SMTP_HOST, SMTP_USER, SMTP_PASS и SMTP_FROM в backend/.env');
    error.status = 503;
    throw error;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(SMTP_FROM) || !Number.isInteger(port) || port !== 465) {
    const error = new Error('Неверные SMTP_FROM/SMTP_PORT: поддерживается защищённый SMTP на порту 465');
    error.status = 503;
    throw error;
  }
  return { host: SMTP_HOST, port, user: SMTP_USER, pass: SMTP_PASS, from: SMTP_FROM };
}

function smtpSession(config) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({host: config.host, port: config.port, servername: config.host, minVersion: 'TLSv1.2', rejectUnauthorized: true});
    let buffer = '', lines = [], waiting = null, closed = false, connected = false;
    const pending = [];
    const fail = error => {
      if (closed) return;
      closed = true;
      if (!connected) reject(error);
      if (waiting) { waiting.reject(error); waiting = null; }
      for (const p of pending.splice(0)) p.reject(error);
      socket.destroy();
    };
    socket.setTimeout(15000, () => fail(new Error('SMTP timeout')));
    socket.on('error', fail);
    socket.on('close', () => fail(new Error('SMTP connection closed')));
    function processResponse() {
      while (lines.length) {
        const match = /^(\d{3})([ -])(.*)$/.exec(lines[0]);
        if (!match) { fail(new Error('Некорректный ответ SMTP')); return; }
        const code = Number(match[1]);
        const response = [];
        while (lines.length) {
          const row = lines.shift(); response.push(row);
          if (row.startsWith(match[1] + ' ')) {
            if (!waiting) { pending.push({ code, response }); }
            else { const w = waiting; waiting = null; w.resolve({ code, response }); }
            break;
          }
          if (!row.startsWith(match[1] + '-')) { fail(new Error('Некорректный многострочный ответ SMTP')); return; }
          if (!lines.length) { lines.unshift(...response); return; }
        }
      }
    }
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      let pos;
      while ((pos = buffer.indexOf('\r\n')) !== -1) { lines.push(buffer.slice(0, pos)); buffer = buffer.slice(pos + 2); }
      processResponse();
    });
    socket.once('secureConnect', () => { connected = true; resolve({
      async read(expected) {
        const data = pending.length ? pending.shift() : await new Promise((resolve, reject) => { waiting = { resolve, reject }; });
        if (!expected.includes(data.code)) throw new Error(`SMTP ответ ${data.code}`);
        return data;
      },
      write(data) { if (closed) throw new Error('SMTP connection closed'); socket.write(data); },
      async command(line, expected) { this.write(line + '\r\n'); return this.read(expected); },
      end() { closed = true; socket.end(); }
    }); });
  });
}

async function sendResetCode(email, code) {
  const cfg = smtpConfig();
  const smtp = await smtpSession(cfg);
  try {
    await smtp.read([220]);
    const hello = await smtp.command('EHLO localhost', [250]);
    const methods = hello.response.join(' ').toUpperCase();
    if (/\bAUTH\b[^\r\n]*\bPLAIN\b/.test(methods)) {
      const auth = Buffer.from(`\0${cfg.user}\0${cfg.pass}`, 'utf8').toString('base64');
      await smtp.command(`AUTH PLAIN ${auth}`, [235]);
    } else if (/\bAUTH\b[^\r\n]*\bLOGIN\b/.test(methods)) {
      await smtp.command('AUTH LOGIN', [334]);
      await smtp.command(Buffer.from(cfg.user).toString('base64'), [334]);
      await smtp.command(Buffer.from(cfg.pass).toString('base64'), [235]);
    } else {
      throw new Error('SMTP не поддерживает AUTH PLAIN или AUTH LOGIN');
    }
    await smtp.command(`MAIL FROM:<${cfg.from}>`, [250]);
    await smtp.command(`RCPT TO:<${email}>`, [250, 251]);
    await smtp.command('DATA', [354]);
    const subject = 'Код восстановления пароля Beauty Studio';
    const plain = `Ваш одноразовый код для восстановления пароля: ${code}\n\nСрок действия: 10 минут. Если вы не запрашивали код, просто проигнорируйте это письмо. Никому не сообщайте код.`;
    const encoded = Buffer.from(plain, 'utf8').toString('base64').match(/.{1,76}/g).join('\r\n');
    const hdr = [
      `From: <${cfg.from}>`, `To: <${email}>`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      `Date: ${new Date().toUTCString()}`, 'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64'
    ].join('\r\n');
    smtp.write(`${hdr}\r\n\r\n${encoded}\r\n.\r\n`);
    await smtp.read([250]);
    smtp.write('QUIT\r\n');
  } finally { smtp.end(); }
}

module.exports = { smtpConfig, sendResetCode };
