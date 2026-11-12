// The lifecycle email function (supabase/functions/mail/index.ts) under Deno, against Postgres (PGlite) with the
// migrations and a stand-in for Resend: without the key a run only counts who is due and writes nothing for them; a run
// happens once an hour whoever calls; with the key the due email goes out once, with its one-click unsubscribe link;
// a failed send is tried again the next hour; the link turns emails off, a forged one doesn't.
// Run: DENO=/path/to/deno node test/server/mail-local.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createDb } from './pg-harness.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const DENO = process.env.DENO || 'deno';
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

const U1 = 'aaaaaaaa-2222-4000-8000-000000000001', U2 = 'bbbbbbbb-2222-4000-8000-000000000002';
const pg = await createDb([U1, U2]);
const q = async (s, a) => (await pg.query(s, a)).rows;
await q("update auth.users set email = case when id = $1 then 'ann@example.com' else 'bob@example.com' end", [U1]);
await q("insert into public.profiles (id, username, is_guest) values ($1, 'Ann', true), ($2, 'Bob', true)", [U1, U2]);
// a zone where it is about noon now (the welcome goes out between 9:00 and 21:00 the player's time)
const o = ((12 - new Date().getUTCHours()) + 36) % 24 - 12, tz = o === 0 ? 'Etc/GMT' : 'Etc/GMT' + (o > 0 ? '-' + o : '+' + (-o));
for (const u of [U1, U2]) await q("select public.gc_prefs($1, 'en', $2, null)", [u, tz]);
await q('update public.profiles set is_guest = false where id = $1', [U1]); // Ann saves her account: the welcome is due
const pgServer = new PGLiteSocketServer({ db: pg, port: 0, host: '127.0.0.1', maxConnections: 8 });
await pgServer.start();
const pgPort = pgServer.server ? pgServer.server.address().port : pgServer.port;

// ---- a stand-in for Resend: records what it is sent; refuses one address while `refuse` is set
const sent = [];
let refuse = null;
const fake = http.createServer((req, res) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => {
    const b = JSON.parse(data || '{}');
    if (refuse && (b.to || []).includes(refuse)) { res.writeHead(422, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ name: 'validation_error', message: 'refused' })); return; }
    sent.push({ auth: req.headers.authorization, body: b });
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ id: 'msg_' + sent.length }));
  });
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));
const fakeUrl = 'http://127.0.0.1:' + fake.address().port;

