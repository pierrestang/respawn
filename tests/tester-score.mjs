// Teste la logique du score directement dans index.html (source unique).
// Lancement : TZ=Europe/Paris node tests/tester-score.mjs
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const debut = html.indexOf('// ===================== LOGIQUE DU SCORE');
const fin = html.indexOf('// ===================== FIN LOGIQUE DU SCORE');
const L = new Function(html.slice(debut, fin) +
  'return { POIDS_DEFAUT, cleDuJour, ajouterJours, lundiDe, joursDeLaSemaine, dureeSommeilMinutes, scoreJour, calculerScoreSemaine, serieJours, serieSemainesSport, etatPersonnage, finDefiMensuel, evaluerDefi, messagePersonnage, phaseDuJour, MESSAGES };')();

let echecs = 0;
const verifier = (nom, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs++;
  console.log(`${ok ? '✓' : '✗'} ${nom}${ok ? '' : `  → obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`}`);
};

// --- Fabriques de journées fictives ---
const TOUT = { eau: true, lecture: true, meditation: true, petitDej: true, dejeuner: true, diner: true };
const BIEN_DORMI = { coucher: '23:00', reveil: '07:00' };   // 8 h
const PEU_DORMI = { coucher: '01:00', reveil: '07:30' };    // 6 h 30
const jour = (habitudes = TOUT, sommeil = BIEN_DORMI, exclusions) => ({ habitudes, sommeil, ...(exclusions && { exclusions }) });
const LUNDI = '2026-10-19';               // semaine du passage à l'heure d'hiver (dim. 25 oct.)
const J = L.joursDeLaSemaine(LUNDI);
const semaineDe = (f) => Object.fromEntries(J.map((c, i) => [c, f(i)]).filter(([, v]) => v));
const SPORT = new Set([0, 2, 4]);         // lundi, mercredi, vendredi
const avecSport = (h, i, set = SPORT) => ({ ...h, sport: set.has(i) });

const cas = [
  { nom: 'Semaine parfaite', attendu: 100,
    jours: semaineDe(i => jour(avecSport(TOUT, i))), semaine: { menage: true } },
  { nom: 'Parfaite, mais ménage non fait', attendu: 96,
    jours: semaineDe(i => jour(avecSport(TOUT, i))), semaine: { menage: false } },
  { nom: 'Sans sport (tout le reste parfait)', attendu: 75,
    jours: semaineDe(() => jour(TOUT)), semaine: { menage: true } },
  { nom: '5 séances de sport (plafonné à 3)', attendu: 100,
    jours: semaineDe(i => jour(avecSport(TOUT, i, new Set([0, 1, 2, 3, 4])))), semaine: { menage: true } },
  { nom: 'Exclusions : ménage (semaine), méditation sam.+dim., sport 2 j, 2 séances', attendu: 100,
    jours: semaineDe(i => jour({ ...TOUT, sport: i === 0 || i === 2 }, BIEN_DORMI,
      [...(i >= 5 ? ['meditation', 'sport'] : [])])),
    semaine: { exclusions: ['menage'] } },
  { nom: 'Mêmes exclusions, méditation jamais faite', attendu: 94,
    jours: semaineDe(i => jour({ ...TOUT, meditation: false, sport: i === 0 || i === 2 }, BIEN_DORMI,
      [...(i >= 5 ? ['meditation', 'sport'] : [])])),
    semaine: { exclusions: ['menage'] } },
  { nom: 'Sommeil < 7 h toute la semaine', attendu: 75,
    jours: semaineDe(i => jour(avecSport(TOUT, i), PEU_DORMI)), semaine: { menage: true } },
  { nom: 'Dimanche sans aucune saisie', attendu: 90,
    jours: semaineDe(i => i < 6 && jour(avecSport(TOUT, i))), semaine: { menage: true } },
  { nom: 'Semaine vide', attendu: 0, jours: {}, semaine: {} },
  { nom: 'Réaliste : 2 séances, 4 nuits ≥ 7 h, eau 5/7, repas 19/21, lecture 3/7, médit. 2/7, ménage fait', attendu: 65,
    jours: semaineDe(i => jour({
      sport: i === 1 || i === 4, eau: i < 5, petitDej: i % 2 === 0 || i === 5, dejeuner: true, diner: true,
      lecture: i < 3, meditation: i === 0 || i === 6,
    }, i < 4 ? BIEN_DORMI : PEU_DORMI)), semaine: { menage: true } },
  { nom: 'Commencée mercredi (dateDebut), parfaite depuis, 2 séances', attendu: 100,
    dateDebut: J[2], jours: semaineDe(i => i >= 2 && jour({ ...TOUT, sport: i === 2 || i === 5 })), semaine: { menage: true } },
  { nom: 'En cours, mardi soir : 2 jours parfaits, 1 séance, ménage pas encore fait', attendu: 96,
    aujourdhui: J[1], jours: semaineDe(i => i < 2 && jour({ ...TOUT, sport: i === 0 })), semaine: {} },
];

