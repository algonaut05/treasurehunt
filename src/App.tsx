import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight,
  BookOpen, Camera, Check, Compass, Download, ExternalLink,
  Eye, Fingerprint, KeyRound, LockKeyhole, Menu, Mountain,
  MoveUpRight, RotateCcw, Search, ShieldCheck, Sparkles, X,
} from 'lucide-react'
import { eventConfig } from './config/event.config'
import { validateRound2Credentials, Round2Archive, ROUND1_VALID_CODES } from './config/round2.config'
import { clueMap } from './config/clue.config'
import ClueRound from './ClueRound'
import Round6Clue from './Round6Clue'
import { organizerApproveRound3, organizerApproveRound7, organizerLogin, organizerTeams, registerTeam, requestRound7Review, teamLogin } from './api'
import { recordRoundCompletion } from './teamProgress'

type RegisteredTeam = { id: string; name: string; members: { name: string; enrollment: string }[]; progress: number; registeredAt: string; lastActivityAt?: string; round3ApprovedAt?: string | null; round4CluePassword?: string | null; round7RequestedAt?: string | null; round7ApprovedAt?: string | null }

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
        <Route path="/"           element={<RoleLanding />} />
        <Route path="/about"      element={<PublicPage><About /></PublicPage>} />
        <Route path="/how-it-works" element={<PublicPage><HowItWorks /></PublicPage>} />
        <Route path="/register"   element={<PublicPage><Register /></PublicPage>} />
        <Route path="/login"      element={<PublicPage><Login /></PublicPage>} />
        <Route path="/dashboard"  element={<TeamPortal />} />
        <Route path="/round/1"    element={<GameGate><RoundPage round={1} /></GameGate>} />
        <Route path="/round/2"    element={<GameGate><RoundPage round={2} /></GameGate>} />
        <Route path="/round/3"    element={<GameGate><RoundPage round={3} /></GameGate>} />
        <Route path="/round/4"    element={<GameGate><RoundPage round={4} /></GameGate>} />
        <Route path="/round/5"    element={<GameGate><RoundPage round={5} /></GameGate>} />
        <Route path="/round/6"    element={<GameGate><RoundPage round={6} /></GameGate>} />
        <Route path="/round/7"    element={<GameGate><RoundPage round={7} /></GameGate>} />
        <Route path="/final"      element={<GameGate><FinalPage /></GameGate>} />
        <Route path="/admin"      element={<OrganizerPortal><Admin /></OrganizerPortal>} />
        <Route path="/admin/round3" element={<OrganizerPortal><AdminRound3 /></OrganizerPortal>} />
        <Route path="/admin/round7" element={<OrganizerPortal><AdminRound7 /></OrganizerPortal>} />
        <Route path="*"           element={<RoleLanding />} />
      </Routes>
    </motion.main>
  )
}

function portalHomePath() {
  const role = sessionStorage.getItem('engquest_role')
  return role === 'team' ? '/dashboard' : role === 'admin' ? '/admin' : '/'
}

function RoleLanding() {
  const destination = portalHomePath()
  return destination === '/' ? <Home /> : <Navigate to={destination} replace />
}

function PublicPage({ children }: { children: React.ReactNode }) {
  const destination = portalHomePath()
  return destination === '/' ? <>{children}</> : <Navigate to={destination} replace />
}

function TeamPortal() {
  const role = sessionStorage.getItem('engquest_role')
  return role === 'admin' ? <Navigate to="/admin" replace /> : <Dashboard />
}

