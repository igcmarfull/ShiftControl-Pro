#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Instalador de escudos de clubes para FutPro. No modifica partidas ni motor.

Con internet, descarga solo escudos coincidentes de dos repositorios públicos,
los guarda localmente y registra exclusivamente los descargados con éxito.
Usar: python3 tools/instalar_escudos.py
"""
from __future__ import annotations
import argparse
import csv
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
import json
from pathlib import Path
import re
import struct
import sys
import time
import unicodedata
from urllib.parse import quote
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'assets' / 'crests'
CATALOG = ROOT / 'assets' / 'clubes-futpro.json'
REGISTRY = ROOT / 'js' / 'crests-local.js'
INDEX = ROOT / 'assets' / 'escudos-fuentes.csv'
SOURCE = (
    ('JoseArroyave', 'JoseArroyave/football-logos', 'SVG'),
    ('diegosy12', 'diegosy12/Escudos_Futbol_2025-26', 'PNG'),
)
COUNTRIES = {
    'CHI': ('chile', 'Chile'), 'ARG': ('argentina','Argentina'),
    'BRA': ('brazil','Brasil'), 'URU': ('uruguay','Uruguay'),
    'PAR': ('paraguay','Paraguay'), 'COL': ('colombia','Colombia'),
    'PER': ('peru','Peru'), 'ECU': ('ecuador','Ecuador'),
    'BOL': ('bolivia','Bolivia'), 'VEN': ('venezuela','Venezuela'),
    'ENG': ('england','Inglaterra'), 'ESP': ('spain','España'),
    'ITA': ('italy','Italia'), 'GER': ('germany','Alemania'),
    'FRA': ('france','Francia'), 'POR': ('portugal','Portugal'),
    'NED': ('netherlands','Paises Bajos'), 'BEL': ('belgium','Bélgica'),
    'SCO': ('scotland','Escocia'), 'TUR': ('turkey','Turquia'),
    'GRE': ('greece','Grecia'), 'SUI': ('switzerland','Suiza'),
    'AUT': ('austria','Austria'), 'DEN': ('denmark','Dinamarca'),
    'SWE': ('sweden','Suecia'), 'NOR': ('norway','Noruega'),
    'POL': ('poland','Polonia'), 'CZE': ('czech-republic','República Checa'),
    'USA': ('usa','Estados Unidos'), 'MEX': ('mexico','Mexico'),
    'CAN': ('canada','Canada'), 'CRC': ('costa-rica',None),
    'KSA': ('saudi-arabia','Arabia saudi'), 'JPN': ('japan','Japón'),
    'KOR': ('south-korea','Corea del sur'), 'CHN': ('china','China'),
    'AUS': ('australia','Australia'), 'EGY': ('egypt','Egipto'),
    'MAR': ('morocco','Marruecos'), 'RSA': ('south-africa',None),
    'TUN': ('tunisia',None), 'ALG': ('algeria',None),
    'SRB': ('serbia','Serbia'), 'RUS': ('russia','Rusia'),
    'ROU': ('romania','Rumania'), 'IRN': ('iran',None),
    'BUL': ('bulgaria','Bulgaria'), 'UKR': ('ukraine','Ucrania'),
    'ISR': ('israel','Israel'), 'HUN': ('hungary','Hungía'),
    'UZB': ('uzbekistan',None), 'IND': ('india',None),
    'UAE': ('united-arab-emirates','Emiratos arabes'), 'ISL': ('iceland','Islandia'),
    'HRV': ('croatia','Croatia'), 'FIN': ('finland','Finlandia'),
    'QAT': ('qatar','Qatar'), 'IRL': ('republic-of-ireland','Irlanda'),
    'CYP': ('cyprus','Chipre'), 'WAL': ('wales',None),
    'SLV': ('el-salvador','Salvador'), 'THA': ('thailand',None),
    'GUA': ('guatemala',None), 'HON': ('honduras',None),
    'JAM': ('jamaica',None), 'PAN': ('panama',None),
}
# Solo equivalencias conocidas; no inventar archivos ni asignar otro club.
ALIASES = {
    'colo-colo': ['colocolo'], 'universidad-de-chile': ['udechile'],
    'universidad-catolica': ['ucatolica', 'universidad-catolica-de-chile'],
    'universidad-de-concepcion': ['udeconcepcion'],
    'o-higgins': ['ohiggins'], 'audax-italiano': ['audax'],
    'coquimbo-unido': ['coquimbo'], 'deportes-la-serena': ['deplaserena'],
    'union-la-calera': ['unionlacalera'], 'everton-de-vina-del-mar': [],
    'universidad-de-concepcion': ['udeconcepcion'],
    'deportes-limache': ['deporteslimache'],
    'real-madrid': ['real-madrid-cf'], 'fc-barcelona': ['barcelona', 'fc-barcelona'],
    'paris-saint-germain': ['psg','paris-saint-germain-fc'],
    'bayern-munchen': ['bayern-munich','fc-bayern-munchen'],
    'inter': ['inter-milan','internazionale'], 'milan': ['ac-milan'],
    'roma': ['as-roma'], 'napoli': ['ssc-napoli'], 'lazio': ['ss-lazio'],
    'marseille': ['olympique-de-marseille'], 'monaco': ['as-monaco'],
    'atletico-de-madrid': ['atletico-madrid'],
    'psv-eindhoven': ['psv'], 'fc-porto': ['porto'],
    'sporting-cp': ['sporting-lisbon','sporting-clube-de-portugal'],
    'sao-paulo': ['sao-paulo-fc'],
    'red-bull-bragantino': ['bragantino'],
    'inter-miami': ['inter-miami-cf'],
    'newells-old-boys': ['newells-old-boys','newells'],
    'gremio': ['gremio-fbpa'],
}

# Formas alternativas corroboradas en el catálogo internacional. No se usa
# coincidencia aproximada cuando hay más de un posible club del mismo país.
ALIASES.update({
    'liverpool': ['liverpool-fc'],
    'west-ham-united': ['west-ham'],
    'port-vale': ['port-vale-fc'],
    'tottenham-hotspur': ['tottenham-hotspur-fc'],
    'atletico-de-madrid': ['atletico-madrid'],
    'athletic-club': ['athletic-club-bilbao'],
    'deportivo-de-la-coruna': ['deportivo-la-coruna'],
    'racing-de-santander': ['racing-santander'],
    'racing-de-ferrol': ['racing-club-ferrol'],
    'real-jaen': ['real-jaen-cf'],
    'bayern-munchen': ['bayern-munchen'],
    'sc-freiburg': ['freiburg'],
    '1-fc-heidenheim': ['fc-heidenheim'],
    '1-fc-kaiserslautern': ['fc-kaiserslautern'],
    '1-fc-nurnberg': ['fc-nurnberg'],
    '1-fc-saarbrucken': ['saarbrucken'],
    '1860-munchen': ['tsv-1860-munchen'],
    'darmstadt-98': ['sv-darmstadt-98'],
    'viktoria-koln': ['fc-viktoria-koln'],
    'waldhof-mannheim': ['sv-waldhof-mannheim'],
    'paris-saint-germain': ['paris-saint-germain-psg'],
    'monaco': ['as-monaco'],
    'lens': ['rc-lens'],
    'le-havre': ['le-havre-ac'],
    'strasbourg': ['as-strasbourg'],
    'lorient': ['lorient-fc'],
    'metz': ['fc-metz'],
    'saint-etienne': ['as-saint-etienne'],
    'guingamp': ['ea-guingamp'],
    'rodez': ['rodez-af'],
    'red-star': ['red-star-fc'],
    'pau': ['pau-fc'],
    'bastia': ['sc-bastia'],
    'le-mans': ['le-mans-fc'],
    'chateauroux': ['lb-chateauroux'],
    'valenciennes': ['valenciennes-fc'],
    'concarneau': ['us-concarneau'],
    'orleans': ['us-orleans'],
    'quevilly-rouen': ['quevilly-rouen-metropole'],
    'braga': ['sc-braga'],
    'casa-pia': ['casa-pia-ac'],
    'pacos-de-ferreira': ['pacos-ferreira'],
    'lusitania-lourosa': ['lusitania-de-lourosa'],
    'belenenses': ['os-belenenses'],
    'fafe': ['ad-fafe'],
    'marco-09': ['ad-marco-09'],
    'sao-joao-de-ver': ['sao-joao-ver'],
    'caldas-sc': ['caldas'],
    'sc-covilha': ['covilha'],
    'almere-city': ['almere-city-fc'],
    'mechelen': ['kv-mechelen'],
    'kortrijk': ['kv-kortrijk'],
    'lommel': ['lommel-sk'],
    'lokeren-temse': ['ksc-lokeren-temse'],
    'patro-eisden': ['patro-eisden-maasmechelen'],
    'francs-borains': ['royal-francs-borains'],
    'beveren': ['s-k-beveren'],
    'bragantino': ['rb-bragantino'],
    'santos': ['santos-fc'],
    'tombense': ['tombense-fc'],
    'retro': ['retro-fc'],
    'treze': ['treze-fc'],
    'nova-iguacu': ['nova-iguacu-fc'],
    'cianorte': ['cianorte-fc'],
    'tuna-luso': ['tuna-luso-brasileira'],
    'san-lorenzo': ['san-lorenzo-de-almagro'],
    'atletico-rafaela': ['atletico-de-rafaela'],
    'san-martin-de-san-juan': ['san-martin-san-juan'],
    'gimnasia-de-jujuy': ['gimnasia-y-esgrima-de-jujuy'],
    'river-plate-uru': ['river-plate'],
    'tacuarembo': ['tacuarembo-fc'],
    'universidad-catolica-ecu': ['universidad-catolica'],
    'deportivo-moquegua': ['club-deportivo-moquegua'],
    'academia-del-balompie': ['academia-del-balompie-boliviano'],
    'san-antonio-bulo-bulo': ['cd-san-antonio-bulo-bulo'],
    'estudiantes-de-merida': ['estudiantes-merida'],
    'universidad-central-de-venezuela': ['universidad-central'],
    'yverdon-sport': ['yverdon-sport-fc'],
    'stade-lausanne-ouchy': ['fc-stade-lausanne-ouchy'],
    'rapperswil-jona': ['fc-rapperswil-jona'],
    'etoile-carouge': ['etoile-carouge-fc'],
    'stade-nyonnais': ['fc-stade-nyonnais'],
    'ac-bellinzona': ['bellinzona'],
    'viking': ['viking-fk'],
    'silkeborg': ['silkeborg-if'],
    'randers': ['randers-fc'],
    'viborg': ['viborg-ff'],
    'fredericia': ['fc-fredericia'],
    'kalmar-ff': ['kalmar'],
    'ik-brage': ['brage'],
    'norrby': ['norrby-if'],
    'varbergs-bois': ['varbergs-bois-fc'],
    'gaziantep-fk': ['gaziantep'],
    'sampaio-correa': [],  # dos clubes distintos (Maranhão/RJ): no adivinar
})
# Las filiales llevan el escudo del club matriz si no aparece el suyo propio.
PARENT_SUFFIXES = ('-b', '-ii', '-u23', '-sub-23')
PREFIXES = {'fc','cf','sc','ac','as','sv','rc','ss','cd','ad','sd','sk','kv','us','af','fa','ca','fk','vfb','kv','ksc'}
SUFFIXES = {'fc','cf','sc','ac','fk','af','sv','sk'}


# Equivalencias adicionales verificadas a mano (mismo club, distinto nombre en la fuente).
ALIASES.update({
    'argentinos-juniors': ['argeninos-juniors'],
    'union-de-santa-fe': ['union'],
    'sarmiento-de-junin': ['sarmiento'],
    'agropecuario': ['agropecuario-argentino'],
    'italiano': ['sportivo-italiano'],
    'laferrere': ['deportivo-laferrere'],
    'lamadrid': ['general-lamadrid'],
    'remo': ['clube-do-remo'],
    'juventude': ['juventude'],
    'brasiliense': ['brasiliense-futebol-clube'],
    'joinville': ['joinville-esporte-clube'],
    'madureira': ['madureira-esporte-clube'],
    'sport': ['sport-recife'],
    'liverpool-uru': ['liverpool'],
    'atletico-bucaramanga': ['bucaramanga'],
    'ldu-quito': ['liga-de-quito'],
    'cuenca-juniors': ['deportivo-cuenca'],
    'tottenham-hotspur': ['tottenham'],
    'brighton-hove-albion': ['brighton'],
    'wrexham': ['wrexham-afc'],
    'barrow': ['barrow-afc'],
    'altrincham': ['altrincham-fc'],
    'celta-de-vigo': ['celta'],
    'celta-fortuna': ['celta'],
    'real-oviedo': ['oviedo'],
    'ce-sabadell': ['sabadell'],
    'lleida-esportiu': ['club-lleida-esportiu'],
    'como': ['como-1907'],
    'frosinone': ['frosinone-calcio'],
    'sudtirol': ['suditrol'],
    'carrarese': ['carrarese-calcio'],
    'mantova': ['mantova-1911'],
    'avellino': ['us-avellino-1912'],
    'pro-vercelli': ['fc-pro-vercelli-1892'],
    'vfl-wolfsburg': ['wolfsburg'],
    'tsg-hoffenheim': ['hoffenheim'],
    'tsg-hoffenheim-ii': ['hoffenheim'],
    'jahn-regensburg': ['jahn'],
    'erzgebirge-aue': ['erzgebirge'],
    'reims': ['stade-de-reims'],
    'grenoble': ['grenoble-foot-38'],
    'amiens': ['amiens-sc'],
    'clermont': ['clermont-foot'],
    'nancy': ['nancy-lorraine'],
    'caen': ['stade-malherbe-caen'],
    'dijon': ['dijon-fco'],
    'villefranche': ['villefranche-beaujolais'],
    'lyon': ['olympique-lyonnais'],
    'cd-nacional': ['nacional-da-madeira'],
    'chaves': ['grupo-desportivo-de-chaves'],
    'torreense': ['s-c-u-torreense'],
    'felgueiras-1932': ['felgueiras'],
    'jong-ajax': ['ajax'],
    'jong-fc-utrecht': ['fc-utrecht'],
    'excelsior': ['excelsior-rotterdam'],
    'anderlecht': ['rsc-anderlecht'],
    'genk': ['krc-genk'],
    'gent': ['kaa-gent'],
    'antwerp': ['royal-antwerp-fc'],
    'cercle-brugge': ['cercle-brugge-ksv'],
    'sint-truiden': ['sint-truidense-vv'],
    'westerlo': ['kvc-westerlo'],
    'oh-leuven': ['oud-heverlee-leuven'],
    'dender': ['fcv-dender-eh'],
    'eupen': ['kas-eupen'],
    'rwdm': ['rwdm-brussels'],
    'club-nxt': ['club-brugge'],
    'jong-genk': ['krc-genk'],
    'jong-gent': ['kaa-gent'],
    'lierse': ['k-lierse-s-k'],
    'seraing': ['rfc-seraing'],
    'grasshopper': ['grasshoppers'],
    'neuchatel-xamax': ['xamax'],
    'grasshopper-u21': ['grasshoppers'],
    'thun-u21': ['thun'],
    'servette-u21': ['servette'],
    'basel-u21': ['basel'],
    'young-boys-u21': ['young-boys'],
    'luzern-u21': ['luzern'],
    'sion-u21': ['sion'],
    'rapid-wien': ['rapid-vienna'],
    'rapid-wien-ii': ['rapid-vienna'],
    'admira-wacker': ['admira'],
    'sku-amstetten': ['amstetten'],
    'kapfenberger-sv': ['kapfenberg'],
    'schwarz-weiss-bregenz': ['sw-bregenz'],
    's-nderjyske': ['sonderjyske'],
    'esbjerg-fb': ['esbjerg'],
    'middelfart': ['middelfart-boldklub'],
    'skive-ik': ['skive'],
    'hobro': ['hobro-ik'],
    'falkenbergs-ff': ['falkenberg'],
    'start': ['ik-start'],
    'sogndal': ['sogndal-fotball'],
    'raufoss': ['raufoss-il'],
    'moss': ['moss-fk'],
    'ranheim': ['ranheim-fotball'],
    'widzew-odz': ['widzew-lodz'],
    'bohemians-1905': ['bohemians-praha'],
    'chrudim': ['mfk-chrudim'],
    'opava': ['sfc-opava'],
    'dukla-praha': ['dukla-prague'],
    'la-galaxy': ['los-angeles-galaxy'],
    'sacramento-republic': ['sacramento-republic-fc'],
    'america': ['club-america'],
    'pumas-unam': ['unam-pumas'],
    'leon': ['club-leon'],
    'tijuana': ['club-tijuana'],
    'atletico-san-luis': ['atletico-de-san-luis'],
    'leones-negros': ['leones-negros-udeg'],
    'saprissa': ['deportivo-saprissa'],
    'alajuelense': ['liga-deportiva-alajuelense'],
    'herediano': ['club-sport-herediano'],
    'urawa-red-diamonds': ['urawa-reds'],
    'consadole-sapporo': ['hokkaido-consadole-sapporo'],
    'thespakusatsu-gunma': ['thespa-gunma'],
    'omiya-ardija': ['rb-omiya-ardija'],
    'jeonbuk-hyundai-motors': ['jeonbuk'],
    'henan-fc': ['henan-songshan-longmen'],
    'al-ittihad-alexandria': ['al-ittihad-alexandria-club'],
    'raja-ca': ['raja-casablanca'],
    'maghreb-de-fes': ['maghreb-of-fez'],
    'olympic-safi': ['olympic-club-safi'],
    'renaissance-zemamra': ['rca-zemamra'],
    'ittihad-tanger': ['ir-tanger'],
    'as-marsa': ['avenir-sportif-de-la-marsa'],
    'dinamo-zagreb': ['gnk-dinamo-zagreb'],
    'gorica': ['hnk-gorica'],
    'vukovar-1991': ['hnk-vukovar'],
    'dugopolje': ['nk-dugopolje'],
    'javor-ivanjica': ['javor-matis'],
    'sepsi-osk': ['sepsi'],
    'metaloglobus-bucuresti': ['metaloglobus'],
    'concordia-chiajna': ['concordia'],
    'paks': ['paksi'],
    'kazincbarcika': ['kazincbarcikai'],
    'budafok': ['budafoki'],
    'ajka': ['ajka-fc'],
    'dobrudzha': ['pfc-dobrudzha-dobrich'],
    'marek-dupnitsa': ['marek'],
    'pirin-blagoevgrad': ['pirin'],
    'neftochimic-burgas': ['neftochimic'],
    'oleksandriya': ['olexandriya'],
    'metalist-1925': ['fc-metalist-1925-kharkiv'],
    'podillya': ['podillya-khmelnytskyi'],
    'bukovyna': ['bukovyna-chernivtsi'],
    'prykarpattia': ['prykarpattia-blaho'],
    'inhulets': ['inhulets-petrove'],
    'dnipro-1': ['dnipro'],
    'obolon-kyiv': ['obolon'],
    'akron-tolyatti': ['akron'],
    'neftekhimik': ['neftekhimik-nizhnekamsk'],
    'chayka': ['chayka-peschanokopskoye'],
    'chernomorets-novorossiysk': ['chernomorets-novorossiisk'],
    'rotor-volgograd': ['rotor'],
    'ethnikos-achna': ['ethnikos-achnas'],
    'enosis-neon-paralimni': ['enosis-neon-paralimniou'],
    'doxa-katokopias': ['doxa'],
    'krasava-eny-ypsonas': ['krasava-ypsonas'],
    'bohemians': ['bohemian'],
    'newtown': ['newtown-afc'],
    'haka': ['fc-haka-valkeakoski'],
    'gnistan': ['if-gnistan'],
    'jaro': ['ff-jaro'],
    'hifk': ['hifk-fotboll'],
    'brei-ablik': ['breidablik'],
    'independiente-la-chorrera': ['independiente-de-la-chorrera'],
    'municipal': ['csd-municipal'],
    'malacateco': ['deportivo-malacateco'],
    'mixco': ['deportivo-mixco'],
    'marquense': ['deportivo-marquense'],
    'panachaiki': ['panahaiki'],
    'iraklis': ['iraklis-thessaloniki'],
    'al-ahli-doha': ['al-ahli'],
    'al-shahaniya': ['al-shahania'],
    'al-kharaitiyat': ['al-khuraitiat-sc'],
    'mohun-bagan-sg': ['mohun-bagan-super-giant'],
    'navbahor': ['navbahor-namangan'],
    'surkhon': ['surkhon-termiz'],
    'termez-surkhon': ['surkhon-termiz'],
    'sogdiana': ['pfc-sogdiana-jizzakh'],
    'shurtan-guzar': ['shurtan-guzor'],
    'xorazm': ['fk-xorazm-urgench'],
    'namangan': ['navbahor-namangan'],
    'port': ['port-fc'],
    'lamphun-warrior': ['lamphun-warriors'],
    'prachuap': ['pt-prachuap-fc'],
    'sisaket': ['sisaket-united'],
})


def crest_identity(value):
    """Reduce solo prefijos/sufijos de tipo societario; conserva topónimos."""
    parts=slug(value).split('-')
    if len(parts)>1 and parts[0] in PREFIXES: parts=parts[1:]
    if len(parts)>1 and parts[-1] in SUFFIXES: parts=parts[:-1]
    return '-'.join(parts)

STOP = {'fc','cf','ac','sc','cd','club','football','futbol','futebol','soccer','de','del','the'}


def slug(value):
    value = unicodedata.normalize('NFKD', value).casefold()
    value = ''.join(x for x in value if not unicodedata.combining(x))
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', value))


def tidy(value):
    return slug(value).replace('-','')


def club_candidates(value):
    s = slug(value)
    out = [s] + ALIASES.get(s, [])
    words = s.split('-')
    if len(words) >= 2:
        if words[0] in STOP: out.append('-'.join(words[1:]))
        if words[-1] in STOP: out.append('-'.join(words[:-1]))
    for suffix in PARENT_SUFFIXES:
        if s.endswith(suffix):
            out.append(s[:-len(suffix)])
            out.extend(ALIASES.get(s[:-len(suffix)],[]))
    return list(dict.fromkeys(out))


def fetch(url, limit=6_000_000, retries=2):
    for attempt in range(retries + 1):
        try:
            req = Request(url, headers={'User-Agent': 'FutPro-Crests-Installer/1.0', 'Accept': 'application/vnd.github+json' if 'api.github.com' in url else '*/*'})
            with urlopen(req, timeout=30) as resp:
                data = resp.read(limit + 1)
                if len(data) > limit: raise ValueError('Archivo demasiado grande')
                return data
        except Exception:
            if attempt == retries: raise
            time.sleep(1.0 + attempt)


def get_tree_git(repo):
    """Respaldo si la API de GitHub no responde: lista los archivos con git, sin bajar imágenes."""
    import shutil, subprocess, tempfile
    tmp = tempfile.mkdtemp(prefix='futpro-tree-')
    try:
        url = 'https://github.com/' + repo + '.git'
        subprocess.run(['git', 'clone', '-q', '--depth', '1', '--filter=blob:none', '--no-checkout', url, tmp],
                       check=True, timeout=300, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        out = subprocess.run(['git', '-C', tmp, 'ls-tree', '-r', '--name-only', '-z', 'HEAD'],
                             check=True, timeout=120, stdout=subprocess.PIPE).stdout.decode('utf-8')
        return [x for x in out.split('\0') if x]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def get_tree(repo):
    try:
        url = 'https://api.github.com/repos/' + repo + '/git/trees/main?recursive=1'
        obj = json.loads(fetch(url, limit=12_000_000).decode('utf-8'))
        if obj.get('truncated'): raise RuntimeError('Catálogo remoto incompleto; no se continuó con asignaciones dudosas')
        if 'tree' not in obj: raise RuntimeError('GitHub no devolvió árbol para ' + repo + ': ' + str(obj.get('message','error')))
        return [x['path'] for x in obj['tree'] if x.get('type') == 'blob']
    except Exception:
        return get_tree_git(repo)


def indexes(paths, source):
    """country-folder -> slug filename -> candidate pathname"""
    buckets = {}
    for p in paths:
        seg = p.split('/')
        if source == 0 and len(seg) == 3 and seg[0] == 'logos' and p.lower().endswith('.svg'):
            country, fn = seg[1], seg[-1]
        elif source == 1 and len(seg) == 2 and p.lower().endswith('.png'):
            country, fn = seg[0], seg[-1]
        else:
            continue
        name = slug(fn.rsplit('.', 1)[0])
        if name:
            buckets.setdefault(country, {}).setdefault(name, []).append(p)
    return buckets


def pick_one(name, country, bucket):
    if not bucket: return None
    aliases=club_candidates(name)
    # Coincidencia exacta y equivalencias confirmadas primero.
    for alias in aliases:
        found=bucket.get(alias,[])
        if len(found)==1: return found[0]
    # Ignorar guiones y abreviaturas solamente si la identidad es única
    # dentro del país. «Botafogo» no debe volverse «Botafogo-SP».
    normalized={}
    for key,paths in bucket.items():
        for identity in (tidy(key),tidy(crest_identity(key))):
            if len(identity)>=5:
                normalized.setdefault(identity,[]).extend(paths)
    for alias in aliases:
        for identity in (tidy(alias),tidy(crest_identity(alias))):
            found=list(dict.fromkeys(normalized.get(identity,[])))
            if len(found)==1 and len(identity)>=5: return found[0]
    # No adivinar clubes por similitud. La coincidencia aproximada sin
    # verificación confundía equipos con nombres parecidos.
    return None


def find_club(row, index_pair):
    c = COUNTRIES.get(row['country'])
    if not c: return []
    options = []
    for i, folder in enumerate(c):
        if not folder: continue
        p = pick_one(row['club'], folder, index_pair[i].get(folder, {}))
        if p:
            repo = SOURCE[i][1]
            url = 'https://raw.githubusercontent.com/' + repo + '/main/' + quote(p, safe='/')
            options.append((url, i, p))
    return options


def safe_svg(b):
    if len(b) > 2_500_000 or b'<!DOCTYPE' in b.upper() or b'<!ENTITY' in b.upper(): return False
    try: root = ET.fromstring(b)
    except ET.ParseError: return False
    if root.tag.rsplit('}',1)[-1] != 'svg': return False
    banned = {'script','foreignObject','iframe','object','embed','audio','video'}
    for node in root.iter():
        if node.tag.rsplit('}',1)[-1] in banned: return False
        for key, value in node.attrib.items():
            attr = key.rsplit('}',1)[-1].lower()
            v = value.lower().strip()
            if 'javascript:' in v or '@import' in v or 'url(http' in v or 'url(//' in v:
                return False
            # Se admiten solo imágenes rasterizadas incrustadas (data:image/...;base64); nada externo.
            if attr == 'href' and v and not v.startswith('#') and not re.match(r'data:image/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$', v): return False
    return True


def valid_png(b):
    if not b.startswith(b'\x89PNG\r\n\x1a\n') or len(b) < 24: return False
    w,h = struct.unpack('>II',b[16:24])
    return 1 <= w <= 8192 and 1 <= h <= 8192


def save_one(item):
    row, opts = item
    outname = slug(row['club'])
    # Los nombres repetidos entre países se excluyen del registro automático.
    for url, source_id, source_path in opts:
        ext = '.svg' if source_id == 0 else '.png'
        target = ASSETS / (outname + ext)
        try:
            if target.is_file():
                b = target.read_bytes()
                if (ext == '.svg' and safe_svg(b)) or (ext == '.png' and valid_png(b)):
                    return row, target, url, source_id, 'existente'
            b = fetch(url, limit=2_600_000, retries=1)
            if not (safe_svg(b) if ext == '.svg' else valid_png(b)):
                raise ValueError('Imagen no válida o no segura')
            # Si ya existe la otra extensión, se limpia tras instalar la nueva.
            target.with_suffix(target.suffix + '.tmp').write_bytes(b)
            target.with_suffix(target.suffix + '.tmp').replace(target)
            other = ASSETS / (outname + ('.png' if ext == '.svg' else '.svg'))
            if other.exists(): other.unlink()
            return row, target, url, source_id, 'descargado'
        except Exception:
            continue
    return row, None, None, None, 'pendiente'


def write_registry(done):
    mapping = {slug(row['club']): 'assets/crests/' + path.name for row, path, url, sid, how in done}
    js = '/* FutPro: escudos locales, generados por tools/instalar_escudos.py. */\n'
    js += '(function(){\n  var FP=window.FP=window.FP||{}; FP.CRESTS=FP.CRESTS||{};\n'
    js += '  Object.assign(FP.CRESTS, ' + json.dumps(mapping,ensure_ascii=False,sort_keys=True,indent=2) + ');\n})();\n'
    tmp = REGISTRY.with_suffix('.js.tmp')
    tmp.write_text(js,encoding='utf8')
    tmp.replace(REGISTRY)
    with INDEX.open('w', newline='',encoding='utf-8') as f:
        w=csv.writer(f);w.writerow(('Club','País','Ruta local','Fuente de imagen','URL original','Estado'))
        for row,path,url,sid,how in done:
            w.writerow((row['club'],row['country'],path.relative_to(ROOT),SOURCE[sid][1],url,how))
    return mapping


def main():
    ap = argparse.ArgumentParser(description='Descarga e instala escudos reales para FutPro (sin créditos Claude)')
    ap.add_argument('--dry-run', action='store_true',help='Comparar catálogo de clubes sin descargar imágenes')
    ap.add_argument('--jobs', type=int, default=6,help='Descargas simultáneas: 1 a 8')
    args=ap.parse_args()
    if not 1<=args.jobs<=8: ap.error('--jobs debe estar entre 1 y 8')
    ASSETS.mkdir(parents=True, exist_ok=True)
    rows = json.loads(CATALOG.read_text(encoding='utf8'))['clubs']
    print(f'FutPro: {len(rows)} clubes, {len(set(x["country"] for x in rows))} países.')
    source_index=[]
    for name,repo,fmt in SOURCE:
        try:
            print('Leyendo catálogo de', repo, '...')
            p=get_tree(repo)
            source_index.append(indexes(p,len(source_index)))
            print('  Archivos disponibles:',len(p))
        except Exception as e:
            print('  No disponible:',str(e))
            source_index.append({})
    if not any(source_index):
        print('No se pudieron consultar fuentes. Comprueba tu conexión y reintenta.')
        return 2
    from collections import Counter
    duplicates={k for k,n in Counter(slug(r['club']) for r in rows).items() if n>1}
    prepared = []
    unmatched = []
    for row in rows:
        if slug(row['club']) in duplicates:
            unmatched.append(row)
            continue
        opts=find_club(row,source_index)
        if opts:prepared.append((row,opts))
        else: unmatched.append(row)
    print(f'Coincidencias de nombre/país: {len(prepared)} / {len(rows)}. Sin coincidencia: {len(unmatched)}')
    if duplicates: print('Se omiten slugs ambiguos entre países:',', '.join(sorted(duplicates)))
    if args.dry_run:
        return 0
    print('Descargando solo los escudos identificados. Esto requiere internet una vez.')
    done=[]; failed=[]
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futs=[pool.submit(save_one,x) for x in prepared]
        for idx, fut in enumerate(as_completed(futs),1):
            row, p, url, sid, how = fut.result()
            if p:done.append((row,p,url,sid,how))
            else:failed.append(row)
            if idx % 60 == 0 or idx == len(futs):
                print(f'  Revisados: {idx}/{len(futs)}. Disponibles: {len(done)}. Errores: {len(failed)}.',flush=True)
    # Preservar registros locales existentes aunque no se pueda volver a consultar la fuente.
    already={slug(row['club']) for row,path,url,sid,how in done}
    for row in rows:
        if slug(row['club']) in already:continue
        for ext in ('.svg','.png'):
            p=ASSETS/(slug(row['club']) + ext)
            if p.exists():
                data=p.read_bytes()
                if safe_svg(data) if ext=='.svg' else valid_png(data):
                    done.append((row,p,'local existente',0 if ext=='.svg' else 1,'existente'))
                    already.add(slug(row['club']))
                    break
    mapping=write_registry(done)
    todo = [r for r in rows if slug(r['club']) not in mapping]
    (ROOT/'assets'/'escudos-pendientes.txt').write_text('\n'.join(f"{r['country']} - {r['club']}" for r in todo)+'\n',encoding='utf8')
    print('\nINSTALACIÓN TERMINADA')
    print(f'Escudos locales operativos: {len(mapping)} / {len(rows)}. Pendientes: {len(todo)}.')
    print('Abre index.html normalmente. El resto conservará su escudo generado.')
    print('Los clubes que no existan en la fuente o no coincidan seguirán pendientes.')
    return 0

if __name__=='__main__':
    sys.exit(main())
