#!/usr/bin/env node
import { createGlassesServer } from "./server.js";
import { connectStdio } from "@vel/mcp-base";
import { loadVelConfig } from "@vel/core";

export { discoverModels } from "./services/modelDiscovery.js";

async function main(): Promise<void> {
  let config: Record<string, unknown> | undefined;
  try {
    const velConfig = await loadVelConfig();
    config = velConfig.modules?.glasses as Record<string, unknown> | undefined;
  } catch {
    // Non-fatal: server starts with defaults if config is missing or invalid
  }

  const { server } = createGlassesServer({ config });
  await connectStdio(server);
}

main().catch((error) => {
  console.error(`[vel-glasses-mcp] fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exit(1);
});