function OrganizerPortal({ children }: { children: React.ReactNode }) {
  const role = sessionStorage.getItem('engquest_role')
  if (role === 'team') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function GameGate({ children }: { children: React.ReactNode }) {
  if (sessionStorage.getItem('engquest_role') === 'admin') return <Navigate to="/admin" replace />
  const signedInTeam = Boolean(sessionStorage.getItem('engquest_team_id') && sessionStorage.getItem('engquest_role') === 'team')
  if (signedInTeam) return <>{children}</>
  return <PageIntro eyebrow="Team access required" title={<>Register and sign<br /><i>in to play.</i></>}>
    <p className="lead">The game is available to registered teams after team ID login.</p>
    <div className="hero-actions"><Link className="button button-primary" to="/register">Register a team <ArrowUpRight size={17} /></Link><Link className="text-link" to="/login">Team portal <ArrowRight size={16} /></Link></div>
  </PageIntro>
}

// ─── Header / Footer ──────────────────────────────────────────────────────────

function Header() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const role = sessionStorage.getItem('engquest_role')
  const homeTarget = portalHomePath()
  const navItems = [['About', '/about'], ['How it works', '/how-it-works']]
  return (
    <header className="site-header">
      <Link to={homeTarget} className="brand" aria-label={role ? `${role === 'team' ? 'Team' : 'Organiser'} portal` : 'Home'} onClick={() => setOpen(false)}>
        <span className="brand-mark"><Compass size={17} /></span>
        <span>ENGQUEST <em>5.0</em></span>
      </Link>
      <nav className={open ? 'main-nav open' : 'main-nav'}>
        {!role && navItems.map(([label, href]) => (
          <Link key={href} to={href} className={location.pathname === href ? 'active' : ''} onClick={() => setOpen(false)}>{label}</Link>
        ))}
        {role ? <Link to={homeTarget} className="nav-cta" onClick={() => setOpen(false)}>{role === 'team' ? 'Team portal' : 'Organiser portal'} <ArrowUpRight size={16} /></Link> : <Link to="/login?organiser=1" className="nav-cta" onClick={() => setOpen(false)}>Organiser login <ArrowUpRight size={16} /></Link>}
      </nav>
      {!role && <button className="menu-button" aria-label="Toggle menu" onClick={() => setOpen(!open)}>
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>}
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
            <Link className="button button-primary" to="/register">Register your team <ArrowUpRight size={18} /></Link>
            <Link className="button button-primary" to="/login">Team login <ArrowRight size={18} /></Link>
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
          <div><div className="section-kicker">02 / The trail</div><h2>Seven stages to<br /><i>get lost.</i></h2></div>
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
  const clueRound = (index + 1) % 2 === 0
  return (
    <Link to={`/round/${index + 1}`} className={`round-card round-${index + 1} ${clueRound ? 'round-kind-clue' : 'round-kind-main'}`}>
      <div className="round-card-top"><span>{round.number}</span><span className="round-kind-label">{clueRound ? 'CLUE ROUND' : 'MAIN ROUND'}</span><MoveUpRight size={19} /></div>
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
            <button className={`${active === i ? 'selected' : ''} ${(i + 1) % 2 === 0 ? 'clue-round' : 'main-round'}`} key={round.number} onClick={() => setActive(i)}>
              <span>{round.number}</span><span>{round.title}<small>{(i + 1) % 2 === 0 ? 'CLUE ROUND' : 'MAIN ROUND'}</small></span><ArrowRight size={16} />
            </button>
          ))}
        </div>
        <motion.div className={`instruction-detail ${(active + 1) % 2 === 0 ? 'clue-round' : 'main-round'}`} key={active} initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }}>
          <div className="detail-number">{eventConfig.rounds[active].number}</div>
          <div className="detail-icon">{(active === 0) ? <Fingerprint /> : (active === 1 || active === 3 || active === 5) ? <KeyRound /> : (active === 2 || active === 4) ? <Mountain /> : <Sparkles />}</div>
          <div className="section-kicker">{(active + 1) % 2 === 0 ? 'CLUE ROUND' : 'MAIN ROUND'} / {eventConfig.rounds[active].label}</div>
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
  const [registered, setRegistered] = useState<string | null>(null)
  const [error, setError] = useState('')
  if (registered) return (
    <PageIntro eyebrow="Registration complete" title={<>Your team is<br /><i>on the map.</i></>}>
      <div className="success-panel">
        <Check size={28} />
        <div>
          <span className="section-kicker">TEAM REGISTERED</span>
          <h2>Your team is registered</h2>
          <p>Your team ID is <strong>{registered}</strong>. Keep it safe; use it with your password to sign in.</p>
          <Link className="button button-primary" to="/login">Go to team login <ArrowUpRight size={17} /></Link>
        </div>
      </div>
    </PageIntro>
  )
  return (
    <PageIntro eyebrow="03 / Assemble your team" title={<>Three minds.<br /><i>One trail.</i></>}>
      <form className="form-panel" onSubmit={async (e) => {
        e.preventDefault(); setError('')
        const form = new FormData(e.currentTarget)
        const name = String(form.get('teamName') || '').trim()
        const password = String(form.get('teamPassword') || '')
        const members = [1, 2, 3].map(i => ({ name: String(form.get(`member${i}`) || '').trim(), enrollment: String(form.get(`enrollment${i}`) || '').trim() }))
        try {
          const result = await registerTeam({ name, password, members })
          setRegistered(result.teamId)
        } catch (cause) {
          setError((cause as Error).message || 'Registration failed. Please try again.')
        }
      }}>
        <div className="form-intro">
          <p>A team is exactly three members. Choose people who look at the details.</p>
          <span>01 / TEAM DETAILS</span>
        </div>
        <label>Team name<input name="teamName" required placeholder="e.g. Wildframe" /></label>
        <label>Team password<input name="teamPassword" required type="password" minLength={4} autoComplete="new-password" placeholder="Create a password (at least 4 characters)" /></label>
        <div className="member-grid">
          {[1, 2, 3].map((member) => (
            <fieldset key={member}>
              <legend>MEMBER {String(member).padStart(2, '0')}</legend>
              <label>Name<input name={`member${member}`} required placeholder="Full name" /></label>
              <label>Enrollment number<input name={`enrollment${member}`} required placeholder="Enrollment ID" /></label>
            </fieldset>
          ))}
        </div>
        {error && <div className="auth-error"><AlertCircle size={18} />{error}</div>}
        <button className="button button-primary" type="submit">Register team <ArrowUpRight size={18} /></button>
      </form>
    </PageIntro>
  )
}

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [organiser, setOrganiser] = useState(() => new URLSearchParams(location.search).get('organiser') === '1')
  const [error, setError] = useState('')
  return (
    <PageIntro eyebrow="04 / Team portal" title={<>The trail is<br /><i>waiting.</i></>}>
      <form className="form-panel compact" onSubmit={async (e) => { e.preventDefault(); const data = new FormData(e.currentTarget)
        try {
          if (organiser) {
            const username = String(data.get('username'))
            const password = String(data.get('password'))
            await organizerLogin(username, password)
            sessionStorage.setItem('engquest_admin_username', username)
            sessionStorage.setItem('engquest_admin_password', password)
            sessionStorage.setItem('engquest_role', 'admin'); sessionStorage.removeItem('engquest_team_id'); navigate('/admin')
          } else {
            const teamId = String(data.get('teamId')).trim().toLowerCase()
            const password = String(data.get('teamPassword'))
            await teamLogin(teamId, password)
            for (const key of ['engquest_r1_code', 'engquest_r2_code', 'engquest_r2_password', 'engquest_r2_archive']) sessionStorage.removeItem(key)
            sessionStorage.setItem('engquest_team_password', password)
            sessionStorage.setItem('engquest_role', 'team'); sessionStorage.setItem('engquest_team_id', teamId); navigate('/dashboard')
          }
        } catch (cause) {
          setError((cause as Error).message || (organiser ? 'Incorrect organiser username or password.' : 'Team ID or password is incorrect.'))
        }
      }}>
        <div className="login-symbol"><LockKeyhole size={25} /></div>
        <p className="lead">{organiser ? 'Sign in to view registered teams and their progress.' : 'Enter your team ID to continue your quest.'}</p>
        {organiser ? <><label>Username<input name="username" required placeholder="Organiser username" /></label><label>Password<input name="password" required type="password" placeholder="Password" /></label></> : <><label>Team ID<input name="teamId" required placeholder="eqth01" /></label><label>Team password<input name="teamPassword" required type="password" autoComplete="current-password" placeholder="Your team password" /></label></>}
        {error && <div className="auth-error"><AlertCircle size={18} />{error}</div>}
        <button className="button button-primary" type="submit">Enter portal <ArrowUpRight size={18} /></button>
        <button type="button" className="text-link" onClick={() => { setOrganiser(!organiser); setError('') }}>{organiser ? 'Team login' : 'Organiser login'}</button>
        {!organiser && <span className="form-help">New team? <Link to="/register">Register here</Link></span>}
      </form>
    </PageIntro>
  )
}

