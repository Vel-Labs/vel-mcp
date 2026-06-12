export interface ProviderHealth {
  ok: boolean;
  warnings?: string[];
  error?: string;
  details?: unknown;
}

export interface NamedProvider {
  id: string;
  displayName?: string;
  healthCheck?: () => Promise<ProviderHealth>;
}

export class ProviderRegistry<TProvider extends NamedProvider> {
  private providers = new Map<string, TProvider>();

  register(provider: TProvider): void {
    if (this.providers.has(provider.id)) throw new Error(`Provider already registered: ${provider.id}`);
    this.providers.set(provider.id, provider);
  }

  get(id: string): TProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unknown provider: ${id}`);
    return provider;
  }

  list(): TProvider[] {
    return [...this.providers.values()];
  }
}
