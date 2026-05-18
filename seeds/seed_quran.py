"""Seed the Quran Collection.

Pulls Arabic (Uthmani) + 4 English translations from alquran.cloud, builds one
document per verse with all editions combined, uploads to a Grok Collection.

Source data: Tanzil-licensed Quran text via api.alquran.cloud.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request

from shared import get_client, get_or_create_collection, parallel_upload


EDITIONS = {
    "arabic":    "quran-uthmani",
    "sahih":     "en.sahih",
    "pickthall": "en.pickthall",
    "yusufali":  "en.yusufali",
    "asad":      "en.asad",
}


def fetch_edition(slug: str) -> dict:
    url = f"https://api.alquran.cloud/v1/quran/{slug}"
    print(f"  Fetching {slug}…", flush=True)
    with urllib.request.urlopen(url, timeout=180) as resp:
        return json.loads(resp.read())["data"]


def index_edition(data: dict) -> dict[int, dict[int, str]]:
    """Returns {surah_num: {verse_num: text}}."""
    out: dict[int, dict[int, str]] = {}
    for s in data["surahs"]:
        out[s["number"]] = {a["numberInSurah"]: a["text"] for a in s["ayahs"]}
    return out


def build_documents(editions: dict[str, dict]) -> list[tuple[str, str]]:
    indexed = {key: index_edition(data) for key, data in editions.items()}
    docs: list[tuple[str, str]] = []

    for surah in editions["arabic"]["surahs"]:
        s_num = surah["number"]
        s_name_ar = surah["name"]
        s_name_en = surah["englishName"]
        s_name_tr = surah["englishNameTranslation"]
        rev = surah["revelationType"]

        for ayah in surah["ayahs"]:
            v_num = ayah["numberInSurah"]
            ref = f"{s_num}:{v_num}"

            body = (
                f"Quran, Surah {s_num} ({s_name_en} — {s_name_tr}), Ayah {v_num}\n"
                f"Reference: {ref}\n"
                f"Surah (Arabic): {s_name_ar}\n"
                f"Revelation: {rev}\n\n"
                f"ARABIC (Uthmani):\n{indexed['arabic'].get(s_num, {}).get(v_num, '')}\n\n"
                f"ENGLISH — Sahih International:\n"
                f"{indexed['sahih'].get(s_num, {}).get(v_num, '')}\n\n"
                f"ENGLISH — Pickthall:\n"
                f"{indexed['pickthall'].get(s_num, {}).get(v_num, '')}\n\n"
                f"ENGLISH — Yusuf Ali:\n"
                f"{indexed['yusufali'].get(s_num, {}).get(v_num, '')}\n\n"
                f"ENGLISH — Muhammad Asad:\n"
                f"{indexed['asad'].get(s_num, {}).get(v_num, '')}\n"
            )
            docs.append((f"quran:{ref}", body))

    return docs


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the Quran Collection.")
    parser.add_argument("--reset", action="store_true", help="Delete and recreate")
    parser.add_argument("--dry-run", action="store_true", help="Build docs only, don't upload")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    print("[1/3] Downloading editions…")
    editions = {key: fetch_edition(slug) for key, slug in EDITIONS.items()}

    print("[2/3] Building documents…")
    docs = build_documents(editions)
    print(f"  Built {len(docs)} verse documents.")

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
        name="tranquil-quran",
        description=(
            "Quran Arabic Uthmani + Sahih International, Pickthall, "
            "Yusuf Ali, Muhammad Asad. One document per verse."
        ),
        reset=args.reset,
    )

    print(f"[3/3] Uploading {len(docs)} docs to xAI ({args.workers} workers)…")
    success, fails = parallel_upload(
        client, collection_id, docs, workers=args.workers, label="Quran"
    )
    print(f"\nDone. Uploaded {success}/{len(docs)}. Failures: {fails}.")
    print("\n  → Save this in .env (and the Next.js app's .env later):")
    print(f"  QURAN_COLLECTION_ID={collection_id}\n")


if __name__ == "__main__":
    main()
