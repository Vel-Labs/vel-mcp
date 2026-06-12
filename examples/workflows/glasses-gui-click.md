# Workflow: GUI target location

1. User captures screenshot with local helper or manually saves image.
2. User asks agent: “Find the search button in this screenshot.”
3. Agent calls `glasses.locate`:

```json
{
  "image": { "kind": "file_path", "value": "/tmp/screen.png" },
  "query": "search button",
  "targetType": "gui",
  "outputType": "point"
}
```

4. Tool returns `centerNorm1000` and optionally `centerPx`.
5. Agent explains the target or passes coordinates to a separate user-approved automation tool.

Do not put click automation inside Glasses.
