import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
  type Ref,
} from 'react';
import { mapWidthForStage } from './mapLayout';

type MapBoxShellProps = {
  prompt: ReactNode;
  status: ReactNode;
  content?: ReactNode;
  headerOverlay?: ReactNode;
  stageOverlay?: ReactNode;
  statusHidden?: boolean;
  mapAspectRatio?: number;
};

/** Shared layout-bearing header, map stage, and map-frame contract. */
export const MapBoxShell = forwardRef(function MapBoxShell(
  {
    prompt,
    status,
    content,
    headerOverlay,
    stageOverlay,
    statusHidden = false,
    mapAspectRatio,
  }: MapBoxShellProps,
  ref: Ref<HTMLDivElement>,
) {
  const localRef = useRef<HTMLDivElement>(null);
  const hasContent = content !== undefined;
  useImperativeHandle(ref, () => localRef.current as HTMLDivElement, []);

  useEffect(() => {
    const stage = localRef.current;
    if (!stage || !hasContent) return;
    const update = () => {
      stage.style.setProperty(
        '--map-width',
        `${mapWidthForStage(stage.clientWidth, stage.clientHeight, mapAspectRatio)}px`,
      );
    };
    update();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(update);
    observer?.observe(stage);
    return () => observer?.disconnect();
  }, [hasContent]);

  return (
    <>
      <div className="quiz-header">
        <div className="quiz-prompt-group">{prompt}</div>
        <div
          className="quiz-status quiz-status-bar"
          aria-live="polite"
          aria-hidden={statusHidden || undefined}
          style={statusHidden ? { visibility: 'hidden' } : undefined}
        >
          {status}
        </div>
        {headerOverlay && (
          <div className="map-header-overlay">{headerOverlay}</div>
        )}
      </div>
      {hasContent && (
        <div className="map-stage" ref={localRef}>
          <div className="map-slot full-bleed-map">
            <section className="map-frame">{content}</section>
          </div>
          {stageOverlay}
        </div>
      )}
    </>
  );
});
