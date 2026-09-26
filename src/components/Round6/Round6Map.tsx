import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { recordRoundCompletion } from '../../teamProgress';
import { round6Config } from '../../config/round6.config';
import { CITIES_25, CITY_CLUES, EXPECTED_NUMERIC_KEY, NPC_INTERACTIONS, type CityData } from './CityData';
import { NpcInteraction } from './NpcInteraction';

type GameState = {
  currentCityId: number;
  firstCityFound: boolean;
  citySearched: boolean;
  npcTapCount: number;
  npcRewardRevealed: boolean;
  collectedDigits: string;
  visitedCities: number[];
  citySequence: string[];
  showFinalPuzzle: boolean;
  playerKey: string;
  pdfUnlocked: boolean;
};

const initialGameState: GameState = {
  currentCityId: 1,
  firstCityFound: false,
  citySearched: false,
  npcTapCount: 0,
  npcRewardRevealed: false,
  collectedDigits: '',
  visitedCities: [],
  citySequence: [],
  showFinalPuzzle: false,
  playerKey: '',
  pdfUnlocked: false,
};

const progressStorageKey = () => {
  const teamId = sessionStorage.getItem('engquest_team_id');
  return teamId ? `engquest_round6_${teamId}` : null;
};

function loadSavedProgress(): GameState {
  const key = progressStorageKey();
  if (!key) return initialGameState;
  try {
    const saved = sessionStorage.getItem(key);
    if (!saved) return initialGameState;
    const parsed = JSON.parse(saved) as Partial<GameState>;
    if (
      typeof parsed.currentCityId !== 'number' || parsed.currentCityId < 1 || parsed.currentCityId > 25 ||
      typeof parsed.collectedDigits !== 'string' || !Array.isArray(parsed.visitedCities) ||
      !Array.isArray(parsed.citySequence)
    ) return initialGameState;
    const requiredTaps = NPC_INTERACTIONS[parsed.currentCityId - 1].requiredTaps;
    const savedTapCount = typeof parsed.npcTapCount === 'number' && Number.isFinite(parsed.npcTapCount)
      ? Math.min(requiredTaps, Math.max(0, Math.floor(parsed.npcTapCount)))
      : 0;
    const needsFinalCityPair = parsed.showFinalPuzzle === true &&
      parsed.visitedCities.includes(25) && parsed.collectedDigits.length === 48;
    return {
      ...initialGameState,
      ...parsed,
      firstCityFound: parsed.firstCityFound === true || parsed.citySearched === true || parsed.visitedCities.length > 0,
      collectedDigits: needsFinalCityPair ? parsed.collectedDigits + CITIES_25[24].digits : parsed.collectedDigits,
      npcTapCount: savedTapCount,
      npcRewardRevealed: parsed.npcRewardRevealed === true || savedTapCount === requiredTaps,
    } as GameState;
  } catch {
    return initialGameState;
  }
}

const npcMapIcon = L.icon({
  iconUrl: round6Config.npcImagePath,
  iconSize: [32, 37],
  iconAnchor: [16, 37],
  popupAnchor: [0, -37],
});

function makeFirstHuntSpots() {
  const decoys = CITIES_25.slice(1).map(city => ({
    latitude: city.coordinates.latitude,
    longitude: city.coordinates.longitude,
    isLondon: false,
  }));
  for (let index = decoys.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [decoys[index], decoys[swapIndex]] = [decoys[swapIndex], decoys[index]];
  }
  const london = {
    latitude: CITIES_25[0].coordinates.latitude + CITIES_25[0].npcOffset.latitude,
    longitude: CITIES_25[0].coordinates.longitude + CITIES_25[0].npcOffset.longitude,
    isLondon: true,
  };
  const spots = [london];
  const remaining = [...decoys];
  while (spots.length < 15 && remaining.length > 0) {
    const next = remaining.findIndex(candidate => spots.every(spot =>
      Math.hypot(candidate.latitude - spot.latitude, candidate.longitude - spot.longitude) >= 12
    ));
    if (next < 0) break;
    spots.push(remaining.splice(next, 1)[0]);
  }
  while (spots.length < 15 && remaining.length > 0) spots.push(remaining.shift()!);
  for (let index = spots.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [spots[index], spots[swapIndex]] = [spots[swapIndex], spots[index]];
  }
  return spots;
}

