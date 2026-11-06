# The house players (accounts run by the developer): 60 profiles across the rating range, each with an engine level,
# the rating it drifts back to, a manner (tempo, when it resigns, draws, flags, leaves) and the hours it is around.
# Writes supabase/migrations/20261106140000_house_seed.sql (idempotent: on conflict do nothing; the ids are fixed here, so a rerun
# changes nothing). Run: python3 supabase/seed/make_house_players.py
import json, random, uuid, os, datetime

random.seed(20261106)
HERE = os.path.dirname(os.path.abspath(__file__))
# name, level (1-8), target rating — ordinary-looking names, nicknames and plain dumb handles side by side
P = [
  ('abc256', 3, 1290), ('555xyz', 2, 1040), ('qwerty88', 4, 1380), ('user31337', 5, 1615), ('aaa111', 1, 790), ('zzz_top', 4, 1455),
  ('x_x_x', 3, 1210), ('player1', 2, 980), ('guest4521', 3, 1335), ('mmm123', 1, 860), ('asdf', 4, 1420), ('1234567', 2, 1120),
  ('ggwp', 5, 1540), ('lol123', 3, 1175), ('oleg_123', 4, 1495), ('ivan2000', 5, 1660), ('n1ck', 6, 1790), ('jjj', 2, 905),
  ('Daniel Reyes', 5, 1590), ('Olga K', 4, 1365), ('Marco Bianchi', 6, 1845), ('Tomas Lind', 5, 1705), ('Priya N', 3, 1255), ('Jonas Weber', 7, 2060),
  ('Mateus Silva', 4, 1410), ('Aylin Kaya', 3, 1300), ('Peter Novak', 6, 1927), ('Chloe M', 2, 1065), ('Ahmed R', 5, 1575), ('Sofia Petrova', 4, 1470),
  ('Иван Соколов', 5, 1640), ('Серёга', 3, 1230), ('Дмитрий К', 6, 1880), ('Наталья', 2, 1010), ('Артём 2007', 4, 1395), ('Кирилл', 7, 2140),
  ('Crazy Combinator', 6, 1965), ('Кошмар Магнуса', 7, 2210), ('pawnstorm', 5, 1520), ('endgame_enjoyer', 6, 1810), ('h7h5', 3, 1195), ('Knightmare', 5, 1685),
  ('CaroKannibal', 6, 1905), ('rookie_mistake', 2, 935), ('Fianchetto Fiasco', 4, 1345), ('Золотой ход', 5, 1560), ('Ферзь на f7', 3, 1270), ('blundermaster', 1, 745),
  ('SicilianDragon', 7, 2095), ('Tilted', 4, 1440), ('en_passant_enjoyer', 5, 1630), ('ChessDad73', 4, 1505), ('slow_blitz', 3, 1150), ('VanishingBishop', 6, 1760),
  ('Гамбитчик', 5, 1600), ('Шах и мат', 2, 1090), ('bongcloud_enjoyer', 1, 915), ('Queen Sacrifice', 7, 2025), ('Nimzo', 8, 2310), ('Берсерк', 8, 2385),
]
assert len(P) == 60 and len({n.lower() for n, _, _ in P}) == 60
NS = uuid.UUID('6b1f2a3e-0c4d-4e5f-8a9b-1c2d3e4f5a6b')
T0 = datetime.datetime(2026, 10, 18, 12, 0, tzinfo=datetime.timezone.utc)

def style(level):
    s = {'tempo': round(random.uniform(0.6, 1.5), 2), 'draw': round(random.uniform(0.5, 0.95), 2), 'drawAt': random.choice([40, 60, 80]),
         'flag': round(random.uniform(0.02, 0.08), 3), 'abort': round(random.uniform(0.008, 0.03), 3), 'leave': round(random.uniform(0.003, 0.012), 4),
         'rematch': round(random.uniform(0.4, 0.9), 2)}
    if level <= 2 and random.random() < 0.5: s['resign'] = 'never'           # weak players play on to the end
    else: s.update({'resignAt': random.choice([500, 650, 800, 900]), 'resignP': round(random.uniform(0.2, 0.5), 2)})
    return s

rows_u, rows_p, rows_h, rows_r = [], [], [], []
q = lambda x: "'" + str(x).replace("'", "''") + "'"
for name, level, target in P:
    uid = uuid.uuid5(NS, name)
    created = T0 + datetime.timedelta(hours=random.uniform(0, 18 * 24))
    # around for 5–12 hours a day; the evening hours of Europe, Russia and the Americas are the busiest
    start = random.choice([6, 8, 10, 12, 13, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22, 23, 1, 3])
    hours = random.randint(5, 12)
    st = style(level)
    rows_u.append(f"({q(uid)}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, '{{}}', '{{}}', {q(created.isoformat())}, {q(created.isoformat())}, '', '', '', '', '', '', '', '')")
    rows_p.append(f"({q(uid)}, {q(name)}, false, true, true, {q(created.isoformat())})")
    rows_h.append(f"({q(uid)}, {level}, {target}, {q(json.dumps(st, ensure_ascii=False))}::jsonb, {start}, {hours})")
    for pool in ('bullet', 'blitz', 'rapid'):
        r = target + random.gauss(0, 35)
        games = int(random.lognormvariate(4.3, 0.8)) + 8          # a few dozen to a few hundred
        wins = int(games * random.uniform(0.38, 0.55)); draws = int(games * random.uniform(0.03, 0.12)); losses = games - wins - draws
        rows_r.append(f"({q(uid)}, {q(pool)}, {r:.1f}, {random.uniform(55, 85):.1f}, 0.06, {games}, {wins}, {draws}, {losses})")

# a migration (the GitHub integration applies it on push); it only runs where auth.users is Supabase's real table
# (the test database's stand-in has no is_anonymous column, so the tests see no seeded house players)
sql = f"""-- House players: {len(P)} accounts run by the developer (see 20261106120000_house_players.sql). Made by supabase/seed/make_house_players.py; do not edit.
do $seed$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'is_anonymous') then
    return;
  end if;
  insert into auth.users (id, instance_id, aud, role, is_anonymous, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token, phone_change, phone_change_token, email_change_token_current, reauthentication_token)
  values
{',\n'.join('  ' + r for r in rows_u)}
  on conflict (id) do nothing;

  insert into public.profiles (id, username, is_guest, house, name_chosen, created_at) values
{',\n'.join('  ' + r for r in rows_p)}
  on conflict (id) do nothing;

  insert into public.house (user_id, level, target, style, online_from, online_hours) values
{',\n'.join('  ' + r for r in rows_h)}
  on conflict (user_id) do nothing;

  insert into public.ratings (user_id, pool, rating, rd, vol, games, wins, draws, losses) values
{',\n'.join('  ' + r for r in rows_r)}
  on conflict (user_id, pool) do nothing;
end
$seed$;
"""
out = os.path.join(os.path.dirname(HERE), 'migrations', '20261106140000_house_seed.sql')
open(out, 'w', encoding='utf-8').write(sql)
print(os.path.relpath(out), len(P), 'players')
