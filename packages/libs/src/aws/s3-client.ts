import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';

const s3Client = new S3Client({ region: process.env['AWS_REGION'] || 'ap-southeast-1' });

export async function getObjectFromS3(bucket: string, key: string): Promise<string> {
  try {
    const result = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await result.Body?.transformToString();
    if (!body) throw new Error('Empty S3 object body');
    return body;
  } catch (error) {
    logger.error(`Error getting object from S3: ${bucket}/${key}`, error);
    throw error;
  }
}

export async function putObjectToS3(bucket: string, key: string, body: string | Buffer): Promise<void> {
  try {
    await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));
    logger.info(`Successfully uploaded object to S3: ${bucket}/${key}`);
  } catch (error) {
    logger.error(`Error uploading object to S3: ${bucket}/${key}`, error);
    throw error;
  }
}
