import { useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight,
  BookOpen, Camera, Check, Compass, Download, ExternalLink,
  Eye, Fingerprint, KeyRound, LockKeyhole, Menu, Mountain,
  MoveUpRight, RotateCcw, Search, ShieldCheck, Sparkles, X,
} from 'lucide-react'
import { eventConfig } from './config/event.config'
import { validateRound2Credentials, Round2Archive, ROUND1_VALID_CODES } from './config/round2.config'
import { teamTable } from './config/teamTable'
import ClueRound from './ClueRound'
import Round6Clue from './Round6Clue'

const fadeUp = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, ease: 'easeOut' as const } }

// ─── App Shell ────────────────────────────────────────────────────────────────

function App() {
  return (
    <div className="app-shell">
      <Header />
      <AnimatePresence mode="wait">
        <Routes><Route path="*" element={<PageRouter />} /></Routes>
      </AnimatePresence>
      <Footer />
    </div>
  )
}

function PageRouter() {
  const location = useLocation()
  return (
    <motion.main key={location.pathname} className="page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
      <Routes location={location}>
        <Route path="/"           element={<Home />} />
        <Route path="/about"      element={<About />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/register"   element={<Register />} />
        <Route path="/login"      element={<Login />} />
        <Route path="/dashboard"  element={<Dashboard />} />
        <Route path="/round/1"    element={<RoundPage round={1} />} />
        <Route path="/round/2"    element={<RoundPage round={2} />} />
        <Route path="/round/3"    element={<RoundPage round={3} />} />
        <Route path="/round/4"    element={<RoundPage round={4} />} />
        <Route path="/round/5"    element={<RoundPage round={5} />} />
        <Route path="/round/6"    element={<RoundPage round={6} />} />
        <Route path="/round/7"    element={<RoundPage round={7} />} />
        <Route path="/final"      element={<FinalPage />} />
        <Route path="/admin"      element={<Admin />} />
        <Route path="*"           element={<Home />} />
      </Routes>
    </motion.main>
  )
}

// ─── Header / Footer ──────────────────────────────────────────────────────────

function Header() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navItems = [['About', '/about'], ['How it works', '/how-it-works'], ['Team portal', '/login']]
  return (
    <header className="site-header">
      <Link to="/" className="brand" onClick={() => setOpen(false)}>
        <span className="brand-mark"><Compass size={17} /></span>
        <span>ENGQUEST <em>5.0</em></span>
      </Link>
      <nav className={open ? 'main-nav open' : 'main-nav'}>
        {navItems.map(([label, href]) => (
          <Link key={href} to={href} className={location.pathname === href ? 'active' : ''} onClick={() => setOpen(false)}>{label}</Link>
        ))}
        <Link to="/register" className="nav-cta" onClick={() => setOpen(false)}>Enter the quest <ArrowUpRight size={16} /></Link>
      </nav>
      <button className="menu-button" aria-label="Toggle menu" onClick={() => setOpen(!open)}>
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
    </header>
  )
}

function Footer() {
  return (
    <footer className="site-footer section-shell">
      <div className="brand"><span className="brand-mark"><Compass size={17} /></span><span>ENGQUEST <em>5.0</em></span></div>
      <span>© {new Date().getFullYear()} {eventConfig.organizer}</span>
      <a href="#top" aria-label="Back to top"><ArrowUpRight size={17} /></a>
      <Camera size={17} />
    </footer>
  )
}

// ─── Home ─────────────────────────────────────────────────────────────────────

