import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Default bucket used by voice upload + worker STT pipeline. */
export const R2_DEFAULT_BUCKET = "tranquil-audio";

/** Read on every check so edits to .env / Railway vars apply after dev server/worker restart. */
function normalizeEnv(raw: string | undefined): string {
  if (raw === undefined || raw === null) return "";
  let t = String(raw).trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function isPlaceholderCredential(v: string): boolean {
  const n = v.toLowerCase();
  return (
    n.length === 0 ||
    n.includes("changeme") ||
    n.includes("your_") ||
    n === "xxx"
  );
}

export type ResolvedR2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

/** Resolve credentials from the environment each call (supports trim + wrapping quotes). */
export function resolveR2Config(): ResolvedR2Config | null {
  const accountId = normalizeEnv(
    process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID,
  );
  const accessKeyId = normalizeEnv(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = normalizeEnv(process.env.R2_SECRET_ACCESS_KEY);
  const bucket =
    normalizeEnv(process.env.R2_BUCKET) || R2_DEFAULT_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  if (isPlaceholderCredential(accessKeyId) || isPlaceholderCredential(secretAccessKey))
    return null;

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

let _cachedClient:
  | { fingerprint: string; client: S3Client }
  | null = null;

function fingerprint(cfg: ResolvedR2Config): string {
  return [cfg.accountId, cfg.accessKeyId, cfg.secretAccessKey].join("|");
}

/** Resolved bucket name (after trim / default). Prefer this over assuming a frozen constant at import time. */
export function currentR2Bucket(): string {
  return resolveR2Config()?.bucket ?? R2_DEFAULT_BUCKET;
}

/** True when env has all vars required for voice upload / playback from R2. */
export function isR2Configured(): boolean {
  return resolveR2Config() !== null;
}

export function r2(): S3Client {
  const cfg = resolveR2Config();
  if (!cfg) {
    throw new Error(
      "R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.",
    );
  }

  const fp = fingerprint(cfg);
  if (!_cachedClient || _cachedClient.fingerprint !== fp) {
    _cachedClient = {
      fingerprint: fp,
      client: new S3Client({
        region: "auto",
        endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: cfg.accessKeyId,
          secretAccessKey: cfg.secretAccessKey,
        },
      }),
    };
  }
  return _cachedClient.client;
}

/** Signed PUT URL for the browser to upload directly to R2. */
export async function signedUploadUrl(
  key: string,
  contentType: string,
  expiresSeconds = 300,
): Promise<string> {
  const bucket = resolveR2Config()?.bucket ?? R2_DEFAULT_BUCKET;
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2(), cmd, { expiresIn: expiresSeconds });
}

/** Signed GET URL for the browser to play back audio. */
export async function signedDownloadUrl(
  key: string,
  expiresSeconds = 3600,
): Promise<string> {
  const bucket = resolveR2Config()?.bucket ?? R2_DEFAULT_BUCKET;
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(r2(), cmd, { expiresIn: expiresSeconds });
}

/** Download bytes from R2 (used by the worker for STT). */
export async function fetchObject(key: string): Promise<Buffer> {
  const bucket = resolveR2Config()?.bucket ?? R2_DEFAULT_BUCKET;
  const out = await r2().send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!out.Body) throw new Error(`R2 object ${key} has no body`);
  return Buffer.from(await out.Body.transformToByteArray());
}

export function audioKey(userId: string, noteId: string, mime: string): string {
  const ext = mime.includes("webm")
    ? "webm"
    : mime.includes("mp4") || mime.includes("m4a")
      ? "m4a"
      : mime.includes("ogg")
        ? "ogg"
        : "bin";
  return `audio/${userId}/${noteId}.${ext}`;
}
