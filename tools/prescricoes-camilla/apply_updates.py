# Aplica as prescricoes da Camilla nos guias existentes do Notion.
# Preserva TODOS os demais campos (resumo, quando usar, sinais de alerta, fonte).
import json, os, re, sys, time, urllib.request

NOTION_VERSION = '2022-06-28'
MAX_RICH_TEXT = 1900  # limite da API e 2000 por objeto; margem de seguranca


def carregar_token():
    env = os.path.join('C:\\', 'dev', 'MinhaAnamnese', 'backend', '.env')
    for linha in open(env, encoding='utf-8'):
        if linha.startswith('NOTION_API_KEY='):
            return linha.split('=', 1)[1].strip().strip('"').strip("'")
    raise SystemExit('NOTION_API_KEY nao encontrada')


def rich_text(texto):
    """Divide em blocos <2000 chars, quebrando em linha quando possivel."""
    partes, resto = [], texto
    while resto:
        if len(resto) <= MAX_RICH_TEXT:
            partes.append(resto)
            break
        corte = resto.rfind('\n', 0, MAX_RICH_TEXT)
        if corte <= 0:
            corte = MAX_RICH_TEXT
        partes.append(resto[:corte])
        resto = resto[corte:]
    return [{'type': 'text', 'text': {'content': p}} for p in partes]


def patch(page_id, props, token):
    body = json.dumps({'properties': props}).encode('utf-8')
    req = urllib.request.Request(
        f'https://api.notion.com/v1/pages/{page_id}',
        data=body, method='PATCH',
        headers={
            'Authorization': f'Bearer {token}',
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json',
        })
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status


def main():
    token = carregar_token()
    dados = json.load(open('updates_payload.json', encoding='utf-8'))
    feitos = json.load(open('applied.json', encoding='utf-8')) if os.path.exists('applied.json') else []

    for item in dados:
        if item['guia'] in feitos:
            continue
        page_id = item['url'].rsplit('/', 1)[-1]
        props = {
            'prescricao_medicamentos': {'rich_text': rich_text(item['prescricao'])},
            'texto_copiavel_prescricao': {'rich_text': rich_text(item['prescricao'])},
        }
        if item['orientacoes']:
            props['orientacoes_paciente'] = {'rich_text': rich_text(item['orientacoes'])}
            props['texto_copiavel_orientacoes'] = {'rich_text': rich_text(item['orientacoes'])}
        try:
            status = patch(page_id, props, token)
            feitos.append(item['guia'])
            print(f'  ok {status}  {item["guia"]}')
        except Exception as e:
            detalhe = getattr(e, 'read', lambda: b'')()
            print(f'  FALHA  {item["guia"]}: {e} {detalhe[:300]}')
        json.dump(feitos, open('applied.json', 'w', encoding='utf-8'))
        time.sleep(0.35)  # respeita rate limit da API do Notion

    print(f'\ntotal aplicado: {len(feitos)}/{len(dados)}')


if __name__ == '__main__':
    main()