// --- Tableau de calcul ---
const pct = x => x === null || x === undefined ? '—' : `${Math.round(x * 100)} %`;
const lignes = cas.map(c => {
  const r = L.calculerScoreSemaine({ lundi: LUNDI, jours: c.jours, semaine: c.semaine, dateDebut: c.dateDebut, aujourdhui: c.aujourdhui ?? J[6] });
  const moyJours = Object.values(r.scoresJours).filter(s => s !== null);
  return {
    'Semaine fictive': c.nom,
    'Jours': r.jours,
    'Moy. jours': moyJours.length ? `${Math.round(moyJours.reduce((a, b) => a + b, 0) / moyJours.length)}` : '—',
    'Sport': r.sport ? `${r.sport.seances}/${r.sport.objectif} → ${pct(r.sport.taux)}` : 'exclu',
    'Ménage': r.menage === null ? 'exclu' : r.menage ? 'oui' : 'non',
    'Score': r.score, 'Attendu': c.attendu, ok: r.score === c.attendu ? '✓' : '✗',
    _r: r, _c: c,
  };
});
console.log(`\nPoids : ${JSON.stringify(L.POIDS_DEFAUT)}\n`);
console.table(lignes.map(({ _r, _c, ...l }) => l));
lignes.forEach(l => { if (l.ok !== '✓') echecs++; });

