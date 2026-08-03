# Prepara o esqueleto dos guias NOVOS: agrupa variantes do PDF, formata a
# prescricao e extrai CID. Os campos clinicos sao escritos a parte.
import json, re, unicodedata
from collections import defaultdict
from format_camilla import formatar_varias

USADOS_EM_UPDATES = set()


def sa(s):
    s = unicodedata.normalize('NFD', s)
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


def slug(s):
    return re.sub(r'-+$', '', re.sub(r'[^a-z0-9]+', '-', sa(s).lower()))[:120].strip('-')


def grupo(t):
    """Chave de agrupamento: tira CID, sufixo numerico e marcador de publico."""
    bruto = sa(t).upper()
    ped0 = bool(re.search(r'CRIANC|BEBE|INFANTIL|PEDIATR|LACTENTE', bruto))
    ges0 = bool(re.search(r'GESTANT|GRAVID|PRE.?NATAL', bruto))
    x = re.sub(r'\([^)]*\)', ' ', t)
    x = sa(x).upper()
    x = re.sub(r'\b\d+\s*(CRISE|CONTROLE)\b|\b(CRISE|CONTROLE)\s*\d+\b', ' ', x)
    x = re.sub(r'\s+\d+\s*$', ' ', x)
    x = re.sub(r'[^A-Z ]+', ' ', x)
    ped = bool(re.search(r'CRIANC|BEBE|INFANTIL|PEDIATR', x))
    ges = bool(re.search(r'GESTANT|GRAVID|PRE NATAL', x))
    x = re.sub(r'\b(CRIANCAS?|BEBES?|INFANTIL|PEDIATRICO|GESTANTES?)\b', ' ', x)
    aud = 'crianca' if (ped or ped0) else ('gestante' if (ges or ges0) else 'adulto')
    return re.sub(r'\s+', ' ', x).strip(), aud


def cid_de(titulos):
    for t in titulos:
        m = re.search(r'\b([A-Z]\d{2}(?:\.\d{1,2})?)\b', sa(t).upper())
        if m:
            return m.group(1)
    return ''


# Condicoes que o material separa mas sao a mesma coisa clinicamente.
# A chave e o grupo normalizado; o valor e o grupo de destino.
FUNDIR = {
    'DISPESIA FUNCIONAL': 'DISPEPSIA FUNCIONAL',
    'SINDROME DISPEPTICA': 'DISPEPSIA FUNCIONAL',
    'IMPETIGO OU ECTIMA': 'IMPETIGO',
    'OXIURIASE': 'ENTEROBIASE INFESTACAO POR OXIUROS',   # enterobiase = oxiuriase
    'URTICARIA AGUDA': 'URTICARIA',
    'DORSALGIA INTENSA': 'DORSALGIA',
    'VACINACAO ANTITETANICA': 'TETANO CONDUTA PARA FERIMENTOS',
    'TONSILITE': 'AMIGDALITE',
    'VERMIFUGO AMPLO ESPECTRO': 'VERMIFUGO',
}