const fnPort = 19000 + Math.floor(Math.random() * 1000);
let deno = null, logs = '';
async function start(extra) {
  if (deno) { deno.kill(); await new Promise((r) => setTimeout(r, 300)); }
  const env = Object.assign({}, process.env, { SUPABASE_URL: 'https://project.example', SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    SUPABASE_DB_URL: `postgres://postgres:x@127.0.0.1:${pgPort}/postgres`, MAIL_API_URL: fakeUrl + '/emails', DENO_DIR: process.env.DENO_DIR || '' }, extra || {});
  const wrapper = `Deno.serve = ((orig) => (h) => orig({ port: ${fnPort}, hostname: '127.0.0.1', onListen() {} }, h))(Deno.serve);\nawait import('${ROOT}supabase/functions/mail/index.ts');\n`;
  fs.writeFileSync('/tmp/gc-mail-wrapper.ts', wrapper);
  deno = spawn(DENO, ['run', '-A', '--no-lock', '/tmp/gc-mail-wrapper.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  deno.stdout.on('data', (d) => (logs += d)); deno.stderr.on('data', (d) => (logs += d));
  for (let i = 0; i < 160; i++) { try { await fetch(`http://127.0.0.1:${fnPort}/`, { method: 'GET' }); return true; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  return false;
}
const runNow = async () => { const r = await fetch(`http://127.0.0.1:${fnPort}/mail`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); return { status: r.status, body: await r.json() }; };
const nextHour = () => q('delete from public.mail_runs'); // as if the clock moved on an hour

try {
  // ---- no Resend key yet: the run counts who is due and writes nothing for them
  check('the function boots under Deno', await start({}), logs.slice(-1500));
  let r = await runNow();
  check('without the key: a dry run, the welcome counted', r.status === 200 && r.body.mode === 'dry' && r.body.run.welcome === 1 && r.body.run.weekly === 0, r.body);
  check('nothing written for the players, the run logged', (await q('select count(*)::int as n from public.mail_outbox'))[0].n === 0 && (await q("select mode, result from public.mail_runs"))[0].result.welcome === 1);
  r = await runNow();
  check('a second call in the same hour does nothing', r.body.run && r.body.run.skipped === true, r.body);
  check('a GET is not a run', (await fetch(`http://127.0.0.1:${fnPort}/mail`)).status === 404);

  // ---- the key is there: the welcome goes out, once
  await nextHour();
  check('restarts with the key', await start({ RESEND_API_KEY: 're_test_key' }), logs.slice(-1500));
  r = await runNow();
  check('with the key: sent', r.body.mode === 'send' && r.body.run.welcome === 1, r.body);
  const m = sent[0] && sent[0].body;
  check('to Ann, from Joker Chess, with the key', m && m.to[0] === 'ann@example.com' && /Joker Chess <hello@joker-chess\.com>/.test(m.from) && sent[0].auth === 'Bearer re_test_key', m && [m.to, m.from]);
  check('one-click unsubscribe in the headers and the text', m && /^<https:\/\/project\.example\/functions\/v1\/mail\?u=[0-9a-f-]{36}&t=[\w-]+>$/.test(m.headers['List-Unsubscribe']) && m.headers['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click' && m.text.includes('/functions/v1/mail?u='), m && m.headers);
  const out = await q('select kind, status, provider_id from public.mail_outbox');
  check('the outbox says sent', out.length === 1 && out[0].status === 'sent' && out[0].provider_id === 'msg_1', out);
  await nextHour();
  r = await runNow();
  check('the next hour: not again', r.body.run.welcome === 0 && sent.length === 1, [r.body, sent.length]);

  // ---- a send that fails is tried again the next hour
  await q('update public.profiles set is_guest = false where id = $1', [U2]);
  refuse = 'bob@example.com';
  await nextHour();
  r = await runNow();
  check('a refused send: failed in the outbox', (await q("select status, error from public.mail_outbox where user_id = $1", [U2]))[0].status === 'failed', await q("select status, error from public.mail_outbox where user_id = $1", [U2]));
  refuse = null;
  await nextHour();
  r = await runNow();
  check('and sent the next hour', r.body.run.welcome === 1 && sent.length === 2 && sent[1].body.to[0] === 'bob@example.com', [r.body, sent.length]);

  // ---- the unsubscribe link from the email turns emails off; a forged one doesn't
  await q("select public.gc_prefs($1, 'en', null, true)", [U1]);
  const link = m.headers['List-Unsubscribe'].slice(1, -1).replace('https://project.example/functions/v1/mail', `http://127.0.0.1:${fnPort}/mail`);
  let res = await fetch(link.replace(/t=[\w-]+/, 't=forged'));
  check('a forged link is refused', res.status === 400 && (await q('select email_opt from public.profiles where id = $1', [U1]))[0].email_opt === true);
  res = await fetch(link);
  check('the link from the email: a page, emails off', res.status === 200 && /no more emails/i.test(await res.text()) && (await q('select email_opt from public.profiles where id = $1', [U1]))[0].email_opt === false);
  res = await fetch(link, { method: 'POST', body: 'List-Unsubscribe=One-Click' });
  check('the one-click POST works too', res.status === 200);
  // the key behind the links is derived from the project's own secret: same link, same answer after a restart
  check('the links still work after a restart', await start({ RESEND_API_KEY: 're_test_key' }) && (await fetch(link)).status === 200);
} finally {
  if (deno) deno.kill();
  fake.close();
  await pgServer.stop();
  await pg.close();
}
if (fail) console.log(logs.slice(-3000));
console.log(`mail function under Deno: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
