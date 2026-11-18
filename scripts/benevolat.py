r"""Veille bénévolat : chaque jour, les nouvelles missions de JeVeuxAider.gouv.fr, triées selon
mes thèmes (marketing digital, intelligence artificielle, mon profil santé), dans data/benevolat/.

Comment, et ce que le site permet :
    - JeVeuxAider n'a pas d'API ouverte (l'API Engagement, qui diffuse ses missions, demande une
      clé accordée aux partenaires) ;
    - son robots.txt interdit aux robots la recherche (adresses avec « ? »), demande 10 secondes
      entre deux pages, et signale son plan du site (sitemap), fait pour les robots ;
    - ce plan du site liste TOUTES les missions en ligne (une adresse par mission).
    Le script lit donc le plan du site, repère les missions qu'il n'a pas encore lues (les plus
    récentes d'abord), ouvre chacune — une page toutes les 10 secondes, au plus MAX_PAGES par
    jour — et lit son titre, son association, son lieu, ses activités et sa description.
    Une mission reste affichée tant qu'elle figure dans le plan du site.
    Il relève aussi, sur les pages par activité, le nombre de missions disponibles (les tuiles).

Usage :
    .venv\Scripts\python.exe scripts\benevolat.py            (300 missions au plus)
    set BENEVOLAT_MAX=30 && .venv\Scripts\python.exe scripts\benevolat.py

Ce que ça écrit :
    data/benevolat/benevolat.json   les missions dans mes thèmes, et les autres lues depuis 7 jours
    data/benevolat/lues.txt         les numéros de missions déjà lues (pour ne pas les relire)
    data/benevolat/serie.csv        une ligne par jour et par activité : missions disponibles
"""
import csv
import html
import json
import os
import re
import sys
import time
import urllib.request
from datetime import date, timedelta
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DOSSIER = RACINE / "data" / "benevolat"
SITE = "https://www.jeveuxaider.gouv.fr"
PLAN = SITE + "/__sitemap__/missions.xml"
PAUSE = 10                                        # secondes entre deux pages (Crawl-delay du robots.txt)
MAX_PAGES = int(os.environ.get("BENEVOLAT_MAX", "300"))   # ~50 minutes par jour
GARDER_AUTRES_JOURS = 7                           # missions hors de mes thèmes : gardées une semaine
ENTETE = {"User-Agent": "Mozilla/5.0 (veille-benevolat ; projet etudiant IAE Clermont)"}

# Pages par activité : seulement pour compter les missions disponibles (les tuiles de la page)
ACTIVITES = {
    "communication": "Communication",
    "informatique": "Informatique et numérique",
    "gestion-de-projets": "Gestion de projets",
    "evenementiel": "Événementiel",
    "actions-de-sensibilisation": "Actions de sensibilisation",
    "ecoute-aide-psychologique": "Écoute et aide psychologique",
    "soins-aux-animaux": "Soins aux animaux",
    "medical": "Médical",
}

# Mes thèmes. Deux niveaux de mots-clés, pour ne pas ratisser trop large :
#   - TITRE : cherchés dans le titre de la mission et ses activités (ce qu'on y fait vraiment) ;
#   - FORT  : assez précis pour être cherchés aussi dans la description complète.
THEMES = {
    "marketing digital": {
        "titre": re.compile(
            r"digital|marketing|r[ée]seaux sociaux|site (internet|web)|\bweb\b|wordpress|community manag|instagram|facebook"
            r"|linkedin|tiktok|newsletter|e-?mailing|\bseo\b|contenus?|graphis\w*|infographi\w*|identit[ée] visuelle|canva"
            r"|vid[ée]os?|communication|faire conna[iî]tre|promotion|promouvoir|visibilit", re.IGNORECASE),
        "fort": re.compile(
            r"marketing digital|r[ée]seaux sociaux|community manag\w*|wordpress|newsletter|\bseo\b|cr[ée]ation de contenus?"
            r"|strat[ée]gie de communication|plan de communication|communication digitale|site internet", re.IGNORECASE)},
    "marketing produit": {
        "titre": re.compile(
            r"marketing|chef de produit|lancement|[ée]tudes? de march[ée]|positionnement|image de marque|\bmarque\b|packaging"
            r"|commercialis\w*|boutique|vente solidaire|business plan|mod[èe]le [ée]conomique|offre de services", re.IGNORECASE),
        "fort": re.compile(
            r"strat[ée]gie marketing|plan marketing|[ée]tudes? de march[ée]|lancement d.un (produit|nouveau)|image de marque"
            r"|business plan|positionnement", re.IGNORECASE)},
    "intelligence artificielle": {
        "titre": re.compile(r"intelligence artificielle|\bIA\b|\bchatgpt\b|IA g[ée]n[ée]rative"),
        "fort": re.compile(r"intelligence artificielle|IA g[ée]n[ée]rative|\bchatgpt\b", re.IGNORECASE)},
    # La santé au sens large : mentale, animale et vétérinaire, féminine, prévention, maladies, biologie…
    "santé": {
        "titre": re.compile(
            r"sant[ée]|psych\w*|bipol\w*|d[ée]pression|[ée]coute|addict\w*|suicid\w*|animaux|animal|chevaux|cheval|\b[ée]quin"
            r"|v[ée]t[ée]rinaire|refuge|faune|patients?|malad\w*|cancer|h[ôo]pital|hospitalis\w*|biolog\w*|handicap\w*"
            r"|m[ée]dical|pr[ée]vention|d[ée]pistage|don du sang|sciences de la vie|femmes?|p[ée]rinat\w*|maternit\w*"
            r"|endom[ée]triose|nutrition|alimentation|bien-[êe]tre|seniors?|aidants?|alzheimer|autisme|diab[èe]te", re.IGNORECASE),
        "fort": re.compile(r"sant[ée] mentale|v[ée]t[ée]rinaire|premiers secours|sant[ée] des femmes|pr[ée]vention sant[ée]", re.IGNORECASE)},
    "événementiel": {
        "titre": re.compile(
            r"[ée]v[ée]nement\w*|festival|salon|forum|f[êe]te|gala|concert|soir[ée]e|spectacle|course|marathon|tournoi"
            r"|journ[ée]e (de|du|des|mondiale|nationale)|semaine (de|du|des)|exposition|colloque|conf[ée]rence|t[ée]l[ée]thon", re.IGNORECASE),
        "fort": re.compile(r"[ée]v[ée]nementiel|organisation (d.un|de l.|des?) [ée]v[ée]nements?|festival", re.IGNORECASE)},
}
# Missions réservées aux soignants diplômés : pas pour moi
SOIGNANT = re.compile(r"m[ée]decin|infirmi|permanences? m[ée]dicales|kin[ée]|dentiste|psychologue", re.IGNORECASE)