# Titulo final escrito por extenso, com acento e separador. Reconstruir a partir
# da chave normalizada perdia acentos e barras ("ABSCESSO FURUNCULO").
TITULOS = {
    'ABSCESSO FURUNCULO': 'ABSCESSO / FURÚNCULO',
    'AFTAS E GENGIVITE': 'AFTAS E GENGIVITE',
    'AMENORREIA SECUNDARIA': 'AMENORREIA SECUNDÁRIA',
    'AMIGDALITE': 'AMIGDALITE / TONSILITE',
    'ANEMIA': 'ANEMIA FERROPRIVA',
    'ASMA': 'ASMA / CRISE ASMÁTICA',
    'CANDIDIASE VAGINAL CORRIMENTO': 'CANDIDÍASE VAGINAL',
    'CEFALEIA TENSIONAL CEFALEIA DOR DE CABECA': 'CEFALEIA TENSIONAL',
    'CERUME IMPACTADO CERA': 'CERUME IMPACTADO',
    'CERVICITE E URETRITE': 'CERVICITE E URETRITE',
    'CINETOSE': 'CINETOSE',
    'COLELITIASE': 'COLELITÍASE',
    'DERMATITE DE CONTATO REACAO ALERGICA LEVE': 'DERMATITE DE CONTATO / REAÇÃO ALÉRGICA LEVE',
    'DERMATITE SEBORREICA LEVE': 'DERMATITE SEBORREICA LEVE',
    'DERMATOFITOSE INTERDIGITAL PE DE ATLETA': 'DERMATOFITOSE INTERDIGITAL / PÉ DE ATLETA',
    'DIP COMPROMETIMENTO SISTEMICO': 'DOENÇA INFLAMATÓRIA PÉLVICA (DIP)',
    'DISMINORREIA': 'DISMENORREIA',
    'DISPEPSIA FUNCIONAL': 'DISPEPSIA FUNCIONAL / SÍNDROME DISPÉPTICA',
    'DOR MUSCULAR LOMBALGIA ALGIA': 'DOR MUSCULAR / LOMBALGIA',
    'DORSALGIA': 'DORSALGIA',
    'ENTEROBIASE INFESTACAO POR OXIUROS': 'ENTEROBÍASE / OXIURÍASE',
    'ESCABIOSE SARNA': 'ESCABIOSE / SARNA',
    'ESCORIACOES FERIDAS LEVES': 'ESCORIAÇÕES / FERIDAS LEVES',
    'ESRISPELA': 'ERISIPELA',
    'FOLICULITE': 'FOLICULITE',
    'GASES EM': 'CÓLICA / GASES DO LACTENTE',
    'GOTA': 'GOTA',
    'H PYLORI': 'INFECÇÃO POR HELICOBACTER PYLORI',
    'HEMORRAGIA NASAL EPISTAXE LEVE': 'EPISTAXE LEVE',
    'HERPES SIMPLES': 'HERPES SIMPLES',
    'HIPERPLASIA PROSTATA': 'HIPERPLASIA PROSTÁTICA BENIGNA',
    'HIPERTIREOIDISMO': 'HIPERTIREOIDISMO',
    'HIPOTIREOIDISMO': 'HIPOTIREOIDISMO',
    'IMPETIGO': 'IMPETIGO / ECTIMA',
    'INFECCAO DE URINA ITU': 'INFECÇÃO URINÁRIA (ITU)',
    'INSUFICIENCIA VENOSA CRONICA': 'INSUFICIÊNCIA VENOSA CRÔNICA',
    'LABIRINTITE': 'LABIRINTITE',
    'LARVA MIGRANS': 'LARVA MIGRANS CUTÂNEA',
    'MASTALGIA': 'MASTALGIA',
    'MOLUSCO CONTAGIOSO': 'MOLUSCO CONTAGIOSO',
    'NAUSEAS E VOMITOS': 'NÁUSEAS E VÔMITOS NA GESTAÇÃO',
    'ONICOMICOSE': 'ONICOMICOSE',
    'OSTEOPOROSE': 'OSTEOPOROSE',
    'PEDICULOSE': 'PEDICULOSE',
    'PEDICULOSE PUBIANA': 'PEDICULOSE PUBIANA',
    'PEP PROFILAXIA POS EXPOSICAO SEXUAL': 'PEP / PROFILAXIA PÓS-EXPOSIÇÃO SEXUAL',
    'PICADA DE INSETO COM REACAO INFLAMATORIA LOCAL': 'PICADA DE INSETO COM REAÇÃO LOCAL',
    'PRE NATAL': 'PRÉ-NATAL / SUPLEMENTAÇÃO',
    'PSORIASE LEVE': 'PSORÍASE LEVE',
    'PTIRIASE VERSICOLOR': 'PITIRÍASE VERSICOLOR',
    'QUEIMADURA SOLAR LEVE': 'QUEIMADURA SOLAR LEVE',
    'SANGRAMENTO UTERINO': 'SANGRAMENTO UTERINO ANORMAL',
    'SIFILIS': 'SÍFILIS',
    'SINDROME GRIPAL VIRAL SIMPLES': 'SÍNDROME GRIPAL VIRAL',
    'TENIASE': 'TENÍASE',
    'TETANO CONDUTA PARA FERIMENTOS': 'PROFILAXIA ANTITETÂNICA EM FERIMENTOS',
    'TINEA MICOSE DE PELE OU COURO CABELUDO': 'TINEA / MICOSE DE PELE OU COURO CABELUDO',
    'TONSILITE': 'AMIGDALITE / TONSILITE',
    'TOSSE SECA PERSISTENTE': 'TOSSE SECA PERSISTENTE',
    'TRICOMONIASE': 'TRICOMONÍASE',
    'ULCERA PEPTICA DUODENAL': 'ÚLCERA PÉPTICA DUODENAL',
    'URTICARIA': 'URTICÁRIA',
    'VAGINITE MISTA': 'VAGINITE MISTA',
    'VAGINOSE BACTERIANA': 'VAGINOSE BACTERIANA',
    'VARIZES DOS MEMBROS INFERIORES': 'VARIZES DOS MEMBROS INFERIORES',
    'VERMIFUGO': 'PARASITOSE INTESTINAL',
    'VERMIFUGO AMPLO ESPECTRO': 'PARASITOSE INTESTINAL / VERMIFUGAÇÃO',
    'VIROSE': 'SÍNDROME VIRAL',
}


