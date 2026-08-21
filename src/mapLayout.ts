export const MAP_ASPECT_RATIO = 41 / 18;

/** Return the largest 41:18 map width that fits the available stage. */
export function mapWidthForStage(stageWidth: number, stageHeight: number) {
  return Math.min(stageWidth, stageHeight * MAP_ASPECT_RATIO);
}
