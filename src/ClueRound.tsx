import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, KeyRound, LockKeyhole } from 'lucide-react';
import { clueMap } from './config/clue.config';
import { recordRoundCompletion } from './teamProgress';

const GOAL = ['○', '△', '◇', '□', '1', '2', '3', '4', '5', '7', '8', '9', 'A', 'B', 'C', ''];

function makeScrambledBoard() {
  const board = [...GOAL];
  let empty = board.length - 1;
  let previous = -1;
  for (let step = 0; step < 100; step += 1) {
    const adjacent = [empty - 4, empty + 4, ...(empty % 4 > 0 ? [empty - 1] : []), ...(empty % 4 < 3 ? [empty + 1] : [])]
      .filter(index => index >= 0 && index < 16 && index !== previous);
    const next = adjacent[Math.floor(Math.random() * adjacent.length)];
    [board[empty], board[next]] = [board[next], board[empty]];
    previous = empty;
    empty = next;
  }
  return board;
}

function Round4Puzzle({ onSolved }: { onSolved: () => void }) {
  const [board, setBoard] = useState(makeScrambledBoard);
  const solved = board.every((tile, index) => tile === GOAL[index]);

  const move = (index: number) => {
    if (solved) return;
    const empty = board.indexOf('');
    const adjacent = Math.abs(index - empty) === 4 || (Math.floor(index / 4) === Math.floor(empty / 4) && Math.abs(index - empty) === 1);
    if (!adjacent) return;
    const next = [...board];
    [next[index], next[empty]] = [next[empty], next[index]];
    setBoard(next);
    if (next.every((tile, tileIndex) => tile === GOAL[tileIndex])) onSolved();
  };

  return (
    <section className="round4-puzzle" aria-labelledby="round4-puzzle-title">
      <h3 id="round4-puzzle-title">Match the reference</h3>
      <p>Arrange the symbols and labels to match the goal. Move a tile into the empty space beside it.</p>
      <div className="round4-board" role="group" aria-label="Sliding tile puzzle">
        {board.map((tile, index) => (
          <button
            key={index}
            type="button"
            className={`round4-tile${tile ? '' : ' is-empty'}`}
            onClick={() => move(index)}
            disabled={solved || !tile}
            aria-label={tile ? `Move tile ${tile}` : 'Empty space'}
          >{tile}</button>
        ))}
      </div>
      <div className="round4-reference" aria-label="Puzzle reference image layout">
        <span>○</span><span>△</span><span>◇</span><span>□</span>
        <span>1</span><span>2</span><span>3</span><span>4</span>
        <span>5</span><span>7</span><span>8</span><span>9</span>
        <span>A</span><span>B</span><span>C</span><span></span>
      </div>
      {solved && <p className="round4-success" role="status">Puzzle solved.</p>}
    </section>
  );
}

function ClueRound() {
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [morseAnswer, setMorseAnswer] = useState('');
  const [puzzleUnlocked, setPuzzleUnlocked] = useState(false);
  const [puzzleSolved, setPuzzleSolved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const upper = pw.toUpperCase().trim();
    if (clueMap[upper]) {
      try {
        await recordRoundCompletion(4, upper);
        setAuthorized(true);
        setError(null);
      } catch (cause) {
        setError((cause as Error).message || 'Could not save your Round 4 completion. Please try again.');
      }
    } else {
      setError('Invalid password — try again');
      setAuthorized(false);
    }
  };

  const checkMorseAnswer = (event: React.FormEvent) => {
    event.preventDefault();
    if (morseAnswer.trim().toUpperCase() === 'SLIDE') {
      setPuzzleUnlocked(true);
      setError(null);
    } else {
      setError('That decoded word is not correct. Listen to the Morse code again.');
    }
  };

  return (
    <div className="unlock-box">
      <KeyRound size={29} />
      <h3>Round 4 Clue Locked</h3>
      <p>Enter the three-character password your organiser shared after approving your Round 3 result.</p>
      {!authorized && <form className="credential-form" onSubmit={handleSubmit}>
        <div className="credential-field">
          <label htmlFor="round4-password"><span>Clue password</span><span className="field-tag">3 chars</span></label>
          <input id="round4-password" type="text" maxLength={3} minLength={3} pattern="[A-Za-z0-9]{3}" required placeholder="3-character password" value={pw} onChange={e => { setPw(e.target.value.toUpperCase()); if (error) setError(null); }} />
          <span className="field-hint">Your assigned password unlocks the Morse code audio.</span>
        </div>
        {error && <div className="auth-error"><AlertCircle size={18} /><div>{error}</div></div>}
        <div className="auth-actions"><button type="submit" className="auth-submit"><LockKeyhole size={16} /> Unlock Audio</button></div>
      </form>}

      {authorized && <section className="round4-audio-stage" aria-labelledby="round4-audio-title">
        <h3 id="round4-audio-title">Decode the Morse code</h3>
        <p>Listen to the audio and enter the decoded word to unlock the puzzle.</p>
        <audio controls preload="metadata" src="/gameasset/morsecode_9mi9ua0fqik8mhqkighbl5v1sb.wav">Your browser does not support audio playback.</audio>
        {!puzzleUnlocked && <form className="credential-form" onSubmit={checkMorseAnswer}>
          <div className="credential-field"><label htmlFor="morse-answer">Decoded word</label><input id="morse-answer" value={morseAnswer} onChange={e => { setMorseAnswer(e.target.value); if (error) setError(null); }} autoComplete="off" required /></div>
          {error && <div className="auth-error"><AlertCircle size={18} /><div>{error}</div></div>}
          <div className="auth-actions"><button type="submit" className="auth-submit">Unlock Puzzle</button></div>
        </form>}
      </section>}

      {puzzleUnlocked && <Round4Puzzle onSolved={() => setPuzzleSolved(true)} />}
      {puzzleSolved && <div className="round4-final-clue" role="status">
        <h3>Clue revealed</h3>
        <p>the clue for sss</p>
        <Link className="button button-primary" to="/round/5" style={{ marginTop: 14 }}>Continue to Round 5</Link>
      </div>}

      <style>{`
        .round4-audio-stage,.round4-puzzle,.round4-final-clue{margin-top:24px;padding:20px;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:rgba(0,0,0,.16)}
        .round4-audio-stage audio{display:block;width:100%;margin:18px 0}
        .round4-board,.round4-reference{display:grid;grid-template-columns:repeat(4,minmax(48px,78px));gap:5px;justify-content:center;margin:18px auto}
        .round4-tile{aspect-ratio:1;border:1px solid #a6a6a6;background:#292929;color:#fff;font-size:clamp(20px,5vw,30px);cursor:pointer}
        .round4-tile.is-empty{background:transparent;border:1px dashed #999;cursor:default}
        .round4-reference{padding:10px;border:1px solid #aaa;background:#292929}
        .round4-reference span{display:grid;aspect-ratio:1;place-items:center;border:1px solid #b9b9b9;color:#eee;font-size:19px}
        .round4-success{color:#b8dfaa}.round4-final-clue{border-color:#79ae70}
        @media(max-width:420px){.round4-board,.round4-reference{grid-template-columns:repeat(4,minmax(44px,1fr))}}
      `}</style>
    </div>
  );
}

export default ClueRound;