function Dashboard() {
  const navigate = useNavigate()
  const teamId = sessionStorage.getItem('engquest_team_id')
  const [team, setTeam] = useState<RegisteredTeam | null>(null)
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    if (!teamId || sessionStorage.getItem('engquest_role') !== 'team') return
    let cancelled = false
    teamLogin(teamId, sessionStorage.getItem('engquest_team_password') || '')
      .then(result => { if (!cancelled) setTeam(result.team) })
      .catch(cause => { if (!cancelled) setLoadError((cause as Error).message) })
    return () => { cancelled = true }
  }, [teamId])
  if (!teamId || sessionStorage.getItem('engquest_role') !== 'team') return <PageIntro eyebrow="Team portal" title={<>Team sign in<br /><i>required.</i></>}><Link className="button button-primary" to="/login">Sign in <ArrowRight size={17} /></Link></PageIntro>
  if (!team) return <PageIntro eyebrow="Team portal" title={<>Loading your<br /><i>team.</i></>}><p className="lead">{loadError || 'Fetching your team profile…'}</p></PageIntro>
  return (
    <PageIntro eyebrow={`TEAM ${team.id}`} title={<>Welcome,<br /><i>{team.name}.</i></>}>
      <div className="team-rounds-heading">
        <span className="section-kicker">CHOOSE A ROUND</span>
        <button className="button button-dark" onClick={() => { sessionStorage.removeItem('engquest_role'); sessionStorage.removeItem('engquest_team_id'); sessionStorage.removeItem('engquest_team_password'); navigate('/') }}>Log out <ArrowUpRight size={16} /></button>
      </div>
      <div className="round-grid team-round-grid">{eventConfig.rounds.map((round, index) => <RoundCard key={round.number} round={round} index={index} />)}</div>
    </PageIntro>
  )
}

