import { round6Config } from '../../config/round6.config';
import { CITY_CLUES, NPC_INTERACTIONS, type CityData } from './CityData';

type NpcInteractionProps = {
  city: CityData;
  tapCount: number;
  revealed: boolean;
  onTap: () => void;
  onComplete: (city: CityData) => void;
};

export function NpcInteraction({ city, tapCount, revealed, onTap, onComplete }: NpcInteractionProps) {
  const interaction = NPC_INTERACTIONS[city.id - 1];
  const visibleTapCount = Number.isFinite(tapCount)
    ? Math.min(interaction.requiredTaps, Math.max(0, Math.floor(tapCount)))
    : 0;
  return (
    <div className="npc-interaction">
      <div className="npc-sprite-container">
        <button
          type="button"
          className="npc-tap-target"
          onClick={onTap}
          disabled={revealed}
          aria-label={`Tap the Wayfinder in ${city.city}`}
        >
          <img src={round6Config.npcImagePath} alt="The Wayfinder" className="npc-sprite" />
        </button>

        {!revealed && visibleTapCount > 0 && (
          <div className="npc-dialogue" aria-live="polite">
            {interaction.responses[visibleTapCount - 1]}
          </div>
        )}

        {revealed && (
          <div className="npc-reward" role="status">
            <strong>{city.city}, {city.country}</strong>
            <p className="npc-reveal-response">{interaction.responses[interaction.requiredTaps - 1]}</p>
            <div className="reward-digit">Your two-digit clue: <strong>{city.digits}</strong></div>
            {city.id < 25 ? (
              <>
                <div className="reward-next-city">
                  <strong>Clue for your next destination</strong>
                  <p className="npc-next-clue">{CITY_CLUES[city.id]}</p>
                </div>
              </>
            ) : (
              <div className="npc-final-rule">
                <p>“You've collected two numbers from every city.”</p>
                <p>“But only one number from each pair was ever meant for the key.”</p>
                <p>“Take the first digit.”</p>
                <p>“Now forget the order in which you found them.”</p>
                <p>“Arrange the cities from A to Z.”</p>
                <p>“Take the first digit belonging to each city.”</p>
                <p><strong>“That is your 25-digit key.”</strong></p>
              </div>
            )}
            <p className="npc-attention-note">Pause and read the message before continuing. Extra taps will not count.</p>
            <button type="button" className="button button-primary" onClick={() => onComplete(city)}>
              {city.id < 25 ? 'Return to the map' : 'Solve the final puzzle'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
