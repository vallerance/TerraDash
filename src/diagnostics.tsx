import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import catalog from '../data/generated/catalog.json';
import { AppFooter, MapView } from './main';
import { MapStage } from './MapStage';
import './styles.css';

const initialId = new URLSearchParams(window.location.search).get('location');
const initialLocation =
  catalog.find(({ id }) => id === initialId) ?? catalog[0];

function Diagnostics() {
  const [locationId, setLocationId] = useState(initialLocation.id);
  const location = catalog.find(({ id }) => id === locationId)!;
  return (
    <main className="diagnostics-page">
      <section className="player-card diagnostics-card">
        <p className="eyebrow">TerraDash · Map diagnostics</p>
        <h1>Inspect a location</h1>
        <label htmlFor="diagnostic-location">Location</label>
        <select
          id="diagnostic-location"
          value={locationId}
          onChange={(event) => {
            const nextId = event.target.value;
            setLocationId(nextId);
            history.replaceState(
              null,
              '',
              `?location=${encodeURIComponent(nextId)}`,
            );
          }}
        >
          {catalog.map(({ id, name }) => (
            <option key={id} value={id}>
              {name} ({id})
            </option>
          ))}
        </select>
      </section>
      <MapStage content={<MapView active={location} />} />
      <AppFooter />
    </main>
  );
}

const root = document.getElementById('diagnostics-root');
if (root) createRoot(root).render(<Diagnostics />);
