'use strict';
var E = require('./engine.js');

var failures = 0;
function check(name, cond) {
  if (cond) { console.log('OK   ' + name); }
  else { failures++; console.error('FAIL ' + name); }
}
function card(rank, suit) { return { rank: rank, suit: suit, id: suit + rank }; }
function type(cards) { return E.detectHand(cards).type; }
function evalOf(played, jokers, opts) {
  return E.evaluate(played, jokers, Object.assign({ handLevels: {}, discards: 0 }, opts || {}));
}

// --- Détection de mains ---
check('paire', type([card(5, 'H'), card(5, 'S'), card(9, 'D'), card(12, 'C'), card(2, 'H')]) === 'pair');
check('double paire', type([card(5, 'H'), card(5, 'S'), card(9, 'D'), card(9, 'C'), card(2, 'H')]) === 'two_pair');
check('brelan', type([card(7, 'H'), card(7, 'S'), card(7, 'D'), card(12, 'C'), card(2, 'H')]) === 'three_kind');
check('carré', type([card(7, 'H'), card(7, 'S'), card(7, 'D'), card(7, 'C'), card(2, 'H')]) === 'four_kind');
check('full', type([card(7, 'H'), card(7, 'S'), card(7, 'D'), card(12, 'C'), card(12, 'H')]) === 'full_house');
check('couleur', type([card(2, 'H'), card(5, 'H'), card(9, 'H'), card(11, 'H'), card(13, 'H')]) === 'flush');
check('quinte', type([card(5, 'H'), card(6, 'S'), card(7, 'D'), card(8, 'C'), card(9, 'H')]) === 'straight');
check('quinte As bas', type([card(14, 'H'), card(2, 'S'), card(3, 'D'), card(4, 'C'), card(5, 'H')]) === 'straight');
check('quinte As haut', type([card(10, 'H'), card(11, 'S'), card(12, 'D'), card(13, 'C'), card(14, 'H')]) === 'straight');
check('quinte flush', type([card(6, 'S'), card(7, 'S'), card(8, 'S'), card(9, 'S'), card(10, 'S')]) === 'straight_flush');
check('carte haute', type([card(2, 'H'), card(5, 'S'), card(9, 'D'), card(12, 'C'), card(4, 'H')]) === 'high_card');
check('pas de quinte trouée', type([card(5, 'H'), card(6, 'S'), card(7, 'D'), card(9, 'C'), card(10, 'H')]) === 'high_card');

// --- Cartes scorées ---
check('paire : 2 cartes scorées', E.detectHand([card(5, 'H'), card(5, 'S'), card(9, 'D'), card(12, 'C'), card(2, 'H')]).scoring.length === 2);
var hc = E.detectHand([card(2, 'H'), card(5, 'S'), card(9, 'D'), card(12, 'C'), card(4, 'H')]);
check('carte haute : 1 carte scorée (la Dame)', hc.scoring.length === 1 && hc.scoring[0].rank === 12);
check('full : 5 cartes scorées', E.detectHand([card(7, 'H'), card(7, 'S'), card(7, 'D'), card(12, 'C'), card(12, 'H')]).scoring.length === 5);

// --- Scoring ---
var r1 = evalOf([card(5, 'H'), card(5, 'S')], []);
check('paire 5+5 : 20 jetons × 2 = 40', r1.chips === 20 && r1.mult === 2 && r1.final === 40);

var r2 = evalOf([card(14, 'H'), card(14, 'S')], []);
check('paire d\'As : 11+11+10 = 32 × 2 = 64', r2.chips === 32 && r2.final === 64);

var r3 = evalOf([card(5, 'H'), card(5, 'S')], [E.JOKERS[0]]);
check('Duo (+4 Mult) : 20 × 6 = 120', r3.chips === 20 && r3.mult === 6 && r3.final === 120);

var r4 = evalOf([card(5, 'H'), card(5, 'S')], [E.JOKERS[2]]);
check('Jolly avec paire : +8 Mult → 200', r4.mult === 10 && r4.final === 200);
var r4b = evalOf([card(5, 'H'), card(9, 'S')], [E.JOKERS[2]]);
check('Jolly sans paire : inactif', r4b.mult === 1);

var r5 = evalOf([card(4, 'H'), card(6, 'S')], [E.JOKERS[7]]);
check('Égal : carte haute, seul le 6 marque → (5+6) × (1+4) = 55', r5.chips === 11 && r5.mult === 5 && r5.final === 55);

var r6 = evalOf([card(3, 'H'), card(5, 'S'), card(9, 'D')], [E.JOKERS[8]], { discards: 2 });
check('Impair : carte haute, seul le 9 marque → 5+9+30 = 44 jetons', r6.chips === 44);

var r7 = evalOf([card(5, 'D'), card(7, 'D')], [E.JOKERS[10]]);
check('Avare : ♦ marqué → +3 Mult', r7.mult === 4);

var r8 = evalOf([card(5, 'D'), card(5, 'H'), card(5, 'S')], [E.JOKERS[12]]);
check('Foi (brelan) : ×2 Mult → (30+15)×6 = 270', r8.mult === 6 && r8.final === 270);

var r9 = evalOf([card(2, 'H'), card(5, 'H'), card(9, 'H'), card(11, 'H'), card(13, 'H')], [E.JOKERS[13]]);
check('Étoile (couleur) : mult 4 × 1.5 = 6 → (35+36) × 6 = 426', r9.mult === 6 && r9.final === 426);

var r10 = evalOf([card(5, 'H'), card(5, 'S')], [E.JOKERS[6], E.JOKERS[0]]);
check('Abstrait avec 2 jokers : mult 2+3+4 = 9 → 180', r10.mult === 9 && r10.final === 180);

// --- Débuff boss ---
var r11 = evalOf([card(5, 'H'), card(5, 'S'), card(3, 'C')], [], { debuffSuit: 'C' });
check('débuff ♣ : la carte trèfle ne marque rien', r11.chips === 10 + 5 + 5);

// --- Niveaux de main ---
var r12 = evalOf([card(5, 'H'), card(5, 'S')], [], { handLevels: { pair: 3 } });
check('paire niv.3 : (10+2×15) + 5 + 5 = 50 jetons × 4 = 200', r12.chips === 50 && r12.mult === 4 && r12.final === 200);

// --- Deck et RNG ---
var deck = E.makeDeck();
check('deck de 52 cartes uniques', deck.length === 52 && new Set(deck.map(function (c) { return c.id; })).size === 52);
var a = E.shuffle(deck, E.makeRng(42));
var b = E.shuffle(deck, E.makeRng(42));
check('shuffle reproductible avec la même seed', JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(deck));

// --- Simulation : 500 tirages aléatoires ---
var simFail = 0;
for (var sim = 0; sim < 500; sim++) {
  var r = E.makeRng(sim);
  var d = E.shuffle(E.makeDeck(), r);
  var played = d.slice(0, 1 + Math.floor(r() * 5));
  var js = [];
  for (var jj = 0; jj < 3; jj++) js.push(E.JOKERS[Math.floor(r() * E.JOKERS.length)]);
  var res = E.evaluate(played, js, { handLevels: { pair: 2 }, discards: Math.floor(r() * 4) });
  if (!isFinite(res.final) || res.final <= 0 || res.log.length < 1) simFail++;
}
check('simulation 500 tirages aléatoires : scores finis et positifs', simFail === 0);

console.log(failures === 0 ? '\nTous les tests passent.' : '\n' + failures + ' test(s) en échec.');
process.exit(failures === 0 ? 0 : 1);