function Home() {
  return (
    <>
      <section className="hero section-shell">
        <div className="hero-copy">
          <motion.div {...fadeUp} className="eyebrow"><span className="eyebrow-dot" /> {eventConfig.eyebrow}</motion.div>
          <motion.h1 {...fadeUp} transition={{ ...fadeUp.transition, delay: .08 }}>The hunt<br /><span>begins here.</span></motion.h1>
          <motion.p {...fadeUp} transition={{ ...fadeUp.transition, delay: .16 }}>{eventConfig.description}</motion.p>
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: .24 }} className="hero-actions">
            <Link className="button button-primary" to="/register">Enter the quest <ArrowUpRight size={18} /></Link>
            <Link className="text-link" to="/how-it-works">How it works <ArrowRight size={16} /></Link>
          </motion.div>
        </div>
        <HeroMap />
        <div className="hero-bottom">
          <span>Presented by <strong>{eventConfig.organizer}</strong></span>
          <span className="scroll-cue"><span>Scroll to explore</span><ArrowDownRight size={17} /></span>
        </div>
      </section>
      <section className="manifesto section-shell">
        <div className="section-kicker">01 / The brief</div>
        <div className="manifesto-grid">
          <h2>A campus full of<br /><i>clues.</i></h2>
          <div>
            <p className="lead">ENGQUEST 5.0 turns familiar ground into an unfolding story. Every answer takes you further from the obvious and closer to the final light.</p>
            <Link className="text-link" to="/about">Discover the format <ArrowRight size={16} /></Link>
          </div>
        </div>
        <Stats />
      </section>
      <section className="rounds-section section-shell">
        <div className="rounds-heading">
          <div><div className="section-kicker">02 / The trail</div><h2>Five ways to<br /><i>get lost.</i></h2></div>
          <p>One team. Three sharp minds.<br />A trail that rewards looking twice.</p>
        </div>
        <div className="round-grid">{eventConfig.rounds.map((round, index) => <RoundCard key={round.number} round={round} index={index} />)}</div>
      </section>
      <section className="closing-cta section-shell">
        <div className="stamp"><Sparkles size={17} /> EST. 2025</div>
        <h2>Ready to follow<br /><i>the thread?</i></h2>
        <Link className="button button-light" to="/register">Build your team <ArrowUpRight size={18} /></Link>
      </section>
    </>
  )
}

function HeroMap() {
  return (
    <motion.div className="hero-art" initial={{ opacity: 0, scale: .94, rotate: 2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 1, delay: .18 }}>
      <div className="art-glow" />
      <div className="map-card">
        <div className="map-top"><span>FIELD NOTE / 05</span><span>DRUSHYAM</span></div>
        <div className="topo topo-one" /><div className="topo topo-two" />
        <div className="route route-one" /><div className="route route-two" />
        <div className="map-pin pin-one"><span /><small>START</small></div>
        <div className="map-pin pin-two"><span /><small>?</small></div>
        <div className="map-pin pin-three"><span /><small>END</small></div>
        <div className="map-compass"><Compass size={42} /><span>N</span></div>
        <div className="map-note"><span>LOOK CLOSER</span><ArrowDownRight size={18} /></div>
      </div>
      <div className="floating-tag tag-code"><KeyRound size={15} /> 4829 1730 56</div>
      <div className="floating-tag tag-found"><Check size={14} /> CLUE FOUND</div>
      <div className="orbit orbit-a" /><div className="orbit orbit-b" />
    </motion.div>
  )
}

function Stats() {
  return (
    <div className="stats-row">
      <div><strong>15</strong><span>teams enter</span></div>
      <div><strong>07</strong><span>stages unfold</span></div>
      <div><strong>03</strong><span>teams remain</span></div>
    </div>
  )
}

function RoundCard({ round, index }: { round: typeof eventConfig.rounds[number]; index: number }) {
  return (
    <Link to={`/round/${index + 1}`} className={`round-card round-${index + 1}`}>
      <div className="round-card-top"><span>{round.number}</span><MoveUpRight size={19} /></div>
      <div className="round-icon">{(index === 0) ? <Fingerprint /> : (index === 1 || index === 3 || index === 5) ? <KeyRound /> : (index === 2 || index === 4) ? <Mountain /> : <Sparkles />}</div>
      <div><small>{round.label}</small><h3>{round.title}</h3><p>{round.description}</p></div>
    </Link>
  )
}

// ─── Static Pages ─────────────────────────────────────────────────────────────

