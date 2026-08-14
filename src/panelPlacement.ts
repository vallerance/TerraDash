export type Rect = { left: number; top: number; width: number; height: number };
export type PanelPlacement = { left: number; top: number };

export function panelPlacementTargets(stage: ParentNode): SVGGraphicsElement[] {
  const calloutCircles = [
    stage.querySelector<SVGGraphicsElement>('.callout-source'),
    stage.querySelector<SVGGraphicsElement>('.callout-cutout'),
  ];
  if (calloutCircles.every((circle) => circle !== null)) {
    return calloutCircles as SVGGraphicsElement[];
  }
  const activeFill = stage.querySelector<SVGGraphicsElement>('.active-fill');
  return activeFill ? [activeFill] : [];
}

export function unionRects(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.left + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.top + rect.height));
  return { left, top, width: right - left, height: bottom - top };
}

export function derivePanelPlacement(
  target: Rect,
  panel: Pick<Rect, 'width' | 'height'>,
  map: Pick<Rect, 'width' | 'height'>,
  gap = 48,
): PanelPlacement {
  const candidates = [
    {
      left: target.left - panel.width - gap,
      top: target.top - panel.height - gap,
    },
    {
      left: target.left + target.width + gap,
      top: target.top - panel.height - gap,
    },
    {
      left: target.left - panel.width - gap,
      top: target.top + target.height + gap,
    },
    {
      left: target.left + target.width + gap,
      top: target.top + target.height + gap,
    },
    {
      left: Math.max(
        0,
        Math.min(
          map.width - panel.width,
          target.left + (target.width - panel.width) / 2,
        ),
      ),
      top: target.top + target.height + gap,
    },
    {
      left: target.left + (target.width - panel.width) / 2,
      top: target.top - panel.height - gap,
    },
  ];
  const fits = (candidate: PanelPlacement) =>
    candidate.left >= 0 &&
    candidate.top >= 0 &&
    candidate.left + panel.width <= map.width &&
    candidate.top + panel.height <= map.height;
  const chosen = candidates.find(fits);
  if (chosen) return chosen;
  return {
    left: Math.max(
      0,
      Math.min(Math.max(0, map.width - panel.width), candidates[0].left),
    ),
    top: Math.max(
      0,
      Math.min(Math.max(0, map.height - panel.height), candidates[0].top),
    ),
  };
}