def lire(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=ENTETE), timeout=60) as r:
        return r.read().decode("utf-8", errors="replace")


def plan_du_site():
    """{numéro de mission: adresse} pour toutes les missions en ligne."""
    xml = lire(PLAN)
    return {int(m.group(1)): m.group(0) for m in re.finditer(r"https://www\.jeveuxaider\.gouv\.fr/missions-benevolat/(\d+)/[^<\s]+", xml)}


def apres(lignes, repere, n=1):
    return lignes[lignes.index(repere) + n] if repere in lignes and lignes.index(repere) + n < len(lignes) else ""


def entre(lignes, debut, fins):
    if debut not in lignes:
        return []
    i = lignes.index(debut) + 1
    j = next((k for k in range(i, len(lignes)) if lignes[k] in fins), len(lignes))
    return lignes[i:j]


def lire_mission(ident, url):
    """Titre, association, lieu, activités, description d'une page de mission."""
    page = lire(url)
    titre = html.unescape(re.search(r"<title>([^<]*)</title>", page).group(1)).strip()
    corps = re.sub(r"<script.*?</script>|<style.*?</style>", "", page, flags=re.S)
    lignes = [l.strip() for l in html.unescape(re.sub(r"<[^>]+>", "\n", corps)).split("\n") if l.strip()]
    # Le bas de page liste toutes les activités du site : on coupe avant
    if "Les activités bénévoles" in lignes:
        lignes = lignes[:lignes.index("Les activités bénévoles")]
    fins = {"Public aidé", "Publics aidés", "Mission ouverte", "Mission fermée", "Aux bénévoles majeurs", "Mission sur le terrain", "Mission à distance"}
    activites = entre(lignes, "Activités", fins) or entre(lignes, "Activité", fins)
    adresse = apres(lignes, "📍")
    m = re.search(r"\b\d{5}\s+(.+)$", adresse)
    ville = m.group(1) if m else ("À distance" if any("distance" in l.lower() for l in lignes[:80]) else adresse)
    description = " ".join(entre(lignes, "Présentation de la mission", {"Sautez le pas", "Précisions", "Découvrez"}))
    return {"id": str(ident), "titre": titre, "url": url, "domaine": apres(lignes, "Missions de bénévolat"),
            "organisation": apres(lignes, "Publié par", 3), "ville": ville,
            "a_distance": any(l == "Mission à distance" for l in lignes),
            "activites": activites, "extrait": description[:400],
            "frequence": " ".join(entre(lignes, "Durée de la mission", {"Engagement souhaité :", "Chargement..."}))[:80],
            "texte": " ".join([titre] + activites + [description])}


def themes_de(m):
    # Le titre d'abord ; pour la santé, les activités du soin (écoute, animaux, médical) comptent aussi ;
    # la description complète n'est lue qu'avec les mots-clés « forts », plus précis.
    # Le domaine « Santé pour tous » du site range aussi la mission dans la santé.
    sante_act = [a for a in m["activites"] if re.search(r"psycholog|animaux|m[ée]dical|sant", a, re.I)]
    court = {"santé": " ".join([m["titre"]] + sante_act)}
    th = [nom for nom, rx in THEMES.items() if rx["titre"].search(court.get(nom, m["titre"])) or rx["fort"].search(m.get("texte") or "")]
    if "Santé" in (m.get("domaine") or "") and "santé" not in th:
        th.append("santé")
    if SOIGNANT.search(m["titre"]):
        th = [x for x in th if x != "santé"]
    return th


