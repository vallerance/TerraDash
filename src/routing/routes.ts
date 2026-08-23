export type RoutePage = 'quiz' | 'high-scores' | 'diagnostics';

export type AppRoute = {
  pathname: string;
  hash: string;
  page: RoutePage;
  quizId: string;
  select: boolean;
  start: boolean;
  locationId?: string;
};

export type RouteOptions = {
  quizIds: readonly string[];
  locationIds: readonly string[];
  defaultQuizId: string;
};

function toUrl(input: string | URL): URL {
  return typeof input === 'string'
    ? new URL(input, 'https://terrndash.invalid')
    : input;
}

export function parseRoute(
  input: string | URL,
  options: RouteOptions,
): AppRoute {
  const url = toUrl(input);
  const requestedQuiz = url.searchParams.get('quiz');
  const quizId = options.quizIds.includes(requestedQuiz ?? '')
    ? requestedQuiz!
    : options.defaultQuizId;
  const requestedLocation = url.searchParams.get('location');
  const locationId = options.locationIds.includes(requestedLocation ?? '')
    ? requestedLocation!
    : options.locationIds[0];
  const diagnostics =
    url.pathname.endsWith('/diagnostics.html') ||
    url.searchParams.get('page') === 'diagnostics';
  const page: RoutePage = diagnostics
    ? 'diagnostics'
    : url.searchParams.get('page') === 'high-scores'
      ? 'high-scores'
      : 'quiz';
  return {
    pathname: url.pathname,
    hash: url.hash,
    page,
    quizId,
    select: url.searchParams.get('select') === '1',
    start: url.searchParams.get('start') === '1',
    locationId,
  };
}

export function serializeRoute(route: AppRoute): string {
  const params = new URLSearchParams();
  if (route.page === 'high-scores') params.set('page', 'high-scores');
  if (route.page === 'diagnostics') {
    params.set('page', 'diagnostics');
    if (route.locationId) params.set('location', route.locationId);
  }
  if (route.page === 'quiz') {
    if (route.quizId) params.set('quiz', route.quizId);
    if (route.select) params.set('select', '1');
    if (route.start) params.set('start', '1');
  }
  const query = params.toString();
  return `${route.pathname}${query ? `?${query}` : ''}${route.hash}`;
}
