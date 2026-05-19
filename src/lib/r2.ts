import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

export const R2_BUCKET = process.env.R2_BUCKET ?? "tranquil-audio";

let _client: S3Client | null = null;

export function r2(): S3Client {
  if (_client) return _client;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.",
    );
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

/** Signed PUT URL for the browser to upload directly to R2. */
export async function signedUploadUrl(
  key: string,
  contentType: string,
  expiresSeconds = 300,
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
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
  const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
  return getSignedUrl(r2(), cmd, { expiresIn: expiresSeconds });
}

/** Download bytes from R2 (used by the worker for STT). */
export async function fetchObject(key: string): Promise<Buffer> {
  const out = await r2().send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
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
