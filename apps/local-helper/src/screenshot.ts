export interface ScreenshotOptions {
  display?: number;
  windowTitle?: string;
  outputPath: string;
}
export async function screenshot(_options: ScreenshotOptions): Promise<string> {
  throw new Error("screenshot capture not implemented. Use local-helper roadmap.");
}
