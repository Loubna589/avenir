r"""Offres LinkedIn : lues dans mes alertes e-mail, jamais sur le site LinkedIn.

LinkedIn n'a pas d'API publique pour les offres et interdit qu'on aspire ses pages.
Je reçois donc ses alertes e-mail sur une boîte dédiée. Un petit script Google Apps Script
recopie chaque jour les offres de ces mails dans un Google Sheets, publié en CSV.
Ce script-ci lit ce CSV, nettoie les lignes, repère la fonction de chaque poste
(scripts/fonctions.py) et écrit data/linkedin.json, affiché dans « Mes offres ».

Usage :  python scripts/linkedin.py
"""
import csv
import io
import json
import re
import sys
import urllib.request
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fonctions import fonctions  # noqa: E402

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "data" / "linkedin.json"
CSV_URL = ("https://docs.google.com/spreadsheets/d/e/2PACX-1vQXxCMoooe71eyw3d-MBdkJIFXOW5S4Jo5RcquMRqHJNQ8Qwq1XUp2HwYf-4xjoHkSE_7KAnhAEI5lf"
           "/pub?gid=1269937811&single=true&output=csv")
GARDER_JOURS = 30   # une offre LinkedIn reste rarement ouverte plus d'un mois

# Lignes du mail qui ne sont ni un poste, ni une entreprise, ni un lieu
BRUIT = re.compile(r"recrute activement|actively recruiting|candidature simplifi|easy apply|promu|promoted|relations?\b|applicants?|candidats?",
                   re.I)


def lire_csv():
    req = urllib.request.Request(CSV_URL, headers={"User-Agent": "Mozilla/5.0 (veille-emploi ; projet etudiant)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return list(csv.DictReader(io.StringIO(r.read().decode("utf-8"))))


def nettoyer(l):
    poste, entreprise, lieu = l["poste"].strip(), l["entreprise"].strip(), l["lieu"].strip()
    # Quand le mail ajoute « Cette entreprise recrute activement », les colonnes glissent d'un cran :
    # le poste est perdu, l'entreprise est dans « poste » et le lieu dans « entreprise »
    if BRUIT.search(lieu):
        poste, entreprise, lieu = "", poste, entreprise
    # « Associate Product Manager - Circle Health Group » : on retire l'entreprise répétée
    if entreprise and poste.endswith(" - " + entreprise):
        poste = poste[: -len(entreprise) - 3]
    alerte = re.sub(r"^.*?alerte Emploi pour\s*", "", l["alerte"]).replace(" a été créée", "").strip()
    pays = lieu.rsplit(",", 1)[-1].strip() if lieu else ""
    return {
        "id": "li-" + l["id"].strip(),
        "intitule": poste,
        "entreprise": entreprise,
        "lieu": lieu,
        "pays": pays,
        "france": pays == "France" or not pays,
        "salaire": l["salaire"].strip(),
        "recue_le": l["recue_le"].strip(),
        "url": l["lien"].strip(),
        "alerte": alerte,
        # Sans intitulé lisible, on se fie au nom de l'alerte pour la fonction
        "fonctions": fonctions(poste or alerte),
    }


def main():
    lignes = lire_csv()
    limite = (date.today() - timedelta(days=GARDER_JOURS)).isoformat()
    offres, vus = [], set()
    for l in lignes:
        if not l.get("id") or not l.get("lien"):
            continue
        o = nettoyer(l)
        if o["id"] in vus or o["recue_le"] < limite:
            continue
        vus.add(o["id"])
        # Intitulé connu mais hors de ma cible (ingénieur, data…) : on écarte
        if o["intitule"] and not o["fonctions"]:
            continue
        offres.append(o)
    # La France d'abord, puis les plus récentes
    offres.sort(key=lambda o: o["recue_le"], reverse=True)
    offres.sort(key=lambda o: not o["france"])
    SORTIE.write_text(json.dumps({"date": date.today().isoformat(),
                                  "source": "Alertes e-mail LinkedIn, recopiées par Google Apps Script dans un Google Sheets publié en CSV",
                                  "lues": len(lignes), "offres": offres}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(lignes)} lignes lues, {len(offres)} offres gardées -> {SORTIE.relative_to(RACINE)}")


if __name__ == "__main__":
    main()
