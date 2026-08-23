import {
  generatedLocations as locations,
  generatedMap as map,
} from '../contracts/generatedData';
import { quizOptions } from '../quizContracts';

const thumbnailViewBoxes: Record<string, string> = {
  world: '0 0 1440 720',
  africa: '600 140 380 430',
  asia: '780 80 500 380',
  europe: '600 70 330 260',
  'north-america': '250 80 500 360',
  'south-america': '420 300 300 360',
  oceania: '1030 330 360 270',
  caribbean: '430 220 300 190',
};

export function QuizThumbnail({
  quiz,
}: {
  quiz: (typeof quizOptions)[number];
}) {
  const locationIds = new Set(quiz.locationIds);
  const paths = locations
    .filter((location) => locationIds.has(location.id))
    .flatMap((location) =>
      location.geometryRefs.flatMap(
        (ref) => map.features[ref as keyof typeof map.features]?.paths ?? [],
      ),
    );
  const viewBox =
    quiz.map?.viewBox ||
    thumbnailViewBoxes[quiz.id] ||
    thumbnailViewBoxes.world;
  return (
    <span
      className={`quiz-option-thumbnail quiz-option-thumbnail-${quiz.id}`}
      aria-hidden="true"
    >
      {paths.length > 0 ? (
        <svg viewBox={viewBox} focusable="false">
          {paths.map((path, index) => (
            <path key={index} d={path} />
          ))}
        </svg>
      ) : (
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
      )}
    </span>
  );
}
