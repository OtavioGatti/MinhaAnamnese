# Converte as condicoes extraidas do PDF para o formato usado no Notion.
#
# Formato alvo (igual ao dos 76 guias atuais):
#   texto_copiavel_prescricao:  "-Opcao N: <cenario>" + "[i] Item ----" + posologia
#   orientacoes_paciente:       linhas iniciadas por "-"
import re

SEP = '-' * 40

# Rotulos de secao que sao ORIENTACAO ao paciente, nao prescricao.
ORIENTACAO_RE = re.compile(r'^(orienta|observa|aten|importante)', re.I)
# Rotulo que indica administracao na unidade (EV/IM) — vira opcao propria.
UNIDADE_RE = re.compile(r'^na\s+unidade', re.I)
# Inicio de item numerado: "1 ) X", "1. X", "1) X"
ITEM_RE = re.compile(r'^(\d{1,2})\s*[\).\-]\s*(.+)$')


# Conectores que deixam a linha claramente incompleta ("... + analgesia com").
CONECTOR_FINAL_RE = re.compile(r'(?:[,;+(\-]|\b(?:com|de|da|do|em|e|ou|para|a|no|na|por|se))$', re.I)
# Inicio de posologia: nunca deve ser colado ao nome do medicamento.
POSOLOGIA_RE = re.compile(
    r'^(tomar|aplicar|fazer|usar|nebulizar|diluir|instilar|repetir|inalar|'
    r'administrar|ingerir|manter|realizar|pingar|borrifar|passar)\b', re.I)


def _continua_linha(anterior, atual):
    """A linha atual e continuacao da anterior (quebra de largura do PDF)?"""
    if ITEM_RE.match(atual) or POSOLOGIA_RE.match(atual):
        return False
    if atual[:1].islower():
        return True
    return bool(CONECTOR_FINAL_RE.search(anterior.rstrip()))


# Marcador de layout que o PDF injeta no meio do texto e vaza na extracao.
ARTEFATO_PDF = re.compile(r'\[\s*Quebra\s+da\s+Disposi\S*\s+de\s+Texto\s*\]', re.I)


def _limpar(t):
    return re.sub(r'\s{2,}', ' ', ARTEFATO_PDF.sub(' ', t)).strip()


def _join_wrapped(linhas):
    """Reune linhas quebradas pela largura da pagina do PDF."""
    out = []
    for l in linhas:
        t = _limpar(l['t'])
        if not t:
            continue
        if l['k'] == 'secao':
            out.append({'k': 'secao', 't': t})
            continue
        if out and out[-1]['k'] == 'corpo' and _continua_linha(out[-1]['t'], t):
            out[-1]['t'] = f'{out[-1]["t"]} {t}'
            continue
        out.append({'k': 'corpo', 't': t})
    return out


def _blocos(linhas):
    """Divide em blocos {rotulo, itens[]} conforme os rotulos de secao."""
    blocos, atual = [], None
    for l in _join_wrapped(linhas):
        if l['k'] == 'secao':
            atual = {'rotulo': l['t'].rstrip(':').strip(), 'linhas': []}
            blocos.append(atual)
            continue
        if atual is None:
            atual = {'rotulo': '', 'linhas': []}
            blocos.append(atual)
        atual['linhas'].append(l['t'])
    return blocos


def _itens(linhas):
    """Agrupa em (cabecalho do item, posologia). Linhas soltas viram item sem numero."""
    itens, atual = [], None
    proximo_e_alternativa = False
    for t in linhas:
        # "Ou" isolado marca que o proximo item substitui o anterior, nao soma.
        if re.fullmatch(r'ou', t.strip(), re.I):
            proximo_e_alternativa = True
            continue
        m = ITEM_RE.match(t)
        if m or atual is None:
            nome = m.group(2).strip() if m else t
            if proximo_e_alternativa:
                nome = f'{nome} (alternativa ao item anterior)'
                proximo_e_alternativa = False
            atual = {'nome': nome, 'posologia': []}
            itens.append(atual)
            continue
        # O PDF as vezes quebra o nome do medicamento em varias linhas soltas
        # ("Tioconazol+Tinidazol" / "creme" / "vaginal" / "(Cartrax)"). Enquanto
        # o nome ainda estiver vazio, as linhas seguintes o completam.
        if not re.search(r'[A-Za-zÀ-ÿ]', atual['nome']) and not POSOLOGIA_RE.match(t):
            atual['nome'] = f'{atual["nome"]} {t}'.strip()
            continue
        atual['posologia'].append(t)
    return itens


def formatar(condicao, numero_opcao=1, rotulo_opcao=None):
    """Devolve (prescricao_texto, orientacoes_texto, proxima_opcao).

    UMA entrada do PDF = UMA opcao. As vias (uso oral, uso topico, na unidade)
    sao partes COMPLEMENTARES da mesma prescricao — viram subtitulos dentro da
    opcao, com numeracao continua. Nao sao alternativas entre si.
    Opcoes de verdade sao as variantes numeradas do PDF (GOTA 1, GOTA 2...),
    tratadas em formatar_varias.
    """
    corpo, orient_linhas = [], []
    numero_item = 1

    for bloco in _blocos(condicao['linhas']):
        rotulo = bloco['rotulo']
        if ORIENTACAO_RE.match(rotulo):
            for t in bloco['linhas']:
                orient_linhas.append(f'-{t.rstrip()}')
            continue

        itens = _itens(bloco['linhas'])
        if not itens:
            continue

        if rotulo:
            corpo.append(f'{rotulo.strip().capitalize()}:')
            corpo.append('')

        for item in itens:
            # O PDF ja traz "Nome ------ 10 cp."; normaliza para o separador
            # padrao em vez de acrescentar um segundo tracejado.
            m = re.match(r'^(.*?)\s*-{3,}\s*(.*)$', item['nome'])
            nome, qtd = (m.group(1).strip(), m.group(2).strip()) if m else (item['nome'], '')
            # numeracao residual do PDF ("1. Tioconazol...") — a nossa e o [i]
            nome = re.sub(r'^\d{1,2}\s*[\).\-]\s*', '', nome).strip()
            corpo.append(f'[{numero_item}] {nome} {SEP}' + (f' {qtd}' if qtd else ''))
            corpo.append('')
            if item['posologia']:
                corpo.append(' '.join(item['posologia']).strip())
                corpo.append('')
            numero_item += 1

    if not corpo:
        return '', '\n'.join(orient_linhas), numero_opcao

    cabecalho = rotulo_opcao or condicao['titulo']
    texto = '\n'.join([f'-Opção {numero_opcao}: {cabecalho}', ''] + corpo).rstrip()
    # O marcador de layout tambem se forma DEPOIS da juncao, quando ele estava
    # partido entre duas linhas do PDF — por isso a limpeza final.
    texto = ARTEFATO_PDF.sub(' ', texto)
    orient = ARTEFATO_PDF.sub(' ', '\n'.join(orient_linhas))
    return texto, orient, numero_opcao + 1


def formatar_varias(condicoes, rotulos=None):
    """Cada variante do PDF vira uma Opcao alternativa do mesmo guia."""
    presc, orient, n = [], [], 1
    for c in condicoes:
        rotulo = (rotulos or {}).get(c['titulo'])
        p, o, n = formatar(c, n, rotulo)
        if p:
            presc.append(p)
        if o:
            orient.append(o)
    return '\n\n'.join(presc), '\n'.join(orient)
