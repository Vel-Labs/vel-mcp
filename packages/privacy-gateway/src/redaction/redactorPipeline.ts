import type { PrivacySpan } from "./types.js";

export interface RedactorProvider {
  id: string;
  detect(text: string): Promise<PrivacySpan[]>;
}

export class RedactorPipeline {
  constructor(private readonly providers: RedactorProvider[]) {}
  async detect(text: string): Promise<PrivacySpan[]> {
    const spans = (await Promise.all(this.providers.map((p) => p.detect(text)))).flat();
    return mergeSpans(spans);
  }
}

export function mergeSpans(spans: PrivacySpan[]): PrivacySpan[] {
  return spans.slice().sort((a, b) => a.start - b.start || b.end - a.end).reduce<PrivacySpan[]>((acc, span) => {
    const last = acc[acc.length - 1];
    if (!last || span.start >= last.end) {
      acc.push(span);
      return acc;
    }
    if (span.score > last.score || span.end > last.end) acc[acc.length - 1] = { ...last, end: Math.max(last.end, span.end), score: Math.max(last.score, span.score) };
    return acc;
  }, []);
}
