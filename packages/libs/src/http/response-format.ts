import type { APIGatewayProxyResultV2 } from 'aws-lambda';

export function formatApiResponse(data: object, statusCode: number = 200): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: JSON.stringify(data)
  };
}
