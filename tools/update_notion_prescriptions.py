import argparse
import csv
import json
import os
import re
import time
import urllib.error
import urllib.request
import socket
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

SELECT_FIELDS = {
    "especialidade",
    "subcondicao",
    "contexto",
    "tipo_de_conduta",
    "via",
    "fonte_arquivo",
    "confianca_extracao",
    "status_revisao",
}


def one_line(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


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
    for attempt in range(1, 5):
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            if exc.code in {429, 500, 502, 503, 504} and attempt < 4:
                time.sleep(attempt * 1.5)
                continue
            raise RuntimeError(f"Notion API {method} {path} failed with {exc.code}: {body[:700]}") from exc
        except (TimeoutError, socket.timeout, urllib.error.URLError):
            if attempt < 4:
                time.sleep(attempt * 1.5)
                continue
            raise


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


def fetch_page_summaries_by_slug(token, data_source_id):
    pages = {}
    payload = {"page_size": 100}
    while True:
        data = notion_request("POST", f"/data_sources/{data_source_id}/query", token, payload)
        for page in data.get("results", []):
            slug = plain_text_property(page, "slug")
            if slug:
                pages.setdefault(slug, []).append(page["id"])
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
    text = one_line(value)
    return {"select": {"name": text[:100]}} if text else {"select": None}


def notion_single_select_value(field, value):
    text = one_line(value)
    if field == "via" and "," in text:
        text = one_line(text.split(",", 1)[0])
    return text


def notion_multi_select(value):
    items = []
    seen = set()
    for item in re.split(r"[,;]", str(value or "")):
        name = one_line(item)
        if name and name not in seen:
            seen.add(name)
            items.append({"name": name[:100]})
    return {"multi_select": items}


def row_to_properties(row):
    props = {"titulo": notion_title(row["titulo"])}
    for field in FIELDS:
        if field == "titulo":
            continue
        if field == "tags":
            props[field] = notion_multi_select(row[field])
        elif field == "fonte_pagina":
            value = one_line(row[field])
            props[field] = {"number": float(value)} if value and re.match(r"^\d+(\.\d+)?$", value) else {"number": None}
        elif field in SELECT_FIELDS:
            props[field] = notion_select(notion_single_select_value(field, row[field]))
        else:
            props[field] = notion_text(row[field])
    return props


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--env", default="backend/.env")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--create-missing", action="store_true")
    parser.add_argument("--archive-extras", action="store_true")
    parser.add_argument("--skip-updates", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--delay", type=float, default=0.12)
    args = parser.parse_args()

    env = {**os.environ, **load_env(args.env)}
    token = env.get("NOTION_API_KEY") or env.get("NOTION_TOKEN") or env.get("NOTION_ACCESS_TOKEN")
    data_source_id = (
        env.get("NOTION_PRESCRIPTIONS_DATA_SOURCE_ID")
        or env.get("NOTION_PRESCRIPTIONS_DATABASE_ID")
        or DEFAULT_DATA_SOURCE_ID
    ).replace("collection://", "")
    if not token:
        raise SystemExit("NOTION_API_KEY not found.")

    with Path(args.csv).open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    pages_by_slug = fetch_page_summaries_by_slug(token, data_source_id)
    desired_slugs = {row["slug"] for row in rows}
    stats = Counter()
    missing = []
    for index, row in enumerate(rows, start=1):
        if args.limit and index > args.limit:
            break
        ids = pages_by_slug.get(row["slug"], [])
        if not ids:
            missing.append(row["slug"])
            if args.create_missing and not args.dry_run:
                notion_request("POST", "/pages", token, {
                    "parent": {"data_source_id": data_source_id},
                    "properties": row_to_properties(row),
                })
                stats["created"] += 1
                time.sleep(args.delay)
            else:
                stats["missing_slug"] += 1
            continue
        if len(ids) > 1:
            stats["duplicate_slug_used_first"] += 1
        if args.dry_run:
            stats["would_update"] += 1
            continue
        if args.skip_updates:
            stats["skipped_existing"] += 1
            continue
        notion_request("PATCH", f"/pages/{ids[0]}", token, {"properties": row_to_properties(row)})
        stats["updated"] += 1
        time.sleep(args.delay)

    extras = [slug for slug in pages_by_slug if slug not in desired_slugs]
    if args.archive_extras:
        for slug in extras:
            for page_id in pages_by_slug[slug]:
                if args.dry_run:
                    stats["would_archive_extra"] += 1
                    continue
                notion_request("PATCH", f"/pages/{page_id}", token, {"in_trash": True})
                stats["archived_extra"] += 1
                time.sleep(args.delay)

    print(json.dumps({
        "csv_rows": len(rows),
        "notion_slugs": len(pages_by_slug),
        "stats": dict(stats),
        "missing_examples": missing[:20],
        "extra_slug_count": len(extras),
        "extra_examples": extras[:20],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
