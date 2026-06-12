import type { PrivacySpan } from "../redaction/types.js";

export interface ABReviewPayload {
  reviewId: string;
  originalText: string;
  sanitizedText: string;
  spans: PrivacySpan[];
  warnings: string[];
  actions: Array<"approve" | "edit_span" | "reject" | "send_sanitized_only">;
}
