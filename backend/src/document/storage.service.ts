import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private s3: S3Client;
  private bucket: string;
  private internalEndpoint: string;
  private publicEndpoint: string;

  constructor(private config: ConfigService) {
    this.internalEndpoint = config.get<string>('MINIO_ENDPOINT', 'http://localhost:9000');
    this.publicEndpoint = config.get<string>('MINIO_PUBLIC_ENDPOINT', this.internalEndpoint);
    const accessKey = config.get<string>('MINIO_ACCESS_KEY', 'minioadmin');
    const secretKey = config.get<string>('MINIO_SECRET_KEY', 'minioadmin');
    this.bucket = config.get<string>('MINIO_BUCKET', 'loma-documents');

    this.s3 = new S3Client({
      endpoint: this.internalEndpoint,
      region: 'us-east-1',
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
      // Disable automatic CRC32 checksums injected by SDK v3 >= 3.350.
      // MinIO validates the checksum baked into the pre-signed URL against the
      // actual uploaded body and returns 403 when they don't match.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  /** Rewrite the internal Docker endpoint to the public-facing URL so browsers can resolve it. */
  private rewriteUrl(url: string): string {
    if (this.internalEndpoint === this.publicEndpoint) return url;
    return url.replace(this.internalEndpoint, this.publicEndpoint);
  }

  /**
   * Storage path: /tenants/{tenantId}/customers/{customerId}/cases/{caseId}/documents/{docType}/{docId}/versions/{versionId}
   */
  buildKey(tenantId: string, customerId: string | null, caseId: string | null, docTypeId: string, docId: string, versionId: string): string {
    let path = `tenants/${tenantId}`;
    if (customerId) path += `/customers/${customerId}`;
    if (caseId) path += `/cases/${caseId}`;
    path += `/documents/${docTypeId}/${docId}/versions/${versionId}`;
    return path;
  }

  async getUploadUrl(key: string, mimeType: string): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mimeType });
    const url = await getSignedUrl(this.s3, command, { expiresIn: 900 }); // 15 min
    return this.rewriteUrl(url);
  }

  async getDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const url = await getSignedUrl(this.s3, command, { expiresIn: 300 }); // 5 min
    return this.rewriteUrl(url);
  }

  async deleteObject(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
