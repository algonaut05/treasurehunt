import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, KeyRound } from 'lucide-react';
import { clueMap } from './config/clue.config';
import { recordRoundCompletion } from './teamProgress';

function ClueRound() {
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const upper = pw.toUpperCase().trim();
    if (clueMap[upper]) {
      try {
        await recordRoundCompletion(4, upper);
        setPdfUrl(clueMap[upper]);
        setError(null);
      } catch (cause) {
        setError((cause as Error).message || 'Could not save your Round 4 completion. Please try again.');
      }
    } else {
      setError('Invalid password – try again');
      setPdfUrl(null);
    }
  };

  return (
    <div className="unlock-box">
      <KeyRound size={29} />
      <h3>Clue Locked</h3>
      <p>Enter the three-character password your organiser shared after approving your Round 3 result.</p>
      <form className="credential-form" onSubmit={handleSubmit}>
        <div className="credential-field">
          <label>
            <span>Clue password</span>
            <span className="field-tag">5 chars</span>
          </label>
          <input
            type="text"
            maxLength={3}
            minLength={3}
            pattern="[A-Za-z0-9]{3}"
            required
            placeholder="3-character password"
            value={pw}
            onChange={e => { setPw(e.target.value.toUpperCase()); if (error) setError(null); }}
          />
          <span className="field-hint">Your assigned password unlocks your Round 4 clue PDF.</span>
        </div>
        {error && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        )}
        <div className="auth-actions">
          <button type="submit" className="auth-submit">
            <KeyRound size={16} /> Unlock PDF
          </button>
        </div>
      </form>
      {pdfUrl && (
        <div className="pdf-link" style={{ marginTop: '1rem' }}>
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            Open your clue PDF
          </a>
          <Link className="button button-primary" to="/round/5" style={{ marginTop: '14px' }}>I found the clue — go to Round 5</Link>
        </div>
      )}
    </div>
  );
}

export default ClueRound;