// ─── Round 2: Dual-Credential PDF Unlock ─────────────────────────────────────

// Round 1 Code verification component
function Round1CodeChallenge() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (ROUND1_VALID_CODES.has(code)) {
      try {
        await recordRoundCompletion(1)
        setVerified(true)
      } catch (cause) {
        setError((cause as Error).message || 'Could not save your Round 1 completion. Please try again.')
      }
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
              placeholder="0000011111"
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
  const [round1Code, setRound1Code] = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [archive, setArchive]       = useState<Round2Archive | null>(null)

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const result = validateRound2Credentials(round1Code, password)
    if (!result.valid || !result.archive) {
      setError(result.error || 'Verification failed.')
      return
    }
    try {
      await recordRoundCompletion(2)
      setArchive(result.archive)
    } catch (cause) {
      setError((cause as Error).message || 'Could not save your Round 2 completion. Please try again.')
    }
  }

  const handleLock = () => {
    setArchive(null); setError(null); setRound1Code(''); setPassword('')
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
              placeholder="0000011111"
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
            placeholder="ABC12"
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
  const clueRound = round % 2 === 0
  return (
    <PageIntro eyebrow={`${clueRound ? 'Clue round' : 'Main round'} ${config.number} / ${config.label}`} title={<>{config.title}<br /><i>{round === 7 ? 'starts now.' : 'the next clue.'}</i></>}>
      <div className={`round-stage stage-${round} ${clueRound ? 'round-kind-clue' : 'round-kind-main'}`}>
        <div className="stage-top">
          <div className="stage-icon">{(round === 1) ? <Fingerprint /> : (round === 2 || round === 4 || round === 6) ? <KeyRound /> : (round === 3 || round === 5) ? <Mountain /> : <Sparkles />}</div>
          <div><span className="round-kind-label stage-kind-label">{clueRound ? 'CLUE ROUND' : 'MAIN ROUND'}</span><span className="section-kicker">{config.label}</span><h2>{config.description}</h2></div>
        </div>
        {round === 2 ? (
          <Round2ArchiveChallenge />
        ) : round === 4 ? (
          <ClueRound />
        ) : round === 6 ? (
          <Round6Clue />
        ) : (
          <div className="challenge-box">
            {round === 1 ? <Round1CodeChallenge /> : round === 3 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span className="section-kicker">THE NEXT CLUE ISN'T ON THIS SCREEN</span>
                <h3>Discover the location.</h3>
                <p>Find the location and submit your photo proof. Organisers will review and update your result.</p>
                <a href="https://docs.google.com/forms/d/e/1FAIpQLScPkd7s9zyfvNuysls2fr8y_UWkq98GidnN4sl5XYOHD5ZTww/viewform?usp=publish-editor" target="_blank" rel="noopener noreferrer" className="button button-primary" style={{ textDecoration: 'none', width: 'fit-content', marginTop: '10px' }}>
                  <Camera size={16} /> Submit Photo Proof
                </a>
                <Link className="button button-primary" to="/round/4" style={{ width: 'fit-content', marginTop: '10px' }}>
                  Continue to Round 4 <ArrowRight size={17} />
                </Link>
                <Round3Status />
              </div>
            ) : round === 5 ? (
              <Round5Challenge />
            ) : round === 7 ? (
              <Round7Challenge />
            ) : null}
          </div>
        )}
      </div>
    </PageIntro>
  )
}

