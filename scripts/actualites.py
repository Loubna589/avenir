r"""Actualités des entreprises qui recrutent : un flux RSS par entreprise.

Pour chaque employeur nommé dans mes offres du jour (data/resume.json), le script lit le
flux RSS public de Bing Actualités (https://www.bing.com/news/search?q="Nom"&format=rss),
que le fichier robots.txt de Bing autorise (seul /search est interdit, pas /news/search).
Google Actualités, lui, interdit son flux RSS aux robots : il n'est pas utilisé.

Il garde les 5 articles les plus récents de chaque entreprise (titre, source, date, lien)
dans data/actualites.json. Le site les affiche dans « Veille sur l'entreprise » et les
transmet à l'assistant IA, qui n'a pas accès à internet par lui-même.

Usage :  python scripts/actualites.py
"""
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from email.utils import parsedate_to_datetime
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "data" / "actualites.json"
ENTETE = {"User-Agent": "Mozilla/5.0 (veille-emploi ; projet etudiant IAE Clermont)"}
PAUSE = 2          # secondes entre deux entreprises : on ne martèle pas le site
PAR_ENTREPRISE = 5

# Noms qui ne désignent pas un employeur précis : inutile de chercher leur actualité
GENERIQUES = re.compile(r"^(non communiqu|confidentiel|entreprise|soci[ée]t[ée])", re.I)


def nettoyer(nom):
    """« LABORATOIRES MAYOLY SPINDLER (SAS) » -> « Laboratoires Mayoly Spindler »."""
    nom = re.sub(r"\(.*?\)", " ", nom or "")
    nom = re.sub(r"\b(SAS|SASU|SA|SARL|EURL|SCA|SNC|GIE)\b\.?", " ", nom, flags=re.I)
    nom = re.sub(r"\s+", " ", nom).strip(" -,.")
    return nom.title() if nom.isupper() else nom


def flux(nom):
    url = "https://www.bing.com/news/search?" + urllib.parse.urlencode({"q": f'"{nom}"', "format": "rss", "setlang": "fr", "cc": "FR"})
    with urllib.request.urlopen(urllib.request.Request(url, headers=ENTETE), timeout=30) as r:
        xml = r.read().decode("utf-8", errors="replace")
    articles = []
    for item in re.findall(r"<item>(.*?)</item>", xml, flags=re.S):
        champ = lambda b: html.unescape(re.sub(r"<[^>]+>", "", (re.search(rf"<{b}>(.*?)</{b}>", item, re.S) or [None, ""])[1])).strip()
        titre, lien, quand = champ("title"), champ("link"), champ("pubDate")
        source = champ("News:Source")
        try:
            jour = parsedate_to_datetime(quand).date().isoformat()
        except Exception:
            jour = ""
        # Le lien Bing redirige : on garde l'adresse de l'article quand elle y figure
        m = re.search(r"[?&]url=([^&]+)", lien)
        if m:
            lien = urllib.parse.unquote(m.group(1))
        if titre and lien:
            articles.append({"titre": titre, "source": source, "date": jour, "url": lien})
    articles.sort(key=lambda a: a["date"], reverse=True)
    return articles[:PAR_ENTREPRISE]


def main():
    d = json.loads((RACINE / "data" / "resume.json").read_text(encoding="utf-8"))
    noms = sorted({o["entreprise"] for o in d["offres"] if o.get("pharma") and o.get("entreprise")
                   and not GENERIQUES.search(o["entreprise"])})
    print(f"{len(noms)} entreprises à suivre")
    resultat, echecs = {}, 0
    for k, nom in enumerate(noms):
        if k:
            time.sleep(PAUSE)
        try:
            resultat[nom] = flux(nettoyer(nom))
            print(f"  {nom} : {len(resultat[nom])} articles")
        except Exception as e:
            echecs += 1
            print(f"  {nom} : échec ({e.__class__.__name__})", file=sys.stderr)
            if echecs >= 5:
                print("  5 échecs : on s'arrête, on réessaiera demain", file=sys.stderr)
                break
    if not resultat:
        sys.exit("Aucune actualité lue : data/actualites.json n'est pas modifié.")
    SORTIE.write_text(json.dumps({"date": date.today().isoformat(),
                                  "source": "Bing Actualités, flux RSS public (un par entreprise)",
                                  "entreprises": resultat}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Écrit : {SORTIE.relative_to(RACINE)}")


if __name__ == "__main__":
    main()
