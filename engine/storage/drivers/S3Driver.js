import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Amazon S3 / S3-compatible storage driver.
 */
export class S3Driver {
  constructor(app, config) {
    this.app = app;
    this.#config = config;
    this.#client = new S3Client({
      region: config.region ?? 'us-east-1',
      credentials: config.key && config.secret
        ? { accessKeyId: config.key, secretAccessKey: config.secret }
        : undefined,
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.usePathStyleEndpoint ?? false,
    });
    this.#bucket = config.bucket;
    this.#baseUrl = config.url?.replace(/\/$/, '') ?? null;
  }

  #config;
  #client;
  #bucket;
  #baseUrl;

  async put(relativePath, contents, options = {}) {
    const key = this.#key(relativePath);
    const visibility = options.visibility ?? this.#config.visibility ?? 'private';

    await this.#client.send(new PutObjectCommand({
      Bucket: this.#bucket,
      Key: key,
      Body: contents,
      ContentType: options.contentType,
      ACL: visibility === 'public' ? 'public-read' : undefined,
    }));

    return { path: key, disk: 's3' };
  }

  async get(relativePath) {
    const key = this.#key(relativePath);
    try {
      const response = await this.#client.send(new GetObjectCommand({
        Bucket: this.#bucket,
        Key: key,
      }));
      return Buffer.from(await response.Body.transformToByteArray());
    } catch {
      return null;
    }
  }

  async delete(relativePath) {
    const key = this.#key(relativePath);
    try {
      await this.#client.send(new DeleteObjectCommand({
        Bucket: this.#bucket,
        Key: key,
      }));
      return true;
    } catch {
      return false;
    }
  }

  async exists(relativePath) {
    const key = this.#key(relativePath);
    try {
      await this.#client.send(new HeadObjectCommand({
        Bucket: this.#bucket,
        Key: key,
      }));
      return true;
    } catch {
      return false;
    }
  }

  url(relativePath) {
    const key = this.#key(relativePath);
    if (this.#baseUrl) {
      return `${this.#baseUrl}/${key}`;
    }
    const region = this.#config.region ?? 'us-east-1';
    return `https://${this.#bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  async temporaryUrl(relativePath, expiresInSeconds = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.#bucket,
      Key: this.#key(relativePath),
    });
    return getSignedUrl(this.#client, command, { expiresIn: expiresInSeconds });
  }

  #key(relativePath) {
    return String(relativePath).replace(/\\/g, '/').replace(/^\/+/, '');
  }
}
