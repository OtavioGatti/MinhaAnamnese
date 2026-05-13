import argparse
import csv
import json
import os
import re
import time
import unicodedata
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path


DEFAULT_DATA_SOURCE_ID = "358da8a9-2980-81a7-9599-000babb17913"
NOTION_VERSION = "2026-03-11"

FIELDS = [
    "titulo",
    "especialidade",
    "condicao_clinica",
    "subcondicao",
    "contexto",
    "tipo_de_conduta",
    "medicamento",
    "apresentacao",
    "dose",
    "via",
    "frequencia",
    "duracao",
    "diluicao",
    "modo_de_uso",
    "orientacoes",
    "sinais_de_alerta",
    "cuidados",
    "observacoes",
    "tags",
    "fonte_arquivo",
    "fonte_pagina",
    "fonte_secao",
    "texto_original",
    "confianca_extracao",
    "status_revisao",
    "slug",
]

HIGH_RISK_TERMS = [
    "bic",
    "mcg/kg/min",
    "mcg/min",
    "emergencia",
    "emergência",
    "choque",
    "sepse",
    "trombol",
    "nitroprussiato",
    "nitroglicerina",
    "noradrenalina",
    "dobutamina",
    "dopamina",
    "adrenalina",
    "amiodarona",
    "heparina",
    "insulina",
    "potassio",
    "potássio",
    "sodio",
    "sódio",
    "hipercalemia",
    "hiponatremia",
    "cetoacidose",
    "sedacao",
    "sedação",
    "intubacao",
    "intubação",
]

