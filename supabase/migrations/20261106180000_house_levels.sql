-- House players play at the engine level nearest their rating plus ~300: the ratings shown here run like chess.com's
-- (a 1200–1300 there plays like a 1500–1600 on the engine's scale, which was calibrated against Stockfish's UCI_Elo),
-- so a house player "1500" has to play at engine level 6 (1900) to be the opponent a 1500 expects.
-- Engine levels: 1 = 600, 2 = 900, 3 = 1200, 4 = 1350, 5 = 1600, 6 = 1900, 7 = 2250, 8 = 2500.
update public.house set level = case
  when target < 750 then 2
  when target < 975 then 3
  when target < 1175 then 4
  when target < 1450 then 5
  when target < 1775 then 6
  when target < 2075 then 7
  else 8 end;
