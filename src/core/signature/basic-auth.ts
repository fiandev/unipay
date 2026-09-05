export function basicAuthHeader(secretApiKey: string): string {
  const encoded = btoa(`${secretApiKey}:`);
  return `Basic ${encoded}`;
}
