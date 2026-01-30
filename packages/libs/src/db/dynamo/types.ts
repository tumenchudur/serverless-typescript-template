import type { ReturnConsumedCapacity, ReturnItemCollectionMetrics, ReturnValue } from '@aws-sdk/client-dynamodb';

export interface CustomGetCommandInput {
  tableName: string;
  key: Record<string, string | number>;
  projectionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  consistentRead?: boolean;
  returnConsumedCapacity?: ReturnConsumedCapacity;
}

export interface QueryRequest {
  indexName?: string;
  pKey: string;
  pKeyProp: string;
  sKey?: string;
  sKeyProp?: string;
  limit?: number;
  lastEvaluatedKey?: string;
}

export interface CustomQueryCommandInput {
  tableName: string;
  queryRequest: QueryRequest;
  keyConditionExpression?: string;
  filterExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, unknown>;
  projectionExpression?: string;
  scanIdxForward?: boolean;
}

export interface CustomQueryCommandOutput<T> {
  lastEvaluatedKey: string | undefined;
  items: T[];
}

export interface CustomPutCommandInput<T> {
  tableName: string;
  item: T;
  conditionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, unknown>;
  returnValues?: ReturnValue;
  returnConsumedCapacity?: ReturnConsumedCapacity;
  returnItemCollectionMetrics?: ReturnItemCollectionMetrics;
}

export interface CustomUpdateItemInput<T> {
  tableName: string;
  key: Record<string, string | number>;
  item: Partial<T>;
  updateExpression?: string;
  conditionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, unknown>;
  returnValues?: ReturnValue;
  returnConsumedCapacity?: ReturnConsumedCapacity;
  returnItemCollectionMetrics?: ReturnItemCollectionMetrics;
}
