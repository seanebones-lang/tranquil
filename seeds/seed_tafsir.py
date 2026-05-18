"""Seed the Tafsir Collection.

Pulls Tafsir Ibn Kathir (English, abridged) from spa5k/tafsir_api on jsDelivr,
one file per surah, expands to one document per ayah, uploads to a Grok
Collection.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request

from shared import get_client, get_or_create_collection, parallel_upload


CDN_BASE = "https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir"
TAFSIR_SLUG = "en-tafisr-ibn-kathir"  # note: source spells it "tafisr"
TAFSIR_NAME = "Tafsir Ibn Kathir (abridged, English)"


def fetch_surah(surah_num: int) -> dict | None:
    url = f"{CDN_BASE}/{TAFSIR_SLUG}/{surah_num}.json"
    try:
        with urllib.request.urlopen(url, timeout=120) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  [!] Could not fetch surah {surah_num}: {e}")
        return None


def extract_ayahs(data: dict) -> list[dict]:
    """Pull ayah-level tafsir entries. Tries common shapes."""
    for key in ("ayahs", "data", "items"):
        if isinstance(data.get(key), list):
            return data[key]
    return []


def build_documents() -> list[tuple[str, str]]:
    docs: list[tuple[str, str]] = []
    for s_num in range(1, 115):
        sys.stdout.write(f"\r  Surah {s_num}/114…")
        sys.stdout.flush()

        data = fetch_surah(s_num)
        if not data:
            continue
        ayahs = extract_ayahs(data)
        for a in ayahs:
            v_num = a.get("ayah") or a.get("ayah_number") or a.get("verse")
            text = (a.get("text") or a.get("body") or "").strip()
            if not v_num or not text:
                continue
            ref = f"{s_num}:{v_num}"

            body = (
                f"{TAFSIR_NAME}\n"
                f"On Quran {ref}\n\n"
                f"{text}\n"
            )
            docs.append((f"tafsir:{ref}", body))
    print()
    return docs


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the Tafsir Collection.")
    parser.add_argument("--reset", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    print("[1/2] Downloading and building tafsir documents…")
    docs = build_documents()
    print(f"  Built {len(docs)} tafsir documents.")

    if not docs:
        sys.exit("No tafsir documents built. Check source URL and parse keys.")

    if args.dry_run:
        print("\n--- DRY RUN: first 2 documents ---\n")
        for name, body in docs[:2]:
            print(f"=== {name} ===")
            print(body)
            print()
        sys.exit(0)

    client = get_client()
    collection_id = get_or_create_collection(
        client,
        name="tranquil-tafsir",
        description=f"{TAFSIR_NAME}. One document per ayah.",
        reset=args.reset,
    )

    print(f"[2/2] Uploading {len(docs)} docs to xAI ({args.workers} workers)…")
    success, fails = parallel_upload(
        client, collection_id, docs, workers=args.workers, label="Tafsir"
    )
    print(f"\nDone. Uploaded {success}/{len(docs)}. Failures: {fails}.")
    print("\n  → Save this in .env (and the Next.js app's .env later):")
    print(f"  TAFSIR_COLLECTION_ID={collection_id}\n")


if __name__ == "__main__":
    main()
