import { MODELS, xaiJson } from "./xai";

/**
 * Grok Collections wrappers.
 *
 * Assumed REST surface (mirrors Python xai-sdk):
 *   POST   /collections                          -> create
 *   GET    /collections                          -> list
 *   DELETE /collections/{id}                     -> delete
 *   POST   /collections/{id}/documents           -> upload document
 *   POST   /collections/search                   -> hybrid search
 *
 * If xAI's actual REST paths differ, adjust here only.
 */

export type Collection = {
  collection_id: string;
  name: string;
  description?: string;
};

export type CollectionDoc = {
  document_id: string;
  name: string;
};

export type SearchHit = {
  document_id: string;
  name: string;
  content: string;
  score: number;
  collection_id: string;
};

export async function createCollection(
  name: string,
  description = "",
): Promise<Collection> {
  return xaiJson<Collection>("/collections", {
    method: "POST",
    body: {
      name,
      description,
      model_name: MODELS.embedding,
    },
  });
}

export async function deleteCollection(collectionId: string): Promise<void> {
  await xaiJson(`/collections/${collectionId}`, { method: "DELETE" });
}

export async function uploadDocument(
  collectionId: string,
  name: string,
  text: string,
): Promise<CollectionDoc> {
  return xaiJson<CollectionDoc>(`/collections/${collectionId}/documents`, {
    method: "POST",
    body: {
      name,
      data: Buffer.from(text, "utf-8").toString("base64"),
      encoding: "base64",
    },
  });
}

export async function searchCollections(
  collectionIds: string[],
  query: string,
  limit = 8,
  mode: "semantic" | "keyword" | "hybrid" = "hybrid",
): Promise<SearchHit[]> {
  const res = await xaiJson<{ results: SearchHit[] }>("/collections/search", {
    method: "POST",
    body: {
      query,
      collection_ids: collectionIds,
      retrieval_mode: mode,
      limit,
    },
  });
  return res.results ?? [];
}
