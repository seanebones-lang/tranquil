"""Shared utilities for A Tranquil Space seed scripts.

Wraps the xai-sdk Collections API with:
- env-loaded client
- idempotent get_or_create with optional --reset
- retrying parallel upload with progress bar

The Collections API surface assumed here is the one documented at
https://x.ai/news/grok-collections-api as of May 2026:

    client.collections.create(name, description, model_name)
    client.collections.list()                          -> iterable of Collection
    client.collections.delete(collection_id)
    client.collections.upload_document(collection_id, name, data)

If the SDK has drifted, only this file needs adjustment.
"""
from __future__ import annotations

import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from xai_sdk import Client
except ImportError:
    sys.exit("xai-sdk not installed. Run: pip install -r requirements.txt")


EMBEDDING_MODEL = "grok-embedding-small"


def get_client() -> Client:
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        sys.exit("XAI_API_KEY not set. Copy .env.example to .env and fill it in.")
    return Client(api_key=api_key)


def find_collection_by_name(client: Client, name: str):
    """Return the first collection matching name, or None."""
    try:
        for col in client.collections.list():
            if getattr(col, "name", None) == name:
                return col
    except Exception as e:
        print(f"[!] Could not list collections: {e}")
    return None


def get_or_create_collection(
    client: Client,
    name: str,
    description: str = "",
    reset: bool = False,
) -> str:
    existing = find_collection_by_name(client, name)
    if existing and reset:
        cid = getattr(existing, "collection_id", None) or getattr(existing, "id", None)
        print(f"[!] --reset: deleting existing collection '{name}' ({cid})")
        client.collections.delete(cid)
        existing = None

    if existing:
        cid = getattr(existing, "collection_id", None) or getattr(existing, "id", None)
        print(f"[+] Using existing collection: {name} ({cid})")
        return cid

    col = client.collections.create(
        name=name,
        description=description,
        model_name=EMBEDDING_MODEL,
    )
    cid = getattr(col, "collection_id", None) or getattr(col, "id", None)
    print(f"[+] Created collection: {name} ({cid})")
    return cid


def upload_with_retry(
    client: Client,
    collection_id: str,
    name: str,
    body: str,
    max_retries: int = 4,
) -> bool:
    data = body.encode("utf-8")
    for attempt in range(max_retries):
        try:
            client.collections.upload_document(
                collection_id=collection_id,
                name=name,
                data=data,
            )
            return True
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(1.5 ** attempt)
            else:
                print(f"\n[X] Failed to upload {name}: {e}")
                return False
    return False


def parallel_upload(
    client: Client,
    collection_id: str,
    docs: list[tuple[str, str]],
    workers: int = 4,
    label: str = "Uploading",
) -> tuple[int, int]:
    """docs = [(name, body), ...]. Returns (success, fail)."""
    total = len(docs)
    if total == 0:
        return 0, 0
    done = 0
    fails = 0

    def task(d: tuple[str, str]) -> bool:
        return upload_with_retry(client, collection_id, d[0], d[1])

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = [ex.submit(task, d) for d in docs]
        for fut in as_completed(futures):
            ok = fut.result()
            done += 1
            if not ok:
                fails += 1
            _progress(done, total, label)
    return done - fails, fails


def _progress(current: int, total: int, prefix: str = "") -> None:
    if total == 0:
        return
    pct = (current / total) * 100
    bar_len = 30
    filled = int(bar_len * current // total)
    bar = "█" * filled + "░" * (bar_len - filled)
    sys.stdout.write(f"\r{prefix} [{bar}] {current}/{total} ({pct:.1f}%)")
    sys.stdout.flush()
    if current == total:
        print()