CONDITION_GUIDANCE = [
    (
        ["dengue"],
        {
            "orientacoes": "Manter hidratação, repouso relativo e retorno conforme classificação de risco e fase da doença.",
            "sinais_de_alerta": "Dor abdominal intensa, vômitos persistentes, sangramento de mucosa, lipotimia/hipotensão, letargia/irritabilidade, dispneia, oligúria ou piora clínica.",
            "cuidados": "Evitar AAS e anti-inflamatórios não esteroidais em suspeita de dengue. Avaliar com cautela gestantes, idosos e comorbidades.",
        },
    ),
    (
        ["crise hipertensiva", "urgencia hipertensiva", "emergencia hipertensiva", "hipertensiva"],
        {
            "orientacoes": "Confirmar medida, avaliar sintomas e sinais de lesão de órgão-alvo antes de definir tratamento.",
            "sinais_de_alerta": "Dor torácica, dispneia, déficit neurológico, confusão, alteração visual, síncope, injúria renal aguda, gestação/eclâmpsia.",
            "cuidados": "Não reduzir PA rapidamente sem indicação. Conduta depende de órgão-alvo, comorbidades, monitorização e protocolo local.",
        },
    ),
    (
        ["insuficiencia cardiaca", "insuficiência cardíaca", "edema agudo"],
        {
            "orientacoes": "Avaliar saturação, ECG, congestão, perfusão, função renal e necessidade de suporte ventilatório.",
            "sinais_de_alerta": "Choque, hipoxemia, dor torácica, síncope, arritmia instável, edema agudo de pulmão, alteração de consciência.",
            "cuidados": "Diurético, nitrato e suporte ventilatório dependem de PA, volemia, perfusão e protocolo institucional.",
        },
    ),
    (
        ["otite"],
        {
            "orientacoes": "Priorizar analgesia e orientar retorno se piora, febre persistente ou ausência de melhora em 48-72h.",
            "sinais_de_alerta": "Mastoidite, edema retroauricular, paralisia facial, vertigem intensa, sinais meníngeos, imunossupressão.",
            "cuidados": "Antibiótico deve considerar gravidade, otorreia, recorrência, idade/risco e protocolo local.",
        },
    ),
    (
        ["rinossinusite", "sinusite"],
        {
            "orientacoes": "Considerar antibiótico apenas em quadro bacteriano provável, persistente, grave ou com piora após melhora inicial.",
            "sinais_de_alerta": "Edema periorbitário, alteração visual, cefaleia intensa/progressiva, rigidez de nuca, confusão ou sinais orbitários/neurológicos.",
            "cuidados": "Evitar antibiótico em IVAS viral simples. Checar alergias, gestação, função renal e uso recente de antibiótico.",
        },
    ),
    (
        ["faringo", "amigdalite"],
        {
            "orientacoes": "Reservar antibiótico para alta probabilidade bacteriana/teste positivo quando disponível; associar analgesia se necessário.",
            "sinais_de_alerta": "Dispneia, sialorreia, trismo, voz abafada, desvio de úvula, toxemia, desidratação ou rigidez cervical.",
            "cuidados": "Evitar antibiótico em quadro claramente viral. Checar alergia a beta-lactâmicos.",
        },
    ),
    (
        ["cistite", "itu", "pielonefrite", "trato urin"],
        {
            "orientacoes": "Orientar hidratação habitual, adesão ao tratamento e retorno se persistência ou piora dos sintomas.",
            "sinais_de_alerta": "Febre, dor lombar, vômitos, gestação, sexo masculino, imunossupressão, sepse ou hematúria importante.",
            "cuidados": "Suspeita de pielonefrite, gestação, homem ou recorrência exige avaliação diferenciada e, muitas vezes, urocultura.",
        },
    ),
    (
        ["vulvovagin", "vaginose", "candid", "tricomon", "corrimento"],
        {
            "orientacoes": "Avaliar IST conforme risco, orientar retorno se recorrência, dor pélvica, febre, gestação ou falha terapêutica.",
            "sinais_de_alerta": "Dor pélvica, febre, sangramento, gestação sintomática, suspeita de DIP ou violência sexual.",
            "cuidados": "Conduta depende de etiologia provável, gestação, recorrência, alergias e tratamento de parceria quando indicado.",
        },
    ),
    (
        ["ulcera genital", "úlcera genital", "sifilis", "sífilis", "herpes"],
        {
            "orientacoes": "Oferecer testagem para IST, aconselhamento, avaliação/tratamento de parcerias e seguimento conforme protocolo.",
            "sinais_de_alerta": "Gestação, imunossupressão, lesões extensas, sintomas neurológicos/visuais, violência sexual ou alergia relevante.",
            "cuidados": "Confirmar estágio/etiologia. Sífilis de duração ignorada/tardia e gestação exigem esquemas e seguimento específicos.",
        },
    ),
    (
        ["cefaleia", "migranea", "migrânea", "enxaqueca"],
        {
            "orientacoes": "Avaliar padrão, gatilhos, frequência, uso excessivo de analgésicos e necessidade de profilaxia.",
            "sinais_de_alerta": "Pior cefaleia da vida, início súbito, déficit neurológico, febre/rigidez nucal, papiledema, câncer/HIV, trauma, gestação/puerpério ou nova cefaleia >50 anos.",
            "cuidados": "Não mascarar cefaleia secundária. Encaminhar/urgência se houver red flags.",
        },
    ),
    (
        ["vertigem", "tontura"],
        {
            "orientacoes": "Usar sintomático pelo menor tempo necessário e considerar manobras vestibulares se VPPB provável.",
            "sinais_de_alerta": "Déficit neurológico focal, ataxia incapacitante, cefaleia nova intensa, diplopia, disartria, hipoacusia súbita, síncope.",
            "cuidados": "Sedativos podem causar sonolência e queda, especialmente em idosos. Excluir causa central se sinais de alarme.",
        },
    ),
    (
        ["celulite", "erisipela", "pele", "partes moles"],
        {
            "orientacoes": "Reavaliar em 48-72h, marcar borda da lesão quando útil e investigar porta de entrada.",
            "sinais_de_alerta": "Toxemia, febre alta, hipotensão, dor desproporcional, bolhas/necrose, rápida progressão, imunossupressão, pé diabético ou abscesso.",
            "cuidados": "Abscesso/purulência pode exigir drenagem e cobertura específica. Diferenciar de trombose, dermatite e gota.",
        },
    ),
]


def strip_accents(value):
    return "".join(
        char for char in unicodedata.normalize("NFD", str(value or ""))
        if unicodedata.category(char) != "Mn"
    )


