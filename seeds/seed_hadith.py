"""Seed the Hadith Collection.

Pulls the six canonical hadith collections (Sahih Sittah) in English from
fawazahmed0/hadith-api on jsDelivr, normalizes them, and uploads to a Grok
Collection — one document per hadith.

Each document captures: collection name, hadith reference, Arabic + English
text where available, and grading (sahih/hasan/da'if) where the source data
provides it.

Bukhari and Muslim: entirely Sahih by scholarly consensus.
Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah: per-hadith grading, included when
present in source data.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request

from shared import get_client, get_or_create_collection, parallel_upload


CDN_BASE = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1"

# (display_name, candidate english slugs in order of preference, candidate arabic slugs)
SAHIH_SITTAH = [
    ("Sahih al-Bukhari",      ["eng-bukhari"],                ["ara-bukhari"]),
    ("Sahih Muslim",          ["eng-muslim"],                 ["ara-muslim"]),
    ("Sunan Abu Dawud",       ["eng-abudawud", "eng-dawud"],  ["ara-abudawud", "ara-dawud"]),
    ("Jami` at-Tirmidhi",     ["eng-tirmidhi"],               ["ara-tirmidhi"]),
    ("Sunan an-Nasa'i",       ["eng-nasai"],                  ["ara-nasai"]),
    ("Sunan Ibn Majah",       ["eng-ibnmajah"],               ["ara-ibnmajah"]),
]


def fetch_json(url: str, timeout: int = 180) -> dict:
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read())


def fetch_edition(slug: str) -> dict | None:
    url = f"{CDN_BASE}/editions/{slug}.json"
    try:
        return fetch_json(url)
    except Exception as e:
        print(f"  [!] Could not fetch {slug}: {e}")
        return None


def pick_first_available(slugs: list[str]) -> tuple[str | None, dict | None]:
    for slug in slugs:
        data = fetch_edition(slug)
        if data:
            return slug, data
    return None, None


def normalize_hadith(item: dict) -> dict:
    """Normalize various possible hadith record shapes into a flat dict."""
    out = {
        "number": None,
        "text": "",
        "reference_text": "",
        "grades": [],
    }
    out["number"] = (
        item.get("hadithnumber")
        or item.get("hadith_number")
        or item.get("number")
    )
    out["text"] = (item.get("text") or item.get("body") or "").strip()

    ref = item.get("reference") or {}
    if isinstance(ref, dict):
        parts = []
        for k in ("book", "hadith", "section", "chapter"):
            if k in ref:
                parts.append(f"{k}={ref[k]}")
        out["reference_text"] = "; ".join(parts)
    elif isinstance(ref, str):
        out["reference_text"] = ref

    grades = item.get("grades") or []
    if isinstance(grades, list):
        for g in grades:
            if isinstance(g, dict):
                grader = g.get("name", "")
                grade = g.get("grade", "")
                if grader or grade:
                    out["grades"].append(f"{grader}: {grade}".strip(": "))
            elif isinstance(g, str):
                out["grades"].append(g)

    return out


def extract_hadiths(data: dict) -> list[dict]:
    """Extract hadith list from edition JSON. Tries common shapes."""
    for key in ("hadiths", "data", "items"):
        if isinstance(data.get(key), list):
            return data[key]
    return []


def build_documents_for_collection(
    display_name: str,
    eng_slug: str,
    eng_data: dict,
    ara_data: dict | None,
) -> list[tuple[str, str]]:
    eng_hadiths = extract_hadiths(eng_data)
    ara_hadiths = extract_hadiths(ara_data) if ara_data else []
    ara_index: dict[int, str] = {}
    for h in ara_hadiths:
        num = h.get("hadithnumber") or h.get("hadith_number") or h.get("number")
        if num is not None:
            ara_index[int(num)] = (h.get("text") or "").strip()

    docs: list[tuple[str, str]] = []
    for raw in eng_hadiths:
        h = normalize_hadith(raw)
        if not h["text"] or h["number"] is None:
            continue

        try:
            num = int(h["number"])
        except (TypeError, ValueError):
            num = h["number"]

        arabic = ara_index.get(num, "") if isinstance(num, int) else ""
        slug_short = eng_slug.replace("eng-", "")
        ref = f"{slug_short}:{num}"

        grade_line = ""
        if display_name in ("Sahih al-Bukhari", "Sahih Muslim"):
            grade_line = "Grade: Sahih (collection consensus)"
        elif h["grades"]:
            grade_line = "Grade: " + " | ".join(h["grades"])
        else:
            grade_line = "Grade: (not specified in source data)"

        body_parts = [
            f"Hadith from {display_name}",
            f"Reference: {ref}",
        ]
        if h["reference_text"]:
            body_parts.append(f"Source reference: {h['reference_text']}")
        body_parts.append(grade_line)
        body_parts.append("")
        if arabic:
            body_parts.append(f"ARABIC:\n{arabic}\n")
        body_parts.append(f"ENGLISH:\n{h['text']}\n")

        body = "\n".join(body_parts)
        docs.append((f"hadith:{ref}", body))

    return docs


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the Hadith Collection.")
    parser.add_argument("--reset", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    print("[1/3] Downloading hadith collections…")
    all_docs: list[tuple[str, str]] = []
    for display_name, eng_slugs, ara_slugs in SAHIH_SITTAH:
        print(f"  • {display_name}")
        eng_slug, eng_data = pick_first_available(eng_slugs)
        if not eng_data:
            print(f"    [!] Skipping {display_name}: no English edition found "
                  f"(tried {eng_slugs}). Edit SAHIH_SITTAH slugs at top of file "
                  f"after checking {CDN_BASE}/editions.json")
            continue
        _, ara_data = pick_first_available(ara_slugs)

        docs = build_documents_for_collection(display_name, eng_slug, eng_data, ara_data)
        print(f"    + {len(docs)} hadith")
        all_docs.extend(docs)

    if not all_docs:
        sys.exit("No hadith collected. Check the slug list against editions.json.")

    print(f"[2/3] Built {len(all_docs)} total hadith documents.")

    if args.dry_run:
        print("\n--- DRY RUN: first 2 documents ---\n")
        for name, body in all_docs[:2]:
            print(f"=== {name} ===")
            print(body)
            print()
        sys.exit(0)

    client = get_client()
    collection_id = get_or_create_collection(
        client,
        name="tranquil-hadith",
        description=(
            "Sahih Sittah hadith collections (Bukhari, Muslim, Abu Dawud, "
            "Tirmidhi, Nasa'i, Ibn Majah) in English with Arabic where "
            "available. One document per hadith, with grading."
        ),
        reset=args.reset,
    )

    print(f"[3/3] Uploading {len(all_docs)} docs to xAI ({args.workers} workers)…")
    success, fails = parallel_upload(
        client, collection_id, all_docs, workers=args.workers, label="Hadith"
    )
    print(f"\nDone. Uploaded {success}/{len(all_docs)}. Failures: {fails}.")
    print("\n  → Save this in .env (and the Next.js app's .env later):")
    print(f"  HADITH_COLLECTION_ID={collection_id}\n")


if __name__ == "__main__":
    main()
