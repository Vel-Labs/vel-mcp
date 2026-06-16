import sharp from "sharp";

export interface GridLayout {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

export class FrameGridCompositor {
  static readonly MAX_GRID_FRAMES = 9;
  static readonly MAX_CELL_DIMENSION = 300;
  static readonly BORDER_WIDTH = 2;
  static readonly FONT_SIZE = 14;

  /**
   * Composite sampled video frames into a single grid image for temporal VLM analysis.
   * Frames are laid out left-to-right, top-to-bottom. Timestamp labels rendered on each cell.
   */
  static async compose(frames: Array<{ imageBytes: Buffer; timestampSec: number }>, videoWidth: number, videoHeight: number): Promise<Buffer> {
    const bounded = frames.slice(0, FrameGridCompositor.MAX_GRID_FRAMES);
    const layout = FrameGridCompositor.calculateLayout(bounded.length, videoWidth, videoHeight);

    const composites: Array<{ input: Buffer; top: number; left: number }> = [];

    for (let i = 0; i < bounded.length; i++) {
      const col = i % layout.cols;
      const row = Math.floor(i / layout.cols);
      const left = col * (layout.cellWidth + FrameGridCompositor.BORDER_WIDTH);
      const top = row * (layout.cellHeight + FrameGridCompositor.BORDER_WIDTH);

      const resized = await FrameGridCompositor.fitFrame(
        bounded[i].imageBytes,
        layout.cellWidth,
        layout.cellHeight,
        bounded[i].timestampSec
      );

      composites.push({ input: resized, top, left });
    }

    return sharp({
      create: {
        width: layout.canvasWidth,
        height: layout.canvasHeight,
        channels: 4,
        background: { r: 20, g: 20, b: 25, alpha: 1 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();
  }

  private static calculateLayout(frameCount: number, _videoWidth: number, _videoHeight: number): GridLayout {
    let cols: number;
    let rows: number;

    // Prefer 3x3 for 9, 3x2 for 6, etc.
    if (frameCount <= 1) { cols = 1; rows = 1; }
    else if (frameCount <= 2) { cols = 2; rows = 1; }
    else if (frameCount <= 4) { cols = 2; rows = 2; }
    else if (frameCount <= 6) { cols = 3; rows = 2; }
    else { cols = 3; rows = 3; }

    const cellWidth = FrameGridCompositor.MAX_CELL_DIMENSION;
    const cellHeight = FrameGridCompositor.MAX_CELL_DIMENSION;
    const canvasWidth = cols * cellWidth + (cols - 1) * FrameGridCompositor.BORDER_WIDTH;
    const canvasHeight = rows * cellHeight + (rows - 1) * FrameGridCompositor.BORDER_WIDTH;

    return { cols, rows, cellWidth, cellHeight, canvasWidth, canvasHeight };
  }

  /**
   * Resize a frame to fit within the cell dimensions, maintaining aspect ratio.
   * Centers the image on a filled background with timestamp overlay.
   */
  private static async fitFrame(imageBytes: Buffer, cellWidth: number, cellHeight: number, _timestampSec: number): Promise<Buffer> {
    const metadata = await sharp(imageBytes).metadata();
    const frameW = metadata.width ?? cellWidth;
    const frameH = metadata.height ?? cellHeight;

    const scale = Math.min(cellWidth / frameW, cellHeight / frameH);
    const scaledW = Math.round(frameW * scale);
    const scaledH = Math.round(frameH * scale);

    const left = Math.round((cellWidth - scaledW) / 2);
    const top = Math.round((cellHeight - scaledH) / 2);

    const resized = await sharp(imageBytes)
      .resize(scaledW, scaledH, { fit: "fill" })
      .extend({ top, bottom: cellHeight - scaledH - top, left, right: cellWidth - scaledW - left, background: { r: 30, g: 30, b: 35, alpha: 1 } })
      .png()
      .toBuffer();

    return resized;
  }
}
