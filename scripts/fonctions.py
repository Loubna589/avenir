"""fonctions.py — la fonction d'un poste, lue dans son intitulé.

Ma cible : le marketing de la santé au sens large. Six fonctions comptent :
    marketing, affaires médicales, accès au marché, digital, gestion de projet, commercial.
Les fonctions de supply chain, qualité, production, R&D, ingénierie, finance, achats,
RH, informatique ou réglementaire n'en font pas partie, même dans un laboratoire.

Utilisé par scripts/resumer.py (offres France Travail) et scripts/vie.py (offres VIE).
"""
import re
import unicodedata


def plat(texte):
    """Minuscules, sans accents : « Médicales » -> « medicales »."""
    texte = unicodedata.normalize("NFKD", texte or "")
    return "".join(c for c in texte if not unicodedata.combining(c)).lower()


FONCTIONS = {
    "marketing": re.compile(
        r"marketing|\bchef\w* de (produits?|gamme|marche|marque)\b|\bproduct (manager|owner|specialist|management)\b|\bhead of products?\b|\bbrand\b"
        r"|\bmarques?\b|\bresponsable (produits?|gamme|marque)\b|\bcharge\w* de produits?\b|\bcategory\b|\btrade marketing\b"
        r"|\binsights?\b|\bcommunication\b|\bomnichannel\b|\bomnicanal\w*|\bproduits? (manager|marketing)\b"),
    "affaires médicales": re.compile(
        r"medical affairs|affaires? medicales?|\bmsl\b|medical science liaison|\bmedical (advisor|manager|lead|program\w*|"
        r"information|education)|information medicale|\bmedical\b.*\b(advisor|liaison)\b"),
    "accès au marché": re.compile(
        r"market access|acces au marche|\bpricing\b|reimbursement|remboursement|\bheor\b|health economic|economie de la sante"
        r"|medico-?economi|public affairs|affaires publiques|\bpolicy\b|external affairs|\bpayers?\b"),
    "digital": re.compile(
        r"\bdigital\w*|numerique|e-?commerce|\bcrm\b|social media|reseaux sociaux|\bgrowth\b|\bseo\b|\bsea\b|\bcontent\b"
        r"|contenus?\b|\bengagement\b|webmarket\w*|\bweb\b|community manag"),
    "gestion de projet": re.compile(
        r"\bchef\w* de projets?\b|project manag\w*|gestion de projets?|\bpmo\b|coordinat\w* de projets?|\bcharge\w* de projets?\b"
        r"|\bproject (lead|leader|coordinator)\b|\bprogram\w* manager\b"),
    "événementiel": re.compile(r"evenement\w*|\bevent(s|ing)?\b|congres|salons?\b|seminaires?\b"),
    "commercial": re.compile(
        r"commercia\w*|\bsales\b|\bventes?\b|business develop\w*|developpement commercial|\bkey account|\bkam\b"
        r"|account (manager|executive)|\bdelegue\w*|visiteu\w* medical|\brepresentant\w*|\battache\w* commercial"
        r"|business manager|ingenieur\w* d.affaires|charge\w* d.affaires|technico-?commercial"),
}

# Fonctions écartées, même si un mot de la cible apparaît (« supply chain digital », « ingénieur commercial » mis à part)
HORS_CIBLE = re.compile(
    r"supply|logisti|\bqualit|quality|production|fabrication|manufactur|conditionnement|\bingenieur\b(?! d.affaires| commercial)"
    r"|\bengineer|scientist|chimiste|chemist|\br&d\b|recherche et developpement|laborato\w* (associate|technician)|\bfinanc"
    r"|controll|comptab|audit|\bachats?\b|procurement|buyer|acheteu|ressources humaines|\brh\b|\btalent|recrut|developpeur"
    r"|developer|full ?stack|devops|data engineer|juriste|\blegal\b|\bhse\b|maintenance|technicien|\bprocess\b|bioprocess"
    r"|\bmsat\b|regulatory|reglementaire|pharmacovigilance|\bclinical (research|trial|operations)|\bcra\b|assistant\w* (de direction|administrati)"
    r"|secretari|operateur|preparateur|magasinier|caissi|vendeu|employe\w* commercial|merchandis|chef d.equipe|superviseur"
    r"|travaux|planificat|ordonnanc|\bbtp\b|batiment|informatique|systemes? d.information|infrastructure|immobili|etudes? cliniques?|\bclinical\b")


def fonctions(intitule):
    """Les fonctions de la cible repérées dans l'intitulé ([] si hors cible)."""
    t = plat(intitule)
    trouvees = [nom for nom, rx in FONCTIONS.items() if rx.search(t)]
    if not trouvees:
        return []
    # Écarté si l'intitulé désigne une fonction hors cible, sauf marketing / médical / accès explicites
    # Toujours écarté : secrétariat, assistanat administratif
    if re.search(r"secretari|assistant\w* (de direction|administrati)", t):
        return []
    if HORS_CIBLE.search(t) and not any(f in trouvees for f in ("marketing", "affaires médicales", "accès au marché")):
        return []
    # « Chef de projet événementiel » : c'est de l'événementiel, pas de la gestion de projet au sens large
    if "événementiel" in trouvees and "gestion de projet" in trouvees:
        trouvees.remove("gestion de projet")
    return trouvees
