# Workflow: OCR a screenshot or document image

Agent calls `glasses.ocr`:

```json
{
  "image": { "kind": "file_path", "value": "/tmp/document.png" },
  "mode": "localized",
  "mergeLines": true
}
```

Expected output includes `text` and `spans` with normalized boxes. The agent can then summarize or extract fields from the text.
