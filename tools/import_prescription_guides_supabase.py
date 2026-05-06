import argparse
import csv
import json
import re
import time
import socket
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path


HIDDEN_REVIEW_STATUS = "Não usar sem validação"
QUALIFIER_CONDITIONS = {
    "aguda",
    "agudo",
    "alergica",
    "alergico",
    "alérgica",
    "alérgico",
    "bacteriana",
    "bacteriano",
    "complicada",
    "complicado",
    "cronica",
    "cronico",
    "crônica",
    "crônico",
    "grave",
    "leve",
    "moderada",
    "moderado",
    "nao complicada",
    "nao complicado",
    "não complicada",
    "não complicado",
    "viral",
}


def clean_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def long_text(value):
    return str(value or "").replace("\r\n", "\n").replace("\r", "\n").strip()


def strip_accents(value):
    return "".join(
        char
        for char in unicodedata.normalize("NFD", str(value or ""))
        if unicodedata.category(char) != "Mn"
    )


def slugify(value):
    base = strip_accents(clean_text(value)).lower()
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    return base[:120] or "guia-prescricao"


def normalize_key(value):
    return strip_accents(clean_text(value)).lower()


def load_env(path):
    env = {}
    for line in Path(path).read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def extract_marker(text, label):
    match = re.search(rf"{re.escape(label)}:\s*([^|]+)", text or "", re.IGNORECASE)
    return clean_text(match.group(1)) if match else ""


def extract_category(row):
    tags = row.get("tags") or ""
    match = re.search(r"(?:^|[,;])\s*categoria:\s*([^,;]+)", tags, re.IGNORECASE)
    if match:
        return clean_text(match.group(1))
    return extract_marker(row.get("observacoes", ""), "Categoria") or "Medicamento"


def extract_group(row):
    return extract_marker(row.get("observacoes", ""), "Grupo") or " > ".join(
        part
        for part in [
            clean_text(row.get("especialidade")),
            clean_text(row.get("subcondicao")),
            clean_text(row.get("condicao_clinica")),
        ]
        if part
    )


def extract_order(row, fallback):
    raw = extract_marker(row.get("observacoes", ""), "Ordem no grupo")
    parsed = int(raw) if raw.isdigit() else fallback
    return parsed


def build_group_title(row):
    condition = clean_text(row.get("condicao_clinica"))
    subcondition = clean_text(row.get("subcondicao"))

    if not condition:
        return subcondition

    if not subcondition:
        return condition

    condition_key = normalize_key(condition)
    subcondition_key = normalize_key(subcondition)

    if subcondition_key and subcondition_key in condition_key:
        return condition

    if condition_key in QUALIFIER_CONDITIONS:
        return f"{subcondition} {condition}"

    if condition_key.startswith(("perfil ", "classe ", "tipo ", "grupo ")):
        return f"{subcondition} - {condition}"

    return condition


def build_copy_text(row):
    mode = long_text(row.get("modo_de_uso"))
    medication = clean_text(row.get("medicamento"))

    if mode:
        return clean_text(mode)

    parts = [
        medication,
        clean_text(row.get("dose")),
        clean_text(row.get("via")),
        clean_text(row.get("frequencia")),
        clean_text(row.get("duracao")),
    ]
    return clean_text(" ".join(part for part in parts if part))


