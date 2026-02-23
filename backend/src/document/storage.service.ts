import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private s3: S3Client;
  private bucket: string;

  constructor(private config: ConfigService) {
    const endpoint = config.get<string>('MINIO_ENDPOINT', 'http://localhost:9000');
    const accessKey = config.get<string>('MINIO_ACCESS_KEY', 'minioadmin');
    const secretKey = config.get<string>('MINIO_SECRET_KEY', 'minioadmin');
    this.bucket = config.get<string>('MINIO_BUCKET', 'loma-documents');

    this.s3 = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });
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
    return getSignedUrl(this.s3, command, { expiresIn: 900 }); // 15 min
  }

  async getDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: 300 }); // 5 min
  }

  async deleteObject(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