function About() {
  return (
    <PageIntro eyebrow="01 / About the hunt" title={<>Turn the ordinary<br /><i>into a clue.</i></>}>
      <div className="content-grid">
        <div className="large-copy">
          <p>ENGQUEST 5.0 is a multi-stage treasure hunt by Drushyam Photography Club. We have built an adventure for teams who notice patterns, chase questions, and can turn a dead end into a better question.</p>
          <p>The route starts with a puzzle, moves through a hidden archive, and then steps into the real world. The final clue is never where you expect it to be.</p>
        </div>
        <div className="quote-panel">
          <Compass size={28} />
          <p>"The best discoveries are usually hiding in plain sight."</p>
          <span>— THE FIELD GUIDE</span>
        </div>
      </div>
      <Timeline />
    </PageIntro>
  )
}

function HowItWorks() {
  const [active, setActive] = useState(0)
  return (
    <PageIntro eyebrow="02 / Field guide" title={<>Read the trail<br /><i>before you run.</i></>}>
      <div className="instruction-layout">
        <div className="instruction-tabs">
          {eventConfig.rounds.map((round, i) => (
            <button className={active === i ? 'selected' : ''} key={round.number} onClick={() => setActive(i)}>
              <span>{round.number}</span>{round.title}<ArrowRight size={16} />
            </button>
          ))}
        </div>
        <motion.div className="instruction-detail" key={active} initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }}>
          <div className="detail-number">{eventConfig.rounds[active].number}</div>
          <div className="detail-icon">{(active === 0) ? <Fingerprint /> : (active === 1 || active === 3 || active === 5) ? <KeyRound /> : (active === 2 || active === 4) ? <Mountain /> : <Sparkles />}</div>
          <div className="section-kicker">{eventConfig.rounds[active].label}</div>
          <h2>{eventConfig.rounds[active].title}</h2>
          <p>{eventConfig.rounds[active].description}</p>
          <div className="detail-note"><ShieldCheck size={17} /> Your progress is saved at every stage.</div>
        </motion.div>
      </div>
    </PageIntro>
  )
}

function Timeline() {
  return (
    <div className="timeline">
      <div className="timeline-item"><strong>ALL</strong><span>Registered teams</span></div>
      <div className="timeline-line" />
      <div className="timeline-item"><strong>15</strong><span>After round 01</span></div>
      <div className="timeline-line" />
      <div className="timeline-item"><strong>10</strong><span>After round 02</span></div>
      <div className="timeline-line" />
      <div className="timeline-item"><strong>05</strong><span>After round 03</span></div>
      <div className="timeline-line" />
      <div className="timeline-item current"><strong>03</strong><span>Finalists</span></div>
    </div>
  )
}

function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="inner-page section-shell">
      <motion.div {...fadeUp} className="page-heading">
        <div className="section-kicker">{eyebrow}</div>
        <h1>{title}</h1>
      </motion.div>
      {children}
    </section>
  )
}

// ─── Auth & Dashboard ─────────────────────────────────────────────────────────

function Register() {
  const [submitted, setSubmitted] = useState(false)
  if (submitted) return (
    <PageIntro eyebrow="Registration complete" title={<>Your team is<br /><i>on the map.</i></>}>
      <div className="success-panel">
        <Check size={28} />
        <div>
          <span className="section-kicker">TEAM REGISTERED</span>
          <h2>Team Wildframe</h2>
          <p>Team ID: EQ-021 &nbsp; / &nbsp; Access code: <strong>******</strong></p>
          <Link className="button button-primary" to="/dashboard">Open team portal <ArrowUpRight size={17} /></Link>
        </div>
      </div>
    </PageIntro>
  )
  return (
    <PageIntro eyebrow="03 / Assemble your team" title={<>Three minds.<br /><i>One trail.</i></>}>
      <form className="form-panel" onSubmit={(e) => { e.preventDefault(); setSubmitted(true) }}>
        <div className="form-intro">
          <p>A team is exactly three members. Choose people who look at the details.</p>
          <span>01 / TEAM DETAILS</span>
        </div>
        <label>Team name<input required placeholder="e.g. Wildframe" /></label>
        <div className="member-grid">
          {[1, 2, 3].map((member) => (
            <fieldset key={member}>
              <legend>MEMBER {String(member).padStart(2, '0')}</legend>
              <label>Name<input required placeholder="Full name" /></label>
              <label>Enrollment number<input required placeholder="Enrollment ID" /></label>
            </fieldset>
          ))}
        </div>
        <button className="button button-primary" type="submit">Register team <ArrowUpRight size={18} /></button>
      </form>
    </PageIntro>
  )
}

