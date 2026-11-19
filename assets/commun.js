/* ============================================================
   commun.js — ce que les cinq pages partagent.
   Chargé par index.html, salaires.html, exigences.html,
   recruteurs.html et mouvement.html, après Chart.js.

   Tout est déclaré au premier niveau : le petit script de chaque
   page peut donc appeler directement euro(), barres(), NIVEAUX…
   Une page ne fait plus que deux choses : son HTML de section, et
   Commun.demarrer(rendre) où rendre(offres, D) dessine SES
   graphiques à chaque changement de filtre.
   ============================================================ */

/* ============================================================
   1) UTILITAIRES
   ============================================================ */
const euro = (n, pas = 1) => n == null || !isFinite(n) ? "—" : (Math.round(n / pas) * pas).toLocaleString("fr-FR") + " €";
const net = brutAnnuel => brutAnnuel * 0.78 / 12;
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const mediane = a => quantile(a, .5);
function quantile(a, q) {
  const s = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y);
  if (!s.length) return null;
  const p = (s.length - 1) * q, bas = Math.floor(p), haut = Math.ceil(p);
  return bas === haut ? s[bas] : s[bas] + (s[haut] - s[bas]) * (p - bas);
}
const compter = (liste, cle) => { const c = new Map(); for (const x of liste) { const k = cle(x); if (k == null || k === "") continue; c.set(k, (c.get(k) || 0) + 1); } return [...c].sort((a, b) => b[1] - a[1]); };
const court = (s, n) => !s ? "—" : (s.length > n ? s.slice(0, n - 1) + "…" : s);
/* Le libellé de salaire de France Travail, rendu lisible : « Mensuel de 2500.0 Euros à
   2500.0 Euros » -> « 2 500 € brut par mois ». Le commentaire libre qui suit un tiret
   (« - Salaire horaire : Smic horaire (+ majoration…) ») est coupé : il fait trois lignes
   dans une liste compacte et n'ajoute rien au chiffre. */
function salaireCourt(o) {
  const lib = String(o.salaire || "").split(" - ")[0].trim();
  if (!lib) return "";
  const m = /^(annuel|mensuel|horaire)\s+de\s+([\d.,]+)\s*euros(?:\s*à\s*([\d.,]+)\s*euros)?/i.exec(lib);
  if (!m) return court(lib, 60);
  const periode = { annuel: "par an", mensuel: "par mois", horaire: "de l'heure" }[m[1].toLowerCase()];
  const nb = v => Number(String(v).replace(",", "."));
  const somme = v => nb(v).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " €";
  const haut = m[3] && nb(m[3]) > nb(m[2]) ? somme(m[3]) : null;
  return (haut ? somme(m[2]) + " à " + haut : somme(m[2])) + " brut " + periode;
}
/* Coupe un libellé long en lignes courtes : Chart.js affiche un tableau sur
   plusieurs lignes, donc rien n'est tronqué, même sur un écran de 400 px. */
function enLignes(texte, max = 28) {
  const lignes = [];
  let ligne = "";
  for (const mot of String(texte).split(" ")) {
    if (ligne && (ligne + " " + mot).length > max) { lignes.push(ligne); ligne = mot; }
    else ligne = ligne ? ligne + " " + mot : mot;
  }
  if (ligne) lignes.push(ligne);
  return lignes;
}
const ans = v => v == null ? "—" : v === 0 ? "débutant" : v < 1 ? Math.round(v * 12) + " mois" : (Math.round(v * 10) / 10).toLocaleString("fr-FR") + (v >= 2 ? " ans" : " an");
// 2026-09-22 -> 22/09/2026 (ou 22/09 pour les étiquettes de graphique).
const dateFr = (s, bref = false) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? (bref ? `${m[3]}/${m[2]}` : `${m[3]}/${m[2]}/${m[1]}`) : (s || "?"); };
// Âge d'une annonce en jours, par rapport à la date d'extraction.
const age = o => { const jour = Date.parse(D.date), t = Date.parse(o.date); return (isFinite(jour) && isFinite(t)) ? (jour - t) / 86400000 : null; };

const couleur = "#1fa9a4", pale = "rgba(31,169,164,.18)";
const COULEURS = { "Mon métier": "#c2185b", Marketing: "#1f5fbf", Digital: "#ef6c00", Frontière: "#8e8e93" };
// Mes cinq fonctions : une couleur chacune, la même sur toutes les pages
const FONCTIONS = [["marketing", "Produit / marketing", "#1f5fbf"], ["affaires médicales", "Affaires médicales", "#6b55a6"],
  ["accès au marché", "Accès au marché", "#b7832a"], ["digital", "Digital", "#ef6c00"], ["gestion de projet", "Gestion de projet", "#2e7d5b"], ["événementiel", "Événementiel", "#c2185b"], ["commercial", "Commercial", "#1fa9a4"]];
