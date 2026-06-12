export interface PrivacySpan {
  start: number;
  end: number;
  label: "account_number" | "private_address" | "private_email" | "private_person" | "private_phone" | "private_url" | "private_date" | "secret" | "infra" | "custom";
  score: number;
  detector: string;
}

export interface RedactionResult {
  originalHash: string;
  sanitizedText: string;
  spans: PrivacySpan[];
  placeholders: Array<{ placeholder: string; label: string; start: number; end: number }>;
}
