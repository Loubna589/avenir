r"""Veille VIE : lit chaque jour les offres de volontariat international (V.I.E)
sur le site public de Business France et les enregistre dans data/vie/.

Pourquoi un navigateur automatique ?
    Business France ne publie pas d'API ouverte, et les offres ne sont pas dans le
    code HTML de la page : elles s'affichent après coup, par JavaScript. Ce script
    ouvre donc la page de recherche dans un vrai navigateur (Chromium, piloté par
    Playwright), comme le ferait une personne : il tape la recherche, clique sur
    « Voir plus d'offres » jusqu'au bout, puis lit chaque carte d'offre affichée.
    Le fichier robots.txt du site autorise la recherche d'offres. Le script attend
    entre deux clics et ne lance que quelques recherches par jour.

Usage :
    .venv\Scripts\python.exe scripts\vie.py
    (une fois : pip install playwright  puis  python -m playwright install chromium)

Ce que ça écrit :
    data/vie/vie.json     les offres du jour (toutes), avec un repère « santé » et « marketing »
    data/vie/serie.csv    une ligne par jour et par recherche : total, offres santé
"""
import csv
import json
import re
import sys
import time
import unicodedata
from datetime import date
from pathlib import Path

from playwright.sync_api import sync_playwright

RACINE = Path(__file__).resolve().parent.parent
DOSSIER = RACINE / "data" / "vie"
SITE = "https://mon-vie-via.businessfrance.fr"

# Les recherches lancées chaque jour (le mot tapé dans la barre de recherche du site)
RECHERCHES = ["marketing", "pharma", "santé", "chef de produit"]

# Repérage, sur l'entreprise + l'intitulé + le début de l'annonce (sans accents, en minuscules)
SANTE = re.compile(
    # « santé » seul est écarté : il apparaît aussi dans « hygiène, sécurité, santé » (HSE)
    r"\b(pharma\w*|(produits?|industrie|secteur|acteurs?) de (la )?sante|sante animale|e-sante|"
    r"healthcare|healthtech|life sciences|medicaments?|medicines?|medical|laboratoires?|biotech\w*|"
    r"clinical|cliniques?|hospital\w*|patients?|therapeut\w*|oncolog\w*|vaccin\w*|diagnostics? in vitro|"
    r"dispositifs? medicaux|medtech|cosmet\w*|dermo\w*|nutrition\w*|complements? alimentaires?|veterin\w*|"
    r"sanofi|servier|ipsen|astrazeneca|biocodex|urgo|pierre fabre|boiron|thea|biomerieux|ucb|"
    r"novartis|pfizer|roche|bayer|guerbet|arkopharma|lim france|biodevas)\b")
MARKETING = re.compile(
    r"\b(marketing|product manager|chef\w* de produit|brand|marque|omnichannel|omnicanal|digital|"
    r"engagement|insights?|business develop\w*|commercial\w*|sales|ventes?|e-?commerce|crm|growth|"
    r"communication|market access|acces au marche|project manager|chef\w* de projet)\b")


def plat(texte):
    """Minuscules, sans accents : « Santé » -> « sante »."""
    texte = unicodedata.normalize("NFKD", texte or "")
    return "".join(c for c in texte if not unicodedata.combining(c)).lower()


LIRE_CARTES = """() => [...document.querySelectorAll('figcaption.offer-content')].map(f => {
  const t = s => (f.querySelector(s)?.textContent || '').trim().replace(/\\s+/g, ' ');
  const meta = [...f.querySelectorAll('.meta-list li')].map(l => l.textContent.trim());
  const a = f.querySelector('a.postuler');
  return { entreprise: t('.organization-name'), intitule: t('.mission-title'), lieu: t('.location'),
           extrait: t('.mission-excerpt'), type: meta[0] || '', duree: meta[1] || '',
           lien: a ? a.getAttribute('href') : '' };
})"""


