export function safeJson(x: any): string {
  return JSON.stringify(x).replace(/</g, "\\u003c");
}
