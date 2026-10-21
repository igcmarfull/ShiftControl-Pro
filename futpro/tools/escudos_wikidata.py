#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Segunda pasada de escudos para FutPro: completa con el logo que Wikidata asocia al club.

Solo toma clubes de fútbol (P31/P641) del mismo país y con nombre equivalente.
No toca partidas ni el motor. Guarda en assets/crests-wiki/ y registra en js/crests-wiki.js,
que se carga después de crests-local.js y solo rellena los que falten.
Los escudos están sujetos a marcas registradas: revisar permisos antes de distribuir el juego.
Usar: python3 tools/escudos_wikidata.py [--dry-run] [--jobs N]
"""
from __future__ import annotations
import argparse, csv, json, re, sys, time, unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent))
import instalar_escudos as I

ROOT = I.ROOT
OUT = ROOT / 'assets' / 'crests-wiki'
REG = ROOT / 'js' / 'crests-wiki.js'
CSV = ROOT / 'assets' / 'escudos-wikidata.csv'
LOCAL = ROOT / 'js' / 'crests-local.js'
UA = {'User-Agent': 'FutPro-Crests/1.0 (juego offline; contacto: usuario del proyecto)'}
API = 'https://www.wikidata.org/w/api.php'

CNAME = {
    'CHI': 'Chile', 'ARG': 'Argentina', 'BRA': 'Brazil', 'URU': 'Uruguay', 'PAR': 'Paraguay', 'COL': 'Colombia',
    'PER': 'Peru', 'ECU': 'Ecuador', 'BOL': 'Bolivia', 'VEN': 'Venezuela', 'ENG': 'United Kingdom', 'WAL': 'United Kingdom',
    'SCO': 'United Kingdom', 'ESP': 'Spain', 'ITA': 'Italy', 'GER': 'Germany', 'FRA': 'France', 'POR': 'Portugal',
    'NED': 'Netherlands', 'BEL': 'Belgium', 'TUR': 'Turkey', 'GRE': 'Greece', 'SUI': 'Switzerland', 'AUT': 'Austria',
    'DEN': 'Denmark', 'SWE': 'Sweden', 'NOR': 'Norway', 'POL': 'Poland', 'CZE': 'Czech Republic', 'USA': 'United States of America',
    'MEX': 'Mexico', 'CAN': 'Canada', 'CRC': 'Costa Rica', 'KSA': 'Saudi Arabia', 'JPN': 'Japan', 'KOR': 'South Korea',
    'CHN': "People's Republic of China", 'AUS': 'Australia', 'EGY': 'Egypt', 'MAR': 'Morocco', 'RSA': 'South Africa',
    'TUN': 'Tunisia', 'ALG': 'Algeria', 'SRB': 'Serbia', 'RUS': 'Russia', 'ROU': 'Romania', 'IRN': 'Iran', 'BUL': 'Bulgaria',
    'UKR': 'Ukraine', 'ISR': 'Israel', 'HUN': 'Hungary', 'UZB': 'Uzbekistan', 'IND': 'India', 'UAE': 'United Arab Emirates',
    'ISL': 'Iceland', 'HRV': 'Croatia', 'FIN': 'Finland', 'QAT': 'Qatar', 'IRL': 'Republic of Ireland', 'CYP': 'Cyprus',
    'SLV': 'El Salvador', 'THA': 'Thailand', 'GUA': 'Guatemala', 'HON': 'Honduras', 'JAM': 'Jamaica', 'PAN': 'Panama',
}
CLUB_TYPES = {'Q476028', 'Q847017', 'Q103229495', 'Q15944511', 'Q1194951'}  # club de fútbol, club deportivo, etc.
SOCCER = 'Q2736'


def call(params, tries=3):
    url = API + '?' + urlencode(dict(params, format='json'))
    for k in range(tries):
        try:
            with urlopen(Request(url, headers=UA), timeout=30) as r:
                return json.loads(r.read().decode('utf-8'))
        except Exception:
            if k == tries - 1: raise
            time.sleep(1.5 * (k + 1))


def claim_ids(ent, prop):
    out = []
    for c in ent.get('claims', {}).get(prop, []):
        v = c.get('mainsnak', {}).get('datavalue', {}).get('value')
        if isinstance(v, dict) and 'id' in v: out.append(v['id'])
    return out


def logo_file(ent):
    best = None
    for c in ent.get('claims', {}).get('P154', []):
        v = c.get('mainsnak', {}).get('datavalue', {}).get('value')
        if not isinstance(v, str): continue
        if c.get('rank') == 'deprecated': continue
        if c.get('rank') == 'preferred': return v
        # Sin fecha de fin = vigente.
        if 'P582' not in c.get('qualifiers', {}) and best is None: best = v
    return best


def variants(name):
    n = re.sub(r'\s*\([^)]*\)', '', name).strip()
    out = [n]
    if not re.search(r'\b(fc|cf|sc|ac|club|deportivo)\b', n.lower()): out.append(n + ' FC')
    return list(dict.fromkeys(out))


def find(row, cache):
    """Devuelve (qid, label, archivo) o None."""
    country = CNAME.get(row['country'])
    qn = I.slug(re.sub(r'\s*\([^)]*\)', '', row['club']))
    cands = []
    for v in variants(row['club']):
        for lang in ('en', 'es'):
            try:
                r = call({'action': 'wbsearchentities', 'search': v, 'language': lang, 'type': 'item', 'limit': 6})
            except Exception:
                continue
            for s in r.get('search', []):
                if s['id'] not in [c[0] for c in cands]: cands.append((s['id'], s.get('label', '')))
        if cands: break
    if not cands: return None
    ids = [c[0] for c in cands]
    ents = call({'action': 'wbgetentities', 'ids': '|'.join(ids), 'props': 'claims|labels', 'languages': 'en|es'}).get('entities', {})
    need = set()
    for e in ents.values():
        need.update(claim_ids(e, 'P17'))
    names = cache.get('names', {})
    miss = [q for q in need if q not in names]
    for i in range(0, len(miss), 40):
        r = call({'action': 'wbgetentities', 'ids': '|'.join(miss[i:i + 40]), 'props': 'labels', 'languages': 'en'}).get('entities', {})
        for q, e in r.items(): names[q] = e.get('labels', {}).get('en', {}).get('value', '')
    cache['names'] = names
    for qid, label in cands:
        e = ents.get(qid)
        if not e: continue
        if not (set(claim_ids(e, 'P31')) & CLUB_TYPES or SOCCER in claim_ids(e, 'P641')): continue
        if SOCCER not in claim_ids(e, 'P641') and not (set(claim_ids(e, 'P31')) & {'Q476028'}): continue
        ctry = [names.get(q, '') for q in claim_ids(e, 'P17')]
        if country and ctry and country not in ctry: continue
        f = logo_file(e)
        if not f: continue
        labels = [x['value'] for x in e.get('labels', {}).values()]
        ok = any(I.slug(l) == qn for l in labels) or any(
            SequenceMatcher(None, I.slug(l), qn).ratio() >= 0.82 for l in labels)
        if ok: return qid, label, f
    return None


def download(fname):
    ext = fname.rsplit('.', 1)[-1].lower()
    base = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + quote(fname.replace(' ', '_'))
    url = base if ext == 'svg' else base + '?width=256'
    for k in range(3):
        try:
            with urlopen(Request(url, headers=UA), timeout=40) as r:
                data = r.read(4_000_000)
                return data, ('svg' if ext == 'svg' else 'png'), url
        except Exception:
            time.sleep(2 * (k + 1))
    return None, None, None


def work(row, cache):
    out = OUT / (I.slug(row['club']))
    try:
        hit = find(row, cache)
        if not hit: return row, None, 'sin coincidencia en Wikidata'
        qid, label, f = hit
        data, ext, url = download(f)
        if not data: return row, None, 'descarga fallida'
        if ext == 'svg':
            if not I.safe_svg(data): return row, None, 'SVG no seguro o muy pesado'
        elif not I.valid_png(data):
            return row, None, 'imagen no válida (no PNG)'
        path = out.with_suffix('.' + ext)
        path.write_bytes(data)
        return row, (path, qid, label, url), 'ok'
    except Exception as e:
        return row, None, 'error: ' + str(e)[:60]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--jobs', type=int, default=4)
    ap.add_argument('--limit', type=int, default=0)
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    cat = json.loads(I.CATALOG.read_text(encoding='utf-8'))['clubs']
    have = set(re.findall(r'"([^"]+)":\s*"assets', LOCAL.read_text(encoding='utf-8')))
    todo, seen = [], set()
    for c in cat:
        s = I.slug(c['club'])
        if s in have or s in seen: continue
        seen.add(s); todo.append(c)
    if a.limit: todo = todo[:a.limit]
    print('Pendientes tras los repositorios:', len(todo))
    done, bad, cache = [], [], {}
    with ThreadPoolExecutor(max_workers=max(1, min(6, a.jobs))) as ex:
        futs = [ex.submit(work, r, cache) for r in todo]
        for i, f in enumerate(as_completed(futs), 1):
            row, res, why = f.result()
            (done if res else bad).append((row, res, why))
            if i % 25 == 0: print('  %d/%d con escudo: %d' % (i, len(todo), len(done)))
    mapping = {I.slug(r['club']): 'assets/crests-wiki/' + res[0].name for r, res, w in done}
    js = '/* FutPro: escudos de Wikidata/Commons para los clubes que faltan, generado por tools/escudos_wikidata.py. */\n'
    js += '(function(){\n  var FP=window.FP=window.FP||{}; FP.CRESTS=FP.CRESTS||{}; var m=' + json.dumps(mapping, ensure_ascii=False, sort_keys=True, indent=2) + ';\n'
    js += '  Object.keys(m).forEach(function(k){ if (!FP.CRESTS[k]) FP.CRESTS[k] = m[k]; });\n})();\n'
    REG.write_text(js, encoding='utf-8')
    with CSV.open('w', newline='', encoding='utf-8') as f:
        w = csv.writer(f); w.writerow(('Club', 'País', 'Ruta', 'Wikidata', 'Etiqueta', 'URL', 'Estado'))
        for r, res, why in sorted(done, key=lambda x: (x[0]['country'], x[0]['club'])):
            w.writerow((r['club'], r['country'], res[0].relative_to(ROOT), res[1], res[2], res[3], 'ok'))
        for r, res, why in sorted(bad, key=lambda x: (x[0]['country'], x[0]['club'])):
            w.writerow((r['club'], r['country'], '', '', '', '', why))
    print('Con escudo de Wikidata: %d | sin coincidencia: %d' % (len(done), len(bad)))


if __name__ == '__main__':
    main()
