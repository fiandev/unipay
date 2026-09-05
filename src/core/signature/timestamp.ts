/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

export function iso8601Timestamp(offsetTz?: string): string {
  const now = new Date();
  if (offsetTz === 'Z' || !offsetTz) {
    return now.toISOString();
  }
  const match = offsetTz.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid timezone offset format: ${offsetTz}`);
  }
  const [, signStr, hoursStr, minutesStr] = match as [string, string, string, string];
  const sign = signStr === '+' ? 1 : -1;
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  const offsetMs = sign * (hours * 60 + minutes) * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs);
  const iso = local.toISOString();
  return iso.replace('Z', offsetTz);
}
