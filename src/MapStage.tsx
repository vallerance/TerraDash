import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
  type Ref,
} from 'react';
import { mapWidthForStage } from './mapLayout';

type MapStageProps = {
  content: ReactNode;
  overlay?: ReactNode;
};

export const MapStage = forwardRef(function MapStage(
  { content, overlay }: MapStageProps,
  ref: Ref<HTMLDivElement>,
) {
  const localRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => localRef.current as HTMLDivElement, []);
  useEffect(() => {
    const stage = localRef.current;
    if (!stage) return;
    const update = () => {
      stage.style.setProperty(
        '--map-width',
        `${mapWidthForStage(stage.clientWidth, stage.clientHeight)}px`,
      );
    };
    update();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(update);
    observer?.observe(stage);
    return () => observer?.disconnect();
  }, []);

  return (
    <div
      className="map-stage"
      data-map-stage-reserved-block="4.75rem"
      ref={localRef}
    >
      <div className="map-slot full-bleed-map">
        <section className="map-frame">{content}</section>
      </div>
      {overlay}
    </div>
  );
});
