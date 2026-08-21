export const MAP_ASPECT_RATIO = 41 / 18;
export const US_STATES_MAP_ASPECT_RATIO = 500 / 295;

/** Return the largest map width that fits the available stage. */
export function mapWidthForStage(
  stageWidth: number,
  stageHeight: number,
  aspectRatio = MAP_ASPECT_RATIO,
) {
  return Math.min(stageWidth, stageHeight * aspectRatio);
}