def titulo_final(chave, aud):
    base = TITULOS.get(chave)
    if not base:
        raise SystemExit(f'titulo nao mapeado para o grupo: {chave!r}')
    sufixo = {'adulto': 'ADULTO', 'crianca': 'CRIANÇA', 'gestante': 'GESTANTE'}[aud]
    return f'{base} — {sufixo}'


def main():
    conds = json.load(open('pdf_conditions.json', encoding='utf-8'))
    por_titulo = {c['titulo']: c for c in conds}
    resultado = json.load(open('match_result.json', encoding='utf-8'))

    # titulos ja usados nos guias existentes nao entram nos novos
    usados = set()
    for m in resultado['matched']:
        usados.add(m['pdf']['titulo'])
    for extra in ['SINUSITE AGUDA (J01.9)', 'RINITE ALÉRGICA (J30.9)',
                  'HIPOGLICEMIA SINTOMÁTICA (E16.2)', 'ASMA AGUDA LEVE/MODERADA (J45.0)',
                  'ASMA', 'ASMA CRISE AGUDA', 'ASMA CRISE AGUDA (2)',
                  'ANEMIA FERROPRIVA SINTOMÁTICA (D50.0)', 'NÁUSEAS E VÔMITOS SEVEROS (3)',
                  'NEFROLITÍASE / CÓLICA RENAL (N20.0)', 'VERTIGEM 1', 'VERTIGEM AGUDA',
                  'CRISE HIPERTENSIVA (I10 + R03.0)', 'HIPERTENSÃO ARTERIAL DESCOMPENSADA (I10)',
                  'VERMÍFUGO AMPLO ESPECTRO 1', 'VERMÍFUGO AMPLO ESPECTRO 2',
                  'VERMÍFUGO AMPLO ESPECTRO 3']:
        usados.add(extra)

    grupos = defaultdict(list)
    for c in conds:
        if c['titulo'] in usados:
            continue
        chave, aud = grupo(c['titulo'])
        chave = FUNDIR.get(chave, chave)   # une o que o material separou sem necessidade
        grupos[(chave, aud)].append(c['titulo'])

    novos = []
    for (chave, aud), titulos in sorted(grupos.items()):
        titulos = sorted(set(titulos))
        selecionados = [por_titulo[t] for t in titulos]
        presc, orient = formatar_varias(selecionados)
        if not presc:
            continue
        tit = titulo_final(chave, aud)
        novos.append({
            'titulo': tit,
            'slug': slug(tit),
            'cid10_principal': cid_de(titulos),
            'audiencia': aud,
            'origem_pdf': titulos,
            'prescricao': presc,
            'orientacoes': orient,
        })

    json.dump(novos, open('novos_payload.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f'guias novos: {len(novos)}')
    print(f'  com CID no titulo do PDF: {sum(1 for n in novos if n["cid10_principal"])}')
    for aud in ['adulto', 'crianca', 'gestante']:
        print(f'  {aud}: {sum(1 for n in novos if n["audiencia"] == aud)}')


if __name__ == '__main__':
    main()
