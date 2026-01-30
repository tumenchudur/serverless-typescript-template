import type { ApiHeaderConfig } from '@template/contracts';

export interface FuncParams {
  dir: string;
  fnName: string;
  other?: Record<string, unknown>;
}

export interface ApiFuncParams {
  dir: string;
  fnName: string;
  http: {
    method: 'get' | 'post' | 'put' | 'patch' | 'delete';
    path: string;
    more?: Record<string, unknown>;
  };
  other?: Record<string, unknown>;
}

export interface ApiFuncWithAuthParams extends ApiFuncParams {
  authConfig?: ApiHeaderConfig;
}
