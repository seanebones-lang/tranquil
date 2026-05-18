"""Smoke-test the three Collections after seeding.

Runs one hybrid search against each and prints the top result, to confirm:
1. The collections exist and contain documents
2. xAI is returning results
3. The document shapes look right

Run this AFTER all three seed scripts have finished.
"""
from __future__ import annotations

import os
import sys

from shared import get_client


QUERIES = [
    ("tranquil-quran",  "QURAN_COLLECTION_ID",  "What does the Quran say about patience in hardship?"),
    ("tranquil-hadith", "HADITH_COLLECTION_ID", "Hadith about kindness to neighbors"),
    ("tranquil-tafsir", "TAFSIR_COLLECTION_ID", "Tafsir on Ayat al-Kursi"),
]


def main() -> None:
    client = get_client()

    for col_name, env_var, query in QUERIES:
        cid = os.getenv(env_var)
        if not cid:
            print(f"[!] {env_var} not set in .env — skipping {col_name}\n")
            continue

        print(f"=== {col_name} ===")
        print(f"Query: {query}")
        try:
            results = client.collections.search(
                query=query,
                collection_ids=[cid],
                retrieval_mode="hybrid",
            )
            shown = 0
            for r in results:
                if shown >= 1:
                    break
                name = getattr(r, "name", "(unknown)")
                content = getattr(r, "content", "") or getattr(r, "text", "")
                score = getattr(r, "score", None)
                print(f"\nTop hit: {name}  (score: {score})")
                print("---")
                print(content[:600] + ("…" if len(content) > 600 else ""))
                shown += 1
            if shown == 0:
                print("  [!] No results returned.")
        except Exception as e:
            print(f"  [X] Search failed: {e}")
        print("\n")


if __name__ == "__main__":
    main()