def compter_activites():
    """Missions disponibles par activité (le nombre affiché en haut de chaque page d'activité)."""
    bilan = []
    for i, (cle, libelle) in enumerate(ACTIVITES.items()):
        if i:
            time.sleep(PAUSE)
        try:
            texte = re.sub(r"<[^>]+>", " ", lire(f"{SITE}/activites/{cle}"))
            m = re.search(r"parmi les ([\d\s  ]+) missions", html.unescape(texte))
            total = int(re.sub(r"\D", "", m.group(1))) if m else None
        except Exception as e:
            print(f"  {libelle} : échec ({e.__class__.__name__})", file=sys.stderr)
            total = None
        bilan.append({"activite": libelle, "cle": cle, "disponibles": total})
        print(f"  {libelle} : {total} missions disponibles")
    return bilan


def main():
    DOSSIER.mkdir(parents=True, exist_ok=True)
    jour = date.today().isoformat()
    fichier, fichier_lues = DOSSIER / "benevolat.json", DOSSIER / "lues.txt"
    ancien = json.loads(fichier.read_text(encoding="utf-8")) if fichier.exists() else {"missions": []}
    lues = set(fichier_lues.read_text(encoding="utf-8").split()) if fichier_lues.exists() else set()

    plan = plan_du_site()
    print(f"Plan du site : {len(plan)} missions en ligne, {len(lues)} déjà lues")
    if not plan:
        sys.exit("Plan du site vide : le site a peut-être changé. data/benevolat/ n'est pas modifié.")

    # Missions déjà connues : on ne garde que celles encore en ligne (le format d'avant est abandonné)
    missions = {m["id"]: m for m in ancien.get("missions", []) if "texte" in m and int(m["id"]) in plan}

    # Les thèmes sont recalculés chaque jour : une règle modifiée s'applique aussi aux missions déjà lues
    for m in missions.values():
        m["themes"] = themes_de(m)
        m["pratique"] = bool(m["themes"])

    a_lire = [i for i in sorted(plan, reverse=True) if str(i) not in lues][:MAX_PAGES]
    print(f"À lire aujourd'hui : {len(a_lire)} nouvelles missions (les plus récentes d'abord)")
    nouvelles, echecs = 0, 0
    for k, ident in enumerate(a_lire):
        if k:
            time.sleep(PAUSE)
        try:
            m = lire_mission(ident, plan[ident])
        except Exception as e:
            echecs += 1
            print(f"  {ident} : échec ({e.__class__.__name__})", file=sys.stderr)
            if echecs >= 10:
                print("  10 échecs : le site ne répond plus, on reprendra demain", file=sys.stderr)
                break
            continue
        lues.add(str(ident))
        m["themes"] = themes_de(m)
        m["pratique"] = bool(m["themes"])
        m["premiere_fois"] = m["vue_le"] = jour
        missions[m["id"]] = m
        nouvelles += m["pratique"]
    print(f"Lues : {len(a_lire) - echecs}, dont {nouvelles} dans mes thèmes")

    bilan = compter_activites()

    limite = (date.today() - timedelta(days=GARDER_AUTRES_JOURS)).isoformat()
    liste = sorted((m for m in missions.values() if m["pratique"] or m["premiere_fois"] >= limite),
                   key=lambda m: (m["pratique"], int(m["id"])), reverse=True)
    resume = {"date": jour, "source": "jeveuxaider.gouv.fr — plan du site (sitemap) et pages publiques des missions",
              "en_ligne": len(plan), "lues_total": len(lues & {str(i) for i in plan}), "lues_aujourdhui": len(a_lire) - echecs,
              "activites": bilan, "nb_missions": len(liste), "nb_pratique": sum(m["pratique"] for m in liste),
              # texte complet (pour la recherche par mot) seulement pour les missions dans mes thèmes : fichier léger
              "missions": [{k: v for k, v in m.items() if k != "texte"} | {"texte": m["texte"][:1500] if m["pratique"] else ""} for m in liste]}
    fichier.write_text(json.dumps(resume, ensure_ascii=False, indent=1), encoding="utf-8")
    fichier_lues.write_text("\n".join(sorted(lues, key=int)), encoding="utf-8")

    serie = DOSSIER / "serie.csv"
    nouveau = not serie.exists()
    with serie.open("a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if nouveau:
            w.writerow(["date", "activite", "disponibles", "lues"])
        for b in bilan:
            w.writerow([jour, b["activite"], b["disponibles"], ""])
    print(f"Écrit : data/benevolat/benevolat.json — {len(liste)} missions, {resume['nb_pratique']} dans mes thèmes")


if __name__ == "__main__":
    main()
