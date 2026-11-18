/* ============================================================
   profil.js — mon profil face à une offre
   - Profil.LIGNES  : ce que les annonces demandent, et ce que j'ai (écrit par moi)
   - Profil.analyser(offre) : mes forces et mes écarts face à UNE offre
   - Profil.lettre(offre)   : un brouillon de lettre de motivation pour cette offre
   - Profil.ouvrir(offre)   : la fiche « Plus d'infos » (carte forces / écarts + lettre)
   Tout se calcule dans le navigateur : rien n'est envoyé nulle part.
   Une offre peut venir de France Travail (outils, compétences) ou du site VIE (extrait).
   ============================================================ */
(function () {
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));

  // lib : intitulé · outils / comp : repérage France Travail · rx : repérage dans un texte (VIE)
  // jai : ce que m'apportent ma formation et mon alternance · ecart : mon écart · ok : couvert ?
  // phrase : ce que la lettre dit de moi quand l'offre le demande
  const LIGNES = [
    {lib:"Anglais", outils:["Anglais"], rx:/\b(anglais|english|bilingue|fluent)\b/i,
     jai:"Anglais B2 ; poste Global chez Théa en lien avec 35 filiales", ecart:"À renforcer : viser un niveau C1 certifié", ok:false,
     phrase:"je travaille chaque jour en anglais avec les filiales de Théa"},
    {lib:"Lancement de produit", outils:["Lancement de produit"], rx:/\b(lancement|launch\w*|go[- ]to[- ]market)\b/i,
     jai:"Lancement d'un médicament dans 4 pays avec 35 filiales ; lancement d'un médicament et d'un complément alimentaire chez Théa France", ecart:"Mon point fort", ok:true,
     phrase:"j'accompagne le lancement d'un médicament du glaucome dans 4 pays européens, en coordination avec 35 filiales"},
    {lib:"Plan marketing, stratégie de marque", outils:["Plan marketing / stratégie de marque"], comp:["Elaborer un plan marketing"], rx:/\b(plan marketing|strat[ée]gie (de )?marque|brand|marketing plan|positionnement)\b/i,
     jai:"M2 Marketing Vente (MOD) ; messages clés et outils marketing chez Théa", ecart:"Couvert", ok:true,
     phrase:"je décline les messages clés et crée des outils marketing pour les équipes"},
    {lib:"Veille, besoins clients, connaissance produit", comp:["Réaliser une veille", "Recueillir et analyser les besoins client", "Maîtriser les caractéristiques"], rx:/\b(veille|concurren\w*|competitive|besoins? clients?|insights? clients?)\b/i,
     jai:"Veille concurrentielle chez Théa France ; argumentaires et réponses aux objections ; immersion terrain avec les équipes de vente", ecart:"Couvert", ok:true,
     phrase:"j'ai assuré la veille concurrentielle et préparé les argumentaires et les réponses aux objections"},
    {lib:"Compliance, conformité", outils:["Compliance / conformité"], rx:/\b(compliance|conformit[ée]|r[ée]glementation de la promotion)\b/i,
     jai:"Mise à jour des documents scientifiques et vérification des références ; procédures réglementaires en animalerie", ecart:"Couvert", ok:true,
     phrase:"je mets à jour les documents scientifiques en vérifiant chaque référence"},
    {lib:"Réglementaire (AMM, ANSM, HAS)", outils:["Réglementaire (AMM, ANSM, HAS)"], rx:/\b(r[ée]glementaire|regulatory|amm|ansm|has|market access|acc[eè]s au march[ée]|remboursement|pricing)\b/i,
     jai:"Master Biologie Santé « Produits de santé et innovation » ; évaluation HAS et prix CEPS chez Théa France ; demandes d'autorisation réglementaires ; UE Évaluation médico-économique (Cnam, en cours)", ecart:"Mon point fort", ok:true,
     phrase:"j'ai découvert l'accès au marché (évaluation HAS, prix CEPS) et je suis une UE d'évaluation médico-économique au Cnam"},
    {lib:"Études de marché, insights", outils:["Études de marché, insights"], rx:/\b([ée]tudes? de march[ée]|market research|insights?|analyse de march[ée])\b/i,
     jai:"M2 MOD ; analyse des ventes chez Théa France", ecart:"Couvert", ok:true,
     phrase:"j'analyse les ventes et le marché pour orienter les actions"},
    {lib:"Excel, Power BI, tableaux de bord", outils:["Excel", "Power BI / tableaux de bord"], rx:/\b(excel|power ?bi|tableaux? de bord|dashboard|reporting|data analy\w*)\b/i,
     jai:"Tableau de bord des ventes chez Théa France ; Excel, Power BI, R (biostatistiques)", ecart:"Couvert", ok:true,
     phrase:"j'ai suivi les ventes avec un tableau de bord sous Power BI"},
    {lib:"Promotion médicale, KOL, congrès", outils:["Promotion médicale, KOL, congrès"], rx:/\b(kol|leaders? d.opinion|congr[eè]s|medical affairs|promotion m[ée]dicale|visite m[ée]dicale)\b/i,
     jai:"Messages clés, podcasts scientifiques", ecart:"Partiel : peu d'expérience des leaders d'opinion et des congrès", ok:false},
    {lib:"Budget, P&L, prévisions", outils:["Budget, P&L, prévisions"], rx:/\b(budget|p&l|forecast\w*|pr[ée]visions?|chiffre d.affaires)\b/i,
     jai:"Analyse des ventes ; DU Entrepreneuriat (IAE)", ecart:"À développer : gérer le budget d'un produit", ok:false},
    {lib:"Digital santé, omnicanal, CRM (Veeva)", outils:["Omnicanal / digital santé", "CRM (Veeva, Salesforce)"], rx:/\b(omnicanal|omnichannel|digital|e-?commerce|crm|veeva|salesforce|social media|r[ée]seaux sociaux)\b/i,
     jai:"M2 Marketing Opérationnel et Digital ; outils marketing et podcasts", ecart:"Partiel : Veeva jamais utilisé", ok:false,
     phrase:"mon M2 Marketing Opérationnel et Digital m'a formée aux outils digitaux et omnicanaux"},
    {lib:"IA générative", outils:["IA générative"], rx:/\b(ia|intelligence artificielle|ai|genai|chatgpt|llm)\b/,
     jai:"DU Intelligence artificielle en santé (Université Paris-Saclay, en cours)", ecart:"Atout rare", ok:true,
     phrase:"je suis un DU Intelligence artificielle en santé à l'Université Paris-Saclay"},
    {lib:"Données de marché (IQVIA, GERS)", outils:["Données de marché (IQVIA, GERS…)"], rx:/\b(iqvia|gers|donn[ée]es de march[ée]|nielsen)\b/i,
     jai:"Pas encore utilisées", ecart:"À demander en alternance", ok:false},
  ];

  const texteOffre = o => [o.intitule, o.extrait, o.description, (o.competences || []).join(" "), (o.outils || []).join(" ")].join(" \n ");

  function demande(o, l) {
    if ((l.outils || []).some(x => (o.outils || []).includes(x))) return true;
    if ((l.comp || []).some(x => (o.competences || []).some(c => c.startsWith(x)))) return true;
    // Offre sans repérage France Travail (VIE) : on lit l'intitulé et l'extrait
    if (!o.outils && l.rx) return l.rx.test(texteOffre(o));
    return false;
  }

  const SECTEURS = [
    [/v[ée]t[ée]rin|sant[ée] animale|animal|equine|[ée]quin/i, "santé animale"],
    [/cosm[ée]t|dermo|beaut/i, "cosmétique"],
    [/nutrition|compl[ée]ment|food|agroalimentaire|nutraceut/i, "nutrition-santé"],
    [/dispositif|medtech|implant|dentaire|perfusion|monitoring|\bdm\b|chirurg|diagnostic|ivd/i, "dispositifs médicaux"],
    [/pharma|m[ée]dicament|laborato|oncolog|biotech|therap|sanofi|servier|ipsen|astrazeneca|ucb|biocodex|mayoly/i, "pharmaceutique"],
  ];
  const secteur = o => (SECTEURS.find(([rx]) => rx.test(texteOffre(o) + " " + (o.entreprise || "") + " " + (o.secteur || ""))) || [null, "santé"])[1];

  function analyser(o) {
    const forces = [], ecarts = [], atouts = [];
    for (const l of LIGNES) {
      if (demande(o, l)) (l.ok ? forces : ecarts).push(l);
      else if (l.ok && ["Lancement de produit", "Réglementaire (AMM, ANSM, HAS)", "IA générative"].includes(l.lib)) atouts.push(l);
    }
    const exp = o.exp_ans;
    if (exp != null && exp > 2) ecarts.unshift({lib:`Expérience : ${exp} ans demandés`, jai:"Deux années d'alternance chez Théa (filiale puis Global)", ecart:"À compenser : présenter l'alternance comme une vraie expérience"});
    const nb = forces.length + ecarts.length;
    return {forces, ecarts, atouts, score: nb ? Math.round(100 * forces.length / nb) : null, secteur: secteur(o)};
  }

  function lettre(o) {
    const a = analyser(o);
    const vie = /vie/i.test(o.type || "") || o.source === "vie";
    let poste = (o.intitule || "").replace(/[\s(–-]*\b(H\s*\/\s*F|F\s*\/\s*H|M\s*\/\s*F)(\s*\/\s*[XD])?\b\)?/gi, " ")
      .replace(/[\s\-–(]+$/g, "").replace(/\s{2,}/g, " ").trim();
    if (poste === poste.toUpperCase()) poste = poste.charAt(0) + poste.slice(1).toLowerCase();  // MAJUSCULES -> phrase
    const ent = o.entreprise && !/non communiqu/i.test(o.entreprise) ? o.entreprise : "votre entreprise";
    const chez = ent === "votre entreprise" ? "au sein de votre entreprise" : `chez ${ent}`;
    const intl = vie || /international|global|export|europe|filiales?|pays/i.test(texteOffre(o));
    const lieu = (o.lieu || "").trim();
    // La lettre : une accroche liée au SECTEUR de l'offre, puis ce que l'annonce demande face à
    // ce que j'ai déjà fait, mon parcours, et une fin courte. Aucun point faible : les écarts
    // servent à préparer l'oral (fiche « Plus d'infos »), pas à la lettre.
    const libs = a.forces.map(l => l.lib);
    const lance = libs.includes("Lancement de produit");
    const pour = `${vie ? "pour la mission de V.I.E" : "pour le poste"} « ${poste} » ${chez}${lieu ? ` (${lieu})` : ""}`;
    const ACCROCHES = {
      "dispositifs médicaux": `Un dispositif médical ne se vend pas sur une promesse : il se vend sur la preuve, auprès de professionnels de santé exigeants. Traduire une donnée scientifique en message clair pour des praticiens, c'est ce que je fais chaque jour comme alternante cheffe de produit Global aux Laboratoires Théa. C'est cette exigence que je souhaite mettre au service de votre gamme, ${pour}.`,
      "santé animale": `La santé animale demande la même rigueur scientifique que la santé humaine, avec un interlocuteur de plus : celui qui prend soin de l'animal. Formée à la pharmacologie, jusqu'aux travaux pratiques en animalerie, et aujourd'hui alternante cheffe de produit Global aux Laboratoires Théa, je vous propose ma candidature ${pour}.`,
      "cosmétique": `Un produit dermo-cosmétique doit convaincre deux fois : le professionnel par la preuve, le consommateur par l'envie. Chez Théa France, j'ai participé au lancement d'un médicament et d'un complément alimentaire : deux produits, deux publics, deux façons de raconter. C'est cette double lecture que je vous propose ${pour}.`,
      "nutrition-santé": `La nutrition-santé se joue à la frontière du médicament et de la grande consommation : il faut la rigueur de la preuve et l'envie du consommateur. Chez Théa France, j'ai participé au lancement d'un médicament et d'un complément alimentaire. C'est cette double expérience que je vous propose ${pour}.`,
      "pharmaceutique": lance
        ? `Un médicament du glaucome, quatre pays, trente-cinq filiales, un seul lancement à réussir : c'est mon quotidien d'alternante cheffe de produit Global aux Laboratoires Théa. C'est cette expérience que je vous propose ${pour}.`
        : `Faire connaître un médicament, c'est d'abord le comprendre. J'ai appris la pharmacologie avant le marketing, et je mets aujourd'hui les deux en pratique comme alternante cheffe de produit Global aux Laboratoires Théa. C'est ce double regard que je vous propose ${pour}.`,
    };
    // L'accroche part de la FONCTION du poste (lue dans l'intitulé) : accès au marché, digital,
    // commercial ; pour le marketing produit et les affaires médicales, elle part du secteur.
    const fn = o.fonctions || [];
    const publiques = /policy|public affairs|affaires publiques|external affairs|government/i.test(o.intitule || "");
    const PAR_FONCTION = {
      "accès au marché": publiques
        ? `Les décisions de santé se construisent avec les autorités, les professionnels et les patients : c'est là que se joue l'accès d'un traitement à ceux qui en ont besoin. Chez Théa France, j'ai découvert l'évaluation par la HAS et la fixation du prix par le CEPS, et je creuse aujourd'hui ces sujets avec une UE d'évaluation médico-économique au Cnam. C'est ce regard que je vous propose ${pour}.`
        : `Un médicament n'atteint ses patients qu'une fois évalué, remboursé et à un prix juste. Chez Théa France, j'ai découvert cette étape décisive (l'évaluation par la HAS, la fixation du prix par le CEPS), et je la creuse aujourd'hui avec une UE d'évaluation médico-économique au Cnam. C'est ce double regard, scientifique et économique, que je vous propose ${pour}.`,
      "digital": `Un produit de santé se choisit de plus en plus en ligne, mais il se vend toujours sur la confiance. Mon M2 Marketing Opérationnel et Digital m'a formée aux outils digitaux et omnicanaux ; mon alternance de cheffe de produit aux Laboratoires Théa m'a appris ce qu'exige la communication sur un produit de santé. C'est cette double compétence que je vous propose ${pour}.`,
      "commercial": `Un argumentaire ne vaut que s'il tient face aux questions du terrain. Chez Théa France, j'ai préparé les argumentaires et les réponses aux objections des équipes de vente, après une immersion sur le terrain à leurs côtés. C'est ce lien entre le marketing et la vente que je vous propose ${pour}.`,
    };
    // La fonction la plus précise d'abord ; « commercial » ne l'emporte pas sur le marketing produit
    const cle = ["accès au marché", "digital"].find(f => fn.includes(f))
      || (fn.includes("commercial") && !fn.includes("marketing") ? "commercial" : null);
    const METIER = cle ? PAR_FONCTION[cle] : null;
    const p = [];
    p.push(`Madame, Monsieur,`);
    p.push(METIER || ACCROCHES[a.secteur] || `J'ai appris la pharmacologie avant le marketing : je sais ce qu'il y a derrière un produit de santé, et je sais le faire connaître. Alternante cheffe de produit Global aux Laboratoires Théa, je vous propose ce double regard ${pour}.`);
    // Ce que l'annonce demande, dans l'ordre du métier (le produit d'abord, les outils ensuite)
    const ORDRE = ["Lancement de produit", "Plan marketing, stratégie de marque", "Veille, besoins clients, connaissance produit",
      "Études de marché, insights", "Réglementaire (AMM, ANSM, HAS)", "Digital santé, omnicanal, CRM (Veeva)", "Compliance, conformité",
      "Excel, Power BI, tableaux de bord", "Anglais", "IA générative"];
    const rang = l => { const i = ORDRE.indexOf(l.lib); return i < 0 ? 99 : i; };
    const dejaDit = a.secteur === "pharmaceutique" && lance ? "Lancement de produit" : "";
    const demandes = a.forces.filter(l => l.phrase && l.lib !== dejaDit).sort((x, y) => rang(x) - rang(y)).slice(0, 3);
    if (demandes.length) p.push(`Ce que vous recherchez, et ce que j'ai déjà fait :\n` + demandes.map(l => `— ${l.lib} : ${l.phrase}.`).join("\n"));
    p.push(`Mon parcours sort du marketing classique : licence de pharmacologie, master Biologie Santé « Produits de santé et innovation », puis M2 Marketing Opérationnel et Digital à l'IAE Clermont Auvergne. ${intl ? "Entre le siège et les filiales, j'ai appris qu'un même message ne se dit pas de la même façon d'un pays à l'autre." : "Je parle le langage des professionnels de santé comme celui des équipes de vente, et je fais le lien entre les deux."}`);
    p.push(`Pourquoi ${ent === "votre entreprise" ? "vous" : ent} ? [À COMPLÉTER : un produit, une gamme, une actualité ou un choix de l'entreprise qui t'a vraiment marquée, et ce que tu en penses. C'est la phrase qui fera la différence : elle ne peut venir que de toi.]`);
    p.push(`${vie ? "Prête à partir à l'étranger" : "Mobile en France et à l'international"} à partir de septembre 2027, je serais ravie d'en parler avec vous : vingt minutes suffiront pour vous montrer ce que je peux apporter à votre équipe.`);
    p.push(`Bien à vous,`);
    p.push(`Loubna BENMAHMOUD`);
    const c = coordonnees();
    const tete = `Loubna BENMAHMOUD\nClermont-Ferrand · ${c.tel || "[téléphone]"} · ${c.mail || "[e-mail]"}\n\n${ent === "votre entreprise" ? "[Nom de l'entreprise]" : ent}\n[Service / nom du recruteur]\n\nClermont-Ferrand, le ${new Date().toLocaleDateString("fr-FR")}\n\nObjet : candidature ${vie ? "V.I.E" : "au poste"} « ${poste} »`;
    return tete + "\n\n" + p.join("\n\n");
  }

  // Mes coordonnées : gardées dans CE navigateur seulement (localStorage), jamais publiées sur le site
  const CLE_COORD = "avenir-coordonnees";
  function coordonnees() { try { return JSON.parse(localStorage.getItem(CLE_COORD)) || {}; } catch (e) { return {}; } }
  function garderCoordonnees(c) { try { localStorage.setItem(CLE_COORD, JSON.stringify(c)); } catch (e) {} }

  // ---- Veille sur l'entreprise ou l'association, avant l'entretien ----
  // Données publiques de l'État (API Recherche d'entreprises, sans clé) + liens de recherche prêts.
  // Seul le NOM de l'organisation est envoyé : aucune donnée personnelle.
  const EFFECTIF = {"00":"0 salarié","01":"1 à 2","02":"3 à 5","03":"6 à 9","11":"10 à 19","12":"20 à 49","21":"50 à 99","22":"100 à 199",
    "31":"200 à 249","32":"250 à 499","41":"500 à 999","42":"1 000 à 1 999","51":"2 000 à 4 999","52":"5 000 à 9 999","53":"10 000 et plus"};
  const AXES = {
    entreprise: ["<b>Ce qu'elle fait</b> : ses produits phares, ses marques, ses aires thérapeutiques",
      "<b>Sa taille</b> : chiffre d'affaires, effectif, groupe auquel elle appartient",
      "<b>Son actualité</b> des 6 derniers mois : lancements, rachats, résultats, nominations",
      "<b>Son marché</b> : ses concurrents, ce qui la distingue",
      "<b>Sa culture</b> : valeurs, engagements RSE, avis de salariés",
      "<b>Le poste</b> : l'équipe, à qui je reporterais, pourquoi le poste est ouvert"],
    cabinet: ["<b>C'est un cabinet ou une agence</b> : demander pour quel laboratoire ou quelle marque il recrute",
      "<b>Le client final</b> : une fois connu, faire la veille sur lui (produits, actualité, taille)",
      "<b>Le cabinet</b> : sa spécialité (santé ?), le consultant qui suit le poste"],
    association: ["<b>Sa mission</b> : la cause, les publics aidés, depuis quand",
      "<b>Ses actions récentes</b> : événements, campagnes, résultats",
      "<b>Son organisation</b> : bénévoles, salariés, financement (dons, subventions)",
      "<b>Ce que je peux apporter</b> : une mission concrète, avec un résultat à raconter en entretien"],
  };
  // Grands secteurs de l'INSEE (lettre de la nomenclature NAF)
  const SECTION = {A:"Agriculture",B:"Industries extractives",C:"Industrie",D:"Énergie",E:"Eau, déchets",F:"Construction",G:"Commerce",H:"Transports",I:"Hébergement, restauration",
    J:"Information, communication",K:"Finance, assurance",L:"Immobilier",M:"Conseil, sciences, techniques",N:"Services aux entreprises (dont intérim, recrutement)",O:"Administration publique",
    P:"Enseignement",Q:"Santé humaine, action sociale",R:"Arts, spectacles, loisirs",S:"Autres services (dont associations)",T:"Ménages",U:"Organismes extraterritoriaux"};
  const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  // Wikipédia : seulement une page dont le titre commence par le nom cherché (pas d'homonyme au hasard)
  async function wikipedia(nom) {
    const api = "https://fr.wikipedia.org/w/api.php?format=json&origin=*&";
    const s = await (await fetch(api + "action=opensearch&namespace=0&limit=5&search=" + encodeURIComponent(nom))).json();
    const titre = (s[1] || []).find(t => norm(t).startsWith(norm(nom)) && norm(nom).length >= 3);
    if (!titre) return null;
    const r = await (await fetch(api + "action=query&prop=extracts|info|pageprops&exintro=1&explaintext=1&exsentences=4&inprop=url&redirects=1&titles=" + encodeURIComponent(titre))).json();
    const page = Object.values((r.query || {}).pages || {})[0];
    if (!page || !page.extract || (page.pageprops && "disambiguation" in page.pageprops)) return null;
    return { titre: page.title, texte: page.extract, url: page.fullurl };
  }
  async function veille(zone, nom, type) {
    const q = encodeURIComponent(nom), cle = type === "association" ? "association" : type === "cabinet" ? "cabinet" : "entreprise";
    zone.innerHTML = `<h4>🔎 Veille : ${esc(nom)}</h4><p class="note">Recherche en cours dans l'annuaire officiel et sur Wikipédia…</p>`;
    // Ses autres offres en ce moment, dans mes données France Travail
    const D0 = typeof Commun !== "undefined" && Commun.D;
    const autres = D0 ? D0.offres.filter(o => o.entreprise && norm(o.entreprise) === norm(nom)) : [];
    const [annu, wiki] = await Promise.all([
      fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${q}&per_page=8&etat_administratif=A`).then(r => r.json()).catch(() => null),
      wikipedia(nom).catch(() => null)]);
    // Pas les entrepreneurs individuels homonymes ; d'abord les structures qui ont des salariés et des comptes publiés
    const poids = x => (x.finances ? 2 : 0) + (EFFECTIF[x.tranche_effectif_salarie] ? 1 : 0) + (norm(x.nom_complet).startsWith(norm(nom)) ? 2 : 0);
    const res = ((annu && annu.results) || []).filter(x => x.nature_juridique !== "1000").sort((a, b) => poids(b) - poids(a)).slice(0, 2);
    const fiches = res.map(x => {
      const an = x.finances && Object.keys(x.finances).sort().pop(), ca = an && x.finances[an].ca;
      const dir = (x.dirigeants || []).filter(d => d.nom).slice(0, 2).map(d => [d.prenoms && d.prenoms.split(" ")[0], d.nom, d.qualite ? `(${d.qualite.toLowerCase()})` : ""].filter(Boolean).join(" "));
      const tuiles = [
        ["🏭", "Activité", SECTION[x.section_activite_principale] || "—"],
        ["📍", "Siège", (x.siege && x.siege.libelle_commune) || "—"],
        ["📅", "Créée en", x.date_creation ? x.date_creation.slice(0, 4) : "—"],
        ["👥", "Salariés", EFFECTIF[x.tranche_effectif_salarie] || "non publié"],
        ["💶", ca ? `Chiffre d'affaires ${an}` : "Chiffre d'affaires", ca ? (ca / 1e6).toLocaleString("fr-FR", {maximumFractionDigits: 1}) + " M€" : "non publié"],
        ["🏷️", "Taille", {PME: "PME", ETI: "Entreprise de taille intermédiaire", GE: "Grande entreprise"}[x.categorie_entreprise] || "—"],
      ];
      return `<div class="veille-fiche"><b><a href="https://annuaire-entreprises.data.gouv.fr/entreprise/${esc(x.siren)}" target="_blank" rel="noopener">${esc(x.nom_complet)}</a></b>
        <div class="veille-tuiles">${tuiles.map(([i, l, v]) => `<span><i>${i}</i><small>${esc(l)}</small>${esc(v)}</span>`).join("")}</div>
        ${dir.length ? `<p class="note" style="margin:6px 0 0">Dirigeants : ${esc(dir.join(" · "))}</p>` : ""}</div>`;
    }).join("");
    zone.innerHTML = `<h4>🔎 Veille : ${esc(nom)}</h4>
      ${wiki ? `<div class="veille-wiki"><b>📖 ${esc(wiki.titre)}</b><p>${esc(wiki.texte)}</p><a href="${esc(wiki.url)}" target="_blank" rel="noopener">Lire la suite sur Wikipédia →</a></div>` : ""}
      ${fiches ? `<p class="note" style="margin:10px 0 6px">🏛️ L'annuaire officiel des entreprises (homonymes possibles : vérifie que c'est la bonne)</p>${fiches}` : `<p class="note">Rien trouvé dans l'annuaire officiel sous ce nom.</p>`}
      ${autres.length > 1 ? `<p class="note" style="margin:10px 0 4px">📋 Ses ${autres.length} offres en ce moment sur France Travail :</p><ul class="oral">${autres.slice(0, 6).map(o => `<li>${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.intitule)}</a>` : esc(o.intitule)} <span class="note">· ${esc(o.lieu || "")}</span></li>`).join("")}</ul>` : ""}
      <h4>À préparer avant l'entretien</h4><ul class="oral">${AXES[cle].map(x => `<li>${x}</li>`).join("")}</ul>`;
  }
  // Une fenêtre avec la seule veille (page bénévolat)
  let boiteV;
  function ouvrirVeille(nom, type) {
    if (!boiteV) {
      boiteV = document.createElement("dialog"); boiteV.className = "fiche"; document.body.appendChild(boiteV);
      boiteV.addEventListener("click", e => { if (e.target === boiteV) boiteV.close(); });
    }
    boiteV.innerHTML = `<div class="fiche-tete"><div></div><button class="fermer" aria-label="Fermer">×</button></div><div class="veille"></div>`;
    boiteV.querySelector(".fermer").onclick = () => boiteV.close();
    veille(boiteV.querySelector(".veille"), nom, type);
    boiteV.showModal();
  }

  // Les points à préparer pour l'entretien, à partir des forces et des écarts
  function oral(o, a) {
    const ent = o.entreprise && !/non communiqu/i.test(o.entreprise) ? esc(o.entreprise) : "l'entreprise";
    const pts = [`<b>Mon pitch en 30 secondes</b> : un profil scientifique (pharmacologie, master Produits de santé) spécialisé en marketing opérationnel et digital, deux ans chez Théa, de la filiale France au Global.`];
    a.forces.slice(0, 3).forEach(l => pts.push(`<b>Raconter un exemple — ${esc(l.lib.toLowerCase())}</b> : ${esc(l.jai)}. Situation, action, résultat, avec un chiffre si possible.`));
    a.ecarts.slice(0, 2).forEach(l => pts.push(`<b>Préparer ma réponse — ${esc(l.lib.toLowerCase())}</b> : ${esc(l.ecart)}. Reconnaître l'écart, puis montrer ce que je fais déjà pour le combler.`));
    if (o.source === "vie") pts.push(`<b>Le VIE</b> : pourquoi l'international, pourquoi ce pays, ce que mon poste Global chez Théa m'a appris du travail avec les filiales.`);
    pts.push(`<b>Pourquoi ${ent} ?</b> Un produit, une gamme ou une actualité de ${ent} à citer : à chercher sur son site et sur LinkedIn avant l'entretien.`);
    return pts;
  }

  // ---- La fiche « Plus d'infos » ----
  let boite;
  function ouvrir(o) {
    if (!boite) {
      boite = document.createElement("dialog");
      boite.className = "fiche";
      document.body.appendChild(boite);
      boite.addEventListener("click", e => { if (e.target === boite) boite.close(); });
    }
    const a = analyser(o);
    const puce = (l, cls) => `<li class="${cls}"><b>${esc(l.lib)}</b><span>${esc(cls === "force" ? l.jai : l.ecart)}</span></li>`;
    const meta = [o.entreprise, o.lieu, o.contratLib || o.contrat, o.duree, o.experience].filter(Boolean).map(esc).join(" · ");
    boite.innerHTML = `
      <div class="fiche-tete"><div><h3>${esc(o.intitule)}</h3><p class="note">${meta}</p></div>
        <button class="fermer" aria-label="Fermer">×</button></div>
      ${a.score != null ? `<div class="jauge"><div style="width:${a.score}%"></div></div>
        <p class="note">Sur les ${a.forces.length + a.ecarts.length} points que cite l'annonce, j'en couvre <b>${a.forces.length}</b> (${a.score} %). Secteur repéré : ${esc(a.secteur)}.</p>`
        : `<p class="note">L'annonce ne cite aucun des points que je suis : lis-la pour juger.</p>`}
      <div class="fiche-cols">
        <div><h4>Mes forces pour cette offre</h4><ul>${a.forces.map(l => puce(l, "force")).join("") || "<li class='vide-l'>Aucune repérée automatiquement.</li>"}</ul>
          ${a.atouts.length ? `<h4>Mes atouts en plus, à mettre en avant</h4><ul>${a.atouts.map(l => puce(l, "force")).join("")}</ul>` : ""}</div>
        <div><h4>À renforcer</h4><ul>${a.ecarts.map(l => puce(l, "ecart")).join("") || "<li class='vide-l'>Rien à signaler.</li>"}</ul></div>
      </div>
      <h4>À valoriser à l'oral</h4>
      <ul class="oral">${oral(o, a).map(x => `<li>${x}</li>`).join("")}</ul>
      <p class="note">Repérage automatique sur ${o.outils ? "les outils et compétences de l'annonce (France Travail)" : "l'intitulé et le début de l'annonce"} : il peut se tromper, l'annonce complète fait foi.</p>
      <details class="coord"><summary>Mes coordonnées pour la lettre</summary>
        <div class="vie-filtres" style="margin-top:8px"><input type="tel" data-c="tel" placeholder="Téléphone">
          <input type="email" data-c="mail" placeholder="E-mail" style="flex:1 1 220px"></div>
        <p class="note">Gardées dans ce navigateur seulement : elles ne sont pas publiées sur le site.</p></details>
      <div class="fiche-actions">
        ${o.url ? `<a class="bouton secondaire" href="${esc(o.url)}" target="_blank" rel="noopener">Lire l'annonce</a>` : ""}
        ${/non communiqu/i.test(o.entreprise || "non communiqué") ? "" : `<button class="bouton secondaire" data-action="veille">🔎 Veille sur l'entreprise</button>`}
        <button class="bouton" data-action="lettre">Générer ma lettre de motivation</button>
      </div>
      <div class="veille" hidden></div>
      <div class="lettre" hidden>
        <textarea rows="18"></textarea>
        <div class="fiche-actions"><button class="bouton" data-action="copier">Copier</button>
          <button class="bouton secondaire" data-action="telecharger">Télécharger (.txt)</button></div>
        <p class="note">Brouillon : relis-le, remplace les [crochets] et adapte-le avant de l'envoyer. Rien n'est envoyé : la lettre est écrite dans ton navigateur.</p>
      </div>`;
    boite.querySelector(".fermer").onclick = () => boite.close();
    const zone = boite.querySelector(".lettre"), ta = zone.querySelector("textarea");
    const bv = boite.querySelector('[data-action="veille"]');
    if (bv) bv.onclick = () => { const z = boite.querySelector(".veille"); z.hidden = false; bv.disabled = true;
      veille(z, o.entreprise, o.intermediaire ? "cabinet" : "entreprise").then(() => z.scrollIntoView({behavior: "smooth", block: "nearest"})); };
    const c0 = coordonnees();
    const champs = [...boite.querySelectorAll("[data-c]")];
    champs.forEach(i => { i.value = c0[i.dataset.c] || ""; i.oninput = () => {
      garderCoordonnees(Object.fromEntries(champs.map(x => [x.dataset.c, x.value.trim()])));
      if (!zone.hidden) ta.value = lettre(o); }; });
    if (!c0.tel && !c0.mail) boite.querySelector("details.coord").open = true;
    boite.querySelector('[data-action="lettre"]').onclick = () => { ta.value = lettre(o); zone.hidden = false; ta.scrollIntoView({behavior:"smooth", block:"nearest"}); };
    zone.querySelector('[data-action="copier"]').onclick = async e => {
      try { await navigator.clipboard.writeText(ta.value); e.target.textContent = "Copiée ✓"; } catch { ta.select(); document.execCommand("copy"); e.target.textContent = "Copiée ✓"; }
    };
    zone.querySelector('[data-action="telecharger"]').onclick = () => {
      const nom = "lettre_" + (o.entreprise || "offre").toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") + ".txt";
      const lien = Object.assign(document.createElement("a"), {href: URL.createObjectURL(new Blob([ta.value], {type:"text/plain;charset=utf-8"})), download: nom});
      lien.click(); URL.revokeObjectURL(lien.href);
    };
    boite.showModal();
  }

  window.Profil = {LIGNES, analyser, lettre, ouvrir, ouvrirVeille, esc};
})();
