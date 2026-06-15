import { ArtifactStore } from "@vel/core";

export interface CaptureUrlOptions {
  url: string;
  viewport: { width: number; height: number };
  fullPage: boolean;
  waitMs: number;
  timeoutMs: number;
  selector?: string;
  maxHeightPx: number;
}

export interface CaptureUrlResult {
  artifactId: string;
  image: { kind: "artifact_id"; value: string; mimeType: "image/png" };
  url: string;
  viewport: { width: number; height: number };
  captured: {
    width: number;
    height: number;
    fullPage: boolean;
    selector?: string;
  };
  warnings: string[];
}

export interface UrlCapturer {
  capture(input: CaptureUrlOptions): Promise<CaptureUrlResult>;
}

type BrowserModule = {
  chromium: {
    launch(options: { headless: boolean }): Promise<{
      newPage(options: { viewport: { width: number; height: number } }): Promise<any>;
      close(): Promise<void>;
    }>;
  };
};

export class PlaywrightUrlCapturer implements UrlCapturer {
  constructor(
    private readonly artifactStore: ArtifactStore,
    private readonly loadBrowserModule: () => Promise<BrowserModule> = loadPlaywright
  ) {}

  async capture(input: CaptureUrlOptions): Promise<CaptureUrlResult> {
    const parsed = new URL(input.url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw Object.assign(new Error("capture_url only supports http and https URLs."), { code: "CAPTURE_URL_PROTOCOL" });
    }

    const warnings: string[] = [];
    const playwright = await this.loadBrowserModule();
    const browser = await launchChromium(playwright);
    try {
      const page = await browser.newPage({ viewport: input.viewport });
      await page.goto(input.url, { waitUntil: "domcontentloaded", timeout: input.timeoutMs });
      if (input.waitMs > 0) await page.waitForTimeout(input.waitMs);

      let buffer: Buffer;
      let capturedWidth = input.viewport.width;
      let capturedHeight = input.viewport.height;

      if (input.selector) {
        const locator = page.locator(input.selector).first();
        await locator.waitFor({ state: "visible", timeout: input.timeoutMs });
        buffer = await locator.screenshot({ type: "png" });
        const box = await locator.boundingBox();
        if (box) {
          capturedWidth = Math.round(box.width);
          capturedHeight = Math.round(box.height);
        }
      } else if (input.fullPage) {
        const scrollSize = await page.evaluate(() => ({
          width: Math.ceil(Math.max(
            (globalThis as any).document.documentElement.scrollWidth,
            (globalThis as any).document.body?.scrollWidth ?? 0,
            (globalThis as any).window.innerWidth
          )),
          height: Math.ceil(Math.max(
            (globalThis as any).document.documentElement.scrollHeight,
            (globalThis as any).document.body?.scrollHeight ?? 0,
            (globalThis as any).window.innerHeight
          )),
        }));
        capturedWidth = Math.min(Math.max(scrollSize.width, input.viewport.width), input.viewport.width);
        capturedHeight = Math.min(scrollSize.height, input.maxHeightPx);
        if (scrollSize.height > input.maxHeightPx) {
          warnings.push(`Full-page capture truncated at maxHeightPx=${input.maxHeightPx}; page height was ${scrollSize.height}.`);
        }
        buffer = await page.screenshot({
          type: "png",
          clip: { x: 0, y: 0, width: capturedWidth, height: capturedHeight },
        });
      } else {
        buffer = await page.screenshot({ type: "png", fullPage: false });
      }

      const meta = await this.artifactStore.putBytes(buffer, {
        origin: "generated",
        mimeType: "image/png",
        originalName: "capture-url.png",
        extra: {
          sourceUrl: input.url,
          viewport: input.viewport,
          fullPage: input.fullPage,
          selector: input.selector,
        },
      });

      return {
        artifactId: meta.id,
        image: { kind: "artifact_id", value: meta.id, mimeType: "image/png" },
        url: input.url,
        viewport: input.viewport,
        captured: {
          width: capturedWidth,
          height: capturedHeight,
          fullPage: input.fullPage,
          selector: input.selector,
        },
        warnings,
      };
    } finally {
      await browser.close();
    }
  }
}

async function loadPlaywright(): Promise<BrowserModule> {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<BrowserModule>;
    return await dynamicImport("playwright");
  } catch (error) {
    throw Object.assign(
      new Error("Playwright is required for glasses.capture_url. Install it in the glasses MCP runtime to enable URL capture."),
      { code: "PLAYWRIGHT_UNAVAILABLE", cause: error }
    );
  }
}

async function launchChromium(playwright: BrowserModule) {
  try {
    return await playwright.chromium.launch({ headless: true });
  } catch (error) {
    throw Object.assign(
      new Error("Playwright Chromium is not installed. Run `pnpm --filter @vel/glasses-mcp exec playwright install chromium` to enable glasses.capture_url."),
      { code: "PLAYWRIGHT_BROWSER_UNAVAILABLE", cause: error }
    );
  }
}
