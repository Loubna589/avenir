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
  const secteur = o => (SECTEURS.find(([rx]) => rx.test(texteOffre(o) + " " + (o.entreprise || ""))) || [null, "santé"])[1];

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
    const preuves = a.forces.filter(l => l.phrase).slice(0, 3).map(l => l.phrase);
    if (preuves.length < 2) preuves.push(...a.atouts.filter(l => l.phrase && !preuves.includes(l.phrase)).slice(0, 2 - preuves.length).map(l => l.phrase));
    const intl = vie || /international|global|export|europe|filiales?|pays/i.test(texteOffre(o));
    const lieu = (o.lieu || "").trim();
    const p = [];
    p.push(`Madame, Monsieur,`);
    p.push(`Actuellement en Master 2 Marketing Vente (parcours Marketing Opérationnel et Digital) à l'IAE Clermont Auvergne et en alternance en tant que cheffe de produit Glaucome Global aux Laboratoires Théa, je vous propose ma candidature ${vie ? "pour la mission de V.I.E" : "au poste"} « ${poste} » ${chez}${lieu ? ` (${lieu})` : ""}.`);
    p.push(`Mon profil associe une formation scientifique (licence de pharmacologie, master Biologie Santé « Produits de santé et innovation ») et une spécialisation en marketing opérationnel et digital. Cette double compétence est celle qu'attend le marketing ${a.secteur === "santé" ? "de la santé" : "dans le secteur " + a.secteur} : comprendre un produit en profondeur et savoir le faire connaître.`);
    if (preuves.length) p.push(`Concrètement, ${preuves.join(" ; ")}. ${intl ? "Travailler entre un siège et des filiales de plusieurs pays m'a appris à adapter un même projet à des marchés différents, une dimension internationale que je retrouve dans votre annonce." : "Ces expériences m'ont appris à relier la rigueur scientifique aux attentes du terrain."}`);
    if (a.ecarts.length) p.push(`Votre annonce mentionne aussi ${a.ecarts.slice(0, 2).map(l => l.lib.toLowerCase()).join(" et ")}. [À COMPLÉTER : montre comment tu comptes progresser sur ce point, avec un exemple concret.]`);
    p.push(`[À COMPLÉTER : pourquoi ${ent === "votre entreprise" ? "cette entreprise" : ent} ? Une phrase sur un produit, une gamme, une actualité ou une valeur que tu as repérée.]`);
    p.push(`${vie ? "Disponible pour partir à l'étranger" : "Mobile en France et à l'international, je suis disponible"} à partir de septembre 2027. Je serais heureuse de vous présenter ma motivation lors d'un entretien.`);
    p.push(`Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.`);
    p.push(`Loubna BENMAHMOUD`);
    const tete = `Loubna BENMAHMOUD\nClermont-Ferrand · [téléphone] · [e-mail]\n\n${ent === "votre entreprise" ? "[Nom de l'entreprise]" : ent}\n[Service / nom du recruteur]\n\nClermont-Ferrand, le ${new Date().toLocaleDateString("fr-FR")}\n\nObjet : candidature ${vie ? "V.I.E" : "au poste"} « ${poste} »`;
    return tete + "\n\n" + p.join("\n\n");
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
        <div><h4>Mes écarts</h4><ul>${a.ecarts.map(l => puce(l, "ecart")).join("") || "<li class='vide-l'>Aucun écart repéré.</li>"}</ul></div>
      </div>
      <h4>À valoriser à l'oral</h4>
      <ul class="oral">${oral(o, a).map(x => `<li>${x}</li>`).join("")}</ul>
      <p class="note">Repérage automatique sur ${o.outils ? "les outils et compétences de l'annonce (France Travail)" : "l'intitulé et le début de l'annonce"} : il peut se tromper, l'annonce complète fait foi.</p>
      <div class="fiche-actions">
        ${o.url ? `<a class="bouton secondaire" href="${esc(o.url)}" target="_blank" rel="noopener">Lire l'annonce</a>` : ""}
        <button class="bouton" data-action="lettre">Générer ma lettre de motivation</button>
      </div>
      <div class="lettre" hidden>
        <textarea rows="18"></textarea>
        <div class="fiche-actions"><button class="bouton" data-action="copier">Copier</button>
          <button class="bouton secondaire" data-action="telecharger">Télécharger (.txt)</button></div>
        <p class="note">Brouillon : relis-le, remplace les [crochets] et adapte-le avant de l'envoyer. Rien n'est envoyé : la lettre est écrite dans ton navigateur.</p>
      </div>`;
    boite.querySelector(".fermer").onclick = () => boite.close();
    const zone = boite.querySelector(".lettre"), ta = zone.querySelector("textarea");
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

  window.Profil = {LIGNES, analyser, lettre, ouvrir, esc};
})();
