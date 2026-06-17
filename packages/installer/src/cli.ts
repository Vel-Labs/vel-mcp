#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { createRegistry, register } from "./registry.js";
import { installCommand } from "./commands/install.js";
import { helpText } from "./args.js";
import { log } from "./render.js";

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const registry = createRegistry();
  register(registry, "install", installCommand);

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    log(helpText());
    return;
  }

  const [command, ...rest] = argv;
  if (command === "--help" || command === "-h") {
    log(helpText());
    return;
  }

  const handler = registry.get(command);
  if (!handler) {
    log(helpText());
    return;
  }
  await handler.run({ args: rest });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
