import { createHmac } from "node:crypto";

export class SyntheticMapper {
  constructor(private readonly sessionKey: string) {}

  placeholder(label: string, realValue: string): string {
    const digest = createHmac("sha256", this.sessionKey).update(`${label}:${realValue}`).digest("base64url").slice(0, 8).toUpperCase();
    return `<PRIVATE_${label.toUpperCase()}_${digest}>`;
  }

  syntheticValue(label: string, realValue: string): string {
    const id = this.placeholder(label, realValue).replace(/[<>]/g, "");
    if (label.includes("email")) return `${id.toLowerCase()}@example.com`;
    if (label.includes("phone")) return "+1-555-0100";
    if (label.includes("url")) return `https://${id.toLowerCase()}.example.com`;
    return this.placeholder(label, realValue);
  }
}
