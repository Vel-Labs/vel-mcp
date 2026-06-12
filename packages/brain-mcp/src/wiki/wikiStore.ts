export interface WikiNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export class WikiStore {
  constructor(public readonly rootDir: string) {}
  async search(_query: string): Promise<WikiNote[]> {
    throw new Error("WikiStore.search not implemented. Follow brain roadmap.");
  }
}