function Login() {
  const navigate = useNavigate()
  return (
    <PageIntro eyebrow="04 / Team portal" title={<>The trail is<br /><i>waiting.</i></>}>
      <form className="form-panel compact" onSubmit={(e) => { e.preventDefault(); navigate('/dashboard') }}>
        <div className="login-symbol"><LockKeyhole size={25} /></div>
        <p className="lead">Enter your team ID and access code to continue your quest.</p>
        <label>Team ID<input required placeholder="EQ-000" /></label>
        <label>Access code<input required type="password" placeholder="10-digit access code" /></label>
        <button className="button button-primary" type="submit">Enter portal <ArrowUpRight size={18} /></button>
        <span className="form-help">Your access code was provided during registration.</span>
      </form>
    </PageIntro>
  )
}

function Dashboard() {
  return (
    <PageIntro eyebrow="Team portal / EQ-021" title={<>Welcome back,<br /><i>Wildframe.</i></>}>
      <div className="dashboard-top">
        <div>
          <span className="section-kicker">CURRENT STATUS</span>
          <h2>Round 02 / Search</h2>
          <p>The archive is open. Find the thread that leads to the next location.</p>
        </div>
        <div className="status-badge"><span /> IN PROGRESS</div>
      </div>
      <div className="dashboard-grid">
        <div className="progress-panel">
          <span className="section-kicker">YOUR PROGRESS</span>
          {['Registration complete', 'Round 01 / Decode', 'Round 02 / Search', 'Round 03 / Discover', 'Round 04 / Final quest'].map((step, i) => (
            <div className={`progress-step ${i < 2 ? 'done' : i === 2 ? 'active' : ''}`} key={step}>
              <span>{i < 2 ? <Check size={14} /> : i + 1}</span>
              <div><strong>{step}</strong><small>{i < 2 ? 'Completed' : i === 2 ? 'Ready to investigate' : 'Locked'}</small></div>
            </div>
          ))}
        </div>
        <div className="dashboard-action">
          <BookOpen size={26} />
          <span className="section-kicker">ROUND 02</span>
          <h2>Unlock the archive</h2>
          <p>Use the clue from Round 01 and your organizer password to access your team's archive.</p>
          <Link className="button button-primary" to="/round/2">Continue <ArrowRight size={17} /></Link>
        </div>
      </div>
    </PageIntro>
  )
}

// ─── Round 2: Dual-Credential PDF Unlock ─────────────────────────────────────

// Round 1 Code verification component
function Round1CodeChallenge() {
  const [code, setCode] = useState(() => sessionStorage.getItem('engquest_r1_code') || '');
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean>(!!sessionStorage.getItem('engquest_r1_code'));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (ROUND1_VALID_CODES.has(code)) {
      setVerified(true);
      sessionStorage.setItem('engquest_r1_code', code);
    } else {
      setError('Invalid code. Please try again.');
    }
  };

  return (
    <div className="code-challenge-box">
      {verified ? (
        <div>
          <p>Code verified. Proceed to <Link className="button button-primary" to="/round/2">Round 2</Link>.</p>
        </div>
      ) : (
        <form className="credential-form" onSubmit={handleSubmit}>
          <div className="credential-field">
            <label>
              <span>Enter 10‑digit Round 01 code</span>
              <span className="field-tag">10 digits</span>
            </label>
            <input
              type="text"
              required
              maxLength={10}
              placeholder="e.g. 0001000111"
              value={code}
              onChange={e => { setCode(e.target.value.replace(/[^01]/g, '')); if (error) setError(null); }}
            />
            <span className="field-hint">The 10‑digit binary key you found in Round 01.</span>
          </div>
          {error && (
            <div className="auth-error"><AlertCircle size={18} /><div>{error}</div></div>
          )}
          <div className="auth-actions"><button type="submit" className="auth-submit"><KeyRound size={16} /> Verify Code</button></div>
        </form>
      )}
    </div>
  );
}