def clean_text(value):
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("º", "").replace("°", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def single_line(value):
    return re.sub(r"\s+", " ", clean_text(value)).strip()


def normalize_slug(value, fallback):
    base = strip_accents(value or fallback).lower()
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    return base[:180] or "prescricao"


def ensure_unique_slugs(rows):
    counts = Counter()
    for row in rows:
        base = normalize_slug(row.get("slug"), row.get("titulo"))
        counts[base] += 1
        row["slug"] = base if counts[base] == 1 else f"{base}-{counts[base]}"


def first_match(patterns, text, flags=re.IGNORECASE):
    for pattern in patterns:
        match = re.search(pattern, text, flags)
        if match:
            return single_line(match.group(1))
    return ""


def infer_apresentacao(row, text):
    current = single_line(row.get("apresentacao"))
    if current:
        return current

    med = single_line(row.get("medicamento"))
    parenthetical = re.search(r"\(([^)]*(?:mg|mcg|g|ml|ui|%)[^)]*)\)", med, re.IGNORECASE)
    if parenthetical:
        return single_line(parenthetical.group(1))

    return first_match([
        r"([0-9]+(?:[,.][0-9]+)?\s*(?:mg|g|mcg|ui|u|ml|%)\s*(?:/\s*[0-9]+(?:[,.][0-9]+)?\s*(?:ml|mg|g|mcg|ui|u))?)",
        r"\b((?:cp|comprimido|c[aá]psula|ampola|frasco|gotas|spray|creme|pomada|xarope|suspens[aã]o)[^.\n;]*)",
    ], text)


def infer_dose(row, text):
    current = single_line(row.get("dose"))
    if current:
        return current

    dose = first_match([
        r"\bDose:\s*([^\n]+)",
        r"\bDosagem:\s*([^\n]+)",
        r"\bAdministrar\s+([^\n.]+)",
        r"\bTomar\s+([^\n.]+)",
        r"\bDar\s+([^\n.]+)",
        r"\bAplicar\s+([^\n.]+)",
        r"\bInfundir\s+([^\n.]+)",
        r"\bIniciar\s+(?:com|a)?\s*([^\n.]+)",
    ], text)

    if not dose:
        dose = first_match([
            r"\b([0-9]+(?:[,.][0-9]+)?\s*(?:mg|g|mcg|ui|u|ml|gotas?|cp|comprimidos?|ampolas?)(?:\s*/\s*kg)?(?:\s*/\s*min)?)",
        ], text)

    return dose


def infer_frequencia(row, text):
    current = single_line(row.get("frequencia"))
    if current:
        return current

    freq = first_match([
        r"\b(de\s+[0-9]{1,2}\s*/\s*[0-9]{1,2}\s*h(?:oras?)?)",
        r"\b([0-9]{1,2}\s*/\s*[0-9]{1,2}\s*h(?:oras?)?)",
        r"\b(a cada\s+[0-9]{1,2}\s*h(?:oras?)?)",
        r"\b([0-9]\s*x\s*/\s*dia)",
        r"\b([0-9]\s*x\s+ao\s+dia)",
        r"\b(uma vez ao dia)",
        r"\b(dose [uú]nica)",
        r"\b(se\s+(?:dor|febre|náuseas|nauseas|vômitos|vomitos|c[oó]lica)[^\n.]*)",
    ], text)

    return normalize_frequency(freq)


def normalize_frequency(value):
    text = single_line(value).lower()
    text = text.replace(" ", "")
    text = text.replace("horas", "h").replace("hora", "h")
    text = text.replace("de", "", 1) if text.startswith("de") else text
    text = text.replace("1x/dia", "1x/dia").replace("2x/dia", "2x/dia")
    text = text.replace("doseúnica", "Dose única")
    if re.match(r"^\d{1,2}/\d{1,2}h$", text):
        return text
    if text == "dose única":
        return "Dose única"
    return single_line(value)


def infer_duracao(row, text):
    current = single_line(row.get("duracao"))
    if current:
        return current

    return first_match([
        r"\b(por\s+[0-9]+\s*(?:dias?|semanas?|meses?))",
        r"\b(durante\s+[0-9]+\s*(?:dias?|semanas?|meses?))",
        r"\b(at[eé]\s+(?:melhora|resolu[cç][aã]o|fechamento)[^\n.]*)",
        r"\b(dose [uú]nica)",
    ], text)


def infer_diluicao(row, text):
    current = single_line(row.get("diluicao"))
    if current:
        return current

    return first_match([
        r"\bDilui[cç][aã]o:\s*([^\n]+(?:\n[^\n]+)?)",
        r"\bDiluir\s+([^\n]+)",
    ], text)


def infer_via(row, text):
    current = single_line(row.get("via"))
    source = f"{current}\n{text}"
    candidates = []
    for via in ["EV", "IV", "VO", "IM", "SC", "SL", "Ocular", "Intranasal", "Inalatória", "Tópica", "Retal", "Local"]:
        if re.search(rf"\b{re.escape(via)}\b", source, re.IGNORECASE):
            candidates.append("EV" if via == "IV" else via)
    if candidates:
        ordered = []
        for item in candidates:
            if item not in ordered:
                ordered.append(item)
        return ", ".join(ordered[:4])
    return current


def infer_tipo(row):
    current = single_line(row.get("tipo_de_conduta"))
    if current:
        return current
    if single_line(row.get("medicamento")):
        return "Prescrição"
    return "Conduta"


def looks_high_risk(row, text):
    blob = strip_accents(" ".join([
        row.get("titulo", ""),
        row.get("especialidade", ""),
        row.get("condicao_clinica", ""),
        row.get("subcondicao", ""),
        row.get("contexto", ""),
        row.get("medicamento", ""),
        row.get("via", ""),
        row.get("tags", ""),
        text,
    ])).lower()

    if any(term in blob for term in [strip_accents(term).lower() for term in HIGH_RISK_TERMS]):
        return True
    if row.get("contexto") in {"PS", "Emergência", "PS / Alta", "Alta"} and any(via in row.get("via", "") for via in ["EV", "IV", "IM", "SC"]):
        return True
    return False


def apply_guidance(row):
    blob = strip_accents(" ".join([
        row.get("titulo", ""),
        row.get("condicao_clinica", ""),
        row.get("subcondicao", ""),
        row.get("fonte_secao", ""),
    ])).lower()

    for terms, guidance in CONDITION_GUIDANCE:
        normalized_terms = [strip_accents(term).lower() for term in terms]
        if any(term in blob for term in normalized_terms):
            for key, value in guidance.items():
                if not single_line(row.get(key)):
                    row[key] = value
            return

    if not single_line(row.get("sinais_de_alerta")):
        row["sinais_de_alerta"] = "Piora clínica, sinais sistêmicos, alergia/reações adversas, gestação, imunossupressão ou ausência de melhora no tempo esperado."
    if not single_line(row.get("cuidados")):
        row["cuidados"] = "Checar alergias, gestação/lactação, idade, função renal/hepática, interações, contraindicações e protocolo local antes de prescrever."
    if not single_line(row.get("orientacoes")):
        row["orientacoes"] = "Usar conforme avaliação clínica, orientar adesão, efeitos adversos relevantes e critérios de retorno."


def clean_title(row):
    title = single_line(row.get("titulo"))
    cond = single_line(row.get("condicao_clinica"))
    med = single_line(row.get("medicamento"))

    if not title and cond and med:
        return f"{cond} — {med}"
    if title:
        title = re.sub(r"\s+—\s+—\s+", " — ", title)
        title = re.sub(r"\s{2,}", " ", title)
        return title[:180]
    return (cond or med or "Prescrição revisada")[:180]


def review_row(raw):
    row = {field: clean_text(raw.get(field, "")) for field in FIELDS}
    text = clean_text(row.get("texto_original") or row.get("modo_de_uso"))

    row["modo_de_uso"] = clean_text(row.get("modo_de_uso") or text)
    row["tipo_de_conduta"] = infer_tipo(row)
    row["apresentacao"] = infer_apresentacao(row, text)
    row["dose"] = infer_dose(row, text)
    row["frequencia"] = infer_frequencia(row, text)
    row["duracao"] = infer_duracao(row, text)
    row["diluicao"] = infer_diluicao(row, text)
    row["via"] = infer_via(row, text)
    row["titulo"] = clean_title(row)

    apply_guidance(row)

    high_risk = looks_high_risk(row, text)
    enough_structure = bool(row["medicamento"] and row["via"] and (row["dose"] or row["modo_de_uso"]))

    if high_risk:
        row["status_revisao"] = "Não usar sem validação"
    else:
        row["status_revisao"] = "Revisado" if enough_structure else "Não usar sem validação"

    if not enough_structure:
        row["confianca_extracao"] = "Baixa"
    elif high_risk:
        row["confianca_extracao"] = "Média"
    else:
        row["confianca_extracao"] = row["confianca_extracao"] if row["confianca_extracao"] in {"Alta", "Média"} else "Média"

    if row["status_revisao"] == "Não usar sem validação":
        note = "Revisão automática: item exige validação clínica/protocolo local antes de uso."
        row["observacoes"] = f"{single_line(row.get('observacoes'))} | {note}".strip(" |")

    return row


def load_env(path):
    env = {}
    if not path or not Path(path).exists():
        return env
    for line in Path(path).read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def notion_request(method, path, token, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        f"https://api.notion.com/v1{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Notion API {method} {path} failed with {exc.code}: {body[:500]}") from exc


def plain_text_property(page, name):
    prop = page.get("properties", {}).get(name) or {}
    if prop.get("type") == "title":
        return "".join(part.get("plain_text", "") for part in prop.get("title", []))
    if prop.get("type") == "rich_text":
        return "".join(part.get("plain_text", "") for part in prop.get("rich_text", []))
    if prop.get("type") == "select":
        return (prop.get("select") or {}).get("name", "")
    return ""


def fetch_pages_by_slug(token, data_source_id):
    pages = defaultdict(list)
    payload = {"page_size": 100}
    while True:
        data = notion_request("POST", f"/data_sources/{data_source_id}/query", token, payload)
        for page in data.get("results", []):
            slug = plain_text_property(page, "slug")
            if slug:
                pages[slug].append(page["id"])
        if not data.get("has_more"):
            break
        payload["start_cursor"] = data.get("next_cursor")
    return pages


def notion_text(value):
    text = str(value or "")
    return {"rich_text": [{"type": "text", "text": {"content": text[:1900]}}]} if text else {"rich_text": []}


def notion_title(value):
    text = str(value or "Prescrição revisada")
    return {"title": [{"type": "text", "text": {"content": text[:1900]}}]}


def notion_select(value):
    text = str(value or "").strip()
    return {"select": {"name": text}} if text else {"select": None}


def notion_multi_select(value):
    items = []
    for item in re.split(r"[,;]", str(value or "")):
        name = item.strip()
        if name:
            items.append({"name": name})
    return {"multi_select": items}


def row_to_notion_properties(row):
    select_fields = {
        "especialidade",
        "subcondicao",
        "contexto",
        "tipo_de_conduta",
        "via",
        "fonte_arquivo",
        "confianca_extracao",
        "status_revisao",
    }
    props = {"titulo": notion_title(row["titulo"])}
    for field in FIELDS:
        if field == "titulo":
            continue
        if field == "tags":
            props[field] = notion_multi_select(row[field])
        elif field == "fonte_pagina":
            value = single_line(row[field])
            props[field] = {"number": float(value)} if value and re.match(r"^\d+(\.\d+)?$", value) else {"number": None}
        elif field in select_fields:
            props[field] = notion_select(row[field])
        else:
            props[field] = notion_text(row[field])
    return props


def update_notion(rows, token, data_source_id, limit=None, delay=0.12):
    pages_by_slug = fetch_pages_by_slug(token, data_source_id)
    stats = Counter()
    for index, row in enumerate(rows, start=1):
        if limit and index > limit:
            break
        ids = pages_by_slug.get(row["slug"], [])
        if not ids:
            stats["missing_slug"] += 1
            continue
        page_id = ids[0]
        notion_request("PATCH", f"/pages/{page_id}", token, {"properties": row_to_notion_properties(row)})
        stats["updated"] += 1
        if len(ids) > 1:
            stats["duplicate_slug_used_first"] += 1
        time.sleep(delay)
    return stats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--env", default="backend/.env")
    parser.add_argument("--apply-notion", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    with Path(args.input).open("r", encoding="utf-8-sig", newline="") as handle:
        raw_rows = list(csv.DictReader(handle))

    rows = [review_row(row) for row in raw_rows]
    ensure_unique_slugs(rows)

    with Path(args.output).open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    summary = {
        "input_rows": len(raw_rows),
        "output_rows": len(rows),
        "status_revisao": dict(Counter(row["status_revisao"] for row in rows)),
        "confianca_extracao": dict(Counter(row["confianca_extracao"] for row in rows)),
        "empty_dose": sum(1 for row in rows if not row["dose"]),
        "empty_frequencia": sum(1 for row in rows if not row["frequencia"]),
        "empty_duracao": sum(1 for row in rows if not row["duracao"]),
        "unique_slugs": len({row["slug"] for row in rows}),
    }

    if args.apply_notion:
        env = {**os.environ, **load_env(args.env)}
        token = env.get("NOTION_API_KEY") or env.get("NOTION_TOKEN") or env.get("NOTION_ACCESS_TOKEN")
        data_source_id = (
            env.get("NOTION_PRESCRIPTIONS_DATA_SOURCE_ID")
            or env.get("NOTION_PRESCRIPTIONS_DATABASE_ID")
            or DEFAULT_DATA_SOURCE_ID
        )
        if not token:
            raise SystemExit("NOTION_API_KEY not found.")
        notion_stats = update_notion(rows, token, data_source_id.replace("collection://", ""), args.limit or None)
        summary["notion"] = dict(notion_stats)

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
