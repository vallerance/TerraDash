import { QuizProvider } from '../QuizContext';
import { QuizPlayer } from '../QuizPlayer';
import { generatedLocations as locations } from '../contracts/generatedData';
import { playableLocations, quizOptions, worldQuiz } from '../contracts/quiz';
import { mapLayerForQuiz, mapLocationForQuizId } from '../quizMapBoundary';
import { MapView } from '../map/MapView';
import { QuizThumbnail } from '../shell/QuizThumbnail';
import type { QuizOption } from '../contracts/quiz';

export function QuizPage({
  quizId,
  providerKey,
  autoStart,
  pendingQuiz,
  onAutoStartHandled,
  onSelectQuizOption,
  onCloseQuizDialog,
  onStartSelectedQuiz,
}: {
  quizId: string;
  providerKey: string;
  autoStart: boolean;
  pendingQuiz?: QuizOption;
  onAutoStartHandled: () => void;
  onSelectQuizOption: (quiz: QuizOption) => void;
  onCloseQuizDialog: () => void;
  onStartSelectedQuiz: (quizId: string) => void;
}) {
  const selectedQuiz =
    quizOptions.find((quiz) => quiz.id === quizId) ?? worldQuiz;
  return (
    <QuizProvider
      key={providerKey}
      quiz={selectedQuiz}
      catalog={playableLocations}
    >
      <QuizPlayer
        catalog={playableLocations}
        quizId={selectedQuiz.id}
        quizName={selectedQuiz.name}
        quizOptions={quizOptions}
        autoStart={autoStart}
        onAutoStartHandled={onAutoStartHandled}
        selectedQuizOption={pendingQuiz}
        onSelectQuizOption={onSelectQuizOption}
        onCloseQuizDialog={onCloseQuizDialog}
        onStartSelectedQuiz={onStartSelectedQuiz}
        renderMap={(active) => (
          <MapView
            active={
              mapLocationForQuizId(active.id)! as (typeof locations)[number]
            }
            layer={mapLayerForQuiz(
              selectedQuiz,
              mapLocationForQuizId(active.id)! as (typeof locations)[number],
            )}
          />
        )}
        renderQuizThumbnail={(quiz) => <QuizThumbnail quiz={quiz} />}
      />
    </QuizProvider>
  );
}
