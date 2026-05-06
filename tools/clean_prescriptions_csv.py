import argparse
import csv
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path


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

NON_MEDICATION_CATEGORIES = {
    "Conduta",
    "Cuidados gerais",
    "Dieta/Jejum",
    "Encaminhamento/Internação",
    "Monitorização",
    "Procedimento",
}

FRAGMENT_MEDICINES = {
    "",
    "kg",
    "min",
    "ml",
    "mg",
    "dia",
    "º dia",
    ",0%",
    ",1%",
    ",5",
    "1)",
    "f)",
    "f):",
    "(ex",
}

CONDUCT_STARTS = (
    "alta ",
    "agendamento",
    "antibioticoterapia",
    "avaliação",
    "avaliacao",
    "certifico",
    "considerar",
    "controle",
    "confirmação",
    "confirmacao",
    "correção",
    "correcao",
    "encaminh",
    "hidratação",
    "hidratacao",
    "internação",
    "internacao",
    "jejum",
    "oriento",
    "orientar",
    "orientada",
    "orientado",
    "prescrevo medicações",
    "prescrevo medicacoes",
    "recomendo",
    "reduzir",
    "retorno",
    "sinalizo",
    "sondagem",
)

NON_MEDICINE_TERMS = {
    "a 59 minutos",
    "confirmação diagnóstica",
    "confirmacao diagnostica",
    "f)",
    "f):",
    "ponto",
    "pontos",
    "pontuação",
    "pontuacao",
    "rastreamento e prevenção",
    "rastreamento e prevencao",
}

HIGH_RISK_TERMS = (
    "bic",
    "mcg/kg/min",
    "mcg/min",
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
    "potássio",
    "potassio",
    "sódio",
    "sodio",
    "hipercalemia",
    "hiponatremia",
    "cetoacidose",
    "sedação",
    "sedacao",
    "intubação",
    "intubacao",
)

VIA_PATTERNS = [
    ("EV", r"\b(?:EV|IV|endovenosa|intravenosa)\b"),
    ("VO", r"\b(?:VO|oral|via oral)\b"),
    ("IM", r"\b(?:IM|intramuscular)\b"),
    ("SC", r"\b(?:SC|subcut[aâ]nea)\b"),
    ("SL", r"\b(?:SL|sublingual)\b"),
    ("Inalatória", r"\b(?:inalat[oó]ria|inala[cç][aã]o|nebuliza)\b"),
    ("Intranasal", r"\b(?:intranasal|nasal)\b"),
    ("Ocular", r"\b(?:ocular|col[ií]rio|olho)\b"),
    ("Tópica", r"\b(?:t[oó]pica|creme|pomada|gel|lo[cç][aã]o)\b"),
    ("Retal", r"\b(?:retal|suposit[oó]rio)\b"),
]


def strip_accents(value):
    return "".join(
        char
        for char in unicodedata.normalize("NFD", str(value or ""))
        if unicodedata.category(char) != "Mn"
    )