// Départements -> régions (pour compter par région et zoomer la carte)
const REGIONS = {
  "Auvergne-Rhône-Alpes": ["01","03","07","15","26","38","42","43","63","69","73","74"],
  "Bourgogne-Franche-Comté": ["21","25","39","58","70","71","89","90"], "Bretagne": ["22","29","35","56"],
  "Centre-Val de Loire": ["18","28","36","37","41","45"], "Corse": ["2A","2B"],
  "Grand Est": ["08","10","51","52","54","55","57","67","68","88"], "Hauts-de-France": ["02","59","60","62","80"],
  "Île-de-France": ["75","77","78","91","92","93","94","95"], "Normandie": ["14","27","50","61","76"],
  "Nouvelle-Aquitaine": ["16","17","19","23","24","33","40","47","64","79","86","87"],
  "Occitanie": ["09","11","12","30","31","32","34","46","48","65","66","81","82"],
  "Pays de la Loire": ["44","49","53","72","85"], "Provence-Alpes-Côte d'Azur": ["04","05","06","13","83","84"],
  "Outre-mer": ["971","972","973","974","976"] };
const REGION_DE = Object.fromEntries(Object.entries(REGIONS).flatMap(([r, ds]) => ds.map(d => [d, r])));
const NOMS_DEP = {"01":"Ain","02":"Aisne","03":"Allier","04":"Alpes-de-Haute-Provence","05":"Hautes-Alpes","06":"Alpes-Maritimes","07":"Ardèche","08":"Ardennes","09":"Ariège","10":"Aube","11":"Aude","12":"Aveyron","13":"Bouches-du-Rhône","14":"Calvados","15":"Cantal","16":"Charente","17":"Charente-Maritime","18":"Cher","19":"Corrèze","2A":"Corse-du-Sud","2B":"Haute-Corse","21":"Côte-d'Or","22":"Côtes-d'Armor","23":"Creuse","24":"Dordogne","25":"Doubs","26":"Drôme","27":"Eure","28":"Eure-et-Loir","29":"Finistère","30":"Gard","31":"Haute-Garonne","32":"Gers","33":"Gironde","34":"Hérault","35":"Ille-et-Vilaine","36":"Indre","37":"Indre-et-Loire","38":"Isère","39":"Jura","40":"Landes","41":"Loir-et-Cher","42":"Loire","43":"Haute-Loire","44":"Loire-Atlantique","45":"Loiret","46":"Lot","47":"Lot-et-Garonne","48":"Lozère","49":"Maine-et-Loire","50":"Manche","51":"Marne","52":"Haute-Marne","53":"Mayenne","54":"Meurthe-et-Moselle","55":"Meuse","56":"Morbihan","57":"Moselle","58":"Nièvre","59":"Nord","60":"Oise","61":"Orne","62":"Pas-de-Calais","63":"Puy-de-Dôme","64":"Pyrénées-Atlantiques","65":"Hautes-Pyrénées","66":"Pyrénées-Orientales","67":"Bas-Rhin","68":"Haut-Rhin","69":"Rhône","70":"Haute-Saône","71":"Saône-et-Loire","72":"Sarthe","73":"Savoie","74":"Haute-Savoie","75":"Paris","76":"Seine-Maritime","77":"Seine-et-Marne","78":"Yvelines","79":"Deux-Sèvres","80":"Somme","81":"Tarn","82":"Tarn-et-Garonne","83":"Var","84":"Vaucluse","85":"Vendée","86":"Vienne","87":"Haute-Vienne","88":"Vosges","89":"Yonne","90":"Territoire de Belfort","91":"Essonne","92":"Hauts-de-Seine","93":"Seine-Saint-Denis","94":"Val-de-Marne","95":"Val-d'Oise","971":"Guadeloupe","972":"Martinique","973":"Guyane","974":"La Réunion","976":"Mayotte"};
const nomDep = d => NOMS_DEP[d] ? `${NOMS_DEP[d]} (${d})` : d;
// Libellés plus parlants pour la grille d'outils
const OUTIL_LISIBLE = { "CRM (Veeva, Salesforce)": "CRM, logiciel de suivi clients",
  "Omnicanal / digital santé": "Digital santé, omnicanal", "Budget, P&L, prévisions": "Budget, prévisions de ventes" };
const outilLisible = x => OUTIL_LISIBLE[x] || x;
// Palette des niveaux : du clair au foncé, assistant → directeur, « autre » en gris. Valable sur toute la page.
// Niveaux : un dégradé du turquoise clair (junior) au bleu nuit (senior), aux couleurs du CV
const COUL_NIV = { assistant: "#9fded9", charge: "#1fa9a4", responsable: "#1f5fbf", directeur: "#123a7a", autre: "#b4b4bc" };
// Une couleur par type de contrat, et par territoire
const COUL_CONTRAT = { cdi: "#1f5fbf", cdd: "#1fa9a4", alt: "#c2185b", mis: "#ef6c00", indep: "#6b55a6", autre: "#8e8e93" };
const COUL_TERR = { "Puy-de-Dôme": "#1fa9a4", "Île-de-France": "#b7832a", "Reste de la France": "#6b55a6" };
// Sur ces trois teintes claires, le texte blanc n'est pas lisible : on écrit en encre foncée.
const ENCRE_FONCEE = new Set(["assistant", "charge", "autre"]);
const NIVEAUX_DEFAUT = [["assistant", "Assistant·e / junior"], ["charge", "Chargé·e"], ["responsable", "Responsable"], ["directeur", "Directeur·rice"], ["autre", "Autre"]];
const FORMATIONS_DEFAUT = ["< Bac", "Bac", "Bac+2", "Bac+3/4", "Bac+5"];
// Six familles de contrat, exclusives : une offre tombe dans une seule.
const CONTRATS = [["cdi", "CDI"], ["cdd", "CDD"], ["alt", "Alternance"], ["mis", "Intérim"], ["indep", "Indépendant"], ["autre", "Autre"]];
const AURA = new Set(["01", "03", "07", "15", "26", "38", "42", "43", "63", "69", "73", "74"]);
const IDF = new Set(["75", "77", "78", "91", "92", "93", "94", "95"]);
const EXPS = ["Débutant accepté", "Moins d'un an", "1 à 2 ans", "3 à 4 ans", "5 ans et plus", "Non précisé"];

