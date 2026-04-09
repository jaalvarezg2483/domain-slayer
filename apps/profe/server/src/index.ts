import express from 'express';
import cors from 'cors';

const PORT = Number(process.env.PORT || 8080);
const MAIL_API_SECRET = process.env.MAIL_API_SECRET ?? '';
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const MAIL_FROM = process.env.MAIL_FROM ?? 'onboarding@resend.dev';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'gestor-academico-mail' });
});

app.post('/api/send-reset-email', async (req, res) => {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!MAIL_API_SECRET || token !== MAIL_API_SECRET) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  const { to, subject, html, text } = req.body ?? {};
  if (typeof to !== 'string' || typeof subject !== 'string' || (!html && !text)) {
    res.status(400).json({ error: 'Faltan campos: to, subject y html o text' });
    return;
  }

  if (!RESEND_API_KEY) {
    res.status(503).json({ error: 'RESEND_API_KEY no configurada en el servidor' });
    return;
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [to.trim()],
        subject,
        html: typeof html === 'string' ? html : undefined,
        text: typeof text === 'string' ? text : undefined,
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('Resend error:', r.status, errText);
      res.status(502).json({ error: errText || 'Error al enviar con Resend' });
      return;
    }

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno al enviar correo' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gestor mail API en puerto ${PORT}`);
});
