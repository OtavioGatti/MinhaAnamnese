# Extrai as condicoes do "Drive de Prescricoes" separando por titulo.
# Sinal de titulo: fonte Arial-BoldMT em tamanho ~23 (corpo usa 16).
import fitz, json, re

PATH = r'C:\Users\caiof\Downloads\Drive de Prescrições Dra. Camilla Rocha atualizado .pdf'
FIRST_CONTENT_PAGE = 10  # 1-based; antes disso e capa/indice
TITLE_SIZE_MIN = 20.0

# Rotulos de secao dentro de uma condicao (negrito tamanho 16).
SECTION_RE = re.compile(
    r'^(uso\s+(oral|interno|externo|topico|t.pico|inalat|nasal|vaginal|retal|oft|otol)\w*'
    r'|na\s+unidade|orienta\w*|observa\w*|aten\w*|importante|dose|posologia)',
    re.IGNORECASE,
)

# Titulos que perderam o negrito no PDF. Sem isso a prescricao deles era
# absorvida pela condicao anterior — a DIP contaminava "DERMATITE DE CONTATO"
# com metronidazol, doxiciclina e ceftriaxona.
# Lista explicita: a varredura do documento inteiro achou so este caso, e a
# heuristica generica pegava texto corrido ("MESMO ASSIM PERSISTIR:") como titulo.
TITULOS_SEM_NEGRITO = {'DIP(1):'}


def e_titulo_perdido(texto):
    return texto.strip() in TITULOS_SEM_NEGRITO


def line_info(line):
    spans = line.get('spans', [])
    text = ''.join(s['text'] for s in spans)
    if not spans:
        return text, 0.0, False
    size = max(s['size'] for s in spans)
    bold = any('Bold' in s['font'] for s in spans)
    return text, size, bold

def main():
    doc = fitz.open(PATH)
    conditions = []
    current = None
    pending_title = []
    pending_page = None

    def flush_title():
        nonlocal current, pending_title, pending_page
        if not pending_title:
            return
        title = re.sub(r'\s+', ' ', ' '.join(pending_title)).strip().strip(':').strip()
        pending_title = []
        if title:
            current = {'titulo': title, 'pagina_pdf': pending_page, 'linhas': []}
            conditions.append(current)

    for pageno in range(FIRST_CONTENT_PAGE - 1, len(doc)):
        d = doc[pageno].get_text('dict')
        for block in d['blocks']:
            for line in block.get('lines', []):
                raw, size, bold = line_info(line)
                text = raw.strip()
                if not text:
                    continue
                # numero de pagina impresso (bold grande, so digitos)
                if re.fullmatch(r'\d{1,3}', text):
                    continue
                # Alguns titulos perderam o negrito no PDF ("DIP(1):") e
                # arrastariam sua prescricao para a condicao anterior.
                if not (bold and size >= TITLE_SIZE_MIN) and e_titulo_perdido(text):
                    flush_title()
                    current = None
                    pending_page = pageno + 1
                    pending_title.append(text)
                    continue
                if bold and size >= TITLE_SIZE_MIN:
                    if current is not None and not pending_title:
                        current = None
                    if pending_page is None or not pending_title:
                        pending_page = pageno + 1
                    pending_title.append(text)
                    continue
                # primeira linha nao-titulo fecha o titulo acumulado
                flush_title()
                pending_page = None
                if current is None:
                    continue
                # O rotulo de secao as vezes vem sem negrito ("Uso Interno:"),
                # e viraria nome de medicamento.
                kind = 'secao' if SECTION_RE.match(text) else 'corpo'
                current['linhas'].append({'t': text, 'k': kind})
    flush_title()

    # descarta blocos sem conteudo util
    conditions = [c for c in conditions if c['linhas']]
    with open('pdf_conditions.json', 'w', encoding='utf-8') as f:
        json.dump(conditions, f, ensure_ascii=False, indent=1)

    print('condicoes extraidas:', len(conditions))
    print('paginas varridas:', FIRST_CONTENT_PAGE, '..', len(doc))

if __name__ == '__main__':
    main()