Chart.defaults.font.family = "Outfit, system-ui, -apple-system, 'Segoe UI', sans-serif";
Chart.defaults.color = "#5d6b80";
Chart.defaults.plugins.legend.display = false;

let D, graphiques = {};
let NIVEAUX = NIVEAUX_DEFAUT, FORMATIONS = FORMATIONS_DEFAUT;

/* Famille de contrat d'une offre : l'alternance l'emporte sur le CDI/CDD qui la porte. */
function familleContrat(o) {
  const c = o.contrat || "", nat = o.nature || "";
  if (o.alternance || nat === "apprentissage" || nat === "professionnalisation") return "alt";
  if (c === "MIS") return "mis";
  if (c === "LIB" || c === "FRA" || c === "CCE" || nat === "non_salarie") return "indep";
  if (c === "CDI") return "cdi";
  if (c === "CDD") return "cdd";
  return "autre";
}
const niv = o => (o && COUL_NIV[o.niveau]) ? o.niveau : "autre";
const libNiv = k => (NIVEAUX.find(x => x[0] === k) || [k, k])[1];
const libContrat = code => (D && D.contrats && D.contrats[code]) || code || "Non précisé";
/* Le contrat tel qu'on l'annonce au lecteur : l'alternance passe devant le CDI/CDD
   qui la porte, pour dire partout la même chose que le filtre. */
const libContratOffre = o => familleContrat(o) === "alt" ? "Alternance" : libContrat(o.contrat);

/* Une offre ouverte aux débutants. L'accueil annonce ce chiffre dans son lien vers
   « Ce qu'on vous demande », qui l'affiche aussi : une seule règle écrite une fois,
   pour que les deux pages ne puissent pas se contredire. */
const debutantAccepte = o => o.exp_exige === "D" || o.exp_ans === 0;

/* Tranche d'expérience demandée. */
function trancheExp(o) {
  if (o.exp_exige === "D" || o.exp_ans === 0) return "Débutant accepté";
  if (o.exp_ans == null) return "Non précisé";
  if (o.exp_ans < 1) return "Moins d'un an";
  if (o.exp_ans < 3) return "1 à 2 ans";
  if (o.exp_ans < 5) return "3 à 4 ans";
  return "5 ans et plus";
}

