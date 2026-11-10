// Joker Chess lifecycle emails (Supabase Edge Function). PROTOTYPE: not deployed, and the database part
// (supabase/pending/20261111010000_email_lifecycle.sql) is not applied.
//
// POST with the x-mail-key header: the hourly run (pg_cron + pg_net, see the migration). For each kind of email it asks
// the database who is due one in this hour (mail_due), renders it in the player's language (templates.js) and sends it
// through Resend, or only logs it (MAIL_MODE=dry, the default: mail_outbox shows what would have gone out).
// GET or POST with ?u=<user>&t=<token>: the one-click unsubscribe, from the link in every email and from the
// List-Unsubscribe header (RFC 8058, which Gmail and Yahoo ask of bulk senders).
//
// Secrets it needs: MAIL_CRON_KEY (the same string as in the Vault), MAIL_SECRET (signs the unsubscribe links),
// RESEND_API_KEY (a key with sending access only), MAIL_FROM ('Joker Chess <hello@joker-chess.com>' once that domain
// is verified in Resend), MAIL_MODE ('send' to really send). Deployed with --no-verify-jwt (the links carry their own
// token).
import postgres from 'npm:postgres@3.4.9';
import { render, KINDS } from './templates.js';
import { Habits, LIST } from './daily.js';

const DB_URL = Deno.env.get('SUPABASE_DB_URL')!;
const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
const CRON_KEY = Deno.env.get('MAIL_CRON_KEY') || '';
const SECRET = Deno.env.get('MAIL_SECRET') || '';
const RESEND = Deno.env.get('RESEND_API_KEY') || '';
const FROM = Deno.env.get('MAIL_FROM') || 'Joker Chess <chess@hutka.ai>';
const MODE = Deno.env.get('MAIL_MODE') === 'send' && RESEND ? 'send' : 'dry';
const SITE = 'https://joker-chess.com/';
const PER_RUN = +(Deno.env.get('MAIL_PER_RUN') || 200); // per kind per hour: well inside Resend's rate limit

const sql = postgres(DB_URL, { max: 2, prepare: false });

// ---- the unsubscribe token: HMAC-SHA256 of the user id, so a link can't be made for someone else
const enc = new TextEncoder();
const keyP = crypto.subtle.importKey('raw', enc.encode(SECRET || 'unset'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
async function token(uid: string): Promise<string> {
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await keyP, enc.encode('unsub:' + uid)));
  return btoa(String.fromCharCode(...sig.slice(0, 18))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function unsubUrl(uid: string) { return `${SUPABASE_URL}/functions/v1/mail?u=${uid}&t=${await token(uid)}`; }

function page(lang: string, ok: boolean) {
  const ru = lang === 'ru';
  const title = ok ? (ru ? 'Готово: писем больше не будет' : 'Done: no more emails') : (ru ? 'Ссылка не подошла' : 'This link didn’t work');
  const sub = ok ? (ru ? 'Включить их снова можно в приложении: Профиль → Настройки → Письма.' : 'You can turn them back on in the app: Profile → Settings → Emails.')
    : (ru ? 'Отписаться можно в приложении: Профиль → Настройки → Письма.' : 'You can turn emails off in the app: Profile → Settings → Emails.');
  return `<!doctype html><html lang="${ru ? 'ru' : 'en'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Joker Chess</title>` +
    `<body style="margin:0;background:#2a2f2d;color:#f4efe4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:grid;place-items:center;min-height:100vh">` +
    `<main style="max-width:420px;padding:32px 20px;text-align:center"><div style="font:700 22px Georgia,serif"><span style="color:#f0b941">Joker</span> Chess</div>` +
    `<h1 style="font-size:22px;margin:28px 0 8px">${title}</h1><p style="color:#b2bab5;line-height:1.5">${sub}</p>` +
    `<p><a href="${SITE}" style="color:#f0b941;font-weight:700">joker-chess.com</a></p></main></body></html>`;
}

async function unsubscribe(u: string, t: string) {
  if (!SECRET || !/^[0-9a-f-]{36}$/i.test(u) || !t || t !== (await token(u))) return { ok: false, lang: 'en' };
  const r = await sql`update public.profiles set email_opt = false, email_opt_at = now() where id = ${u} returning lang`;
  return { ok: true, lang: r[0]?.lang || 'en' };
}

// ---- one email
async function send(to: string, m: { subject: string; html: string; text: string }, unsub: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + RESEND, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject: m.subject, html: m.html, text: m.text,
      headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j && (j.message || j.name)) || 'resend ' + res.status);
  return j.id as string;
}

// what an email of this kind needs, from the row mail_due gave
function dataFor(kind: string, r: any, unsub: string) {
  const today = r.local_day || new Date().toISOString().slice(0, 10);
  const daily = Habits.dailyFor(today, LIST);
  const st = Habits.streak(r.days || [], today);
  const d: any = { name: r.name, email: r.email, unsub, site: SITE, rating: r.rating, pool: r.pool || 'blitz',
    daily: daily ? { n: daily.n, fen: daily.p.fen, lvl: daily.lvl } : null };
  if (kind === 'weekly' && r.week) d.week = Object.assign({}, r.week, { to: r.rating, streak: st.count });
  return d;
}

async function run() {
  const out: Record<string, number> = {};
  for (const kind of KINDS) {
    const rows = (await sql`select public.mail_due(${kind}, ${PER_RUN}) as j`)[0].j || [];
    out[kind] = 0;
    for (const r of rows) {
      if (kind === 'winback7' && !Habits.dailyFor(r.local_day, LIST)) continue;
      const unsub = await unsubUrl(r.user_id);
      const m = render(kind, r.lang, dataFor(kind, r, unsub));
      let status = 'dry', id: string | null = null, error: string | null = null;
      if (MODE === 'send') {
        try { id = await send(r.email, m, unsub); status = 'sent'; } catch (e) { status = 'failed'; error = String((e as Error).message || e).slice(0, 300); }
      }
      await sql`insert into public.mail_outbox (user_id, kind, to_email, subject, status, provider_id, error)
        values (${r.user_id}, ${kind}, ${r.email}, ${m.subject}, ${status}, ${id}, ${error})`;
      out[kind]++;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const u = url.searchParams.get('u'), t = url.searchParams.get('t');
  if (u && t) {
    const r = await unsubscribe(u, t);
    if (req.method === 'POST') return new Response(r.ok ? 'ok' : 'bad link', { status: r.ok ? 200 : 400 });
    return new Response(page(r.lang, r.ok), { status: r.ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  if (req.method !== 'POST' || !CRON_KEY || req.headers.get('x-mail-key') !== CRON_KEY) return new Response('not found', { status: 404 });
  try {
    return Response.json({ mode: MODE, sent: await run() });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'server' }, { status: 500 });
  }
});
