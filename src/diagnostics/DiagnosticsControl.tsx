import type { PlayableLocation } from '../contracts/playableLocation';

export function DiagnosticsControl({
  locationId,
  locations,
  onLocationChange,
}: {
  locationId: string;
  locations: readonly PlayableLocation[];
  onLocationChange: (locationId: string) => void;
}) {
  const location = locations.find(({ id }) => id === locationId);
  return (
    <label className="diagnostics-control" htmlFor="diagnostic-location">
      <span>Location</span>
      <output className="diagnostics-selected-name">
        {location?.name ?? locationId}
      </output>
      <select
        id="diagnostic-location"
        value={locationId}
        onChange={(event) => onLocationChange(event.target.value)}
      >
        {locations.map(({ id, name }) => (
          <option key={id} value={id}>
            {name} ({id})
          </option>
        ))}
      </select>
    </label>
  );
}