def clean_text(value, keep_newlines=True):
    text = str(value or "").replace("\ufeff", "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("Âº", "º").replace("Â°", "º")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"(?m)^\s*[º•\-]\s*", "", text)
    if keep_newlines:
        text = re.sub(r"\n{3,}", "\n\n", text)
    else:
        text = re.sub(r"\s+", " ", text)
    return text.strip()


def one_line(value):
    return clean_text(value, keep_newlines=False)


def norm(value):
    return strip_accents(one_line(value)).lower()


def slugify(value, fallback="prescricao"):
    base = norm(value or fallback)
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    return base[:180] or fallback


def first_match(patterns, text):
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            return one_line(match.group(1))
    return ""


def looks_like_fragment(row):
    med = one_line(row.get("medicamento"))
    text = one_line(row.get("texto_original") or row.get("modo_de_uso"))
    if norm(med) in {norm(item) for item in FRAGMENT_MEDICINES}:
        return True
    if not med and text.startswith(":"):
        return True
    if re.fullmatch(r"[,.:;()\d\s%]+", med or ""):
        return True
    return False


def looks_like_conduct(row):
    med = one_line(row.get("medicamento"))
    text = one_line(row.get("texto_original") or row.get("modo_de_uso"))
    blob = norm(med or text)
    if blob.startswith(CONDUCT_STARTS):
        return True
    if blob in NON_MEDICINE_TERMS:
        return True
    if re.fullmatch(r"\d+\s+pontos?", blob):
        return True
    if re.match(r"^[,.:;)\]/➡✅❌🔄📍]", one_line(med or text)):
        return True
    if re.match(r"^\d+(?:[,.]\d+)?\s*(?:mg|mcg|g|ml|ui|%)?\b", one_line(med)):
        return True
    if not med and not re.search(r"\b\d+(?:[,.]\d+)?\s*(?:mg|mcg|g|ml|ui|%)\b", text, re.I):
        return True
    return False


def infer_apresentacao(row, text):
    current = one_line(row.get("apresentacao"))
    if current:
        return current
    med = one_line(row.get("medicamento"))
    match = re.search(r"\(([^)]*(?:mg|mcg|g|ml|ui|%)[^)]*)\)", med, re.I)
    if match:
        return one_line(match.group(1))
    match = re.search(
        r"\b(\d+(?:[,.]\d+)?\s*(?:mg|mcg|g|ui|u|ml|%)\s*(?:/\s*\d+(?:[,.]\d+)?\s*(?:ml|mg|mcg|g|ui|u))?)\b",
        med,
        re.I,
    )
    if match:
        return one_line(match.group(1))
    match = re.search(r"\b(?:-\s*)?(cp|comprimido|cápsula|capsula|ampola|frasco|gotas|spray|creme|pomada|xarope|suspensão|solução)\b", text, re.I)
    return one_line(match.group(1)) if match else ""


def infer_dose(row, text):
    current = one_line(row.get("dose"))
    if current:
        return current
    dose = first_match(
        [
            r"\bDose(?: de ataque| de manutenção| inicial)?:\s*([^\n;]+)",
            r"\bDosagem:\s*([^\n;]+)",
            r"\b(?:Administrar|Tomar|Aplicar|Infundir|Ingerir|Usar)\s+([^\n.]+)",
            r"\b(?:Alíquotas|Aliquotas)\s+de\s+([^\n.]+)",
        ],
        text,
    )
    if dose:
        return dose
    return first_match(
        [
            r"\b(\d+(?:[,.]\d+)?\s*(?:mg|mcg|g|ui|u|ml|gotas?|cp|comprimidos?|cápsulas?|capsulas?|ampolas?|sachês?|saches?)(?:\s*/\s*kg)?(?:\s*/\s*min)?)\b"
        ],
        text,
    )


def infer_frequency(row, text):
    current = one_line(row.get("frequencia"))
    if current:
        return normalize_frequency(current)
    freq = first_match(
        [
            r"\b(de\s+\d{1,2}\s*/\s*\d{1,2}\s*h(?:oras?)?)",
            r"\b(\d{1,2}\s*/\s*\d{1,2}\s*h(?:oras?)?)",
            r"\b(a cada\s+\d{1,2}\s*h(?:oras?)?)",
            r"\b(\d+\s*x\s*/?\s*(?:dia|semana))",
            r"\b(\d+\s*x\s+ao\s+(?:dia|semana))",
            r"\b(uma vez ao dia)",
            r"\b(dose [úu]nica)",
            r"\b(se\s+(?:dor|febre|náuseas|nauseas|vômitos|vomitos|cólica|colica)[^\n.]*)",
        ],
        text,
    )
    return normalize_frequency(freq)


def normalize_frequency(value):
    text = one_line(value)
    compact = norm(text).replace(" ", "")
    compact = compact.replace("horas", "h").replace("hora", "h")
    if compact.startswith("de"):
        compact = compact[2:]
    if re.fullmatch(r"\d{1,2}/\d{1,2}h", compact):
        return compact
    if compact in {"doseunica", "doseúnica"}:
        return "dose única"
    return text


def infer_duration(row, text):
    current = one_line(row.get("duracao"))
    if current:
        return current
    return first_match(
        [
            r"\b(por\s+\d+\s*(?:dias?|semanas?|meses?))",
            r"\b(durante\s+\d+\s*(?:dias?|semanas?|meses?))",
            r"\b(até\s+(?:melhora|resolução|fechamento|atingir)[^\n.]*)",
            r"\b(dose [úu]nica)",
        ],
        text,
    )


def infer_dilution(row, text):
    current = one_line(row.get("diluicao"))
    if current:
        return current
    return first_match(
        [
            r"\bDilui[cç][aã]o:\s*([^\n]+(?:\n[^\n]+)?)",
            r"\bDiluir\s+([^\n]+)",
            r"\b(dilu[ií]d[oa]s?\s+em\s+[^\n.]+)",
        ],
        text,
    )


def infer_via(row, text):
    current = one_line(row.get("via"))
    source = f"{current}\n{text}"
    found = []
    for label, pattern in VIA_PATTERNS:
        if re.search(pattern, source, re.I) and label not in found:
            found.append(label)
    return ", ".join(found) if found else current


def clean_title(row):
    cond = one_line(row.get("condicao_clinica"))
    med = one_line(row.get("medicamento"))
    title = one_line(row.get("titulo"))
    if looks_like_conduct(row):
        item = one_line(row.get("modo_de_uso") or row.get("texto_original") or med)
        return f"{cond} - {item}"[:180] if cond and item else (title or item or cond)[:180]
    if cond and med:
        return f"{cond} - {med}"[:180]
    return (title or cond or med or "Item de prescrição")[:180]


def append_note(row, note):
    current = one_line(row.get("observacoes"))
    if note and note not in current:
        row["observacoes"] = f"{current} | {note}".strip(" |")


def append_tag(row, tag):
    current = [one_line(item) for item in re.split(r"[,;]", row.get("tags") or "") if one_line(item)]
    if tag and tag not in current:
        current.append(tag)
    row["tags"] = ", ".join(current)


def classify_category(row):
    text = norm(" ".join([
        row.get("titulo", ""),
        row.get("medicamento", ""),
        row.get("modo_de_uso", ""),
        row.get("texto_original", ""),
    ]))

    if any(term in text for term in ["internacao", "avaliacao da cirurgia", "encaminhar", "encaminhamento"]):
        return "Encaminhamento/Internação"
    if any(term in text for term in ["sf 0,9", "soro fisiologico", "soro fisiológico", "sg 5", "soro glicosado", "ringer", "nacl", "kcl", "fluidoterapia", "hidratacao", "hidratação"]):
        return "Hidratação/Solução"
    if any(term in text for term in ["sondagem", "sonda nasogastrica", "passagem de sonda", "cateter", "drenagem", "curativo", "tamponamento"]):
        return "Procedimento"
    if any(term in text for term in ["controle de sinais vitais", "sinais vitais", "dextro", "glicemia capilar", "monitorizacao", "monitorização"]):
        return "Monitorização"
    if any(term in text for term in ["jejum", "dieta zero", "dieta oral suspensa"]):
        return "Dieta/Jejum"
    if any(term in text for term in ["cabeceira", "repouso", "correcao de disturbios", "correção de distúrbios", "controle de sintomas", "orientar", "orientacao"]):
        return "Cuidados gerais"
    if any(term in text for term in ["ceftriax", "metronidazol", "ciproflox", "amoxic", "azitrom", "claritrom", "doxicicl", "cefalex", "clindamic", "sulfametoxazol", "nitrofurantoina", "levoflox", "piperacilina", "meropenem", "gentamicina"]):
        return "Antibiótico"
    if any(term in text for term in ["dipirona", "paracetamol", "ibuprofeno", "cetoprofeno", "naproxeno", "tramadol", "morfina", "codeina", "escopolamina"]):
        return "Analgesia/Sintomático"
    if any(term in text for term in ["ondansetrona", "metoclopramida", "bromoprida", "dimenidrinato"]):
        return "Antiemético"
    if any(term in text for term in ["omeprazol", "pantoprazol", "ranitidina"]):
        return "Proteção gástrica"
    if row.get("tipo_de_conduta") == "Conduta":
        return "Conduta"
    return "Medicamento"


def classify_status(row, flags):
    text = " ".join(one_line(row.get(c)) for c in FIELDS)
    high_risk = any(term in norm(text) for term in [norm(item) for item in HIGH_RISK_TERMS])
    weak_source = one_line(row.get("fonte_pagina")) in {"", "0"}
    is_prescription = one_line(row.get("tipo_de_conduta")) == "Prescrição"
    has_core = bool(one_line(row.get("medicamento")) and (one_line(row.get("dose")) or one_line(row.get("modo_de_uso"))))
    if "fragmento_fundido" in flags:
        return row.get("status_revisao") or "Revisão pendente", row.get("confianca_extracao") or "Baixa"
    if high_risk or weak_source:
        return "Não usar sem validação", "Média" if has_core else "Baixa"
    if is_prescription and has_core:
        confidence = one_line(row.get("confianca_extracao"))
        return "Revisão pendente", confidence if confidence in {"Alta", "Média", "Baixa"} else "Média"
    if not is_prescription:
        return "Revisão pendente", one_line(row.get("confianca_extracao")) or "Média"
    return "Revisão pendente", "Baixa"


def normalize_row(raw):
    row = {field: clean_text(raw.get(field, "")) for field in FIELDS}
    text = clean_text(row.get("texto_original") or row.get("modo_de_uso"))
    row["texto_original"] = text
    row["modo_de_uso"] = clean_text(row.get("modo_de_uso") or text)

    if looks_like_conduct(row):
        row["tipo_de_conduta"] = "Conduta"
        row["medicamento"] = "" if not re.search(r"\b[A-ZÁÉÍÓÚ][A-Za-zÀ-ÿ-]+\s+\d", row["medicamento"]) else one_line(row["medicamento"])
    else:
        row["tipo_de_conduta"] = "Prescrição"
        row["medicamento"] = one_line(row.get("medicamento"))

    row["apresentacao"] = infer_apresentacao(row, text)
    row["dose"] = infer_dose(row, text)
    row["frequencia"] = infer_frequency(row, text)
    row["duracao"] = infer_duration(row, text)
    row["diluicao"] = infer_dilution(row, text)
    row["via"] = infer_via(row, text)
    row["titulo"] = clean_title(row)

    row["orientacoes"] = clean_text(row.get("orientacoes"))
    row["sinais_de_alerta"] = clean_text(row.get("sinais_de_alerta"))
    row["cuidados"] = clean_text(row.get("cuidados"))
    row["observacoes"] = clean_text(row.get("observacoes"))

    flags = []
    if looks_like_conduct(row):
        flags.append("conduta_sem_medicamento")
    if not row["medicamento"] and row["tipo_de_conduta"] == "Prescrição":
        flags.append("medicamento_nao_identificado")
    if row["tipo_de_conduta"] == "Prescrição" and not row["dose"]:
        flags.append("dose_nao_identificada")
    if row["tipo_de_conduta"] == "Prescrição" and not row["via"]:
        flags.append("via_nao_identificada")

    category = classify_category(row)
    if category in NON_MEDICATION_CATEGORIES:
        row["tipo_de_conduta"] = "Conduta"
        row["medicamento"] = ""
    elif row["tipo_de_conduta"] != "Conduta":
        row["tipo_de_conduta"] = "Prescrição"

    row["titulo"] = clean_title(row)
    append_tag(row, f"categoria: {category}")
    append_note(row, f"Categoria: {category}")

    status, confidence = classify_status(row, flags)
    row["status_revisao"] = status
    row["confianca_extracao"] = confidence

    if flags:
        note = "Flags ETL: " + ", ".join(flags)
        append_note(row, note)

    return row, flags


def same_context(a, b):
    return (
        one_line(a.get("fonte_pagina")) == one_line(b.get("fonte_pagina"))
        and one_line(a.get("condicao_clinica")) == one_line(b.get("condicao_clinica"))
        and one_line(a.get("especialidade")) == one_line(b.get("especialidade"))
    )


def build_rows(raw_rows):
    rows = []
    audit = []
    for index, raw in enumerate(raw_rows, start=1):
        if looks_like_fragment(raw) and rows and same_context(raw, rows[-1]):
            fragment = one_line(raw.get("texto_original") or raw.get("modo_de_uso") or raw.get("medicamento"))
            rows[-1]["modo_de_uso"] = clean_text(f"{rows[-1]['modo_de_uso']}\n{fragment}")
            rows[-1]["texto_original"] = clean_text(f"{rows[-1]['texto_original']}\n{fragment}")
            rows[-1]["observacoes"] = f"{rows[-1]['observacoes']} | Fragmento fundido da linha original {index}: {fragment}".strip(" |")
            audit.append({"linha_original": index, "acao": "fundida_na_linha_anterior", "motivo": "fragmento", "texto": fragment})
            continue

        row, flags = normalize_row(raw)
        row["_original_index"] = index
        rows.append(row)
        audit.append({"linha_original": index, "acao": "mantida", "motivo": ",".join(flags), "texto": one_line(raw.get("texto_original"))[:240]})

    group_counts = Counter()
    for row in rows:
        group_key = " > ".join(
            part for part in [
                one_line(row.get("especialidade")),
                one_line(row.get("subcondicao")),
                one_line(row.get("condicao_clinica")),
            ] if part
        )
        group_counts[group_key] += 1
        append_note(row, f"Grupo: {group_key}")
        append_note(row, f"Ordem no grupo: {group_counts[group_key]:03d}")

    counts = Counter()
    for row in rows:
        base = slugify(row.get("slug") or row.get("titulo"))
        counts[base] += 1
        row["slug"] = base if counts[base] == 1 else f"{base}-{counts[base]}"
        row.pop("_original_index", None)
    return rows, audit


def write_csv(path, rows, fields):
    with Path(path).open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--audit-output", required=True)
    parser.add_argument("--report-output", required=True)
    args = parser.parse_args()

    with Path(args.input).open("r", encoding="utf-8-sig", newline="") as handle:
        raw_rows = list(csv.DictReader(handle))

    rows, audit = build_rows(raw_rows)
    write_csv(args.output, rows, FIELDS)
    write_csv(args.audit_output, audit, ["linha_original", "acao", "motivo", "texto"])

    report = {
        "input_rows": len(raw_rows),
        "output_rows": len(rows),
        "merged_fragments": sum(1 for item in audit if item["acao"] == "fundida_na_linha_anterior"),
        "columns": FIELDS,
        "status_revisao": dict(Counter(row["status_revisao"] for row in rows)),
        "confianca_extracao": dict(Counter(row["confianca_extracao"] for row in rows)),
        "tipo_de_conduta": dict(Counter(row["tipo_de_conduta"] for row in rows)),
        "empty_by_column": {field: sum(1 for row in rows if not one_line(row.get(field))) for field in FIELDS},
        "duplicate_slugs": sum(1 for _, count in Counter(row["slug"] for row in rows).items() if count > 1),
        "bad_fragment_medicines_remaining": [
            med
            for med, _ in Counter(one_line(row.get("medicamento")) for row in rows).most_common()
            if med and norm(med) in {norm(item) for item in FRAGMENT_MEDICINES}
        ],
    }
    Path(args.report_output).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
