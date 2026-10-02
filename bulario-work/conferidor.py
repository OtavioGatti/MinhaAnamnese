"""Conferidor de completude: doses da bula sem correspondência no texto escrito.

Uso: python conferidor.py <saida.json> <fonte1.txt> [fonte2.txt ...]
Para cada dose com unidade na seção 8 (POSOLOGIA) das fontes, guarda as
palavras significativas ao redor ("sublingual", "pânico", "crise"...). A dose só
conta como coberta se aparecer no texto escrito com pelo menos uma dessas
palavras por perto. Não julga se a omissão é aceitável — só lista para revisão.
"""
import json
import re
import sys
import unicodedata

UNIDADE = r'(?:mg/kg(?:/dia)?|mg/m2|mg/m²|mcg/kg|microgramas?|mcg|µg|mg|g|mL|ml|gotas?|UI)'
DOSE = re.compile(rf'(\d+(?:[.,]\d+)?)(?:\s*(?:a|-|–|até|ou)\s*(\d+(?:[.,]\d+)?))?\s*({UNIDADE})\b', re.IGNORECASE)
PARADAS = set('''
    para com sem pelo pela pelos pelas entre sobre deve devem pode podem dose doses dias vezes cada
    administrar administrado administrada paciente pacientes usual máxima maxima mínima minima diária diaria
    inicial conforme quando após apos antes durante recomendada recomendado tratamento medicamento
    comprimido comprimidos também tambem outros outras sendo seguida seguido total
'''.split())
JANELA_FONTE = 90
JANELA_TEXTO = 160


def sem_acento(texto):
    return ''.join(c for c in unicodedata.normalize('NFD', texto.lower()) if unicodedata.category(c) != 'Mn')


def numero(valor):
    valor = valor.replace('.', ',')
    return valor.rstrip('0').rstrip(',') if ',' in valor else valor


def unidade(valor):
    u = valor.lower().replace('µg', 'mcg').replace('m²', 'm2')
    if u.startswith('micrograma'):
        return 'mcg'
    if u.startswith('gota'):
        return 'gota'
    if u.startswith('mg/kg'):
        return 'mg/kg'  # mg/kg e mg/kg/dia: mesma dose, grafia diferente
    return 'mL' if u == 'ml' else u


def ocorrencias(texto):
    for m in DOSE.finditer(texto):
        for bruto in (m.group(1), m.group(2)):
            if bruto:
                yield (numero(bruto), unidade(m.group(3))), m.start(), m.end()


# Só palavras que distinguem cenários clínicos (via, idade, situação). Paráfrase
# troca o resto do vocabulário e gerava falso alarme.
DISTINTIVAS = [
    'sublingu', 'crise', 'panico', 'epileps', 'intraven', 'intramus', 'infus', 'bolus', 'subcut',
    'oral', 'gota', 'xarope', 'suspens', 'retal', 'supositor', 'injet', 'ampola',
    'crianc', 'pediatr', 'lactent', 'neonat', 'recem', 'adolesc', 'idoso', 'geriatr',
    'renal', 'creatinin', 'clearance', 'hepat', 'dialis', 'hemodial',
    'maxim', 'ataque', 'manutenc', 'profilax', 'prevenc', 'retirada', 'descontinu', 'reduc',
    'gonorr', 'pylori', 'cirurg', 'operat', 'quimioter', 'radioter', 'emetog', 'gestan', 'gravid',
]


def palavras(trecho):
    base = sem_acento(trecho)
    return {d for d in DISTINTIVAS if d in base}


def secao_posologia(texto):
    pedacos = re.findall(r'(?ms)^\s*8\.\s*POSOLOGIA.*?(?=^\s*9\.\s*REA|\Z)', texto)
    return '\n'.join(pedacos) if pedacos else texto


def main():
    saida = json.load(open(sys.argv[1], encoding='utf-8'))
    escrito = '\n'.join(str(v) for k, v in saida.items() if not k.startswith('_'))
    contextos = {}
    for chave, ini, fim in ocorrencias(escrito):
        contextos.setdefault(chave, []).append(palavras(escrito[max(0, ini - JANELA_TEXTO):fim + JANELA_TEXTO]))

    faltando = {}
    for fonte in sys.argv[2:]:
        texto = secao_posologia(open(fonte, encoding='utf-8').read())
        for chave, ini, fim in ocorrencias(texto):
            perto = palavras(texto[max(0, ini - JANELA_FONTE):fim + JANELA_FONTE])
            if not perto:
                continue
            if any(perto & ctx for ctx in contextos.get(chave, [])):
                continue
            trecho = re.sub(r'\s+', ' ', texto[max(0, ini - 60):fim + 40]).strip()
            faltando.setdefault(f'{chave[0]} {chave[1]}', trecho)

    print(f'{sys.argv[1]}: {len(faltando)} dose(s) da bula sem correspondência no texto')
    for dose, trecho in faltando.items():
        print(f'  - {dose}: "...{trecho}..."')


if __name__ == '__main__':
    main()
