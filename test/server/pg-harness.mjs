// Real Postgres (PGlite, WASM) behind a socket, reached through postgres.js exactly like the edge function does.
// Applies the production migration on top of minimal stand-ins for Supabase's auth and realtime schemas.
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import postgres from 'postgres';
import { createPgRepo } from '../../supabase/functions/play/pgrepo.js';

const MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);

export async function setupPg(userIds) {
  const pg = await PGlite.create();
  await pg.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users (id uuid primary key);
    create schema realtime;
    create table realtime.messages (id bigserial primary key, topic text, extension text, payload jsonb, event text, private boolean);
    alter table realtime.messages enable row level security;`);
  for (const f of fs.readdirSync(MIGRATIONS).filter((x) => x.endsWith('.sql')).sort()) await pg.exec(fs.readFileSync(new URL(f, MIGRATIONS), 'utf8'));
  for (const id of userIds) await pg.query('insert into auth.users (id) values ($1)', [id]);
  const server = new PGLiteSocketServer({ db: pg, port: 0, host: '127.0.0.1' });
  await server.start();
  const port = server.server ? server.server.address().port : server.port;
  const sql = postgres({ host: '127.0.0.1', port, database: 'postgres', username: 'postgres', password: 'x', prepare: false, max: 1, onnotice: () => {} });
  const repo = createPgRepo(sql);
  const inspect = {
    profiles: async () => (await pg.query('select * from public.profiles')).rows,
    ratings: async () => (await pg.query('select * from public.ratings')).rows,
    game: async (id) => (await pg.query('select * from public.games where id = $1', [id])).rows[0],
  };
  const cleanup = async () => { await sql.end({ timeout: 1 }); await server.stop(); await pg.close(); };
  return { repo, inspect, cleanup, sql, pg };
}
