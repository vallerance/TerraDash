import {
  generatedLocations as locations,
  generatedMap as map,
} from '../contracts/generatedData';
import { quizOptions } from '../contracts/quiz';

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
  const viewBox = quiz.thumbnailViewBox;
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
