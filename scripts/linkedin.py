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
# Un VIE (volontariat international en entreprise) part dans l'onglet « Veille VIE », pas dans « Mes offres ».
# « VIE » en majuscules seulement : « vie » en minuscules est un mot courant.
RX_VIE = re.compile(r"\bV\.?I\.?E\b|\b(?i:volontariat international|international volunteer)")

# Lignes du mail qui ne sont ni un poste, ni une entreprise, ni un lieu
BRUIT = re.compile(r"recrute activement|actively recruiting|candidature simplifi|easy apply|promu|promoted|relations?\b|applicants?|candidats?"
                   r"|ancien(ne)?s? él[èe]ves?|alumni|postulez avec|apply with", re.I)
# Hors de ma recherche : alternance, stage, apprentissage (je cherche un premier emploi)
EXCLU = re.compile(r"apprenti|alternan|work[- ]?study|\bstages?\b|stagiaire|\bintern(ship)?\b", re.I)
# Une annonce rédigée en chinois, japonais ou coréen : je ne peux pas y répondre
CJK = re.compile(r"[぀-ヿ㐀-鿿가-힯]")
# Le lieu dit-il l'étranger ? Pays cités, États américains (« Bethlehem, PA »), villes repérées dans mes alertes
ETRANGER = re.compile(
    r"États-Unis|Royaume-Uni|Angleterre|Écosse|Pays de Galles|Irlande|Canada|Chine|Suisse|Australie|Singapour|Viêt ?Nam|Thaïlande"
    r"|Belgique|Allemagne|Espagne|Italie|Pays-Bas|Luxembourg|Japon|Inde|Hong Kong|, [A-Z]{2}$"
    r"|Londres|London|Maidenhead|Shanghai|Nankin|Pékin|Beijing|Wuhan|Qingdao|Guangzhou|Suzhou|Shenzhen|Hangzhou|Toronto|Montréal|Genève|Bâle|Zurich")


def lire_csv():
    req = urllib.request.Request(CSV_URL, headers={"User-Agent": "Mozilla/5.0 (veille-emploi ; projet etudiant)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return list(csv.DictReader(io.StringIO(r.read().decode("utf-8"))))


def nettoyer(l):
    # Quand le mail ajoute « Cette entreprise recrute activement » ou « 1 ancien élève », les colonnes
    # glissent : on retire ces mentions et on range ce qui reste par la droite (… entreprise, lieu)
    champs = [x.strip() for x in (l["poste"], l["entreprise"], l["lieu"]) if x.strip() and not BRUIT.search(x)]
    champs = [""] * (3 - len(champs)) + champs
    poste, entreprise, lieu = champs
    # « Associate Product Manager - Circle Health Group » : on retire l'entreprise répétée
    if entreprise and poste.endswith(" - " + entreprise):
        poste = poste[: -len(entreprise) - 3]
    alerte = re.sub(r"^.*?alerte Emploi pour\s*", "", l["alerte"]).replace(" a été créée", "").strip()
    # Le pays : celui de l'alerte (« … (France) »), sinon la fin du lieu ; la France par défaut
    m = re.search(r"\(([^)]+)\)\s*$", alerte)
    if m and "France" in m.group(1):
        pays = "France"
    elif "," in lieu and not re.search(r", [A-Z]{2}$", lieu):
        pays = lieu.rsplit(",", 1)[-1].strip()
    elif ETRANGER.search(lieu):
        pays = "États-Unis" if re.search(r", [A-Z]{2}$", lieu) else (m.group(1) if m else "étranger")
    else:
        pays = "France"
    if pays != "France" and not ETRANGER.search(lieu + " " + pays) and "France" in lieu:
        pays = "France"
    return {
        "id": "li-" + l["id"].strip(),
        "intitule": poste,
        "entreprise": entreprise,
        "lieu": lieu,
        "pays": pays,
        "france": pays == "France",
        "salaire": l["salaire"].strip(),
        "recue_le": l["recue_le"].strip(),
        "url": l["lien"].strip(),
        "alerte": alerte,
        "vie": bool(RX_VIE.search(poste) or RX_VIE.search(alerte)),
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
        # Ligne vide, intitulé hors de ma cible (ingénieur, data…), alternance ou stage, annonce en chinois : on écarte
        if not (o["intitule"] or o["entreprise"]):
            continue
        if o["intitule"] and not o["fonctions"]:
            continue
        if EXCLU.search(o["intitule"]) or CJK.search(o["intitule"] + o["entreprise"]):
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
