import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type {
  CustomGetCommandInput,
  CustomPutCommandInput,
  CustomQueryCommandInput,
  CustomQueryCommandOutput,
  CustomUpdateItemInput
} from './types';
import { logger } from '../../utils/logger';

// Initialize DynamoDB client
const dynamoDb = new DynamoDBClient({ region: process.env['AWS_REGION'] || 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(dynamoDb);

/**
 * Retrieves a single record from DynamoDB by key
 */
export async function getRecordByKey<T>(input: CustomGetCommandInput): Promise<T | undefined> {
  try {
    const { tableName, key, projectionExpression, expressionAttributeNames, consistentRead } = input;

    const result = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: key,
        ProjectionExpression: projectionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ConsistentRead: consistentRead
      })
    );

    return result.Item ? (result.Item as T) : undefined;
  } catch (error: unknown) {
    logger.error(`Error retrieving record from table "${input.tableName}":`, error);
    throw error;
  }
}

/**
 * Queries records from DynamoDB using a key condition
 */
export async function queryRecords<T>(input: CustomQueryCommandInput): Promise<CustomQueryCommandOutput<T>> {
  try {
    const { tableName, queryRequest, filterExpression, projectionExpression, scanIdxForward } = input;

    const keyConditionExpression = `#pk = :pk${queryRequest.sKey ? ' AND #sk = :sk' : ''}`;

    const expressionAttributeNames: Record<string, string> = {
      '#pk': queryRequest.pKeyProp,
      ...(queryRequest.sKeyProp && { '#sk': queryRequest.sKeyProp }),
      ...(input.expressionAttributeNames || {})
    };

    const expressionAttributeValues: Record<string, unknown> = {
      ':pk': queryRequest.pKey,
      ...(queryRequest.sKey && { ':sk': queryRequest.sKey }),
      ...(input.expressionAttributeValues || {})
    };

    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: queryRequest.indexName,
        KeyConditionExpression: keyConditionExpression,
        FilterExpression: filterExpression,
        ProjectionExpression: projectionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ScanIndexForward: scanIdxForward,
        Limit: queryRequest.limit,
        ExclusiveStartKey: queryRequest.lastEvaluatedKey ? JSON.parse(queryRequest.lastEvaluatedKey) : undefined
      })
    );

    return {
      items: result.Items ? (result.Items as T[]) : [],
      lastEvaluatedKey: result.LastEvaluatedKey ? JSON.stringify(result.LastEvaluatedKey) : undefined
    };
  } catch (error: unknown) {
    logger.error(`Error querying records from table "${input.tableName}":`, error);
    throw error;
  }
}

/**
 * Creates a new record in DynamoDB
 */
export async function createRecord<T>(input: CustomPutCommandInput<T>): Promise<T> {
  try {
    const { tableName, item, conditionExpression, expressionAttributeNames, expressionAttributeValues } = input;

    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item as Record<string, unknown>,
        ConditionExpression: conditionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
      })
    );

    return item;
  } catch (error: unknown) {
    logger.error(`Error creating record in table "${input.tableName}":`, error);
    throw error;
  }
}

/**
 * Updates an existing record in DynamoDB
 */
export async function updateRecord<T>(input: CustomUpdateItemInput<T>): Promise<T | undefined> {
  try {
    const {
      tableName,
      key,
      item,
      updateExpression,
      conditionExpression,
      expressionAttributeNames,
      expressionAttributeValues,
      returnValues = 'ALL_NEW'
    } = input;

    // Build update expression from item if not provided
    const finalUpdateExpression =
      updateExpression ||
      `SET ${Object.keys(item)
        .map((k, i) => `#attr${i} = :val${i}`)
        .join(', ')}`;

    const finalExpressionAttributeNames = expressionAttributeNames || {};
    const finalExpressionAttributeValues = expressionAttributeValues || {};

    if (!updateExpression) {
      Object.keys(item).forEach((k, i) => {
        finalExpressionAttributeNames[`#attr${i}`] = k;
        finalExpressionAttributeValues[`:val${i}`] = item[k as keyof typeof item];
      });
    }

    const result = await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: finalUpdateExpression,
        ConditionExpression: conditionExpression,
        ExpressionAttributeNames:
          Object.keys(finalExpressionAttributeNames).length > 0 ? finalExpressionAttributeNames : undefined,
        ExpressionAttributeValues:
          Object.keys(finalExpressionAttributeValues).length > 0 ? finalExpressionAttributeValues : undefined,
        ReturnValues: returnValues
      })
    );

    return result.Attributes as T;
  } catch (error: unknown) {
    logger.error(`Error updating record in table "${input.tableName}":`, error);
    throw error;
  }
}