function Round3Status() {
  const [approvedAt, setApprovedAt] = useState<string | null>(null)
  const [cluePassword, setCluePassword] = useState<string | null>(null)
  const [statusError, setStatusError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  useEffect(() => {
    const teamId = sessionStorage.getItem('engquest_team_id')
    const password = sessionStorage.getItem('engquest_team_password')
    if (!teamId || !password || sessionStorage.getItem('engquest_role') !== 'team') return
    let cancelled = false
    const refreshResult = async () => {
      setRefreshing(true)
      try {
        const result = await teamLogin(teamId, password)
        if (!cancelled) {
          setApprovedAt(result.team.round3ApprovedAt || null)
          setCluePassword(result.team.round4CluePassword || null)
          setStatusError('')
        }
      } catch (cause) {
        if (!cancelled) setStatusError((cause as Error).message || 'Could not load your Round 3 result.')
      } finally {
        if (!cancelled) setRefreshing(false)
      }
    }
    void refreshResult()
    const interval = window.setInterval(() => void refreshResult(), 10000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [refreshToken])

  const refreshButton = <button type="button" className="button button-dark" aria-label="Refresh Round 3 approval status" onClick={() => { setRefreshing(true); setRefreshToken(value => value + 1) }} disabled={refreshing}><RotateCcw size={15} /> {refreshing ? 'Checking…' : 'Refresh status'}</button>
  if (!approvedAt) return <div role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginTop: '8px', flexWrap: 'wrap' }}>
    <p className="form-help" style={{ margin: 0 }}>{statusError || 'Your Round 3 result is awaiting organiser review.'}</p>{refreshButton}
  </div>
  return <div role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 16px', border: '1px solid #aab2a4', marginTop: '8px', flexWrap: 'wrap' }}>
    <span className="section-kicker">ROUND 3 RESULT</span><strong style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#607b57' }}><Check size={16} /> APPROVED</strong>
    <span>Round 4 clue password: <strong style={{ fontFamily: 'DM Mono, monospace', letterSpacing: '.15em' }}>{cluePassword || 'Awaiting organiser password'}</strong></span>{refreshButton}
  </div>
}

function Round7Challenge() {
  const [requestedAt, setRequestedAt] = useState<string | null>(null)
  const [approvedAt, setApprovedAt] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const photoUploadUrl = eventConfig.round7PhotoUploadUrl

  useEffect(() => {
    const teamId = sessionStorage.getItem('engquest_team_id')
    const password = sessionStorage.getItem('engquest_team_password')
    if (!teamId || !password) return
    let cancelled = false
    const refresh = async () => {
      setRefreshing(true)
      try {
        const result = await teamLogin(teamId, password)
        if (!cancelled) {
          setRequestedAt(result.team.round7RequestedAt || null)
          setApprovedAt(result.team.round7ApprovedAt || null)
          setError('')
        }
      } catch (cause) {
        if (!cancelled) setError((cause as Error).message || 'Could not load your final-round status.')
      } finally {
        if (!cancelled) setRefreshing(false)
      }
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 10000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [refreshToken])

  const submitForReview = async () => {
    const teamId = sessionStorage.getItem('engquest_team_id')
    const password = sessionStorage.getItem('engquest_team_password')
    if (!teamId || !password) { setError('Team login is required to request approval.'); return }
    setSaving(true)
    setError('')
    try {
      const result = await requestRound7Review(teamId, password)
      setRequestedAt(result.requestedAt)
    } catch (cause) {
      setError((cause as Error).message || 'Could not request final-round approval.')
    } finally {
      setSaving(false)
    }
  }

  const refreshButton = <button type="button" className="button button-dark" aria-label="Refresh final-round approval status" onClick={() => { setRefreshing(true); setRefreshToken(value => value + 1) }} disabled={refreshing}><RotateCcw size={15} /> {refreshing ? 'Checking…' : 'Refresh status'}</button>

  if (approvedAt) return <div className="final-panel winner-panel" role="status">
    <Sparkles size={31} />
    <span className="section-kicker">FINAL ROUND / APPROVED</span>
    <h2>You found<br /><i>the treasure.</i></h2>
    <p>You’re the winner! The organisers approved your final-round photo.</p>
    {refreshButton}
  </div>

  return <div className="challenge-box final-round-challenge">
    <span className="section-kicker">THE FINAL QUEST</span>
    <h3>Found the treasure?</h3>
    <p>Upload a photo of your team with the treasure, then request organiser approval. Your result will appear here after review.</p>
    {photoUploadUrl ? <a className="button button-primary" href={photoUploadUrl} target="_blank" rel="noreferrer"><Camera size={16} /> Upload treasure photo <ExternalLink size={15} /></a> : <button className="button button-primary" type="button" disabled>Photo upload link coming soon</button>}
    {requestedAt ? <p className="form-help" role="status">Photo review requested. Waiting for organiser approval.</p> : <button className="button button-light" type="button" style={{ marginTop: 12 }} disabled={!photoUploadUrl || saving} onClick={() => void submitForReview()}>{saving ? 'Sending request…' : 'Request organiser approval'} <ArrowRight size={16} /></button>}
    {refreshButton}
    {error && <div className="auth-error"><AlertCircle size={18} />{error}</div>}
  </div>
}

function Round5Challenge() {
  const navigate = useNavigate()
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const handleContinue = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await recordRoundCompletion(5)
      navigate('/round/6')
    } catch (cause) {
      setError((cause as Error).message || 'Could not save your Round 5 completion. Please try again.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <span className="section-kicker">THE NEXT CLUE ISN'T ON THIS SCREEN</span>
      <h3>Discover the location.</h3>
      <p>Follow the clue to the second location. When you find it, continue to the next round.</p>
      <form className="credential-form" onSubmit={handleContinue}>
        <div className="credential-field">
          <label><span>Location found</span></label>
          <input required value={location} onChange={event => setLocation(event.target.value)} placeholder="Enter the location" />
        </div>
        {error && <div className="auth-error"><AlertCircle size={18} />{error}</div>}
        <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'I found the clue — go to Round 6'} <ArrowRight size={17} /></button>
      </form>
    </>
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
  const [teams, setTeams] = useState<RegisteredTeam[]>([])
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(false)
  const loadTeams = async () => {
    setLoading(true)
    try {
      const result = await organizerTeams(sessionStorage.getItem('engquest_admin_username') || '', sessionStorage.getItem('engquest_admin_password') || '')
      setTeams(result.teams)
      setLoadError('')
    } catch (cause) { setLoadError((cause as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    if (sessionStorage.getItem('engquest_role') !== 'admin') return
    void loadTeams()
    const interval = window.setInterval(() => void loadTeams(), 15000)
    const onFocus = () => void loadTeams()
    window.addEventListener('focus', onFocus)
    return () => { window.clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [])
  if (sessionStorage.getItem('engquest_role') !== 'admin') return <PageIntro eyebrow="Organiser login required" title={<>The control room<br /><i>is restricted.</i></>}><Link className="button button-primary" to="/login?organiser=1">Organiser login <ArrowRight size={17} /></Link></PageIntro>
  const visibleTeams = teams.filter(team => `${team.name} ${team.id} ${team.members.map(member => member.name).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
  return (
    <PageIntro eyebrow="Admin / Control room" title={<>Watch the trail<br /><i>unfold.</i></>}>
      <div className="admin-bar">
        <div><span className="section-kicker">LIVE EVENT VIEW</span><h2>Team progress</h2></div>
        <div className="admin-tools"><label className="admin-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search teams" aria-label="Search teams" /></label><Link className="button button-dark" to="/admin/round3">Round 3 approvals</Link><Link className="button button-dark" to="/admin/round7">Final round approvals</Link><button className="button button-dark" onClick={() => void loadTeams()} disabled={loading}><RotateCcw size={15} /> {loading ? 'Refreshing' : 'Refresh'}</button><button className="button button-dark" onClick={() => { sessionStorage.removeItem('engquest_role'); sessionStorage.removeItem('engquest_admin_username'); sessionStorage.removeItem('engquest_admin_password'); window.location.assign('/') }}>Log out</button></div>
      </div>
      {loadError && <div className="auth-error"><AlertCircle size={18} />{loadError}</div>}
      <div className="admin-table">
        <div className="table-head"><span>TEAM</span><span>ROUND</span><span>STATUS</span><span>LAST ACTIVITY</span><span /></div>
        {visibleTeams.map((team) => (
          <div className="table-row" key={team.id}>
            <strong>{team.name}<small style={{ display: 'block' }}>{team.id} · {team.members.map(member => member.name).join(', ')}</small></strong>
            <span>{team.progress ? `${team.progress % 2 === 0 ? 'Clue' : 'Main'} ${String(team.progress).padStart(2, '0')} / ${eventConfig.rounds[team.progress - 1]?.title || 'Round'}` : 'Registration'}</span>
            <span className="table-status">
              {team.round7ApprovedAt ? 'Winner approved' : team.round7RequestedAt ? 'Final photo review pending' : team.progress === 2 ? 'Round 3 review pending' : team.progress === 3 ? 'Round 3 approved' : team.progress ? 'In progress' : 'Registered'}
            </span>
            <span>{new Date(team.lastActivityAt || team.registeredAt).toLocaleString()}</span>
            <span aria-label={`${team.name} details`}><Eye size={17} /></span>
          </div>
        ))}
        {!visibleTeams.length && <p className="form-help" style={{ padding: 20 }}>{teams.length ? 'No teams match your search.' : 'No teams have registered yet.'}</p>}
      </div>
    </PageIntro>
  )
}

function AdminRound3() {
  const [teams, setTeams] = useState<RegisteredTeam[]>([])
  const [cluePasswords, setCluePasswords] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState('')
  const [approvingTeamId, setApprovingTeamId] = useState('')
  const loadTeams = async () => {
    try {
      const result = await organizerTeams(sessionStorage.getItem('engquest_admin_username') || '', sessionStorage.getItem('engquest_admin_password') || '')
      setTeams(result.teams)
      setLoadError('')
    } catch (cause) {
      setLoadError((cause as Error).message || 'Could not load teams.')
    }
  }
  const approveRound3 = async (teamId: string) => {
    const cluePassword = (cluePasswords[teamId] || '').trim().toUpperCase()
    if (!/^[A-Z0-9]{3}$/.test(cluePassword)) {
      setLoadError('Enter a three-character clue password before approving this team.')
      return
    }
    if (!Object.hasOwn(clueMap, cluePassword)) {
      setLoadError('Use one of the available Round 4 clue codes so the team can open its PDF.')
      return
    }
    setApprovingTeamId(teamId)
    try {
      await organizerApproveRound3(teamId, sessionStorage.getItem('engquest_admin_username') || '', sessionStorage.getItem('engquest_admin_password') || '', cluePassword)
      await loadTeams()
    } catch (cause) {
      setLoadError((cause as Error).message || 'Could not save the Round 3 result.')
    } finally {
      setApprovingTeamId('')
    }
  }
  useEffect(() => {
    if (sessionStorage.getItem('engquest_role') !== 'admin') return
    void loadTeams()
    const interval = window.setInterval(() => void loadTeams(), 15000)
    return () => window.clearInterval(interval)
  }, [])
  if (sessionStorage.getItem('engquest_role') !== 'admin') return <PageIntro eyebrow="Organiser login required" title={<>The control room<br /><i>is restricted.</i></>}><Link className="button button-primary" to="/login?organiser=1">Organiser login <ArrowRight size={17} /></Link></PageIntro>
  const reviewTeams = teams.filter(team => team.progress >= 2)
  return (
    <PageIntro eyebrow="Organiser / Round 3" title={<>Location<br /><i>approvals.</i></>}>
      <div className="admin-bar">
        <div><span className="section-kicker">PHOTO PROOF REVIEW</span><h2>Round 3 results</h2></div>
        <div className="admin-tools">
          <Link className="button button-dark" to="/admin">Team progress</Link>
          <Link className="button button-dark" to="/admin/round7">Final round approvals</Link>
          <button className="button button-dark" onClick={() => { sessionStorage.removeItem('engquest_role'); sessionStorage.removeItem('engquest_admin_username'); sessionStorage.removeItem('engquest_admin_password'); window.location.assign('/') }}>Log out</button>
        </div>
      </div>
      {loadError && <div className="auth-error"><AlertCircle size={18} />{loadError}</div>}
      <div className="admin-table">
        {reviewTeams.map(team => {
          const approved = Boolean(team.round3ApprovedAt) || team.progress >= 3
          const passwordAssigned = Boolean(team.round4CluePassword)
          return <div className="table-row" key={team.id}>
            <strong>{team.name}</strong>
            {approved && passwordAssigned ? <span className="table-status"><Check size={14} /> Approved · Password: <strong style={{ marginLeft: 5, fontFamily: 'DM Mono, monospace' }}>{team.round4CluePassword}</strong></span> : <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input aria-label={`Three-character Round 4 password for ${team.name}`} value={cluePasswords[team.id] || ''} maxLength={3} minLength={3} pattern="[A-Za-z0-9]{3}" placeholder="3-char password" onChange={event => { setCluePasswords(previous => ({ ...previous, [team.id]: event.target.value.toUpperCase() })); setLoadError('') }} />
              <button type="button" className="button button-dark" disabled={approvingTeamId === team.id} onClick={() => void approveRound3(team.id)}>{approvingTeamId === team.id ? 'Saving…' : approved ? 'Save password' : 'Approve & send'}</button>
            </div>}
          </div>
        })}
        {!reviewTeams.length && <p className="form-help" style={{ padding: 20 }}>Teams will appear here after completing Round 2.</p>}
      </div>
    </PageIntro>
  )
}

function AdminRound7() {
  const [teams, setTeams] = useState<RegisteredTeam[]>([])
  const [loadError, setLoadError] = useState('')
  const [approvingTeamId, setApprovingTeamId] = useState('')
  const loadTeams = async () => {
    try {
      const result = await organizerTeams(sessionStorage.getItem('engquest_admin_username') || '', sessionStorage.getItem('engquest_admin_password') || '')
      setTeams(result.teams)
      setLoadError('')
    } catch (cause) {
      setLoadError((cause as Error).message || 'Could not load teams.')
    }
  }
  const approveFinalRound = async (teamId: string) => {
    setApprovingTeamId(teamId)
    try {
      await organizerApproveRound7(teamId, sessionStorage.getItem('engquest_admin_username') || '', sessionStorage.getItem('engquest_admin_password') || '')
      await loadTeams()
    } catch (cause) {
      setLoadError((cause as Error).message || 'Could not approve the final-round result.')
    } finally {
      setApprovingTeamId('')
    }
  }
  useEffect(() => {
    if (sessionStorage.getItem('engquest_role') !== 'admin') return
    void loadTeams()
    const interval = window.setInterval(() => void loadTeams(), 15000)
    return () => window.clearInterval(interval)
  }, [])
  if (sessionStorage.getItem('engquest_role') !== 'admin') return <PageIntro eyebrow="Organiser login required" title={<>The control room<br /><i>is restricted.</i></>}><Link className="button button-primary" to="/login?organiser=1">Organiser login <ArrowRight size={17} /></Link></PageIntro>
  const reviewTeams = teams.filter(team => team.round7RequestedAt || team.round7ApprovedAt)
  return (
    <PageIntro eyebrow="Organiser / Final round" title={<>Treasure photo<br /><i>approvals.</i></>}>
      <div className="admin-bar">
        <div><span className="section-kicker">FINAL PHOTO REVIEW</span><h2>Final round results</h2></div>
        <div className="admin-tools">
          <Link className="button button-dark" to="/admin">Team progress</Link>
          <Link className="button button-dark" to="/admin/round3">Round 3 approvals</Link>
          <button className="button button-dark" onClick={() => { sessionStorage.removeItem('engquest_role'); sessionStorage.removeItem('engquest_admin_username'); sessionStorage.removeItem('engquest_admin_password'); window.location.assign('/') }}>Log out</button>
        </div>
      </div>
      {loadError && <div className="auth-error"><AlertCircle size={18} />{loadError}</div>}
      <div className="admin-table">
        <div className="table-head final-approval-head"><span>TEAM</span><span>PHOTO REVIEW REQUESTED</span><span>RESULT</span><span /></div>
        {reviewTeams.map(team => <div className="table-row final-approval-row" key={team.id}>
          <strong>{team.name}<small style={{ display: 'block' }}>{team.id}</small></strong>
          <span>{team.round7RequestedAt ? new Date(team.round7RequestedAt).toLocaleString() : '—'}</span>
          {team.round7ApprovedAt ? <span className="table-status"><Check size={14} /> Winner approved</span> : <button type="button" className="button button-dark" disabled={approvingTeamId === team.id} onClick={() => void approveFinalRound(team.id)}>{approvingTeamId === team.id ? 'Saving…' : 'Approve winner'}</button>}
        </div>)}
        {!reviewTeams.length && <p className="form-help" style={{ padding: 20 }}>Teams will appear here after requesting final-round photo review.</p>}
      </div>
    </PageIntro>
  )
}

export default App
