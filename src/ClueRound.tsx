import { useState } from 'react';
import { AlertCircle, KeyRound } from 'lucide-react';
import { clueMap } from './config/clue.config';

function ClueRound() {
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const upper = pw.toUpperCase().trim();
    if (clueMap[upper]) {
      setPdfUrl(clueMap[upper]);
      setError(null);
    } else {
      setError('Invalid password – try again');
      setPdfUrl(null);
    }
  };

  return (
    <div className="clue-round">
      <h3>Enter clue password</h3>
      <form className="credential-form" onSubmit={handleSubmit}>
        <div className="credential-field">
          <label>
            <span>Clue password</span>
            <span className="field-tag">5 chars</span>
          </label>
          <input
            type="text"
            maxLength={5}
            required
            placeholder="e.g. 7Q2"
            value={pw}
            onChange={e => { setPw(e.target.value.toUpperCase()); if (error) setError(null); }}
          />
          <span className="field-hint">One of the ten passwords unlocks a PDF clue.</span>
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
        </div>
      )}
    </div>
  );
}

export default ClueRound;