// --- Dates, changement d'heure, sommeil ---
console.log('\nDates et sommeil');
verifier('Semaine du 19 oct. 2026 (passage heure d\'hiver le 25) : 7 jours distincts',
  J, ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
verifier('Semaine du 23 mars 2026 (passage heure d\'été le 29) : 7 jours distincts',
  L.joursDeLaSemaine('2026-03-23'), ['2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29']);
verifier('Lundi du dimanche 25 oct.', L.lundiDe('2026-10-25'), '2026-10-19');
verifier('Lundi du lundi 26 oct.', L.lundiDe('2026-10-26'), '2026-10-26');
verifier('Lundi du jeudi 1er janv. 2026', L.lundiDe('2026-01-01'), '2025-12-29');
verifier('Bascule à minuit local : 25 oct. 23:59 → 25', L.cleDuJour(new Date(2026, 9, 25, 23, 59)), '2026-10-25');
verifier('Bascule à minuit local : 26 oct. 00:00 → 26', L.cleDuJour(new Date(2026, 9, 26, 0, 0)), '2026-10-26');
verifier('Heure répétée (25 oct. 02:30, heure d\'hiver) → 25', L.cleDuJour(new Date(2026, 9, 25, 2, 30)), '2026-10-25');
verifier('Parcours de 400 jours depuis le 1er janv. 2026 : aucun doublon, aucun saut', (() => {
  const vus = []; for (let c = '2026-01-01', n = 0; n < 400; c = L.ajouterJours(c, 1), n++) vus.push(c);
  return new Set(vus).size === 400 && vus[399] === '2027-02-04';
})(), true);
verifier('Sommeil 23:00 → 07:00 = 480 min', L.dureeSommeilMinutes('23:00', '07:00'), 480);
verifier('Sommeil 00:30 → 07:30 = 420 min (validé, pile 7 h)', L.dureeSommeilMinutes('00:30', '07:30'), 420);
verifier('Sommeil 00:31 → 07:30 = 419 min (non validé)', L.dureeSommeilMinutes('00:31', '07:30'), 419);
verifier('Jour : 7 h pile validé', L.scoreJour({ habitudes: {}, sommeil: { coucher: '00:30', reveil: '07:30' } }).score > 0, true);

// --- Séries ---
console.log('\nSéries');
const S = { '2026-10-20': jour(), '2026-10-21': jour(), '2026-10-22': jour({ ...TOUT, lecture: false }),
  '2026-10-23': jour(), '2026-10-24': jour(TOUT, BIEN_DORMI, ['lecture']), '2026-10-25': jour() };
verifier('Lecture : dim. ✓, sam. exclu (pause), ven. ✓, jeu. manqué → série 2',
  L.serieJours('lecture', { jours: S, aujourdhui: '2026-10-25' }), 2);
verifier('Méditation : 6 jours d\'affilée', L.serieJours('meditation', { jours: S, aujourdhui: '2026-10-25' }), 6);
verifier('Aujourd\'hui pas encore coché ne casse pas la série',
  L.serieJours('meditation', { jours: S, aujourdhui: '2026-10-26' }), 6);
verifier('Hier oublié casse la série', L.serieJours('meditation', { jours: S, aujourdhui: '2026-10-27' }), 0);
verifier('Correction : cocher hier recolle la série',
  L.serieJours('meditation', { jours: { ...S, '2026-10-26': jour() }, aujourdhui: '2026-10-27' }), 7);
verifier('Exclusion à la semaine : pause, puis cassée par le week-end du 17-18 non saisi',
  L.serieJours('eau', { jours: { '2026-10-16': jour(), '2026-10-26': jour() }, semaines: { '2026-10-19': { exclusions: ['eau'] } },
    dateDebut: '2026-10-16', aujourdhui: '2026-10-26' }), 1);

verifier('Sommeil : 3 nuits ≥ 7 h puis une courte → série 3',
  L.serieJours('sommeil', { jours: { '2026-10-22': jour(TOUT, PEU_DORMI), '2026-10-23': jour(), '2026-10-24': jour(), '2026-10-25': jour() }, aujourdhui: '2026-10-25' }), 3);

// --- Série du sport (en semaines) ---
console.log('\nSérie du sport');
const seances = (...cles) => Object.fromEntries(cles.map(c => [c, { habitudes: { sport: true } }]));
const troisParSemaine = seances('2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-14', '2026-10-16', '2026-10-19', '2026-10-21', '2026-10-23');
verifier('3 semaines réussies, semaine en cours (mardi) sans séance → 3',
  L.serieSemainesSport({ jours: troisParSemaine, dateDebut: '2026-10-05', aujourdhui: '2026-10-27' }), 3);
verifier('Semaine en cours réussie (lundi + 1 séance, objectif 1) → 4',
  L.serieSemainesSport({ jours: { ...troisParSemaine, '2026-10-26': { habitudes: { sport: true } } }, dateDebut: '2026-10-05', aujourdhui: '2026-10-26' }), 4);
verifier('Semaine du 12 avec 2 séances seulement → cassée, série 1',
  L.serieSemainesSport({ jours: { ...troisParSemaine, '2026-10-16': undefined }, dateDebut: '2026-10-05', aujourdhui: '2026-10-27' }), 1);
verifier('Semaine du 12 avec sport exclu → pause, série 2',
  L.serieSemainesSport({ jours: seances('2026-10-05', '2026-10-07', '2026-10-09', '2026-10-19', '2026-10-21', '2026-10-23'),
    semaines: { '2026-10-12': { exclusions: ['sport'] } }, dateDebut: '2026-10-05', aujourdhui: '2026-10-27' }), 2);

// --- État du personnage ---
console.log('\nÉtat du personnage');
verifier('Seuils : 100, 80, 79, 60, 59, 40, 39, 0, aucun score',
  [100, 80, 79, 60, 59, 40, 39, 0, null].map(L.etatPersonnage),
  ['en-forme', 'en-forme', 'content', 'content', 'neutre', 'neutre', 'fatigue', 'fatigue', 'neutre']);

// --- Message du personnage et fond ---
console.log('\nMessage et fond');
const groupeDe = (score, cle) => Object.keys(L.MESSAGES).find(g => L.MESSAGES[g].includes(L.messagePersonnage(score, cle)));
verifier('Mardi : 90 → en forme, 70 → content, 50 → neutre, 20 → fatigué, aucun score → pause',
  [90, 70, 50, 20, null].map(x => groupeDe(x, '2026-10-27')), ['en-forme', 'content', 'neutre', 'fatigue', 'pause']);
verifier('Lundi : 10 → message de début de semaine (pas de taquinerie), 85 → en forme',
  [10, 85].map(x => groupeDe(x, '2026-10-26')), ['lundi', 'en-forme']);
verifier('Même jour, même score → même phrase', L.messagePersonnage(50, '2026-10-27') === L.messagePersonnage(52, '2026-10-27'), true);
verifier('Les phrases varient d\'un jour à l\'autre', new Set(['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'].map(c => L.messagePersonnage(20, c))).size > 1, true);
verifier('Phases : 6 h nuit, 7 h jour, 17 h jour, 18 h soir, 20 h soir, 21 h nuit, 0 h nuit',
  [6, 7, 17, 18, 20, 21, 0].map(L.phaseDuJour), ['nuit', 'jour', 'jour', 'soir', 'soir', 'nuit', 'nuit']);

// --- Défis ---
console.log('\nDéfis');
verifier('Fin du défi mensuel lancé le 27 oct. → 26 nov.', L.finDefiMensuel('2026-10-27'), '2026-11-26');
verifier('Lancé le 31 janv. → 28 févr.', L.finDefiMensuel('2027-01-31'), '2027-02-28');
verifier('Lancé le 1er déc. → 31 déc.', L.finDefiMensuel('2026-12-01'), '2026-12-31');
const defiSport = { type: 'sport-semaine', cible: 4, debut: '2026-10-19', fin: '2026-10-25' };
const sport4 = seances('2026-10-19', '2026-10-21', '2026-10-23', '2026-10-24');
verifier('Sport 4 séances : 2 faites mercredi → en cours',
  L.evaluerDefi(defiSport, { jours: sport4, aujourdhui: '2026-10-21' }), { fait: 2, total: 4, statut: 'en-cours' });
verifier('Sport 4 séances : 4 faites samedi → réussi',
  L.evaluerDefi(defiSport, { jours: sport4, aujourdhui: '2026-10-24' }), { fait: 4, total: 4, statut: 'reussi' });
verifier('Sport 4 séances : 3 seulement, semaine finie → raté',
  L.evaluerDefi(defiSport, { jours: { ...sport4, '2026-10-24': undefined }, aujourdhui: '2026-10-26' }), { fait: 3, total: 4, statut: 'rate' });
const defiMedit = { type: 'sans-manquer', habitude: 'meditation', debut: '2026-10-20', fin: '2026-10-24' };
const medit = Object.fromEntries(['2026-10-20', '2026-10-21', '2026-10-23', '2026-10-24'].map(c => [c, jour()]));
verifier('Méditation : jeudi 22 manqué → raté',
  L.evaluerDefi(defiMedit, { jours: medit, aujourdhui: '2026-10-25' }), { fait: 4, total: 5, statut: 'rate' });
verifier('Méditation : jeudi 22 exclu → réussi à la fin',
  L.evaluerDefi(defiMedit, { jours: { ...medit, '2026-10-22': jour(TOUT, BIEN_DORMI, ['meditation']) }, aujourdhui: '2026-10-25' }), { fait: 5, total: 5, statut: 'reussi' });
verifier('Méditation : aujourd\'hui pas encore faite → toujours en cours',
  L.evaluerDefi(defiMedit, { jours: medit, aujourdhui: '2026-10-22' }), { fait: 2, total: 5, statut: 'en-cours' });
verifier('Correction : cocher le jeudi oublié → plus raté',
  L.evaluerDefi(defiMedit, { jours: { ...medit, '2026-10-22': jour() }, aujourdhui: '2026-10-24' }), { fait: 5, total: 5, statut: 'en-cours' });

console.log(echecs ? `\n✗ ${echecs} échec(s)` : '\n✓ Tout est juste');
process.exit(echecs ? 1 : 0);
