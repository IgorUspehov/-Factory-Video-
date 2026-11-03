import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const CONTENT_TYPES = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/mp4', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.aac': 'audio/aac' };

/**
 * Cloudflare R2 driver (S3 API), same interface as local.js.
 * R2 is the source of truth; DATA_DIR/files is only a cache (Render's disk is wiped on every deploy):
 * - put(): uploads to R2 first; uploads/ keep a local copy (needed again by every render), renders/ do not;
 * - localPath(): returns the cached file or downloads it from R2 first (concurrent calls share one download);
 * - signedUrl()/verify()/publicUrl() are unchanged (links point to our own /files route, HMAC-signed).
 */
export function createR2Storage({ local, accountId, accessKeyId, secretAccessKey, bucket }) {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // R2 does not accept the SDK's default CRC32 trailer checksums
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const inflight = new Map();
  const isRender = (key) => key.startsWith('renders/');
  const missing = (err) => err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404;

  async function download(key) {
    const dest = local.filePath(key);
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    await mkdir(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.${process.pid}.dl`;
    try {
      await pipeline(res.Body, createWriteStream(tmp));
      await rename(tmp, dest);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
    return dest;
  }

  return {
    ...local,
    async put(key, srcPath) {
      local.filePath(key); // validates the key
      const { size } = await stat(srcPath);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: createReadStream(srcPath),
          ContentLength: size,
          ContentType: CONTENT_TYPES[path.extname(key).toLowerCase()] ?? 'application/octet-stream',
        }),
      );
      if (isRender(key)) await rm(srcPath, { force: true });
      else await local.put(key, srcPath);
      return key;
    },
    async localPath(key) {
      const file = local.filePath(key);
      try {
        await stat(file);
        return file;
      } catch {
        /* not cached */
      }
      if (!inflight.has(key)) inflight.set(key, download(key).finally(() => inflight.delete(key)));
      return inflight.get(key);
    },
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch (err) {
        if (missing(err)) return false;
        throw err;
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      await local.remove(key);
    },
    /** Small objects (the JSON database mirror): the body as a Buffer, or null if the key does not exist. */
    async getObject(key) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return Buffer.from(await res.Body.transformToByteArray());
      } catch (err) {
        if (missing(err)) return null;
        throw err;
      }
    },
    async putObject(key, body, contentType = 'application/json') {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentLength: Buffer.byteLength(body), ContentType: contentType }));
    },
    async list(prefix) {
      const keys = [];
      let token;
      do {
        const res = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
        for (const o of res.Contents ?? []) keys.push(o.Key);
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (token);
      return keys;
    },
    /** True if the file is reachable (cache or R2); used by the /files route to answer 404 instead of 500. */
    async available(key) {
      try {
        await this.localPath(key);
        return true;
      } catch (err) {
        if (missing(err)) return false;
        throw err;
      }
    },
  };
}
