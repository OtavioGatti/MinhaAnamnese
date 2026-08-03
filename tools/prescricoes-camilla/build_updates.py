# Monta o conteudo final (prescricao + orientacoes) de cada guia existente que
# recebera as prescricoes da Camilla.
import json
from format_camilla import formatar_varias

# Decisoes do dono + pareamento automatico. Guia -> titulos do PDF (em ordem).
MAPA = {
    'SINUSITE AGUDA / RINOSSINUSITE AGUDA BACTERIANA': ['SINUSITE AGUDA (J01.9)'],
    'DENGUE — ADULTO': ['DENGUE (A90)'],
    'CONJUNTIVITE — ADULTO': ['CONJUNTIVITE (H10.9)'],
    'CONSTIPAÇÃO INTESTINAL — ADULTO': ['CONSTIPAÇÃO FUNCIONAL (K59.0)'],
    'CONVULSÃO / CRISE EPILÉPTICA — ADULTO': ['CRISE CONVULSIVA / EPILEPSIA (G40.9)'],
    'CÓLICA BILIAR — ADULTO': ['CÓLICA BILIAR / LITÍASE BILIAR / PEDRA NOS RINS (K80.2)'],
    'DIABETES MELLITUS TIPO 2 DESCOMPENSADO — ADULTO': ['HIPERGLICEMIA / DESCOMPENSAÇÃO DO DM2 (E11.9)'],
    'DOENÇA DO REFLUXO GASTROESOFÁGICO — ADULTO': ['GASTRITE / DRGE / DISPEPSIA / DOR NO ESTÔMAGO (K29.7 / K21.9 / K30)'],
    'DPOC EXACERBADO — ADULTO': ['DPOC EM EXACERBAÇÃO (J44.1)'],
    'FARINGITE VIRAL — ADULTO': ['FARINGITE VIRAL / FARINGOAMIGDALITE VIRAL (J02.9)'],
    'GASTROENTERITE AGUDA / DIARREIA AGUDA — ADULTO': ['GECA (GASTROENTERITE AGUDA) (A09)'],
    'HEMORROIDA SINTOMÁTICA — ADULTO': ['HEMORROIDA (I84.9)'],
    'INTOXICAÇÃO ALIMENTAR — ADULTO': ['INTOXICAÇÃO ALIMENTAR LEVE (T62.9 / A05.9)'],
    'OTITE EXTERNA — ADULTO': ['OTITE EXTERNA (H60.3)'],
    'OTITE MÉDIA AGUDA — ADULTO': ['OTITE MÉDIA AGUDA (H66.0)'],
    'PNEUMONIA ADQUIRIDA NA COMUNIDADE (PAC) — ADULTO': ['PNEUMONIAS / PNEUMONIA / BRONCOPNEUMONIA / BCP (J18.9)'],
    'PROSTATITE – ADULTO': ['PROSTATITE'],
    'RINITE ALÉRGICA — ADULTO': ['RINITE ALÉRGICA (J30.9)'],
    'ANSIEDADE / CRISE DE PÂNICO — ADULTO': ['SÍNDROME ANSIOSA / CRISE DE ANSIEDADE LEVE (F41.0)'],
    'CEFALEIA AGUDA / ENXAQUECA — ADULTO': ['ENXAQUECA / MIGRÂNEA (G43.9)'],
    'INSÔNIA AGUDA — ADULTO': ['INSÔNIA LEVE/MODERADA (G47.0)'],
    'HIPOGLICEMIA — ADULTO': ['HIPOGLICEMIA SINTOMÁTICA (E16.2)'],
    'ANEMIA — ADULTO': ['ANEMIA FERROPRIVA SINTOMÁTICA (D50.0)'],
    'NÁUSEAS E VÔMITOS AGUDOS — ADULTO': ['NÁUSEAS E VÔMITOS SEVEROS (3)'],
    'CÓLICA RENAL — ADULTO': ['NEFROLITÍASE / CÓLICA RENAL (N20.0)'],
    'CRISE HIPERTENSIVA — ADULTO': ['CRISE HIPERTENSIVA (I10 + R03.0)'],
    'HIPERTENSÃO ARTERIAL SISTÊMICA (HAS) — ADULTO': ['HIPERTENSÃO ARTERIAL DESCOMPENSADA (I10)'],
    # Variantes agrupadas como Opcao 1..N
    'ASMA / EXACERBAÇÃO ASMÁTICA — ADULTO': [
        'ASMA', 'ASMA CRISE AGUDA', 'ASMA CRISE AGUDA (2)', 'ASMA AGUDA LEVE/MODERADA (J45.0)',
    ],
    'VERTIGEM PERIFÉRICA — ADULTO': ['VERTIGEM 1', 'VERTIGEM AGUDA'],
    'PARASITOSE INTESTINAL — ADULTO': [
        'VERMÍFUGO AMPLO ESPECTRO 1', 'VERMÍFUGO AMPLO ESPECTRO 2', 'VERMÍFUGO AMPLO ESPECTRO 3',
    ],
}



def main():
    conds = {c['titulo']: c for c in json.load(open('pdf_conditions.json', encoding='utf-8'))}
    urls = {}
    for line in open('notion_urls.tsv', encoding='utf-8'):
        if line.strip():
            u, t = line.rstrip('\n').split('\t', 1)
            urls[t] = u

    saida, faltando = [], []
    for guia, titulos in MAPA.items():
        selecionados = [conds[t] for t in titulos if t in conds]
        ausentes = [t for t in titulos if t not in conds]
        if ausentes:
            faltando.append((guia, ausentes))
        if not selecionados:
            continue
        presc, orient = formatar_varias(selecionados)
        saida.append({
            'guia': guia,
            'url': urls.get(guia, ''),
            'origem_pdf': titulos,
            'prescricao': presc,
            'orientacoes': orient,
        })

    json.dump(saida, open('updates_payload.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f'guias preparados: {len(saida)}')
    print(f'sem URL do Notion: {[s["guia"] for s in saida if not s["url"]]}')
    if faltando:
        print('titulos do PDF nao encontrados:')
        for g, a in faltando:
            print(f'  {g}: {a}')
    com_orient = sum(1 for s in saida if s['orientacoes'])
    print(f'guias com orientacoes da Camilla: {com_orient}')


if __name__ == '__main__':
    main()
