// The games the campaign draws on: who, when, and where the record is looked up (the player files and world
// championship files of a PGN collection kept outside the repository; see README). `pick` narrows several games
// between the same two players in one year (event, round, number of moves, result).
// era: 1 Romantics, 2 First champions, 3 Golden age, 4 Soviet school, 5 Fischer, 6 Karpov and Kasparov,
//      7 Man and machine, 8 Our time
module.exports = [
  { id: 'bourdonnais-1834', era: 1, file: 'McDonnell', w: 'mcdonnell', b: 'bourdonnais', y: 1834, pick: { plies: [72, 76], result: '0-1' } },
  { id: 'immortal-1851', era: 1, file: 'Anderssen', w: 'anderssen', b: 'kieseritzky', y: 1851, pick: { result: '1-0', plies: [43, 47] } },
  { id: 'evergreen-1852', era: 1, file: 'Anderssen', w: 'anderssen', b: 'dufresne', y: 1852, pick: { result: '1-0', plies: [45, 49] } },
  { id: 'paulsen-morphy-1857', era: 1, file: 'Morphy', w: 'paulsen', b: 'morphy', y: 1857, pick: { result: '0-1', plies: [54, 58] } },
  { id: 'opera-1858', era: 1, file: 'Morphy', w: 'morphy', b: 'duke karl count isouard', y: 1858 },
  { id: 'morphy-anderssen-1858', era: 1, file: 'Morphy', w: 'morphy', b: 'anderssen', y: 1858, pick: { result: '1-0', plies: [33, 35] } },

  { id: 'zukertort-blackburne-1883', era: 2, file: 'Zukertort', w: 'zukertort', b: 'blackburne', y: 1883, pick: { result: '1-0', plies: [63, 67] } },
  { id: 'lasker-bauer-1889', era: 2, file: 'Lasker', w: 'lasker', b: 'bauer', y: 1889, pick: { plies: [75, 75] } },
  { id: 'chigorin-steinitz-1892', era: 2, file: '../../World_Chess_Champoinship/WorldChamp1892', w: 'chigorin', b: 'steinitz', y: 1892, pick: { round: '23' } },
  { id: 'steinitz-bardeleben-1895', era: 2, file: 'Steinitz', w: 'steinitz', b: 'von bardeleben', y: 1895 },
  { id: 'pillsbury-tarrasch-1895', era: 2, file: 'Pillsbury', w: 'pillsbury', b: 'tarrasch', y: 1895 },
  { id: 'pillsbury-lasker-1896', era: 2, file: 'Lasker', w: 'pillsbury', b: 'lasker', y: 1895, pick: { result: '0-1' } },

  { id: 'rotlewi-rubinstein-1907', era: 3, file: 'Rubinstein', w: 'rotlewi', b: 'rubinstein', y: 1907, pick: { result: '0-1', plies: [48, 52] } },
  { id: 'levitsky-marshall-1912', era: 3, file: 'Marshall', w: 'levitsky', b: 'marshall', y: 1912, pick: { result: '0-1' } },
  { id: 'lasker-capablanca-1914', era: 3, file: 'Lasker', w: 'lasker', b: 'capablanca', y: 1914, pick: { result: '1-0' } },
  { id: 'capablanca-marshall-1918', era: 3, file: 'Capablanca', w: 'capablanca', b: 'marshall', y: 1918, pick: { result: '1-0', plies: [69, 73] } },
  { id: 'bogoljubow-alekhine-1922', era: 3, file: 'Alekhine', w: 'bogoljubow', b: 'alekhine', y: 1922, pick: { result: '0-1' } },
  { id: 'saemisch-nimzowitsch-1923', era: 3, file: 'Nimzowitsch', w: 'saemisch', b: 'nimzowitsch', y: 1923, pick: { plies: [50, 50] } },
  { id: 'reti-alekhine-1925', era: 3, file: 'Alekhine', w: 'reti', b: 'alekhine', y: 1925, pick: { result: '0-1' } },

  { id: 'euwe-alekhine-1935', era: 4, file: '../../World_Chess_Champoinship/WorldChamp1935', w: 'euwe', b: 'alekhine', y: 1935, pick: { round: '26' } },
  { id: 'botvinnik-capablanca-1938', era: 4, file: 'Botvinnik', w: 'botvinnik', b: 'capablanca', y: 1938, pick: { result: '1-0' } },
  { id: 'byrne-fischer-1956', era: 4, file: 'Fischer', w: 'byrne', b: 'fischer', y: 1956, pick: { result: '0-1', plies: [80, 84] } },
  { id: 'polugaevsky-nezhmetdinov-1958', era: 4, file: 'Polugaevsky', w: 'polugaevsky', b: 'nezhmetdinov', y: 1958 },
  { id: 'tal-smyslov-1959', era: 4, file: 'Tal', w: 'tal', b: 'smyslov', y: 1959, pick: { result: '1-0', plies: [49, 53] } },
  { id: 'botvinnik-tal-1960', era: 4, file: '../../World_Chess_Champoinship/WorldChamp1960', w: 'botvinnik', b: 'tal', y: 1960, pick: { round: '6' } },
  { id: 'spassky-bronstein-1960', era: 4, file: 'Spassky', w: 'spassky', b: 'bronstein', y: 1960, pick: { result: '1-0' } },

  { id: 'byrne-fischer-1963', era: 5, file: 'Fischer', w: 'byrne', b: 'fischer', y: 1963, pick: { result: '0-1', plies: [40, 44] } },
  { id: 'larsen-spassky-1970', era: 5, file: 'Spassky', w: 'larsen', b: 'spassky', y: 1970, pick: { result: '0-1', plies: [32, 36] } },
  { id: 'fischer-petrosian-1971', era: 5, file: 'Fischer', w: 'fischer', b: 'petrosian', y: 1971, pick: { result: '1-0', plies: [65, 69] } },
  { id: 'spassky-fischer-1972-g1', era: 5, file: '../../World_Chess_Champoinship/WorldChamp1972', w: 'spassky', b: 'fischer', y: 1972, pick: { round: '1' } },
  { id: 'fischer-spassky-1972-g6', era: 5, file: '../../World_Chess_Champoinship/WorldChamp1972', w: 'fischer', b: 'spassky', y: 1972, pick: { round: '6' } },
  { id: 'spassky-fischer-1972-g13', era: 5, file: '../../World_Chess_Champoinship/WorldChamp1972', w: 'spassky', b: 'fischer', y: 1972, pick: { round: '13' } },

  { id: 'karpov-korchnoi-1978-g17', era: 6, file: '../../World_Chess_Champoinship/WorldChamp1978', w: 'kortschnoj', b: 'karpov', y: 1978, pick: { round: '17' } },
  { id: 'karpov-kasparov-1985-g16', era: 6, file: '../../World_Chess_Champoinship/WorldChamp1985', w: 'karpov', b: 'kasparov', y: 1985, pick: { round: '16' } },
  { id: 'karpov-kasparov-1985-g24', era: 6, file: '../../World_Chess_Champoinship/WorldChamp1985', w: 'karpov', b: 'kasparov', y: 1985, pick: { round: '24' } },
  { id: 'kasparov-karpov-1987-g24', era: 6, file: '../../World_Chess_Champoinship/WorldChamp1987', w: 'kasparov', b: 'karpov', y: 1987, pick: { round: '24' } },
  { id: 'kasparov-karpov-1990-g20', era: 6, file: '../../World_Chess_Champoinship/WorldChamp1990', w: 'kasparov', b: 'karpov', y: 1990, pick: { round: '20' } },
  { id: 'short-timman-1991', era: 6, file: 'Short', w: 'short', b: 'timman', y: 1991, pick: { result: '1-0', plies: [65, 69] } },
  { id: 'ivanchuk-jussupow-1991', era: 6, file: 'Ivanchuk', w: 'ivanchuk', b: 'jussupow', y: 1991, pick: { result: '0-1' } },

  { id: 'kasparov-anand-1995-g10', era: 7, file: '../../World_Chess_Champoinship/PCAChamp1995', w: 'kasparov', b: 'anand', y: 1995, pick: { round: '10' } },
  { id: 'deepblue-kasparov-1996-g1', era: 7, file: 'Kasparov', w: 'comp deep blue', b: 'kasparov', y: 1996, pick: { round: '1' } },
  { id: 'deepblue-kasparov-1997-g2', era: 7, file: 'Kasparov', w: 'comp deep blue', b: 'kasparov', y: 1997, pick: { round: '2' } },
  { id: 'deepblue-kasparov-1997-g6', era: 7, file: 'Kasparov', w: 'comp deep blue', b: 'kasparov', y: 1997, pick: { round: '6' } },
  { id: 'kasparov-topalov-1999', era: 7, file: 'Kasparov', w: 'kasparov', b: 'topalov', y: 1999, pick: { result: '1-0', plies: [85, 89] } },
  { id: 'kramnik-kasparov-2000-g2', era: 7, file: '../../World_Chess_Champoinship/WorldChamp2000', w: 'kramnik', b: 'kasparov', y: 2000, pick: { round: '2' } },
  { id: 'kramnik-kasparov-2000-g10', era: 7, file: '../../World_Chess_Champoinship/WorldChamp2000', w: 'kramnik', b: 'kasparov', y: 2000, pick: { round: '10' } },
  { id: 'kramnik-topalov-2006-g2', era: 7, file: '../../World_Chess_Champoinship/WorldChamp2006', w: 'topalov', b: 'kramnik', y: 2006, pick: { round: '2' } },

  { id: 'deepfritz-kramnik-2006-g2', era: 7, file: 'Kramnik', w: 'deep fritz', b: 'kramnik', y: 2006, pick: { round: '2' } },

  { id: 'anand-topalov-2010-g12', era: 8, file: 'Anand', w: 'topalov', b: 'anand', y: 2010, pick: { result: '0-1', plies: [108, 116] } },
  { id: 'aronian-anand-2013', era: 8, file: 'Anand', w: 'aronian', b: 'anand', y: 2013, pick: { result: '0-1', plies: [44, 48] } },
  { id: 'anand-carlsen-2013-g9', era: 8, file: 'Anand', w: 'anand', b: 'carlsen', y: 2013, pick: { result: '0-1', plies: [54, 58] } },
  { id: 'carlsen-anand-2014-g6', era: 8, file: 'Anand', w: 'carlsen', b: 'anand', y: 2014, pick: { result: '1-0', plies: [73, 77] } },
  { id: 'wei-bruzon-2015', era: 8, file: 'Wei', w: 'wei', b: 'bruzon', y: 2015, pick: { result: '1-0' } },
  { id: 'carlsen-karjakin-2016-tb4', era: 8, file: 'Carlsen', w: 'carlsen', b: 'karjakin', y: 2016, pick: { result: '1-0', plies: [97, 101] } },
  { id: 'carlsen-nepomniachtchi-2021-g6', era: 8, file: 'Carlsen', w: 'carlsen', b: 'nepomniachtchi', y: 2021, pick: { result: '1-0', plies: [265, 275] } },
];
