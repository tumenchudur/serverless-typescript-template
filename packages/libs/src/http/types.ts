import type { APIGatewayProxyEventV2 } from 'aws-lambda';

export type ValidatedAPIGatewayProxyEvent<S> = Omit<APIGatewayProxyEventV2, 'body'> & {
  body: S;
};
