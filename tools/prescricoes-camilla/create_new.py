# Cria os guias novos no Notion como RASCUNHO.
#
# Dupla protecao para nao ir ao ar sem revisao:
#   pronto_para_supabase = desmarcado  -> sync marca status 'draft' e active=false
#   status_revisao = 'Rascunho'        -> sync tambem forca 'draft'
import json, os, time, urllib.request

from apply_updates import carregar_token, rich_text

DATA_SOURCE = '1ea5a7f5-5c0f-4df8-b8aa-872788b513d0'
NOTION_VERSION = '2025-09-03'
TOKEN = carregar_token()

CAMPOS_TEXTO = ['slug', 'cid10_principal', 'resumo_clinico', 'quando_usar',
                'quando_nao_usar', 'conduta_procedimento', 'prescricao_medicamentos',
                'texto_copiavel_prescricao', 'orientacoes_paciente',
                'texto_copiavel_orientacoes', 'sinais_alerta',
                'criterios_encaminhamento', 'observacoes_clinicas', 'fonte']


def montar_props(item, clinico):
    props = {
        'titulo': {'title': [{'type': 'text', 'text': {'content': item['titulo']}}]},
        'pronto_para_supabase': {'checkbox': False},
        'status_revisao': {'select': {'name': 'Rascunho'}},
        'tipo_protocolo': {'select': {'name': 'Protocolo completo'}},
    }
    valores = dict(clinico)
    valores.setdefault('slug', item['slug'])
    if item['cid10_principal']:
        valores.setdefault('cid10_principal', item['cid10_principal'])
    valores['prescricao_medicamentos'] = item['prescricao']
    valores['texto_copiavel_prescricao'] = item['prescricao']
    if item['orientacoes'] and not valores.get('orientacoes_paciente'):
        valores['orientacoes_paciente'] = item['orientacoes']
    if valores.get('orientacoes_paciente'):
        valores['texto_copiavel_orientacoes'] = valores['orientacoes_paciente']

    for campo in CAMPOS_TEXTO:
        if valores.get(campo):
            props[campo] = {'rich_text': rich_text(valores[campo])}

    for campo in ['especialidade', 'contexto', 'nivel_risco']:
        if clinico.get(campo):
            props[campo] = {'multi_select': [{'name': v} for v in clinico[campo]]}
    return props


def criar(item, clinico):
    body = json.dumps({
        'parent': {'type': 'data_source_id', 'data_source_id': DATA_SOURCE},
        'properties': montar_props(item, clinico),
    }).encode('utf-8')
    req = urllib.request.Request(
        'https://api.notion.com/v1/pages', data=body, method='POST',
        headers={'Authorization': f'Bearer {TOKEN}', 'Notion-Version': NOTION_VERSION,
                 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)['id']


def executar(clinicos):
    """clinicos: {titulo do guia: {campos clinicos}}"""
    itens = {x['titulo']: x for x in json.load(open('novos_payload.json', encoding='utf-8'))}
    criados = json.load(open('criados.json', encoding='utf-8')) if os.path.exists('criados.json') else {}

    for titulo, clinico in clinicos.items():
        if titulo in criados:
            print(f'  (ja existe) {titulo}')
            continue
        if titulo not in itens:
            print(f'  SEM PAYLOAD: {titulo}')
            continue
        try:
            pid = criar(itens[titulo], clinico)
            criados[titulo] = pid
            print(f'  ok  {titulo}')
        except Exception as e:
            print(f'  FALHA {titulo}: {e} {getattr(e, "read", lambda: b"")()[:300]}')
        json.dump(criados, open('criados.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        time.sleep(0.35)

    print(f'\ncriados no total: {len(criados)}')