/* Secteurs : libellés officiels très longs, on les rend lisibles. */
const RACCOURCIS = [
  [/agences de travail temporaire/i, "Agences d'intérim"],
  [/placement de main-d'?œuvre|placement de main-d'?oeuvre/i, "Placement de main-d'œuvre"],
  [/mise à disposition de ressources humaines/i, "Mise à disposition de personnel"],
  [/relations publiques et communication/i, "Conseil en communication"],
  [/conseil pour les affaires et autres conseils de gestion/i, "Conseil en gestion"],
  [/programmation informatique/i, "Programmation informatique"],
  [/portails internet/i, "Portails internet"],
  [/régie publicitaire/i, "Régie publicitaire"],
  [/agences de publicité/i, "Agences de publicité"],
  [/commerce de détail/i, "Commerce de détail"],
];
function secteurCourt(s) {
  if (!s) return null;
  for (const [re, lib] of RACCOURCIS) if (re.test(s)) return lib;
  return court(s.replace(/^Activités? (de(s)? |d'|du )?/i, "").replace(/^./, c => c.toUpperCase()), 48);
}

/* ============================================================
   2) GRAPHIQUES : création la première fois, mise à jour ensuite
   ============================================================ */
function dessiner(id, type, data, options) {
  const el = document.getElementById(id);
  if (!el) return null;
  // resize() avant update() : la hauteur de la zone peut avoir changé avec le nombre de barres.
  if (graphiques[id]) { const g = graphiques[id]; g.data.labels = data.labels; g.data.datasets = data.datasets; g.resize(); g.update(); return g; }
  graphiques[id] = new Chart(el, { type, data, options: Object.assign({ responsive: true, maintainAspectRatio: false, animation: false }, options) });
  return graphiques[id];
}

/* Un graphique en barres horizontales doit grandir avec le nombre de barres :
   sinon Chart.js masque une étiquette sur deux et on ne sait plus qui est qui. */
function zoneSelonBarres(id, n, parBarre) {
  const el = document.getElementById(id);
  if (el) el.parentNode.style.height = Math.max(220, 56 + n * parBarre) + "px";
}

/* Barres simples, une seule série. */
function barres(id, etiquettes, valeurs, horizontal = true, suffixe = "", teinte = couleur) {
  dessiner(id, "bar",
    { labels: etiquettes, datasets: [{ data: valeurs, backgroundColor: teinte, borderRadius: 4 }] },
    { indexAxis: horizontal ? "y" : "x",
      plugins: { tooltip: { callbacks: { label: c => c.parsed[horizontal ? "x" : "y"] + suffixe } } },
      scales: { x: { grid: { display: !horizontal }, beginAtZero: true },
                y: { grid: { display: horizontal }, ticks: { autoSkip: !horizontal } } } });
}

/* Barres empilées par niveau de poste. */
function empilees(id, etiquettes, offresParEtiquette, horizontal = false) {
  // Un niveau décoché dans les filtres n'a plus aucune barre : on le retire aussi de la
  // légende, sinon elle annonce cinq couleurs dont deux ne sont nulle part sur le graphique.
  const datasets = NIVEAUX.map(([k, lib]) => ({
    label: lib, backgroundColor: COUL_NIV[k], borderRadius: 3,
    data: etiquettes.map((_, i) => (offresParEtiquette[i] || []).filter(o => niv(o) === k).length),
  })).filter(d => d.data.some(v => v > 0));
  // Total de chaque barre, pour dire dans l'infobulle « 320 offres sur 900, soit 36 % ».
  const totaux = etiquettes.map((_, i) => datasets.reduce((s, d) => s + d.data[i], 0));
  dessiner(id, "bar", { labels: etiquettes, datasets },
    { indexAxis: horizontal ? "y" : "x",
      plugins: { legend: { display: true, position: "bottom", labels: { boxWidth: 12, boxHeight: 12, padding: 12 } },
                 tooltip: { callbacks: {
                   title: c => `${c[0].label} — ${totaux[c[0].dataIndex]} offres`,
                   label: c => { const v = c.parsed[horizontal ? "x" : "y"], t = totaux[c.dataIndex];
                     return `${c.dataset.label} : ${v} offre${v > 1 ? "s" : ""}${t ? ` (${Math.round(100 * v / t)} % de la barre)` : ""}`; } } } },
      scales: { x: { stacked: true, beginAtZero: true, grid: { display: !horizontal },
                     title: horizontal ? { display: true, text: "nombre d'offres" } : undefined },
                y: { stacked: true, beginAtZero: true, grid: { display: horizontal }, ticks: { autoSkip: !horizontal },
                     title: horizontal ? undefined : { display: true, text: "nombre d'offres" } } } });
}

/* Barres flottantes : de la médiane des minima à la médiane des maxima. */
function fourchette(lot) {
  const mn = mediane(lot.map(o => o.smin).filter(v => v != null));
  if (mn == null) return null;
  const mx = mediane(lot.map(o => (o.smax != null ? o.smax : o.smin)).filter(v => v != null));
  return [mn, Math.max(mx == null ? mn : mx, mn)];
}
function flottantes(id, lignes) {
  // lignes : [{ label, n, paire:[min,max] }]
  dessiner(id, "bar",
    { labels: lignes.map(l => [].concat(l.label, l.n + " offre" + (l.n > 1 ? "s" : ""))),
      datasets: [{ data: lignes.map(l => l.paire), backgroundColor: lignes.map(l => l.teinte || couleur), borderRadius: 4, borderSkipped: false }] },
    { indexAxis: "y",
      plugins: { tooltip: { callbacks: { label: c => { const r = c.raw || []; return r.length < 2 ? "" :
        [`${euro(r[0], 100)} → ${euro(r[1], 100)} brut par an`, `soit ${euro(net(r[0]), 10)} → ${euro(net(r[1]), 10)} net par mois`]; } } } },
      scales: { x: { beginAtZero: true, ticks: { callback: v => Math.round(v / 1000) + " k€" } },
                y: { grid: { display: true }, ticks: { autoSkip: false } } } });
}

/* ============================================================
   3) ÉTAT DES FILTRES
   ============================================================ */
/* Clé de mémorisation des filtres. Elle a changé quand le site est passé des 23 métiers
   marketing à mon métier : les anciens choix mémorisés ne s'appliquent plus, et la page
   s'ouvre sur M1703 + pharma-santé, cochés par défaut. */
const CLE_FILTRES = "avenir-filtres-v3";
const cochees = sel => new Set([...document.querySelectorAll(sel + " input:checked")].map(i => i.value));
function etatFiltres() {
  return { metiers: cochees("#metiers"), contrats: cochees("#f-contrats"), niveaux: cochees("#f-niveaux") };
}
/* Une offre est retenue par le filtre métiers si son code est coché. La case PHARMA
   (mon métier) ne retient QUE les offres repérées comme pharma-santé (o.pharma), sous
   n'importe quel code : les recherches par mots-clés de France Travail renvoient aussi des
   postes hors sujet (production, prestations santé…), qui ne comptent pas.
   Même règle que le compteur de la case, calculé dans scripts/resumer.py. */
/* La case « mon métier » est séparée en cinq cases, une par fonction (lue dans l'intitulé,
   scripts/fonctions.py) : code « PH:marketing », « PH:digital »… Une offre à deux fonctions
   apparaît sous les deux cases. */
const SOUS_PHARMA = [["marketing", "Santé — produit / marketing"], ["affaires médicales", "Santé — affaires médicales"],
  ["accès au marché", "Santé — accès au marché"], ["digital", "Santé — digital"], ["gestion de projet", "Santé — gestion de projet"], ["événementiel", "Santé — événementiel"], ["commercial", "Santé — commercial"]];
const dansCode = (o, c) => c.startsWith("PH:") ? !!o.pharma && (o.fonctions || []).includes(c.slice(3))
  : c === "PHARMA" ? !!o.pharma : o.rome === c && o.rome !== "PHARMA";
const dansMetiers = (o, f) => [...f.metiers].some(c => dansCode(o, c));
/* Pour les séries par jour (par_metier), les cinq cases « PH: » comptent comme PHARMA. */
const codesSerie = f => [...new Set([...f.metiers].map(c => c.startsWith("PH:") ? "PHARMA" : c))];
/* Les offres retenues par les trois filtres. */
function filtrer(f) {
  f = f || etatFiltres();
  return D.offres.filter(o => dansMetiers(o, f) && f.contrats.has(familleContrat(o)) && f.niveaux.has(niv(o)));
}

/* ============================================================
   4) NAVIGATION ET PANNEAU DE FILTRES, IDENTIQUES PARTOUT
   ============================================================ */
const PAGES = [
  ["index.html", "Accueil"],
  ["offres.html", "Mes offres"],
  ["mouvement.html", "Au fil des jours"],
  ["vie.html", "Veille VIE"],
  ["benevolat.html", "Bénévolat"],
];
// Chemins relatifs partout : le site vit dans un sous-dossier (/metier/) sur GitHub Pages.
const PAGE_ICI = (location.pathname.split("/").pop() || "index.html");

const HTML_FILTRES = `
  <div class="filtres">
    <div>
      <h3>Les métiers</h3>
      <div class="metiers" id="metiers"></div>
      <div class="boutons">
        <button data-groupe="tous">Tout cocher</button>
        <button data-groupe="aucun">Tout décocher</button>
        <span class="groupes" id="groupes"></span>
      </div>
    </div>
    <div>
      <h3>Type de contrat</h3>
      <div class="cases" id="f-contrats"></div>
    </div>
    <div>
      <h3>Niveau de poste</h3>
      <div class="cases" id="f-niveaux"></div>
      <p class="note" style="margin:8px 0 0">Déduit de l'intitulé de l'annonce. Ces couleurs servent de repère dans toute la page.</p>
    </div>
  </div>
  <p class="compte" id="compte"></p>`;

function poserNavEtFiltres() {
  const n = document.getElementById("nav-ici");
  if (n) n.outerHTML = `<nav class="nav">` + PAGES.map(([url, lib]) =>
    `<a href="${url}"${url === PAGE_ICI ? ' class="ici" aria-current="page"' : ""}>${lib}</a>`).join("") + `</nav>`;

  const f = document.getElementById("filtres-ici");
  if (f) f.outerHTML = (PAGE_ICI === "explorer.html"
    // Accueil : le panneau est déplié, c'est le point de départ.
    ? `<div class="carte">${HTML_FILTRES}</div>`
    // Ailleurs : replié, on vient lire une page, pas refaire ses filtres.
    : `<details class="carte"><summary id="resume-filtres">Filtres</summary>${HTML_FILTRES}</details>`)
    + `<div class="vide" id="aucune" hidden>Aucune offre ne correspond à ces filtres. Recochez un métier, un type de contrat ou un niveau de poste.</div>`;

  const p = document.getElementById("pied");
  if (p) p.innerHTML =
    `Offres d'emploi lues chaque jour sur France Travail (accès officiel, pas de LinkedIn ni d'APEC) · <a href="mouvement.html#limites">Méthode et limites</a> · M2 Marketing opérationnel et digital, IAE Clermont Auvergne`;
}

/* ============================================================
   5) CHARGEMENT ET BOUCLE DE RENDU
   ============================================================ */
const Commun = {
  D: null,          // les données, une fois chargées
  f: null,          // l'état des filtres au dernier rendu
  lib: {},          // code ROME -> { libelle, groupe, … }
  rendre: null,     // le dessinateur de la page

  /* Tout ce qui est commun à chaque rendu : compteurs des cases, ligne de
     synthèse, mémorisation, puis la page dessine ses propres graphiques. */
  rafraichir() {
    const f = etatFiltres();
    Commun.f = f;
    const parMetier = D.offres.filter(o => dansMetiers(o, f));               // base des compteurs de filtres
    const offres = filtrer(f);
    const n = offres.length, total = D.offres.length;

    // Compteurs dans les cases de filtre + ligne de synthèse
    CONTRATS.forEach(([k]) => { const e = document.getElementById("nb-c-" + k); if (e) e.textContent = parMetier.filter(o => familleContrat(o) === k).length; });
    NIVEAUX.forEach(([k]) => { const e = document.getElementById("nb-n-" + k); if (e) e.textContent = parMetier.filter(o => niv(o) === k).length; });
    document.getElementById("compte").innerHTML = `<b>${n}</b> offre${n > 1 ? "s" : ""} sélectionnée${n > 1 ? "s" : ""} sur ${total} — ${f.metiers.size} métier${f.metiers.size > 1 ? "s" : ""} coché${f.metiers.size > 1 ? "s" : ""}.`;
    document.getElementById("aucune").hidden = n > 0;
    const resume = document.getElementById("resume-filtres");
    if (resume) resume.textContent = `Filtres (${f.metiers.size} métier${f.metiers.size > 1 ? "s" : ""}, ${n} offre${n > 1 ? "s" : ""})`;
    // Plus rien de sélectionné : le message dit « recochez un métier », le panneau replié
    // doit donc s'ouvrir. Sinon la page réclame une action dont elle cache les cases.
    if (n === 0) { const d = document.querySelector("details.carte"); if (d) d.open = true; }

    // Mémorisation des trois filtres ensemble : ils suivent d'une page à l'autre.
    try { localStorage.setItem(CLE_FILTRES, JSON.stringify({ metiers: [...f.metiers], contrats: [...f.contrats], niveaux: [...f.niveaux] })); } catch (e) {}

    Commun.rendre(offres, D);
  },

  /* rendre(offres, D) : rappelée au chargement puis à chaque changement de filtre.
     initier(D) : facultatif, une seule fois, avant le premier rendu. */
  demarrer(rendre, initier) {
    Commun.rendre = rendre;
    poserNavEtFiltres();
    // GitHub Pages met le JSON en cache 10 minutes : on le redemande frais à chaque chargement.
    fetch("data/resume.json", { cache: "no-cache" }).then(r => r.json()).then(d => {
      if (!d.metiers || !d.offres) throw new Error("ancien format de resume.json — rechargez la page (Ctrl+F5)");
      D = d;
      Commun.D = d;
      Commun.lib = Object.fromEntries(d.metiers.map(m => [m.code, m]));
      // « Mon métier » en cinq cases, une par fonction
      const iP = d.metiers.findIndex(m => m.code === "PHARMA");
      if (iP >= 0) {
        const mP = d.metiers[iP];
        d.metiers.splice(iP, 1, ...SOUS_PHARMA.map(([fn, l]) => ({ ...mP, code: "PH:" + fn, libelle: l,
          actives: d.offres.filter(o => dansCode(o, "PH:" + fn)).length })));
        d.metiers.forEach(m => { Commun.lib[m.code] = m; });
      }
      if (Array.isArray(d.niveaux) && d.niveaux.length) NIVEAUX = d.niveaux.filter(x => Array.isArray(x) && x.length === 2);
      if (Array.isArray(d.formations) && d.formations.length) FORMATIONS = d.formations;

      const sous = document.getElementById("sous");
      if (sous) sous.innerHTML =
        `Extraction du <b>${dateFr(d.date)}</b> · <b>${d.offres.length.toLocaleString("fr-FR")}</b> offres actives sur France Travail · mise à jour automatiquement chaque jour`;

      if (!document.getElementById("metiers")) { if (initier) initier(d); Commun.rendre(d.offres, d); return; }
      let memo = null;
      try { memo = JSON.parse(localStorage.getItem(CLE_FILTRES)); } catch (e) {}
      const memoA = (cle, defaut) => (memo && Array.isArray(memo[cle])) ? memo[cle] : defaut;

      // --- Filtre métiers, par groupe ---
      const groupes = [...new Set(d.metiers.map(m => m.groupe))];
      let memoM = memo && Array.isArray(memo.metiers) ? memo.metiers : null;
      if (memoM && memoM.includes("PHARMA")) memoM = memoM.concat(SOUS_PHARMA.map(x => "PH:" + x[0]));
      document.getElementById("metiers").innerHTML = groupes.map(g => `<h4 style="color:${COULEURS[g] || ""}">${g}</h4>` +
        d.metiers.filter(m => m.groupe === g).map(m =>
          `<label><input type="checkbox" value="${m.code}" data-groupe="${m.groupe}" ${(memoM ? memoM.includes(m.code) : m.coche) ? "checked" : ""}> ${m.libelle} <small>${m.code.startsWith("PH:") ? "" : m.code + " · "}${m.actives}</small></label>`).join("")).join("");
      // Une case par groupe : cocher/décocher le groupe entier, cumulables ; état intermédiaire si le groupe est partiel.
      document.getElementById("groupes").innerHTML = groupes.map(g =>
        `<label style="color:${COULEURS[g] || ""}"><input type="checkbox" data-groupe-case="${g}"> ${g}</label>`).join("");
      const majGroupes = () => document.querySelectorAll("[data-groupe-case]").forEach(c => {
        const cases = [...document.querySelectorAll(`#metiers input[data-groupe="${c.dataset.groupeCase}"]`)];
        const k = cases.filter(i => i.checked).length;
        c.checked = cases.length > 0 && k === cases.length; c.indeterminate = k > 0 && k < cases.length;
      });
      document.querySelectorAll("[data-groupe-case]").forEach(c => c.addEventListener("change", () => {
        document.querySelectorAll(`#metiers input[data-groupe="${c.dataset.groupeCase}"]`).forEach(i => { i.checked = c.checked; });
        majGroupes(); Commun.rafraichir();
      }));
      document.getElementById("metiers").addEventListener("change", () => { majGroupes(); Commun.rafraichir(); });
      document.querySelectorAll(".boutons button").forEach(b => b.addEventListener("click", () => {
        document.querySelectorAll("#metiers input").forEach(i => { i.checked = b.dataset.groupe === "tous"; });
        majGroupes(); Commun.rafraichir();
      }));
      majGroupes();

      // --- Filtre type de contrat ---
      const memoC = memoA("contrats", CONTRATS.map(x => x[0]).filter(k => k !== "alt"));  // pas d'alternance par défaut
      document.getElementById("f-contrats").innerHTML = CONTRATS.map(([k, l]) =>
        `<label><input type="checkbox" value="${k}" ${memoC.includes(k) ? "checked" : ""}> ${l} <small id="nb-c-${k}"></small></label>`).join("");
      // --- Filtre niveau de poste ---
      const memoN = memoA("niveaux", NIVEAUX.map(x => x[0]));
      document.getElementById("f-niveaux").innerHTML = NIVEAUX.map(([k, l]) =>
        `<label><input type="checkbox" value="${k}" ${memoN.includes(k) ? "checked" : ""}> <i class="pastille" style="background:${COUL_NIV[k]}"></i> ${l} <small id="nb-n-${k}"></small></label>`).join("");
      document.getElementById("f-contrats").addEventListener("change", Commun.rafraichir);
      document.getElementById("f-niveaux").addEventListener("change", Commun.rafraichir);

      if (initier) initier(d);
      Commun.rafraichir();
    }).catch(e => { const s = document.getElementById("sous"); if (s) s.textContent = "Impossible de lire data/resume.json : " + e; });
  },
};


/* ============================================================
   6) PETITS VISUELS EN HTML ET LISTE D'OFFRES AU CLIC (accueil, mes offres, au fil des jours)
   ============================================================ */
const escH = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const pluriel = k => k > 1 ? "s" : "";
/* Une liste de barres horizontales en HTML : [libellé, valeur, couleur, texte affiché] */
/* ---- Cliquer sur une barre, un segment, un nom : la liste des offres concernées ---- */
const LOTS = [];
const voir = (titre, liste) => liste && liste.length ? ` data-voir="${LOTS.push([titre, liste]) - 1}"` : "";
function barresHTML(lignes, max) {
  max = max || Math.max(1, ...lignes.map(l => l[1]));
  return `<div class="barres-h">` + lignes.map(([lib, v, c, txt, liste]) =>
    `<div class="barre"${voir(lib, liste)} title="${escH(lib)} : ${escH(txt == null ? v : txt)}"><span class="lib">${escH(lib)}</span>` +
    `<span class="piste"><i style="width:${100 * v / max}%;background:${c}"></i></span><span class="val">${txt == null ? v : txt}</span></div>`).join("") + `</div>`;
}
/* Une barre découpée en segments, avec sa légende */
function segmentsHTML(parts) {
  const tot = parts.reduce((s, p) => s + p[1], 0) || 1;
  return `<div class="segments">` + parts.filter(p => p[1]).map(([l, v, c, liste]) => `<i${voir(l, liste)} title="${escH(l)} : ${v}" style="width:${100 * v / tot}%;background:${c}"></i>`).join("") + `</div>` +
    `<div class="legende-seg">` + parts.filter(p => p[1]).map(([l, v, c, liste]) => `<span${voir(l, liste)}><i style="background:${c}"></i>${escH(l)} ${v}</span>`).join("") + `</div>`;
}
/* Un anneau (Chart.js) avec un texte au centre */
function anneau(id, parts, centre) {
  return { html: `<div class="anneau"><canvas id="${id}"></canvas><div class="centre">${centre}</div></div>`,
    dessin: () => new Chart(document.getElementById(id), { type: "doughnut",
      data: { labels: parts.map(p => p[0]), datasets: [{ data: parts.map(p => p[1]), backgroundColor: parts.map(p => p[2]), borderColor: "#fff", borderWidth: 2 }] },
      options: { cutout: "68%", responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { tooltip: { callbacks: { label: c => ` ${c.label} : ${c.parsed} offre${pluriel(c.parsed)}` } } } } }) };
}

/* La fenêtre qui liste les offres d'un clic */
let boiteL;
document.addEventListener("click", e => {
  const el = e.target.closest("[data-voir]"); if (!el) return;
  const [titre, liste] = LOTS[+el.dataset.voir];
  if (!boiteL) { boiteL = document.createElement("dialog"); boiteL.className = "fiche"; document.body.appendChild(boiteL);
    boiteL.addEventListener("click", ev => { if (ev.target === boiteL) boiteL.close();
      const b = ev.target.closest("[data-fiche]"); if (b) { const o = boiteL._liste[+b.dataset.fiche]; boiteL.close();
        window.Profil && Profil.ouvrir({ ...o, contratLib: libContratOffre(o), entreprise: o.entreprise || "employeur non communiqué" }); } }); }
  const tri = [...liste].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  boiteL._liste = tri;
  boiteL.innerHTML = `<div class="fiche-tete"><div><h3>${escH(titre)}</h3><p class="note">${tri.length} offre${pluriel(tri.length)}, les plus récentes d'abord</p></div><button class="fermer" aria-label="Fermer">×</button></div>
    <div class="liste" style="margin-top:12px">${tri.map((o, i) => `<div class="item"><div class="titre">${o.url ? `<a href="${escH(o.url)}" target="_blank" rel="noopener">${escH(o.intitule)}</a>` : escH(o.intitule)}</div>
      <div class="meta"><span>${escH(o.entreprise || "employeur non communiqué")}</span><span>·</span><span>${escH(o.lieu || "lieu non précisé")}</span><span>·</span><span>${escH(libContratOffre(o))}</span>
      ${salaireCourt(o) ? `<span>·</span><span class="sal">${escH(salaireCourt(o))}</span>` : ""}<span>·</span><span>${trancheExp(o)}</span><span>·</span><span>publiée le ${dateFr(o.date)}</span>
      <button class="bouton petit" data-fiche="${i}" style="margin-left:auto">Plus d'infos</button></div></div>`).join("")}</div>`;
  boiteL.querySelector(".fermer").onclick = () => boiteL.close();
  boiteL.showModal();
});

/* ============================================================
   7) MON ASSISTANT IA, SUR TOUTES LES PAGES
   Un bouton rond en bas à droite ouvre une fenêtre de discussion.
   L'IA tourne sur Cloudflare (Worker « avenir-ia », Workers AI, gratuit) :
   le site n'a aucune clé, il envoie seulement la conversation au Worker.
   À la première question, on lui joint le résumé des offres du jour
   (data/resume.json), pour qu'elle puisse parler de MES offres.
   ============================================================ */
(function () {
  const ADRESSE = "https://avenir-ia.loubna-benmahmoud-190.workers.dev";
  const conv = [];
  let contexte = null;

  async function lireContexte() {
    if (contexte !== null) return contexte;
    try {
      const d = await (await fetch("data/resume.json", { cache: "no-cache" })).json();
      const P = d.offres.filter(o => o.pharma).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      const avecSal = P.filter(o => o.smin != null);
      contexte = `Contexte (données de mon site de veille, extraction du ${d.date}) : ${d.offres.length} offres actives sur France Travail, ` +
        `dont ${P.length} correspondent à ma recherche (marketing de la santé : produit/marketing, digital, affaires médicales, accès au marché, gestion de projet, événementiel, commercial ; hors alternance). ` +
        `${avecSal.length} affichent un salaire. Les voici, une par ligne (intitulé ; employeur ; lieu ; contrat ; salaire ; date) :\n` +
        P.slice(0, 45).map(o => `- ${o.intitule} ; ${o.entreprise || "employeur non précisé"} ; ${o.lieu || "?"} ; ${o.contrat || "?"} ; ${String(o.salaire || "—").split(" - ")[0]} ; ${o.date}`).join("\n") +
        `\nUtilise ces données quand ma question porte sur mes offres ou mon marché, et dis-le quand tu réponds avec tes connaissances générales.`;
    } catch (e) { contexte = ""; }
    return contexte;
  }

  function installer() {
    if (document.getElementById("assistant-ia")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <button id="assistant-ouvrir" aria-label="Ouvrir mon assistant IA">🤖 <span>Mon assistant</span></button>
      <section id="assistant-ia" hidden aria-label="Mon assistant IA">
        <header><b>🤖 Mon assistant IA</b><button id="assistant-fermer" aria-label="Fermer">×</button></header>
        <div id="assistant-fil"><div class="ia-msg ia">Bonjour ! Pose-moi une question sur tes offres, une entreprise, un entretien ou une lettre. Je connais les offres du jour de ton site. Je n'ai pas accès à internet : vérifie l'actualité récente.</div></div>
        <div id="assistant-idees">
          <button>Quelles offres me correspondent le mieux ?</button>
          <button>Comment présenter mon alternance en entretien ?</button>
          <button>Quelles questions poser à un recruteur ?</button>
        </div>
        <form id="assistant-form"><input type="text" placeholder="Écris ta question…" aria-label="Ta question"><button class="bouton petit">Envoyer</button></form>
      </section>`);
    const boite = document.getElementById("assistant-ia"), fil = document.getElementById("assistant-fil"), form = document.getElementById("assistant-form");
    const champ = form.querySelector("input");
    const enHTML = t => escH(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^#{1,4}\s*(.+)$/gm, "<b>$1</b>").replace(/\n/g, "<br>");
    const bulle = (qui, html) => { fil.insertAdjacentHTML("beforeend", `<div class="ia-msg ${qui}">${html}</div>`); fil.scrollTop = fil.scrollHeight; return fil.lastElementChild; };
    async function poser(question) {
      document.getElementById("assistant-idees").hidden = true;
      bulle("moi", escH(question));
      const attente = bulle("ia", "<i>Je réfléchis… (10 à 30 secondes)</i>");
      conv.push({ role: "user", content: question });
      const ctx = await lireContexte();
      // Le contexte est renvoyé à chaque fois, devant les derniers échanges (le Worker en garde 10 au plus)
      const messages = (ctx ? [{ role: "user", content: ctx }, { role: "assistant", content: "Entendu, j'ai les offres du jour." }] : []).concat(conv.slice(-8));
      try {
        const r = await fetch(ADRESSE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) });
        const j = await r.json();
        if (!r.ok || !j.reponse) throw new Error(j.erreur || "pas de réponse");
        conv.push({ role: "assistant", content: j.reponse });
        attente.innerHTML = enHTML(j.reponse);
      } catch (e) {
        conv.pop();
        attente.innerHTML = `<i>Je n'ai pas pu répondre (${escH(e.message)}). Réessaie dans un instant.</i>`;
      }
      fil.scrollTop = fil.scrollHeight;
    }
    document.getElementById("assistant-ouvrir").onclick = () => { boite.hidden = false; champ.focus(); };
    document.getElementById("assistant-fermer").onclick = () => { boite.hidden = true; };
    document.getElementById("assistant-idees").onclick = e => { const b = e.target.closest("button"); if (b) poser(b.textContent); };
    form.onsubmit = e => { e.preventDefault(); const q = champ.value.trim(); if (!q) return; champ.value = ""; poser(q); };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installer); else installer();
})();
