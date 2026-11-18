r"""Veille bénévolat : lit chaque jour les missions de bénévolat de JeVeuxAider.gouv.fr
dans les activités proches de mon métier (communication, numérique, projets, santé…)
et les enregistre dans data/benevolat/.

Ce que le site permet, et ce que ce script respecte :
    - JeVeuxAider n'a pas d'API ouverte : l'API Engagement (beta.gouv) qui diffuse ses
      missions demande une clé, accordée aux partenaires sur demande ;
    - son fichier robots.txt interdit aux robots les adresses avec « ? » (la recherche
      complète) et demande 10 secondes entre deux pages ;
    - il autorise les pages par activité (/activites/communication…), qui affichent le
      nombre de missions disponibles et une sélection de missions.
    Le script ouvre donc ces pages-là seulement, dans un navigateur automatique
    (Playwright), une toutes les 10 secondes, et lit les cartes de mission affichées.

Usage :
    .venv\Scripts\python.exe scripts\benevolat.py

Ce que ça écrit :
    data/benevolat/benevolat.json   les missions vues, gardées 30 jours après leur dernière apparition
    data/benevolat/serie.csv        une ligne par jour et par activité : missions disponibles
"""
import csv
import json
import re
import sys
import time
from datetime import date, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright

RACINE = Path(__file__).resolve().parent.parent
DOSSIER = RACINE / "data" / "benevolat"
SITE = "https://www.jeveuxaider.gouv.fr"
PAUSE = 10  # secondes entre deux pages (Crawl-delay du robots.txt)
GARDER_JOURS = 30

# Activités suivies : celles où l'on trouve des missions de marketing digital et de communication
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

# Missions où je mets en pratique le marketing digital, en santé ou ailleurs (mots-clés sur l'intitulé et la carte)
THEMES = {
    "marketing digital": re.compile(
        r"digital|marketing|r[ée]seaux sociaux|site (internet|web)|\bweb\b|wordpress|community manag|instagram|facebook"
        r"|linkedin|tiktok|newsletter|e-?mailing|\bseo\b|cr[ée]ation de contenu|contenus? (num[ée]rique|en ligne|web)"
        r"|graphi|canva|montage vid[ée]o|strat[ée]gie de communication|communication|faire conna[iî]tre|visibilit", re.IGNORECASE),
    "intelligence artificielle": re.compile(r"intelligence artificielle|\bIA\b|\bchatgpt\b|\bIA g[ée]n[ée]rative", re.IGNORECASE),
    # En lien avec mon parcours : santé mentale (PSSM), animaux et vétérinaire (SOS Cheval), santé, biologie
    "mon profil santé": re.compile(
        r"sant[ée] mentale|psych\w*|bipol\w*|d[ée]pression|[ée]coute|addict\w*|souffrance|suicid\w*|animal|animaux|chevaux|cheval"
        r"|\b[ée]quin|v[ée]t[ée]rinaire|refuge|faune|sant[ée]|m[ée]dic\w*|patients?|maladie|cancer|handicap|biolog\w*|scienti\w*"
        r"|recherche m[ée]dicale|don du sang|pr[ée]vention|d[ée]pistage", re.IGNORECASE),
}

LIRE_CARTES = r"""() => [...document.querySelectorAll("a.stretched-link[href*='/missions-benevolat/']")].map(a => {
  let c = a;
  for (let i = 0; i < 8 && c.parentElement && c.innerText.length < 120; i++) c = c.parentElement;
  return { lien: a.getAttribute('href'), titre: a.innerText.trim().replace(/\s+/g, ' '),
           carte: c.innerText.split('\n').map(s => s.trim()).filter(Boolean) };
})"""


def lire_activite(page, cle):
    page.goto(f"{SITE}/activites/{cle}", wait_until="domcontentloaded", timeout=60000)
    page.wait_for_selector("a.stretched-link[href*='/missions-benevolat/']", state="attached", timeout=45000)
    page.wait_for_timeout(2000)
    m = re.search(r"parmi les ([\d\s  ]+) missions", page.inner_text("body"))
    total = int(re.sub(r"\D", "", m.group(1))) if m else None
    return total, page.evaluate(LIRE_CARTES)