export function Round6Map() {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const npcMarkersRef = useRef<L.Marker[]>([]);
  const [firstHuntSpots] = useState(makeFirstHuntSpots);
  const [gameState, setGameState] = useState<GameState>(loadSavedProgress);
  const [map, setMap] = useState<L.Map | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeNpc, setActiveNpc] = useState(false);
  const [showIntro, setShowIntro] = useState(() => !sessionStorage.getItem(`${progressStorageKey()}_intro`));

  const handleNpcTap = () => {
    setGameState(previous => {
      const requiredTaps = NPC_INTERACTIONS[previous.currentCityId - 1].requiredTaps;
      const currentTapCount = typeof previous.npcTapCount === 'number' && Number.isFinite(previous.npcTapCount)
        ? Math.min(requiredTaps, Math.max(0, Math.floor(previous.npcTapCount)))
        : 0;
      if (previous.npcRewardRevealed || currentTapCount >= requiredTaps) {
        return currentTapCount === previous.npcTapCount ? previous : { ...previous, npcTapCount: currentTapCount };
      }
      const nextTapCount = currentTapCount + 1;
      return {
        ...previous,
        npcTapCount: nextTapCount,
        npcRewardRevealed: nextTapCount === requiredTaps,
      };
    });
  };

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || showIntro || gameState.showFinalPuzzle || gameState.pdfUnlocked) return;

    const mapInstance = L.map(container, { center: [20, 0], zoom: 2, minZoom: 2 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapInstance);

    setMap(mapInstance);
    return () => {
      mapInstance.remove();
    };
  }, [showIntro, gameState.showFinalPuzzle, gameState.pdfUnlocked]);

  const currentCity = CITIES_25.find(city => city.id === gameState.currentCityId);
  const npcTapCount = typeof gameState.npcTapCount === 'number' && Number.isFinite(gameState.npcTapCount)
    ? Math.min(NPC_INTERACTIONS[gameState.currentCityId - 1].requiredTaps, Math.max(0, Math.floor(gameState.npcTapCount)))
    : 0;
  const showCurrentNpc = Boolean(currentCity && gameState.citySearched);

  useEffect(() => {
    if (!map) return;
    npcMarkersRef.current.forEach(marker => marker.remove());
    npcMarkersRef.current = [];
    if (!currentCity) return;

    const firstCityHunt = currentCity.id === 1 && !gameState.firstCityFound && !gameState.visitedCities.includes(1);
    if (firstCityHunt) {
      firstHuntSpots.forEach(spot => {
        const marker = L.marker([spot.latitude, spot.longitude], { icon: npcMapIcon, riseOnHover: true }).addTo(map);
        marker.bindTooltip('The Wayfinder');
        marker.on('click', () => {
          if (!spot.isLondon) {
            setError('This is not the Wayfinder you are looking for. Keep searching the map.');
            return;
          }
          setGameState(previous => ({ ...previous, firstCityFound: true, citySearched: true }));
          setError(null);
        });
        npcMarkersRef.current.push(marker);
      });
      return;
    }
    if (!showCurrentNpc) return;

    const marker = L.marker([
      currentCity.coordinates.latitude + currentCity.npcOffset.latitude,
      currentCity.coordinates.longitude + currentCity.npcOffset.longitude,
    ], { icon: npcMapIcon, riseOnHover: true }).addTo(map);
    marker.bindTooltip('The Wayfinder · click to interact');
    marker.on('click', () => {
      if (!gameState.citySearched) {
        setError('Search the place from the clue before speaking with the Wayfinder.');
        return;
      }
      setActiveNpc(true);
      setError(null);
      handleNpcTap();
    });
    npcMarkersRef.current.push(marker);
    map.flyTo([
      currentCity.coordinates.latitude + currentCity.npcOffset.latitude,
      currentCity.coordinates.longitude + currentCity.npcOffset.longitude,
    ], 5, { duration: 1.1 });
  }, [map, currentCity, showCurrentNpc, gameState.citySearched, gameState.firstCityFound, gameState.visitedCities, firstHuntSpots]);

  useEffect(() => {
    const key = progressStorageKey();
    if (key) sessionStorage.setItem(key, JSON.stringify(gameState));
  }, [gameState]);

  const handleCityComplete = (city: CityData) => {
    setActiveNpc(false);
    setSearchTerm('');
    setGameState(previous => {
      if (city.id !== previous.currentCityId || previous.visitedCities.includes(city.id)) return previous;
      return {
        ...previous,
        citySearched: false,
        npcTapCount: 0,
        npcRewardRevealed: false,
        collectedDigits: previous.collectedDigits + city.digits,
        visitedCities: [...previous.visitedCities, city.id],
        citySequence: [...previous.citySequence, city.city],
        currentCityId: city.id < 25 ? city.id + 1 : city.id,
        showFinalPuzzle: city.id === 25,
      };
    });
    setError(null);
  };

  const handlePlaceSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentCity) return;
    const normalizePlace = (value: string) => value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const search = normalizePlace(searchTerm);
    const cityName = normalizePlace(currentCity.city);
    const cityAndCountry = normalizePlace(`${currentCity.city} ${currentCity.country}`);

    if (search !== cityName && search !== cityAndCountry) {
      setError('That place does not match the current clue. Keep searching from the clue.');
      return;
    }
    setGameState(previous => ({ ...previous, citySearched: true }));
    setActiveNpc(false);
    setError(null);
  };

  const handleWordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const answer = gameState.playerKey.replace(/\D/g, '');
    if (gameState.visitedCities.length !== 25 || answer.length !== 25) return;

    if (answer !== EXPECTED_NUMERIC_KEY) {
      setError('That key is not correct. Sort the cities A to Z, then use the first digit from each pair.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await recordRoundCompletion(6);
      setGameState(previous => ({ ...previous, pdfUnlocked: true }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save Round 6 progress. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (gameState.pdfUnlocked) {
    return (
      <div className="pdf-unlocked">
        <div className="section-kicker">FINAL CLUE UNLOCKED</div>
        <h2>25-City Hunt Complete</h2>
        <p>Your answer is correct. The final clue is ready for your team.</p>
        <a href={round6Config.finalPdfUrl} target="_blank" rel="noopener noreferrer" className="button button-primary">
          View Final Clue PDF
        </a>
        <button type="button" className="button button-dark" onClick={() => navigate('/round/7')}>
          Proceed to Round 7 <span aria-hidden="true">→</span>
        </button>
      </div>
    );
  }

  if (showIntro && !gameState.showFinalPuzzle) {
    const introKey = `${progressStorageKey()}_intro`;
    return (
      <div className="round6-intro">
        <div className="section-kicker">MEET THE WAYFINDER</div>
        <h1>Every treasure hunt begins with a trail.</h1>
        <p>“Yours begins here.”</p>
        <p>“Twenty-five cities. Twenty-five encounters. And something hidden within every one of them.”</p>
        <p>“Find the person waiting for you. They won't simply hand over what you seek.”</p>
        <p>“Be persistent. Listen carefully. And pay attention to where your journey takes you.”</p>
        <p>“Each encounter will give you something to carry forward… and a path to the next city.”</p>
        <p>“Don't assume you understand the purpose of anything you collect.”</p>
        <p>“Some things only reveal their meaning at the very end.”</p>
        <p className="round6-intro-emphasis">“25 cities. 50 digits. One final key.”</p>
        <p>“Now go. Your first destination awaits.”</p>
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            sessionStorage.setItem(introKey, 'seen');
            setShowIntro(false);
          }}
        >
          Begin the hunt
        </button>
      </div>
    );
  }

  if (gameState.showFinalPuzzle) {
    const enteredKey = gameState.playerKey.replace(/\D/g, '');
    return (
      <div className="final-puzzle-container">
        <div className="section-kicker">THE FINAL TWIST</div>
        <h2>Enter the 25-digit key</h2>
        <p className="puzzle-hint">
          “You've collected two numbers from every city. But only one number from each pair was meant for the key. Take the first digit, sort the cities A to Z, and take the first digit belonging to each city.”
        </p>
        <div className="city-sequence">
          <strong>50-digit trail</strong>
          <div className="digit-sequence" aria-label="Collected 50-digit clue sequence">
            {gameState.collectedDigits.match(/.{1,2}/g)?.join(' ')}
          </div>
        </div>
        <form className="word-entry-form" onSubmit={handleWordSubmit}>
          <div className="form-field">
            <label htmlFor="round6-key">Enter the 25-digit key</label>
            <input
              id="round6-key"
              className="word-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{25}"
              value={gameState.playerKey}
              onChange={event => setGameState(previous => ({ ...previous, playerKey: event.target.value.replace(/\D/g, '').slice(0, 25) }))}
              maxLength={25}
              autoComplete="off"
              aria-describedby="round6-key-hint"
              placeholder="Enter the 25 digits"
            />
            <span id="round6-key-hint" className="form-hint">Use the first digit of each pair, with cities sorted A to Z.</span>
          </div>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <div className="form-actions">
            <button type="submit" className="button button-primary" disabled={isLoading || enteredKey.length !== 25}>
              {isLoading ? 'Saving…' : 'Unlock Final Clue'}
            </button>
            <span className="form-hint">{enteredKey.length}/25 digits</span>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="round6-map-container">
      <header className="round6-header">
        <div className="section-kicker">ROUND 6 · THE WAYFINDER</div>
        <h1>The Wayfinder's trail</h1>
        <div className="progress-indicator">Cities visited: {gameState.visitedCities.length}/25</div>
        {currentCity?.id === 1 && !gameState.firstCityFound ? (
          <p className="round6-city-clue">Find the Wayfinder hidden among the 15 locations on the map.</p>
        ) : (
          <p className="round6-city-clue">{currentCity ? CITY_CLUES[currentCity.id - 1] : ''}</p>
        )}
        {currentCity?.id === 1 && gameState.firstCityFound && (
          <p className="round6-first-clue-note">You found London. Note this first clue down before continuing.</p>
        )}
        <div className="digit-sequence" aria-live="polite">
          Clues collected: {gameState.collectedDigits.match(/.{1,2}/g)?.join(' ') || 'None yet'}
        </div>
      </header>

      <div className="map-container">
        <div ref={mapContainerRef} className="map" aria-label="World map with the 25 hunt cities" />
        {(currentCity?.id !== 1 || gameState.firstCityFound) && (
          <form className="map-search" onSubmit={handlePlaceSearch}>
            <label className="round6-visually-hidden" htmlFor="round6-place-search">Search for the city described in the clue</label>
            <input
              id="round6-place-search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search the place from the clue"
              autoComplete="off"
            />
            <button type="submit" className="button button-primary">Search place</button>
          </form>
        )}
        {error && <div className="round6-map-error" role="alert">{error}</div>}
        {currentCity?.id === 1 && !gameState.firstCityFound && !activeNpc && (
          <div className="map-instructions">Find and click the Wayfinder among the 15 locations.</div>
        )}
        {showCurrentNpc && !activeNpc && (
          <div className="map-instructions">
            {gameState.citySearched ? 'Wayfinder found. Click the marker on the map to speak.' : 'Search the city from the clue, then click the Wayfinder marker.'}
          </div>
        )}
        {showCurrentNpc && currentCity && (
          <div className={`npc-interaction-wrapper${activeNpc ? ' is-active' : ''}`} aria-hidden={!activeNpc}>
            <button type="button" className="npc-close" onClick={() => setActiveNpc(false)} aria-label="Close Wayfinder interaction">×</button>
            <NpcInteraction
              key={currentCity.id}
              city={currentCity}
              tapCount={npcTapCount}
              revealed={gameState.npcRewardRevealed}
              onTap={handleNpcTap}
              onComplete={handleCityComplete}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default Round6Map;