def build_payloads(rows):
    groups = {}
    items = []
    group_contexts = defaultdict(set)
    group_has_active_item = defaultdict(bool)

    for index, row in enumerate(rows, start=1):
        group_name = extract_group(row)
        group_slug = slugify(group_name)
        context = clean_text(row.get("contexto"))
        if context:
            group_contexts[group_slug].add(context)

        review_status = clean_text(row.get("status_revisao")) or "Revisão pendente"
        is_active_item = review_status != HIDDEN_REVIEW_STATUS
        group_has_active_item[group_slug] = group_has_active_item[group_slug] or is_active_item

        group_title = build_group_title(row) or group_name

        groups[group_slug] = {
            "slug": group_slug,
            "title": group_title,
            "condition_name": group_title,
            "specialty": clean_text(row.get("especialidade")) or None,
            "subcondition": clean_text(row.get("subcondicao")) or None,
            "contexts": [],
            "status": "published",
            "active": True,
            "source": clean_text(row.get("fonte_arquivo")) or "prescricoes_cms",
            "display_order": len(groups) + 1,
        }

        category = extract_category(row)
        copy_text = build_copy_text(row)
        items.append({
            "guide_slug": group_slug,
            "source_slug": clean_text(row.get("slug")) or f"{group_slug}-{index}",
            "order_index": extract_order(row, index),
            "item_type": "Conduta" if clean_text(row.get("tipo_de_conduta")) == "Conduta" else "Prescrição",
            "category": category,
            "title": clean_text(row.get("titulo")) or copy_text[:120],
            "medication": clean_text(row.get("medicamento")) or None,
            "presentation": clean_text(row.get("apresentacao")) or None,
            "dose": clean_text(row.get("dose")) or None,
            "route": clean_text(row.get("via")) or None,
            "frequency": clean_text(row.get("frequencia")) or None,
            "duration": clean_text(row.get("duracao")) or None,
            "dilution": clean_text(row.get("diluicao")) or None,
            "instructions": long_text(row.get("modo_de_uso")) or copy_text,
            "care_notes": long_text(row.get("cuidados")) or None,
            "warnings": long_text(row.get("sinais_de_alerta")) or None,
            "review_status": review_status,
            "confidence": clean_text(row.get("confianca_extracao")) or None,
            "copy_text": copy_text,
            "source_text": long_text(row.get("texto_original")) or None,
            "active": is_active_item,
        })

    for slug, group in groups.items():
        group["contexts"] = sorted(group_contexts[slug])
        group["active"] = group_has_active_item[slug]

    return list(groups.values()), items


def supabase_request(url, key, table, method="GET", query="", payload=None, prefer=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/{table}{query}",
        method=method,
        data=data,
        headers={
            "Content-Type": "application/json",
            "apikey": key,
            "Authorization": f"Bearer {key}",
            **({"Prefer": prefer} if prefer else {}),
        },
    )
    for attempt in range(1, 5):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                body = response.read().decode("utf-8")
                return json.loads(body) if body else None
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            if exc.code in {429, 500, 502, 503, 504} and attempt < 4:
                time.sleep(attempt * 1.5)
                continue
            raise RuntimeError(f"Supabase {method} {table}{query} failed with {exc.code}: {body[:700]}") from exc
        except (TimeoutError, socket.timeout, urllib.error.URLError):
            if attempt < 4:
                time.sleep(attempt * 1.5)
                continue
            raise


def chunks(items, size):
    for index in range(0, len(items), size):
        yield items[index:index + size]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--env", default="backend/.env")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--batch-size", type=int, default=100)
    args = parser.parse_args()

    env = load_env(args.env)
    url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    service_role_key = env.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not service_role_key:
        raise SystemExit("SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")

    with Path(args.csv).open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    groups, raw_items = build_payloads(rows)

    if args.dry_run:
        print(json.dumps({
            "csv_rows": len(rows),
            "groups": len(groups),
            "items": len(raw_items),
            "active_items": sum(1 for item in raw_items if item["active"]),
            "hidden_items": sum(1 for item in raw_items if not item["active"]),
            "sample_group": groups[0] if groups else None,
        }, ensure_ascii=False, indent=2))
        return

    for batch in chunks(groups, args.batch_size):
        supabase_request(
            url,
            service_role_key,
            "prescription_guides",
            method="POST",
            query="?on_conflict=slug",
            payload=batch,
            prefer="resolution=merge-duplicates,return=minimal",
        )
        time.sleep(0.05)

    group_query = "?" + urllib.parse.urlencode({
        "select": "id,slug",
        "limit": str(max(len(groups), 1)),
    })
    guide_rows = supabase_request(url, service_role_key, "prescription_guides", query=group_query) or []
    guide_ids = {row["slug"]: row["id"] for row in guide_rows if row.get("slug") and row.get("id")}

    items = []
    for item in raw_items:
        guide_id = guide_ids.get(item.pop("guide_slug"))
        if not guide_id:
            continue
        items.append({"guide_id": guide_id, **item})

    for batch in chunks(items, args.batch_size):
        supabase_request(
            url,
            service_role_key,
            "prescription_guide_items",
            method="POST",
            query="?on_conflict=source_slug",
            payload=batch,
            prefer="resolution=merge-duplicates,return=minimal",
        )
        time.sleep(0.05)

    print(json.dumps({
        "imported_groups": len(groups),
        "imported_items": len(items),
        "active_items": sum(1 for item in items if item["active"]),
        "hidden_items": sum(1 for item in items if not item["active"]),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
