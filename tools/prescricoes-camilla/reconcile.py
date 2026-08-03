# Le de volta cada guia e reaplica campo a campo ate o conteudo bater.
# Necessario porque gravar varios campos longos numa unica chamada truncou
# silenciosamente parte do texto em alguns casos.
import json, time, urllib.request
from apply_updates import carregar_token, rich_text, patch

TOKEN = carregar_token()
PRESERVAR = ['quando_usar', 'quando_nao_usar', 'sinais_alerta',
             'criterios_encaminhamento', 'resumo_clinico', 'conduta_procedimento', 'fonte']


def ler(pid):
    req = urllib.request.Request(
        f'https://api.notion.com/v1/pages/{pid}',
        headers={'Authorization': f'Bearer {TOKEN}', 'Notion-Version': '2022-06-28'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)['properties']


def texto(props, nome):
    return ''.join(i.get('plain_text', '') for i in props.get(nome, {}).get('rich_text', []))


def main():
    dados = json.load(open('updates_payload.json', encoding='utf-8'))
    pendentes, perdas = [], []

    for item in dados:
        pid = item['url'].rsplit('/', 1)[-1]
        esperado = {
            'prescricao_medicamentos': item['prescricao'],
            'texto_copiavel_prescricao': item['prescricao'],
        }
        if item['orientacoes']:
            esperado['orientacoes_paciente'] = item['orientacoes']
            esperado['texto_copiavel_orientacoes'] = item['orientacoes']

        for tentativa in range(3):
            props = ler(pid)
            divergentes = [c for c, v in esperado.items() if texto(props, c) != v]
            if not divergentes:
                break
            # reaplica UM campo por chamada
            for campo in divergentes:
                patch(pid, {campo: {'rich_text': rich_text(esperado[campo])}}, TOKEN)
                time.sleep(0.4)
        else:
            pendentes.append((item['guia'], divergentes))

        props = ler(pid)
        vazios = [c for c in PRESERVAR if not texto(props, c).strip()]
        if vazios:
            perdas.append((item['guia'], vazios))
        time.sleep(0.2)

    print(f'guias conferidos: {len(dados)}')
    print(f'  ainda divergentes: {len(pendentes)}')
    for g, c in pendentes:
        print(f'    {g}: {c}')
    print(f'  com campo clinico perdido: {len(perdas)}')
    for g, c in perdas:
        print(f'    {g}: {c}')


if __name__ == '__main__':
    main()
