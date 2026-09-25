import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, KeyRound } from 'lucide-react';
import { round6ClueMap } from './config/clue.config';
import { recordRoundCompletion } from './teamProgress';

function Round6Clue() {
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = pw.trim();
    if (round6ClueMap[code]) {
      try {
        await recordRoundCompletion(6);
        setPdfUrl(round6ClueMap[code]);
        setError(null);
      } catch (cause) {
        setError((cause as Error).message || 'Could not save your Round 6 completion. Please try again.');
      }
    } else {
      setError('Invalid code – try again');
      setPdfUrl(null);
    }
  };

  return (
    <div className="unlock-box">
      <KeyRound size={29} />
      <h3>Final Clue Locked</h3>
      <p>Enter your 4-digit code to unlock the final map.</p>
      <form className="credential-form" onSubmit={handleSubmit}>
        <div className="credential-field">
          <label>
            <span>Clue Code</span>
            <span className="field-tag">4 digits</span>
          </label>
          <input
            type="text"
            maxLength={4}
            required
            placeholder="e.g. 5831"
            value={pw}
            onChange={e => { setPw(e.target.value); if (error) setError(null); }}
          />
          <span className="field-hint">One of the five codes unlocks the final PDF.</span>
        </div>
        {error && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        )}
        <div className="auth-actions">
          <button type="submit" className="auth-submit">
            <KeyRound size={16} /> Unlock Map
          </button>
        </div>
      </form>
      {pdfUrl && (
        <div className="pdf-link" style={{ marginTop: '1rem' }}>
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            Open your final map PDF
          </a>
          <Link className="button button-primary" to="/round/7" style={{ marginTop: '14px' }}>
            I found the clue — go to Round 7
          </Link>
        </div>
      )}
    </div>
  );
}

export default Round6Clue;
