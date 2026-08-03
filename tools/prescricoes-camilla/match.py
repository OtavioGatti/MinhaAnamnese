# Cruza as condicoes do PDF da Camilla com os guias existentes no Notion.
#
# Regra de seguranca: publico-alvo diferente NUNCA pareia. Uma prescricao
# pediatrica dentro de um guia "— ADULTO" seria erro de dose grave.
import json, re, unicodedata
from collections import defaultdict

STOPWORDS = {'DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'A', 'O', 'AS', 'OS', 'EM', 'COM',
             'ADULTO', 'ADULTOS', 'APS', 'PS', 'UBS', 'AGUDA', 'AGUDO', 'LEVE',
             'MODERADA', 'MODERADO', 'SUSPEITA', 'SUSPEITO', 'SINTOMATICA', 'SINTOMATICO'}

CRIANCA_RE = re.compile(r'CRIANC|BEBE|INFANTIL|PEDIATR|LACTENTE|\bANOS\b', re.I)
GESTANTE_RE = re.compile(r'GESTANT|GRAVID|PRE NATAL|PRENATAL|PUERP', re.I)

def strip_accents(s):
    s = unicodedata.normalize('NFD', s)
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')

def norm(s):
    return re.sub(r'[^A-Z0-9]+', ' ', strip_accents(s).upper()).strip()

def cid_key(s):
    return re.sub(r'[^A-Z0-9]', '', strip_accents(s).upper())

def extract_cids(title):
    return [cid_key(m) for m in re.findall(r'\b([A-Z]\d{2}(?:\.\d{1,2})?)\b', strip_accents(title).upper())]

def audience(title):
    n = norm(title)
    if CRIANCA_RE.search(n):
        return 'crianca'
    if GESTANTE_RE.search(n):
        return 'gestante'
    return 'adulto'

def base_title(t):
    t = re.sub(r'\((\d+)\)\s*$', '', t).strip()
    t = re.sub(r'\s+\d+\s*$', '', t).strip()
    return t

def tokens(t):
    # remove o CID do titulo antes de tokenizar
    t = re.sub(r'\([^)]*\)', ' ', t)
    return {w for w in norm(base_title(t)).split() if w not in STOPWORDS and len(w) > 2}

def score(a, b):
    """Jaccard: penaliza subconjunto, diferente do min() que dava 1.00 falso."""
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)

def main():
    conds = json.load(open('pdf_conditions.json', encoding='utf-8'))

    seen, deduped = set(), []
    for c in conds:
        key = (norm(c['titulo']), ' '.join(l['t'] for l in c['linhas']))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(c)

    guides = []
    with open('notion_guides.tsv', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            cid, title = line.rstrip('\n').split('\t', 1)
            guides.append({'cid': cid_key(cid), 'titulo': title,
                           'tokens': tokens(title), 'audiencia': audience(title)})

    by_cid = defaultdict(list)
    for g in guides:
        by_cid[g['cid']].append(g)

    # Frequencia do token entre os guias. Palavra generica ("CRISE", "SINDROME",
    # "BACTERIANA") aparece em varios titulos e nao serve de evidencia: era o que
    # fazia GOTA parear com CRISE HIPERTENSIVA.
    df = defaultdict(int)
    for g in guides:
        for w in g['tokens']:
            df[w] += 1

    def tem_token_distintivo(inter):
        return any(df[w] <= 1 for w in inter)

    matched, novos, ambiguos = [], [], []

    for c in deduped:
        aud = audience(c['titulo'])
        elegiveis = [g for g in guides if g['audiencia'] == aud]

        # 1) CID exato, respeitando publico-alvo
        hits = []
        for cid in extract_cids(c['titulo']):
            hits.extend(g for g in by_cid.get(cid, []) if g['audiencia'] == aud)
        hits = list({g['titulo']: g for g in hits}.values())

        if len(hits) == 1:
            matched.append({'pdf': c, 'guia': hits[0]['titulo'], 'via': 'cid', 'audiencia': aud})
            continue
        if len(hits) > 1:
            ambiguos.append({'pdf': c, 'candidatos': [g['titulo'] for g in hits],
                             'motivo': 'CID aponta para mais de um guia', 'audiencia': aud})
            continue

        # 1b) mesmo bloco de CID (3 primeiros caracteres): J01.9 vs J01.0,
        # N39.0 vs N30.0, J45.0 vs J45.9. Forte indicio de mesma condicao, mas a
        # subcategoria diferente exige confirmacao humana — nunca auto-pareia.
        blocos = {cid[:3] for cid in extract_cids(c['titulo'])}
        vizinhos = [g for g in elegiveis if g['cid'][:3] in blocos] if blocos else []
        if vizinhos:
            ambiguos.append({'pdf': c, 'candidatos': [g['titulo'] for g in vizinhos],
                             'motivo': 'CID do mesmo bloco, subcategoria diferente',
                             'audiencia': aud})
            continue

        # 2) nome, so entre guias do mesmo publico
        ct = tokens(c['titulo'])
        ranked = sorted(((score(ct, g['tokens']), g) for g in elegiveis),
                        key=lambda x: x[0], reverse=True)
        best_score, best = (ranked[0] if ranked else (0.0, None))
        runner_up = ranked[1][0] if len(ranked) > 1 else 0.0

        if best_score >= 0.7 and best_score - runner_up >= 0.15:
            matched.append({'pdf': c, 'guia': best['titulo'],
                            'via': f'nome {best_score:.2f}', 'audiencia': aud})
        elif best_score >= 0.3 and tem_token_distintivo(ct & best['tokens']):
            ambiguos.append({'pdf': c,
                             'candidatos': [g['titulo'] for s, g in ranked[:3]
                                            if s >= 0.3 and tem_token_distintivo(ct & g['tokens'])],
                             'motivo': f'similaridade parcial ({best_score:.2f})', 'audiencia': aud})
        else:
            novos.append({'pdf': c, 'audiencia': aud})

    # agrupa variantes do PDF que caem no mesmo guia (viram Opcao 1, 2, 3...)
    por_guia = defaultdict(list)
    for m in matched:
        por_guia[m['guia']].append(m['pdf']['titulo'])

    out = {'matched': matched, 'ambiguos': ambiguos, 'novos': novos,
           'total_pdf': len(deduped),
           'guias_com_multiplas_variantes': {k: v for k, v in por_guia.items() if len(v) > 1}}
    json.dump(out, open('match_result.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    print(f'condicoes no PDF (dedupe): {len(deduped)}')
    print(f'  ja existem (atualizar): {len(matched)}  -> {len(por_guia)} guias distintos')
    print(f'  ambiguas (decidir):     {len(ambiguos)}')
    print(f'  novas (criar):          {len(novos)}')
    print()
    print('publico-alvo das novas:')
    from collections import Counter
    for k, v in Counter(n['audiencia'] for n in novos).items():
        print(f'  {k}: {v}')

if __name__ == '__main__':
    main()