def main():
    DOSSIER.mkdir(parents=True, exist_ok=True)
    jour = date.today().isoformat()
    fichier = DOSSIER / "benevolat.json"
    ancien = json.loads(fichier.read_text(encoding="utf-8")) if fichier.exists() else {"missions": []}
    missions = {m["id"]: m for m in ancien.get("missions", [])}
    bilan = []
    with sync_playwright() as p:
        navigateur = p.chromium.launch()
        page = navigateur.new_page(locale="fr-FR")
        for i, (cle, libelle) in enumerate(ACTIVITES.items()):
            if i:
                time.sleep(PAUSE)
            try:
                total, cartes = lire_activite(page, cle)
            except Exception as e:
                print(f"  {libelle} : échec ({e.__class__.__name__})", file=sys.stderr)
                continue
            for c in cartes:
                ident = c["lien"].strip("/").split("/")[1] if c["lien"].count("/") >= 2 else c["lien"]
                lignes = [l for l in c["carte"] if l != c["titre"] and not l.startswith("+")]
                # Sur la carte : activité, ville, fréquence, organisation, parfois un badge
                ville = next((l for l in lignes if not re.search(r"heure|jour|mois|semaine|ponctuel|id[ée]ale|^\d", l, re.I)
                              and l not in ACTIVITES.values() and len(l) < 40), "")
                frequence = next((l for l in lignes if re.search(r"heure|jour|mois|semaine|ponctuel", l, re.I)), "")
                organisation = lignes[-1] if lignes else ""
                m = missions.setdefault(ident, {"id": ident, "titre": c["titre"], "url": SITE + c["lien"],
                                                "activites": [], "vue_le": jour, "premiere_fois": jour})
                m.update({"titre": c["titre"], "ville": ville, "frequence": frequence,
                          "organisation": organisation, "vue_le": jour,
                          "themes": [nom for nom, rx in THEMES.items() if rx.search(" ".join([c["titre"]] + lignes))]})
                # Missions réservées aux soignants diplômés : pas pour moi
                if re.search(r"m[ée]decin|infirmi|permanences? m[ée]dicales|kin[ée]|dentiste|psychologue", c["titre"], re.I):
                    m["themes"] = [x for x in m["themes"] if x != "mon profil santé"]
                m["pratique"] = bool(m["themes"])
                if libelle not in m["activites"]:
                    m["activites"].append(libelle)
            bilan.append({"activite": libelle, "cle": cle, "disponibles": total, "lues": len(cartes)})
            print(f"  {libelle} : {total} missions disponibles, {len(cartes)} affichées")
        navigateur.close()

    if not bilan:
        sys.exit("Aucune page lue : le site a peut-être changé. data/benevolat/ n'est pas modifié.")

    limite = (date.today() - timedelta(days=GARDER_JOURS)).isoformat()
    liste = sorted((m for m in missions.values() if m["vue_le"] >= limite),
                   key=lambda m: (m["vue_le"], m["pratique"]), reverse=True)
    resume = {"date": jour, "source": SITE + "/activites/… (pages publiques, lues par navigateur automatique)",
              "activites": bilan, "nb_missions": len(liste), "nb_pratique": sum(m["pratique"] for m in liste),
              "missions": liste}
    fichier.write_text(json.dumps(resume, ensure_ascii=False, indent=1), encoding="utf-8")

    serie = DOSSIER / "serie.csv"
    nouveau = not serie.exists()
    with serie.open("a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if nouveau:
            w.writerow(["date", "activite", "disponibles", "lues"])
        for b in bilan:
            w.writerow([jour, b["activite"], b["disponibles"], b["lues"]])
    print(f"Écrit : data/benevolat/benevolat.json — {len(liste)} missions gardées, {resume['nb_pratique']} en lien avec ma formation")


if __name__ == "__main__":
    main()
