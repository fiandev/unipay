/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import { UnipayError } from './errors.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type RequestBody = Record<string, unknown> | string | undefined;

export interface HttpRequestOptions {
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: RequestBody;
  timeoutMs?: number;
  contentType?: 'json' | 'form-urlencoded';
}

export interface HttpResponse<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
}

export async function request<T = unknown>(
  url: string,
  options: HttpRequestOptions,
): Promise<HttpResponse<T>> {
  const { method, headers = {}, body, timeoutMs = 15000, contentType = 'json' } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const fetchHeaders = new Headers(headers);

  let fetchBody: BodyInit | undefined;

  if (body !== undefined) {
    if (contentType === 'form-urlencoded') {
      if (!fetchHeaders.has('Content-Type')) {
        fetchHeaders.set('Content-Type', 'application/x-www-form-urlencoded');
      }
      if (typeof body === 'string') {
        fetchBody = body;
      } else {
        fetchBody = new URLSearchParams(
          body as Record<string, string>,
        ).toString();
      }
    } else {
      if (!fetchHeaders.has('Content-Type')) {
        fetchHeaders.set('Content-Type', 'application/json');
      }
      fetchBody = JSON.stringify(body);
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers: fetchHeaders,
      body: fetchBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let responseBody: T;
    const contentTypeHeader = response.headers.get('content-type') ?? '';
    if (contentTypeHeader.includes('application/json')) {
      responseBody = (await response.json()) as T;
    } else {
      responseBody = (await response.text()) as unknown as T;
    }

    return {
      status: response.status,
      body: responseBody,
      headers: response.headers,
    };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new UnipayError({
        code: 'TIMEOUT',
        message: `Request timed out after ${timeoutMs}ms: ${method} ${url}`,
        httpStatus: 408,
      });
    }

    throw new UnipayError({
      code: 'NETWORK_ERROR',
      message: `Network request failed: ${method} ${url}`,
      cause: err,
    });
  }
}