def chercher(page, mot):
    """Lance une recherche, déplie toutes les offres, renvoie (total annoncé, offres lues)."""
    page.goto(f"{SITE}/offres/recherche?query={mot}", wait_until="domcontentloaded", timeout=60000)
    page.wait_for_selector("figcaption.offer-content", state="attached", timeout=45000)  # les cartes arrivent par JavaScript
    page.wait_for_timeout(1500)
    total = None
    m = re.search(r"(\d+)\s+offres? trouv", page.inner_text("body"))
    if m:
        total = int(m.group(1))
    for _ in range(40):  # 40 clics au plus, 6 offres par clic : bien au-delà des recherches suivies
        avant = page.locator("figcaption.offer-content").count()
        bouton = page.get_by_text("Voir plus d'offres", exact=True)
        if bouton.count() == 0 or not bouton.first.is_visible():
            break
        bouton.first.click()
        for _ in range(30):  # attend que de nouvelles cartes arrivent (au plus 9 s)
            page.wait_for_timeout(300)
            if page.locator("figcaption.offer-content").count() > avant:
                break
        else:
            break
        page.wait_for_timeout(700)  # politesse : on ne martèle pas le site
    return total, page.evaluate(LIRE_CARTES)


def main():
    DOSSIER.mkdir(parents=True, exist_ok=True)
    jour = date.today().isoformat()
    offres, bilan = {}, []
    with sync_playwright() as p:
        navigateur = p.chromium.launch()
        page = navigateur.new_page(locale="fr-FR")
        for mot in RECHERCHES:
            try:
                total, cartes = chercher(page, mot)
            except Exception as e:  # une recherche qui échoue ne bloque pas les autres
                print(f"  {mot} : échec ({e.__class__.__name__})", file=sys.stderr)
                continue
            sante = 0
            for c in cartes:
                ident = c["lien"].rstrip("/").split("/")[-1]
                if not ident:
                    continue
                texte = plat(" ".join([c["entreprise"], c["intitule"], c["extrait"][:400]]))
                o = offres.setdefault(ident, {
                    "id": ident, "entreprise": c["entreprise"], "intitule": c["intitule"],
                    "lieu": c["lieu"], "type": c["type"], "duree": c["duree"],
                    "url": SITE + c["lien"], "extrait": c["extrait"][:300],
                    "sante": bool(SANTE.search(texte)),
                    "marketing": bool(MARKETING.search(plat(c["intitule"]))),
                    "recherches": []})
                o["recherches"].append(mot)
                sante += o["sante"]
            bilan.append({"recherche": mot, "annoncees": total, "lues": len(cartes), "sante": sante})
            print(f"  {mot} : {total} annoncées, {len(cartes)} lues, {sante} dans la santé")
            time.sleep(2)
        navigateur.close()

    if not offres:
        sys.exit("Aucune offre lue : le site a peut-être changé. data/vie/ n'est pas modifié.")

    liste = sorted(offres.values(), key=lambda o: (not (o["sante"] and o["marketing"]), not o["sante"], o["entreprise"]))
    resume = {"date": jour, "source": SITE + "/offres/recherche (page publique, lue par navigateur automatique)",
              "recherches": bilan, "nb_offres": len(liste),
              "nb_sante": sum(o["sante"] for o in liste),
              "nb_sante_marketing": sum(o["sante"] and o["marketing"] for o in liste),
              "offres": liste}
    (DOSSIER / "vie.json").write_text(json.dumps(resume, ensure_ascii=False, indent=1), encoding="utf-8")

    serie = DOSSIER / "serie.csv"
    nouveau = not serie.exists()
    with serie.open("a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if nouveau:
            w.writerow(["date", "recherche", "annoncees", "lues", "sante"])
        for b in bilan:
            w.writerow([jour, b["recherche"], b["annoncees"], b["lues"], b["sante"]])
    print(f"Écrit : data/vie/vie.json — {len(liste)} offres, {resume['nb_sante']} santé, "
          f"{resume['nb_sante_marketing']} santé + marketing")


if __name__ == "__main__":
    main()
