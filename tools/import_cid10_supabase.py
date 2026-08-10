"""Importa a tabela CID-10 oficial (DATASUS/CBCD) para o Supabase.

Fonte: http://www2.datasus.gov.br/cid10/V2008/downloads/CID10CSV.zip
Os CSVs vem em ISO-8859-1, separados por ';'.

Diferente dos outros catalogos do projeto, este nao passa pelo Notion: a
descricao dos codigos e copiada da fonte oficial, sem curadoria editorial por
linha. Rodar so quando a tabela oficial mudar (raro).

Uso:
    python tools/import_cid10_supabase.py --dry-run
    python tools/import_cid10_supabase.py

Variaveis de ambiente necessarias (mesmas do backend):
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

import argparse
import csv
import io
import json
import os
import sys
import unicodedata
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

DATASUS_ZIP_URL = "http://www2.datasus.gov.br/cid10/V2008/downloads/CID10CSV.zip"
SOURCE_ENCODING = "iso-8859-1"
CSV_DELIMITER = ";"
BATCH_SIZE = 500
REQUEST_TIMEOUT = 120

CHAPTERS_FILE = "CID-10-CAPITULOS.CSV"
GROUPS_FILE = "CID-10-GRUPOS.CSV"
CATEGORIES_FILE = "CID-10-CATEGORIAS.CSV"
SUBCATEGORIES_FILE = "CID-10-SUBCATEGORIAS.CSV"


def strip_accents(value):
    normalized = unicodedata.normalize("NFD", str(value or ""))
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def build_search_text(*parts):
    return strip_accents(" ".join(str(part or "") for part in parts)).lower().strip()


def clean(value):
    return " ".join(str(value or "").split()).strip()


def read_zip_csv(archive, name):
    with archive.open(name) as raw:
        text = raw.read().decode(SOURCE_ENCODING)

    return list(csv.DictReader(io.StringIO(text), delimiter=CSV_DELIMITER))


def download_source(local_zip=None):
    if local_zip:
        data = Path(local_zip).read_bytes()
        print(f"Lendo arquivo local: {local_zip} ({len(data)} bytes)")
        return zipfile.ZipFile(io.BytesIO(data))

    print(f"Baixando {DATASUS_ZIP_URL} ...")
    request = urllib.request.Request(
        DATASUS_ZIP_URL,
        headers={"User-Agent": "MinhaAnamnese/cid10-import"},
    )

    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        data = response.read()

    print(f"Recebidos {len(data)} bytes.")
    return zipfile.ZipFile(io.BytesIO(data))


def build_range_lookup(rows, description_field="DESCRICAO"):
    """Faixas do tipo A00-B99. Codigos sao letra + 2 digitos, entao a comparacao
    lexicografica respeita a ordem da classificacao."""
    ranges = []

    for row in rows:
        start = clean(row.get("CATINIC"))
        end = clean(row.get("CATFIM"))

        if not start or not end:
            continue

        ranges.append({
            "start": start,
            "end": end,
            "description": clean(row.get(description_field)),
            "number": clean(row.get("NUMCAP")),
        })

    return ranges


def find_in_ranges(ranges, category_code):
    for item in ranges:
        if item["start"] <= category_code <= item["end"]:
            return item

    return None


def format_display_code(raw_code):
    """"N300" -> "N30.0"; "A09" continua "A09"."""
    code = clean(raw_code).upper()
    return f"{code[:3]}.{code[3:]}" if len(code) > 3 else code


def normalize_optional(value, allowed):
    normalized = clean(value).upper()
    return normalized if normalized in allowed else None


def build_row(raw_code, description, chapters, groups, level, sex=None, classif=None):
    code_key = clean(raw_code).upper()
    category_code = code_key[:3]
    chapter = find_in_ranges(chapters, category_code)
    group = find_in_ranges(groups, category_code)
    display_code = format_display_code(code_key)
    clean_description = clean(description)

    chapter_number = None
    if chapter and chapter["number"].isdigit():
        chapter_number = int(chapter["number"])

    return {
        "code": display_code,
        "code_key": code_key,
        "description": clean_description,
        # O codigo entra no texto de busca para "n300" e "n30.0" acharem a linha.
        "search_text": build_search_text(display_code, code_key, clean_description),
        # So a descricao: o ranking pergunta se ela COMECA com o termo, o que o
        # search_text (que abre com o codigo) nao conseguiria responder.
        "description_search": build_search_text(clean_description),
        "category_code": category_code,
        "chapter_number": chapter_number,
        "chapter_description": chapter["description"] if chapter else None,
        "group_description": group["description"] if group else None,
        "level": level,
        "sex_restriction": normalize_optional(sex, {"F", "M"}),
        "dagger_asterisk": normalize_optional(classif, {"+", "*"}),
    }


def build_rows(archive):
    chapters = build_range_lookup(read_zip_csv(archive, CHAPTERS_FILE))
    groups = build_range_lookup(read_zip_csv(archive, GROUPS_FILE))
    categories = read_zip_csv(archive, CATEGORIES_FILE)
    subcategories = read_zip_csv(archive, SUBCATEGORIES_FILE)

    print(f"Capitulos: {len(chapters)} | Grupos: {len(groups)}")
    print(f"Categorias: {len(categories)} | Subcategorias: {len(subcategories)}")

    rows_by_code = {}

    for row in categories:
        code = clean(row.get("CAT")).upper()

        if not code or not clean(row.get("DESCRICAO")):
            continue

        built = build_row(
            code,
            row.get("DESCRICAO"),
            chapters,
            groups,
            level="categoria",
            classif=row.get("CLASSIF"),
        )
        rows_by_code[built["code"]] = built

    # O arquivo de subcategorias tambem repete as categorias que nao tem
    # subdivisao (codigos de 3 caracteres). Essas ja vieram do arquivo anterior,
    # entao aqui so entram os codigos de 4 caracteres.
    skipped_three_char = 0

    for row in subcategories:
        code = clean(row.get("SUBCAT")).upper()

        if not code or not clean(row.get("DESCRICAO")):
            continue

        if len(code) <= 3:
            skipped_three_char += 1
            continue

        built = build_row(
            code,
            row.get("DESCRICAO"),
            chapters,
            groups,
            level="subcategoria",
            sex=row.get("RESTRSEXO"),
            classif=row.get("CLASSIF"),
        )
        rows_by_code[built["code"]] = built

    print(f"Categorias sem subdivisao ja cobertas pelo arquivo de categorias: {skipped_three_char}")

    missing_chapter = [row["code"] for row in rows_by_code.values() if row["chapter_number"] is None]

    if missing_chapter:
        print(f"AVISO: {len(missing_chapter)} codigos sem capitulo (ex.: {missing_chapter[:5]})")

    return sorted(rows_by_code.values(), key=lambda row: row["code_key"])


def upsert_batches(rows, supabase_url, service_role_key):
    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/cid10_codes?on_conflict=code"
    headers = {
        "Content-Type": "application/json",
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    total = 0

    for start in range(0, len(rows), BATCH_SIZE):
        batch = rows[start:start + BATCH_SIZE]
        request = urllib.request.Request(
            endpoint,
            data=json.dumps(batch).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                response.read()
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            raise SystemExit(f"Falha no lote {start}-{start + len(batch)}: {error.code} {body}")

        total += len(batch)
        print(f"  {total}/{len(rows)} codigos enviados...")

    return total


def main():
    parser = argparse.ArgumentParser(description="Importa a CID-10 do DATASUS para o Supabase.")
    parser.add_argument("--dry-run", action="store_true", help="So processa e mostra a amostra, sem gravar.")
    parser.add_argument("--local-zip", help="Usa um CID10CSV.zip ja baixado em vez de buscar na rede.")
    args = parser.parse_args()

    archive = download_source(args.local_zip)
    rows = build_rows(archive)

    print(f"\nTotal de codigos prontos: {len(rows)}")
    print("Amostra:")
    for row in rows[:3]:
        print(f"  {row['code']} — {row['description']} (cap. {row['chapter_number']})")

    for sample_code in ("N30.0", "J06.9", "F41.1"):
        found = next((row for row in rows if row["code"] == sample_code), None)
        print(f"  {sample_code}: {found['description'] if found else 'NAO ENCONTRADO'}")

    if args.dry_run:
        print("\n--dry-run: nada foi gravado.")
        return

    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        raise SystemExit("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de importar.")

    print(f"\nEnviando para {supabase_url} em lotes de {BATCH_SIZE}...")
    total = upsert_batches(rows, supabase_url, service_role_key)
    print(f"Concluido: {total} codigos importados.")


if __name__ == "__main__":
    sys.exit(main())