function Round2ArchiveChallenge() {
  const [round1Code, setRound1Code] = useState(() => sessionStorage.getItem('engquest_r2_code') || '')
  const [password, setPassword]     = useState(() => sessionStorage.getItem('engquest_r2_password') || '')
  const [error, setError]           = useState<string | null>(null)
  const [archive, setArchive]       = useState<Round2Archive | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('engquest_r2_archive') || 'null') } catch { return null }
  })

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const result = validateRound2Credentials(round1Code, password)
    if (!result.valid || !result.archive) {
      setError(result.error || 'Verification failed.')
      return
    }
    setArchive(result.archive)
    sessionStorage.setItem('engquest_r2_code', round1Code)
    sessionStorage.setItem('engquest_r2_password', password.toUpperCase())
    sessionStorage.setItem('engquest_r2_archive', JSON.stringify(result.archive))
  }

  const handleLock = () => {
    setArchive(null); setError(null)
    sessionStorage.removeItem('engquest_r2_archive')
  }

  // ── Unlocked view ──────────────────────────────────────────────────────────
  if (archive) {
    return (
      <div className="archive-unlocked-card">
        <div className="archive-banner">
          <div>
            <div className="archive-badge"><Check size={14} /> Access Authorized</div>
            <h3>{archive.title}</h3>
            <div className="archive-meta">
              Key: <strong>{archive.password}</strong> &bull; File: <code>{archive.fileName}</code>
            </div>
          </div>
          <button className="btn-archive-action btn-relock" onClick={handleLock}>
            <RotateCcw size={15} /> Lock / Change Credentials
          </button>
        </div>

        <div className="archive-btn-group">
          <a className="btn-archive-action btn-archive-highlight" href={archive.fileUrl} download={archive.fileName}>
            <Download size={16} /> Download Clue PDF ({archive.fileName})
          </a>
          <a className="btn-archive-action" href={archive.fileUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} /> Open in New Tab
          </a>
        </div>

        <div className="pdf-viewer-shell">
          <iframe src={`${archive.fileUrl}#toolbar=1`} title={archive.title} className="pdf-frame" />
        </div>

        <div className="archive-footer-actions">
          <span className="auth-note">
            If the viewer isn't showing, click "Download Clue PDF" to view it offline.
          </span>
          <Link className="button button-primary" to="/round/3">
            I found the clue <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    )
  }

  // ── Locked view (dual-credential form) ─────────────────────────────────────
  return (
    <div className="unlock-box">
      <LockKeyhole size={29} />
      <h3>Round 02 Locked</h3>
      <p>Enter both credentials below. Both must be correct to unlock your assigned clue PDF.</p>

      <form className="credential-form" onSubmit={handleUnlock}>

        {/* Field 1: 10-digit Round 1 code */}
        <div className="credential-field">
          <label>
            <span>1 &mdash; Round 01 Clue Code</span>
            <span className="field-tag">10 digits</span>
          </label>
          <input
            type="text"
            required
            maxLength={10}
            placeholder="e.g. 1011010011"
            value={round1Code}
            onChange={(e) => { setRound1Code(e.target.value.replace(/[^01]/g, '')); if (error) setError(null) }}
          />
          <span className="field-hint">The 10-digit binary key you found in Round 01.</span>
        </div>

        {/* Field 2: 5-character organizer password */}
        <div className="credential-field">
          <label>
            <span>2 &mdash; Organizer Password</span>
            <span className="field-tag">5 characters</span>
          </label>
          <input
            type="text"
            required
            maxLength={5}
            placeholder="e.g. A7K2M"
            value={password}
            onChange={(e) => { setPassword(e.target.value.toUpperCase()); if (error) setError(null) }}
          />
          <span className="field-hint">The 5-character key given to your team by the organizer.</span>
        </div>

        {/* Error banner */}
        {error && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        )}

        <div className="auth-actions">
          <button type="submit" className="auth-submit">
            <KeyRound size={16} /> Unlock Archive PDF
          </button>
          <span className="auth-note">Both credentials are verified before unlocking</span>
        </div>
      </form>
    </div>
  )
}

