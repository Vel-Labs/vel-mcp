export interface CommandHandler {
  run(opts: { args: string[] }): Promise<void>;
}

export type Registry = Map<string, CommandHandler>;

export function createRegistry(): Registry {
  return new Map();
}

export function register(registry: Registry, name: string, handler: CommandHandler): void {
  registry.set(name, handler);
}