// ─── Round Pages ──────────────────────────────────────────────────────────────

function RoundPage({ round }: { round: number }) {
  const config = eventConfig.rounds[round - 1]
  return (
    <PageIntro eyebrow={`Round ${config.number} / ${config.label}`} title={<>{config.title}<br /><i>{round === 7 ? 'starts now.' : 'the next clue.'}</i></>}>
      <div className={`round-stage stage-${round}`}>
        <div className="stage-top">
          <div className="stage-icon">{(round === 1) ? <Fingerprint /> : (round === 2 || round === 4 || round === 6) ? <KeyRound /> : (round === 3 || round === 5) ? <Mountain /> : <Sparkles />}</div>
          <div><span className="section-kicker">{config.label}</span><h2>{config.description}</h2></div>
        </div>

        {round === 2 ? (
          <Round2ArchiveChallenge />
        ) : round === 4 ? (
          <ClueRound />
        ) : round === 6 ? (
          <Round6Clue />
        ) : (
          <div className="challenge-box">
            {round === 1 ? <Round1CodeChallenge /> : (round === 3 || round === 5) ? (
              <>
                <span className="section-kicker">THE NEXT CLUE ISN'T ON THIS SCREEN</span>
                <h3>Discover the location.</h3>
                <p>Take the clue beyond the page, identify the corresponding location, then verify it here.</p>
                <div className="code-input"><input placeholder="Location name" /><button><Search size={16} /> Verify</button></div>
              </>
            ) : round === 7 ? (
              <>
                <span className="section-kicker">THE FINAL QUEST</span>
                <h3>Five teams. One last trail.</h3>
                <p>Final challenge placeholder. Only qualified teams can access this stage.</p>
                <div className="countdown"><strong>00:00:00</strong><span>COUNTDOWN PLACEHOLDER</span></div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </PageIntro>
  )
}

function FinalPage() {
  return (
    <PageIntro eyebrow="The end of the trail" title={<>The map is<br /><i>complete.</i></>}>
      <div className="final-panel">
        <Sparkles size={31} />
        <span className="section-kicker">FINALISTS / 03</span>
        <h2>Somewhere between<br />a clue and a choice.</h2>
        <p>The final three teams have been recorded. The rest is now part of the story.</p>
        <Link className="button button-light" to="/">Return to the field <ArrowUpRight size={17} /></Link>
      </div>
    </PageIntro>
  )
}

function Admin() {
  return (
    <PageIntro eyebrow="Admin / Control room" title={<>Watch the trail<br /><i>unfold.</i></>}>
      <div className="admin-bar">
        <div><span className="section-kicker">LIVE EVENT VIEW</span><h2>Team progress</h2></div>
        <button className="button button-dark"><Search size={16} /> Search teams</button>
      </div>
      <div className="admin-table">
        <div className="table-head"><span>TEAM</span><span>ROUND</span><span>STATUS</span><span>LAST ACTIVITY</span><span /></div>
        {['Wildframe', 'Northstar', 'The Seekers', 'Aperture 03'].map((team, i) => (
          <div className="table-row" key={team}>
            <strong>{team}</strong>
            <span>0{i + 1} / {i === 0 ? 'Search' : 'Decode'}</span>
            <span className={`table-status status-${i}`}>{i === 0 ? 'In progress' : 'Registered'}</span>
            <span>Today, 10:{12 + i} AM</span>
            <button aria-label={`View ${team}`}><Eye size={17} /></button>
          </div>
        ))}
      </div>
    </PageIntro>
  )
}

export default App

