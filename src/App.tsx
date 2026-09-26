import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight,
  BookOpen, Camera, Check, Compass, Download, ExternalLink,
  Eye, Fingerprint, KeyRound, LockKeyhole, Menu, Mountain,
  RotateCcw, Search, ShieldCheck, Sparkles, Volume2, VolumeX, X,
} from 'lucide-react'
import { eventConfig } from './config/event.config'
import { validateRound2Credentials, Round2Archive, ROUND1_VALID_CODES } from './config/round2.config'
import { clueMap } from './config/clue.config'
import ClueRound from './ClueRound'
import Round6Clue from './Round6Clue'
import treasureChestImage from '../assetsicons/quest-treasure-chest.png'
import drushyamLogo from '../assetsicons/drushyamlogo.png'
import engquestLogo from '../assetsicons/image.png'
import winnerMusic from '../assetsicons/tunetank-winner-awards-logo-484334.mp3'
import { getEventStatus, organizerApproveRound3, organizerApproveRound7, organizerLogin, organizerRejectRound3, organizerRejectRound7, organizerSetGameOver, organizerSetRound3SlotsFull, organizerRound3Photo, organizerRound7Photo, organizerTeams, registerTeam, requestRound3Review, requestRound7Review, teamLogin } from './api'
import { recordRoundCompletion } from './teamProgress'

type RegisteredTeam = { id: string; name: string; members: { name: string; enrollment: string }[]; progress: number; registeredAt: string; lastActivityAt?: string; round3RequestedAt?: string | null; round3PhotoSubmittedAt?: string | null; round3RejectedAt?: string | null; round3SlotsFull?: boolean; round3ApprovedAt?: string | null; round3PhotoAvailable?: boolean; round4CluePassword?: string | null; round7RequestedAt?: string | null; round7PhotoSubmittedAt?: string | null; round7RejectedAt?: string | null; round7ApprovedAt?: string | null; round7PhotoAvailable?: boolean; gameOver?: boolean }

const fadeUp = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, ease: 'easeOut' as const } }

// ─── App Shell ────────────────────────────────────────────────────────────────

function App() {
  return (
    <div className="app-shell">
      <Header />
      <AnimatePresence mode="wait">
        <Routes><Route path="*" element={<PageRouter />} /></Routes>
      </AnimatePresence>
      <GameOverNotice />
      <Footer />
    </div>
  )
}

function GameOverNotice() {
  const location = useLocation()
  const [visible, setVisible] = useState(false)
  const [countdown, setCountdown] = useState(5)
  useEffect(() => {
    const teamId = sessionStorage.getItem('engquest_team_id')
    const password = sessionStorage.getItem('engquest_team_password')
    if (sessionStorage.getItem('engquest_role') !== 'team' || !teamId || !password) { setVisible(false); return }
    let cancelled = false
    const checkGameStatus = async () => {
      try {
        const result = await teamLogin(teamId, password)
        if (!cancelled) setVisible(Boolean(result.team.gameOver && !result.team.round7ApprovedAt))
      } catch { if (!cancelled) setVisible(false) }
    }
    void checkGameStatus()
    const interval = window.setInterval(() => void checkGameStatus(), 10000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [location.pathname])
  if (!visible) return null
  return createPortal(<GameOverCountdown countdown={countdown} setCountdown={setCountdown} />, document.body)
}

function GameOverCountdown({ countdown, setCountdown }: { countdown: number; setCountdown: React.Dispatch<React.SetStateAction<number>> }) {
  useEffect(() => {
    setCountdown(5)
    const interval = window.setInterval(() => setCountdown(value => Math.max(0, value - 1)), 1000)
    const redirect = window.setTimeout(() => {
      sessionStorage.removeItem('engquest_role')
      sessionStorage.removeItem('engquest_team_id')
      sessionStorage.removeItem('engquest_team_password')
      window.location.assign('/#winners')
    }, 5000)
    return () => { window.clearInterval(interval); window.clearTimeout(redirect) }
  }, [setCountdown])
  return <div className="game-over-overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-title"><div className="game-over-dialog"><span className="section-kicker">ENGQUEST 5.0</span><h2 id="game-over-title">Game over.</h2><p>Thanks for participating. The hunt has ended.</p><p className="game-over-countdown" aria-live="polite">Opening the winners page in <strong>{countdown}</strong>…</p><button className="button button-primary" onClick={() => { sessionStorage.removeItem('engquest_role'); sessionStorage.removeItem('engquest_team_id'); sessionStorage.removeItem('engquest_team_password'); window.location.assign('/#winners') }}>Go to winners page now <ArrowRight size={16} /></button></div></div>
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
        <img className="brand-logo" src={engquestLogo} alt="" />
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
      <div className="brand"><img className="brand-logo" src={engquestLogo} alt="" /><span>ENGQUEST <em>5.0</em></span></div>
      <span>© {new Date().getFullYear()} {eventConfig.organizer}</span>
      <img className="drushyam-logo" src={drushyamLogo} alt="Drushyam Photography and Film Society" />
      <a href="#top" aria-label="Back to top"><ArrowUpRight size={17} /></a>
      <Camera size={17} />
    </footer>
  )
}

// ─── Home ─────────────────────────────────────────────────────────────────────

function Home() {
  const [eventStatus, setEventStatus] = useState<{ gameOver: boolean; winners: { id: string; name: string; approvedAt: string }[] } | null>(null)
  const winnerAudioRef = useRef<HTMLAudioElement>(null)
  const [musicPlaying, setMusicPlaying] = useState(false)
  useEffect(() => {
    let cancelled = false
    const refreshEventStatus = async () => {
      try {
        const status = await getEventStatus()
        if (!cancelled) setEventStatus(status)
      } catch { /* Keep the public home page available if the API is offline. */ }
    }
    void refreshEventStatus()
    const interval = window.setInterval(() => void refreshEventStatus(), 15000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [])
  useEffect(() => {
    if (!eventStatus?.gameOver || window.location.hash !== '#winners') return
    window.requestAnimationFrame(() => document.getElementById('winners')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [eventStatus])
  useEffect(() => {
    if (!eventStatus?.gameOver || !winnerAudioRef.current) return
    void winnerAudioRef.current.play().then(() => setMusicPlaying(true)).catch(() => setMusicPlaying(false))
  }, [eventStatus?.gameOver])
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
      {eventStatus?.gameOver && <section id="winners" className="winner-announcement section-shell" aria-labelledby="winner-announcement-title">
        <span className="section-kicker">ENGQUEST 5.0 / FINAL RESULTS</span>
        <h2 id="winner-announcement-title">Congratulations<br /><i>to our winners.</i></h2>
        {eventStatus.winners.length ? <div className="winner-announcement-teams">{eventStatus.winners.map(team => <div className="winner-announcement-team" key={team.id}><Sparkles size={22} /><strong>{team.name}</strong><span>{team.id}</span></div>)}</div> : <p className="winner-announcement-pending">The final results are being confirmed.</p>}
        <p className="winner-announcement-thanks">Thank you to every team who joined the hunt, followed the clues, and made ENGQUEST 5.0 memorable.</p>
        <audio ref={winnerAudioRef} src={winnerMusic} preload="auto" onEnded={() => setMusicPlaying(false)} />
        <button className="button button-dark winner-music-toggle" type="button" onClick={() => { const audio = winnerAudioRef.current; if (!audio) return; if (audio.paused) void audio.play().then(() => setMusicPlaying(true)).catch(() => setMusicPlaying(false)); else { audio.pause(); setMusicPlaying(false) } }}>{musicPlaying ? <><VolumeX size={16} /> Pause winners music</> : <><Volume2 size={16} /> Play winners music</>}</button>
      </section>}
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
        <QuestProgress treasureChestImage={treasureChestImage} />
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
        <span className="section-kicker">YOUR QUEST MAP</span>
        <button className="button button-dark" onClick={() => { sessionStorage.removeItem('engquest_role'); sessionStorage.removeItem('engquest_team_id'); sessionStorage.removeItem('engquest_team_password'); navigate('/') }}>Log out <ArrowUpRight size={16} /></button>
      </div>
      <QuestProgress team={team} treasureChestImage={treasureChestImage} />
    </PageIntro>
  )
}

function QuestProgress({ team, treasureChestImage }: { team?: RegisteredTeam; treasureChestImage: string }) {
  const progress = Math.min(team?.progress || 0, eventConfig.rounds.length)
  const progressPercent = Math.round((progress / eventConfig.rounds.length) * 100)
  const statusForRound = (roundNumber: number) => {
    if (roundNumber <= progress) return 'CLEARED'
    if (roundNumber === 3 && progress === 2) return 'ORGANISER REVIEW'
    if (roundNumber === 7 && team?.round7RequestedAt && !team.round7ApprovedAt) return 'ORGANISER REVIEW'
    if (roundNumber === progress + 1) return team ? 'CURRENT STAGE' : 'START HERE'
    return 'UP AHEAD'
  }

  return <section className={`quest-progress-board${team ? '' : ' quest-public-board'}`} aria-label="Quest progress">
    <div className={`quest-progress-overview${team ? '' : ' quest-public-overview'}`}>
      {team && <div>
        <span className="section-kicker">YOUR QUEST PROGRESS</span>
        <div className="quest-progress-count"><strong>{String(progress).padStart(2, '0')}</strong><span> / 07 stages cleared</span></div>
      </div>}
      <div className="quest-category-counts" aria-label="4 challenges and 3 clues">
        <span className="challenge-count"><i /> 04 <small>CHALLENGES</small></span>
        <span className="clue-count"><i /> 03 <small>CLUES</small></span>
      </div>
    </div>
    {team && <div className="quest-progress-meter" role="progressbar" aria-label="Quest completion" aria-valuemin={0} aria-valuemax={7} aria-valuenow={progress}>
      <span style={{ width: `${progressPercent}%` }} />
    </div>}
    <div className="quest-route">
    <div className="quest-route-rail" aria-hidden="true"><span style={{ height: `${progressPercent}%` }} /></div>
    <ol className="quest-route-list">
      {eventConfig.rounds.map((round, index) => {
        const roundNumber = index + 1
        const isClue = roundNumber % 2 === 0
        const status = statusForRound(roundNumber)
        const completed = roundNumber <= progress
        return <li className={`quest-route-stop ${isClue ? 'clue-stop' : 'challenge-stop'} ${completed ? 'is-cleared' : ''} ${status === 'CURRENT STAGE' ? 'is-current' : ''} ${status === 'ORGANISER REVIEW' ? 'is-review' : ''}`} key={round.number}>
          <span className="quest-route-marker" aria-hidden="true">{completed ? <Check size={15} /> : String(roundNumber).padStart(2, '0')}</span>
          <Link className="quest-route-card" to={`/round/${roundNumber}`} aria-label={`Open ${isClue ? 'clue' : 'challenge'} ${roundNumber}: ${round.title}`}>
            <div className="quest-card-kicker"><span>{round.number}</span><small>{isClue ? 'CLUE' : 'CHALLENGE'}</small></div>
            <div className="quest-card-main">
              <div><h3>{round.title}</h3><p>{round.description}</p></div>
              {roundNumber === 7 && <img className="quest-chest-art" src={treasureChestImage} alt="Treasure chest" loading="lazy" decoding="async" />}
            </div>
            <div className="quest-card-footer"><span>{status}</span><ArrowRight size={16} /></div>
          </Link>
        </li>
      })}
    </ol>
    </div>
  </section>
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
                <p>Find the correct location and submit your photo proof, then request an organiser review below. You can continue after approval.</p>
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
  const [requestedAt, setRequestedAt] = useState<string | null>(null)
  const [rejectedAt, setRejectedAt] = useState<string | null>(null)
  const [slotsFull, setSlotsFull] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
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
          setRequestedAt(result.team.round3RequestedAt || null)
          setRejectedAt(result.team.round3RejectedAt || null)
          setSlotsFull(Boolean(result.team.round3SlotsFull))
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

  const submitReviewRequest = async () => {
    const teamId = sessionStorage.getItem('engquest_team_id')
    const password = sessionStorage.getItem('engquest_team_password')
    if (!teamId || !password) { setStatusError('Team login is required to request review.'); return }
    if (!photo) { setStatusError('Choose a location photo before requesting review.'); return }
    if (!photo.type.startsWith('image/')) { setStatusError('Choose an image file.'); return }
    if (photo.size > 20 * 1024 * 1024) { setStatusError('Photo must be 20 MB or smaller.'); return }
    setRequesting(true)
    setStatusError('')
    try {
      const result = await requestRound3Review(teamId, password, photo)
      setRequestedAt(result.requestedAt)
      setRejectedAt(null)
      setPhoto(null)
      setPhotoPreview('')
    } catch (cause) {
      setStatusError((cause as Error).message || 'Could not request Round 3 review.')
    } finally {
      setRequesting(false)
    }
  }

  const refreshButton = <button type="button" className="button button-dark" aria-label="Refresh Round 3 approval status" onClick={() => { setRefreshing(true); setRefreshToken(value => value + 1) }} disabled={refreshing}><RotateCcw size={15} /> {refreshing ? 'Checking…' : 'Refresh status'}</button>
  if (!approvedAt && slotsFull) return <div role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginTop: '8px', flexWrap: 'wrap' }}><strong>You’re eliminated. The 10 slots for the next round are full.</strong>{refreshButton}</div>
  if (!approvedAt) return <div role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginTop: '8px', flexWrap: 'wrap' }}>
    <div style={{ flex: '1 1 260px' }}>
      <p className="form-help" style={{ margin: 0 }}>{statusError || (rejectedAt ? 'Your location was not approved. Find the correct location, submit a new photo proof, then request another review.' : requestedAt ? 'Your Round 3 review is waiting for the organiser.' : 'Find the correct location and submit your photo proof, then request an organiser review.')}</p>
      {(!requestedAt || rejectedAt) && <label className="round3-photo-upload"><span>{rejectedAt ? 'Upload a new location photo' : 'Upload location photo'} <small>JPG, PNG, or WEBP · up to 20 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const selected = event.target.files?.[0] || null; setPhoto(selected); setPhotoPreview(selected ? URL.createObjectURL(selected) : ''); setStatusError('') }} /></label>}
      {photoPreview && (!requestedAt || rejectedAt) && <img className="round3-photo-preview" src={photoPreview} alt="Selected location photo preview" />}
    </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {(!requestedAt || rejectedAt) && <button type="button" className="button button-primary" onClick={() => void submitReviewRequest()} disabled={requesting || !photo}>{requesting ? 'Sending…' : rejectedAt ? 'Submit photo & request review' : 'Submit photo & request review'} <ArrowRight size={15} /></button>}
      {refreshButton}
    </div>
  </div>
  return <div role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 16px', border: '1px solid #aab2a4', marginTop: '8px', flexWrap: 'wrap' }}>
    <span className="section-kicker">ROUND 3 RESULT</span><strong style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#607b57' }}><Check size={16} /> APPROVED</strong>
    <span>Round 4 clue password: <strong style={{ fontFamily: 'DM Mono, monospace', letterSpacing: '.15em' }}>{cluePassword || 'Awaiting organiser password'}</strong></span><Link className="button button-primary" to="/round/4">Continue to Round 4 <ArrowRight size={16} /></Link>{refreshButton}
  </div>
}

function Round7Challenge() {
  const celebrationRef = useRef<HTMLDivElement>(null)
  const hasShownCelebration = useRef(false)
  const [requestedAt, setRequestedAt] = useState<string | null>(null)
  const [rejectedAt, setRejectedAt] = useState<string | null>(null)
  const [approvedAt, setApprovedAt] = useState<string | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')

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
          setRejectedAt(result.team.round7RejectedAt || null)
          const approval = result.team.round7ApprovedAt || null
          setApprovedAt(approval)
          if (approval && !hasShownCelebration.current) {
            hasShownCelebration.current = true
            setShowCelebration(true)
          }
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

  useEffect(() => {
    if (!showCelebration || !celebrationRef.current) return
    let cancelled = false
    let animation: import('lottie-web').AnimationItem | undefined
    let timer: number | undefined
    const dismiss = () => setShowCelebration(false)
    void Promise.all([
      import('lottie-web'),
      import('../assetsicons/Chinese treasure chest open and shine.json'),
    ]).then(([lottieModule, animationModule]) => {
      if (cancelled || !celebrationRef.current) return
      const loadedAnimation = lottieModule.default.loadAnimation({
        container: celebrationRef.current,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        animationData: animationModule.default,
      })
      animation = loadedAnimation
      loadedAnimation.addEventListener('complete', dismiss)
      timer = window.setTimeout(dismiss, 4200)
    }).catch(() => setShowCelebration(false))
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
      animation?.destroy()
    }
  }, [showCelebration])

  const submitForReview = async () => {
    const teamId = sessionStorage.getItem('engquest_team_id')
    const password = sessionStorage.getItem('engquest_team_password')
    if (!teamId || !password) { setError('Team login is required to request approval.'); return }
    if (!photo) { setError('Choose a treasure photo before requesting review.'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) { setError('Choose a JPG, PNG, or WEBP photo.'); return }
    if (photo.size > 20 * 1024 * 1024) { setError('Photo must be 20 MB or smaller.'); return }
    setSaving(true)
    setError('')
    try {
      const result = await requestRound7Review(teamId, password, photo)
      setRequestedAt(result.requestedAt)
      setRejectedAt(null)
      setPhoto(null)
      setPhotoPreview('')
    } catch (cause) {
      setError((cause as Error).message || 'Could not request final-round approval.')
    } finally {
      setSaving(false)
    }
  }

  const refreshButton = <button type="button" className="button button-dark" aria-label="Refresh final-round approval status" onClick={() => { setRefreshing(true); setRefreshToken(value => value + 1) }} disabled={refreshing}><RotateCcw size={15} /> {refreshing ? 'Checking…' : 'Refresh status'}</button>

  if (approvedAt) return <>
    <div className="final-panel winner-panel" role="status">
      <Sparkles size={31} />
      <span className="section-kicker">FINAL ROUND / APPROVED</span>
      <h2>You found<br /><i>the treasure.</i></h2>
      <p>You’re the winner! The organisers approved your final-round photo.</p>
      <img className="quest-chest-art winner-treasure-chest" src={treasureChestImage} alt="" />
      <div className="winner-refresh">{refreshButton}</div>
    </div>
    {showCelebration && createPortal(<div className="treasure-celebration" role="presentation"><div className="treasure-celebration-animation" ref={celebrationRef} /></div>, document.body)}
  </>

  return <div className="challenge-box final-round-challenge">
    <span className="section-kicker">THE FINAL QUEST</span>
    <h3>Found the treasure?</h3>
    <p>{rejectedAt ? 'The organiser could not approve this treasure photo. Find the right treasure, upload a new photo, and send it for review again.' : 'Upload a photo of your team with the treasure, then request organiser approval. Your result will appear here after review.'}</p>
    {requestedAt ? <p className="form-help" role="status">Photo review requested. Waiting for organiser approval.</p> : <>
      <label className="round3-photo-upload"><span>{rejectedAt ? 'Upload a new treasure photo' : 'Upload treasure photo'} <small>JPG, PNG, or WEBP · up to 20 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const selected = event.target.files?.[0] || null; setPhoto(selected); setPhotoPreview(selected ? URL.createObjectURL(selected) : ''); setError('') }} /></label>
      {photoPreview && <img className="round3-photo-preview" src={photoPreview} alt="Selected final-round treasure photo preview" />}
      <button className="button button-primary" type="button" style={{ marginTop: 12 }} disabled={!photo || saving} onClick={() => void submitForReview()}>{saving ? 'Sending request…' : 'Submit photo & request review'} <ArrowRight size={16} /></button>
    </>}
    <div style={{ marginTop: 12 }}>{refreshButton}</div>
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
        <div className="table-head team-progress-head"><span>TEAM</span><span>ROUND</span><span>STATUS</span><span>ROUND 3 PHOTO SUBMITTED</span><span>LAST ACTIVITY</span><span /></div>
        {visibleTeams.map((team) => (
          <div className="table-row team-progress-row" key={team.id}>
            <strong>{team.name}<small style={{ display: 'block' }}>{team.id} · {team.members.map(member => member.name).join(', ')}</small></strong>
            <span>{team.progress ? `${team.progress % 2 === 0 ? 'Clue' : 'Main'} ${String(team.progress).padStart(2, '0')} / ${eventConfig.rounds[team.progress - 1]?.title || 'Round'}` : 'Registration'}</span>
            <span className="table-status">
              {team.round7ApprovedAt ? 'Winner approved' : team.round7RequestedAt ? 'Final photo review pending' : team.progress === 2 ? 'Round 3 review pending' : team.progress === 3 ? 'Round 3 approved' : team.progress ? 'In progress' : 'Registered'}
            </span>
            <span>{(team.round3PhotoSubmittedAt || team.round3RequestedAt) ? new Date(team.round3PhotoSubmittedAt || team.round3RequestedAt!).toLocaleString() : '—'}</span>
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
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const photoUrlsRef = useRef<Record<string, string>>({})
  const photoRequestKeys = useRef<Record<string, string>>({})
  const [cluePasswords, setCluePasswords] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState('')
  const [approvingTeamId, setApprovingTeamId] = useState('')
  const [slotsFull, setSlotsFull] = useState(false)
  const loadTeams = async () => {
    try {
      const result = await organizerTeams(sessionStorage.getItem('engquest_admin_username') || '', sessionStorage.getItem('engquest_admin_password') || '')
      setTeams(result.teams)
      setSlotsFull(Boolean(result.round3SlotsFull))
      setLoadError('')
      const pending = result.teams.filter(team => team.round3RequestedAt && !team.round3RejectedAt && !team.round3ApprovedAt && team.round3PhotoAvailable)
      const pendingIds = new Set(pending.map(team => team.id))
      for (const [teamId, url] of Object.entries(photoUrlsRef.current)) {
        if (!pendingIds.has(teamId)) {
          URL.revokeObjectURL(url)
          delete photoUrlsRef.current[teamId]
          delete photoRequestKeys.current[teamId]
        }
      }
      setPhotoUrls({ ...photoUrlsRef.current })
      const username = sessionStorage.getItem('engquest_admin_username') || ''
      const password = sessionStorage.getItem('engquest_admin_password') || ''
      await Promise.all(pending.map(async team => {
        const requestKey = `${team.round3RequestedAt}:${team.lastActivityAt}`
        if (photoRequestKeys.current[team.id] === requestKey && photoUrlsRef.current[team.id]) return
        try {
          const blob = await organizerRound3Photo(team.id, username, password)
          const oldUrl = photoUrlsRef.current[team.id]
          if (oldUrl) URL.revokeObjectURL(oldUrl)
          photoUrlsRef.current[team.id] = URL.createObjectURL(blob)
          photoRequestKeys.current[team.id] = requestKey
          setPhotoUrls({ ...photoUrlsRef.current })
        } catch (cause) {
          setLoadError((cause as Error).message || `Could not load ${team.name}'s location photo.`)
        }
      }))
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
  const rejectRound3 = async (teamId: string) => {
    setApprovingTeamId(teamId)
    setLoadError('')
    try {
      await organizerRejectRound3(teamId, sessionStorage.getItem('engquest_admin_username') || '', sessionStorage.getItem('engquest_admin_password') || '')
      await loadTeams()
    } catch (cause) {
      setLoadError((cause as Error).message || 'Could not return the team to Round 3.')
    } finally {
      setApprovingTeamId('')
    }
  }
  const toggleSlotsFull = async () => {
    const nextValue = !slotsFull
    setApprovingTeamId('slots')
    setLoadError('')
    try {
      const result = await organizerSetRound3SlotsFull(nextValue, sessionStorage.getItem('engquest_admin_username') || '', sessionStorage.getItem('engquest_admin_password') || '')
      setSlotsFull(result.full)
    } catch (cause) {
      setLoadError((cause as Error).message || 'Could not update next-round slot status.')
    } finally {
      setApprovingTeamId('')
    }
  }
  useEffect(() => {
    if (sessionStorage.getItem('engquest_role') !== 'admin') return
    void loadTeams()
    const interval = window.setInterval(() => void loadTeams(), 15000)
    return () => {
      window.clearInterval(interval)
      Object.values(photoUrlsRef.current).forEach(URL.revokeObjectURL)
      photoUrlsRef.current = {}
    }
  }, [])
  if (sessionStorage.getItem('engquest_role') !== 'admin') return <PageIntro eyebrow="Organiser login required" title={<>The control room<br /><i>is restricted.</i></>}><Link className="button button-primary" to="/login?organiser=1">Organiser login <ArrowRight size={17} /></Link></PageIntro>
  const reviewTeams = teams.filter(team => team.progress === 2 && !team.round3ApprovedAt && !team.round3RejectedAt)
  return (
    <PageIntro eyebrow="Organiser / Round 3" title={<>Location<br /><i>approvals.</i></>}>
      <div className="admin-bar">
        <div><span className="section-kicker">PHOTO PROOF REVIEW</span><h2>Round 3 results</h2></div>
        <div className="admin-tools">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><span>{slotsFull ? 'Next-round slots full' : 'Next-round slots open'}</span><button type="button" role="switch" aria-checked={slotsFull} aria-label="Toggle whether the 10 next-round slots are full" disabled={approvingTeamId === 'slots'} onClick={() => void toggleSlotsFull()} style={{ width: 48, height: 27, border: 0, borderRadius: 99, padding: 3, background: slotsFull ? '#a5b85f' : '#718073', cursor: 'pointer' }}><span style={{ display: 'block', width: 21, height: 21, borderRadius: '50%', background: '#fffdf1', transform: slotsFull ? 'translateX(21px)' : 'translateX(0)', transition: 'transform .18s' }} /></button></div>
          <Link className="button button-dark" to="/admin">Team progress</Link>
          <Link className="button button-dark" to="/admin/round7">Final round approvals</Link>
          <button className="button button-dark" onClick={() => { sessionStorage.removeItem('engquest_role'); sessionStorage.removeItem('engquest_admin_username'); sessionStorage.removeItem('engquest_admin_password'); window.location.assign('/') }}>Log out</button>
        </div>
      </div>
      {loadError && <div className="auth-error"><AlertCircle size={18} />{loadError}</div>}
      <div className="admin-table">
        {reviewTeams.map(team => {
          return <div className="table-row round3-review-row" key={team.id}>
            <strong>{team.name}<small style={{ display: 'block' }}>{team.id}{team.round3RequestedAt ? ` · Review requested ${new Date(team.round3RequestedAt).toLocaleString()}` : ' · Awaiting team review request'}</small>{team.round3PhotoAvailable && photoUrls[team.id] ? <a href={photoUrls[team.id]} target="_blank" rel="noopener noreferrer"><img className="round3-review-photo" src={photoUrls[team.id]} alt={`${team.name} Round 3 location proof`} /></a> : team.round3RequestedAt ? <small>Loading location photo…</small> : null}</strong>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input aria-label={`Three-character Round 4 password for ${team.name}`} value={cluePasswords[team.id] || ''} maxLength={3} minLength={3} pattern="[A-Za-z0-9]{3}" placeholder="3-char password" onChange={event => { setCluePasswords(previous => ({ ...previous, [team.id]: event.target.value.toUpperCase() })); setLoadError('') }} />
              <button type="button" className="button button-dark" disabled={approvingTeamId === team.id} onClick={() => void approveRound3(team.id)}>{approvingTeamId === team.id ? 'Saving…' : 'Approve & send'}</button>
              <button type="button" className="button button-light" disabled={approvingTeamId === team.id} onClick={() => void rejectRound3(team.id)}>{approvingTeamId === team.id ? 'Saving…' : 'Not approve'}</button>
            </div>
          </div>
        })}
        {!reviewTeams.length && <p className="form-help" style={{ padding: 20 }}>Teams who complete Round 2 will appear here for location review. After a rejection, they return here when they submit a new review request.</p>}
      </div>
    </PageIntro>
  )
}

function AdminRound7() {
  const [teams, setTeams] = useState<RegisteredTeam[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const photoUrlsRef = useRef<Record<string, string>>({})
  const photoRequestKeys = useRef<Record<string, string>>({})
  const [loadError, setLoadError] = useState('')
  const [approvingTeamId, setApprovingTeamId] = useState('')
  const [gameOver, setGameOver] = useState(false)
  const loadTeams = async () => {
    try {
      const result = await organizerTeams(sessionStorage.getItem('engquest_admin_username') || '', sessionStorage.getItem('engquest_admin_password') || '')
      setTeams(result.teams)
      setGameOver(Boolean(result.gameOver))
      setLoadError('')
      const pending = result.teams.filter(team => (team.round7RequestedAt || team.round7ApprovedAt) && team.round7PhotoAvailable)
      const pendingIds = new Set(pending.map(team => team.id))
      for (const [teamId, url] of Object.entries(photoUrlsRef.current)) {
        if (!pendingIds.has(teamId)) {
          URL.revokeObjectURL(url)
          delete photoUrlsRef.current[teamId]
          delete photoRequestKeys.current[teamId]
        }
      }
      setPhotoUrls({ ...photoUrlsRef.current })
      const username = sessionStorage.getItem('engquest_admin_username') || ''
      const password = sessionStorage.getItem('engquest_admin_password') || ''
      await Promise.all(pending.map(async team => {
        const requestKey = `${team.round7RequestedAt}:${team.round7PhotoSubmittedAt}`
        if (photoRequestKeys.current[team.id] === requestKey && photoUrlsRef.current[team.id]) return
        try {
          const blob = await organizerRound7Photo(team.id, username, password)
          if (photoUrlsRef.current[team.id]) URL.revokeObjectURL(photoUrlsRef.current[team.id])
          photoUrlsRef.current[team.id] = URL.createObjectURL(blob)
          photoRequestKeys.current[team.id] = requestKey
          setPhotoUrls({ ...photoUrlsRef.current })
        } catch (cause) {
          setLoadError((cause as Error).message || `Could not load ${team.name}'s final-round photo.`)
        }
      }))
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
  const rejectFinalRound = async (teamId: string) => {
    setApprovingTeamId(teamId)
    setLoadError('')
    try {
      await organizerRejectRound7(teamId, sessionStorage.getItem('engquest_admin_username') || '', sessionStorage.getItem('engquest_admin_password') || '')
      await loadTeams()
    } catch (cause) {
      setLoadError((cause as Error).message || 'Could not return the team to the final round.')
    } finally {
      setApprovingTeamId('')
    }
  }
  const toggleGameOver = async () => {
    const nextValue = !gameOver
    setApprovingTeamId('game-over')
    setLoadError('')
    try {
      const result = await organizerSetGameOver(nextValue, sessionStorage.getItem('engquest_admin_username') || '', sessionStorage.getItem('engquest_admin_password') || '')
      setGameOver(result.gameOver)
    } catch (cause) {
      setLoadError((cause as Error).message || 'Could not update game status.')
    } finally {
      setApprovingTeamId('')
    }
  }
  useEffect(() => {
    if (sessionStorage.getItem('engquest_role') !== 'admin') return
    void loadTeams()
    const interval = window.setInterval(() => void loadTeams(), 15000)
    return () => {
      window.clearInterval(interval)
      Object.values(photoUrlsRef.current).forEach(URL.revokeObjectURL)
      photoUrlsRef.current = {}
    }
  }, [])
  if (sessionStorage.getItem('engquest_role') !== 'admin') return <PageIntro eyebrow="Organiser login required" title={<>The control room<br /><i>is restricted.</i></>}><Link className="button button-primary" to="/login?organiser=1">Organiser login <ArrowRight size={17} /></Link></PageIntro>
  const reviewTeams = teams.filter(team => team.round7RequestedAt || team.round7ApprovedAt)
  return (
    <PageIntro eyebrow="Organiser / Final round" title={<>Treasure photo<br /><i>approvals.</i></>}>
      <div className="admin-bar">
        <div><span className="section-kicker">FINAL PHOTO REVIEW</span><h2>Final round results</h2></div>
        <div className="admin-tools">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><span>{gameOver ? 'Game over' : 'Game in progress'}</span><button type="button" role="switch" aria-checked={gameOver} aria-label="Toggle game over for teams without winner approval" disabled={approvingTeamId === 'game-over'} onClick={() => void toggleGameOver()} style={{ width: 48, height: 27, border: 0, borderRadius: 99, padding: 3, background: gameOver ? '#a5b85f' : '#718073', cursor: 'pointer' }}><span style={{ display: 'block', width: 21, height: 21, borderRadius: '50%', background: '#fffdf1', transform: gameOver ? 'translateX(21px)' : 'translateX(0)', transition: 'transform .18s' }} /></button></div>
          <Link className="button button-dark" to="/admin">Team progress</Link>
          <Link className="button button-dark" to="/admin/round3">Round 3 approvals</Link>
          <button className="button button-dark" onClick={() => { sessionStorage.removeItem('engquest_role'); sessionStorage.removeItem('engquest_admin_username'); sessionStorage.removeItem('engquest_admin_password'); window.location.assign('/') }}>Log out</button>
        </div>
      </div>
      {loadError && <div className="auth-error"><AlertCircle size={18} />{loadError}</div>}
      <div className="admin-table">
        <div className="table-head final-approval-head"><span>TEAM / PHOTO PROOF</span><span>PHOTO REVIEW REQUESTED</span><span>RESULT</span><span /></div>
        {reviewTeams.map(team => <div className="table-row final-approval-row" key={team.id}>
          <strong>{team.name}<small style={{ display: 'block' }}>{team.id}</small>{team.round7PhotoAvailable && photoUrls[team.id] ? <a href={photoUrls[team.id]} target="_blank" rel="noopener noreferrer"><img className="round3-review-photo" src={photoUrls[team.id]} alt={`${team.name} final-round treasure proof`} /></a> : team.round7RequestedAt ? <small>Loading treasure photo…</small> : null}</strong>
          <span>{team.round7RequestedAt ? new Date(team.round7RequestedAt).toLocaleString() : '—'}</span>
          {team.round7ApprovedAt ? <span className="table-status"><Check size={14} /> Winner approved</span> : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" className="button button-dark" disabled={approvingTeamId === team.id} onClick={() => void approveFinalRound(team.id)}>{approvingTeamId === team.id ? 'Saving…' : 'Approve winner'}</button><button type="button" className="button button-light" disabled={approvingTeamId === team.id} onClick={() => void rejectFinalRound(team.id)}>{approvingTeamId === team.id ? 'Saving…' : 'Not approve'}</button></div>}
        </div>)}
        {!reviewTeams.length && <p className="form-help" style={{ padding: 20 }}>Teams will appear here after requesting final-round photo review.</p>}
      </div>
    </PageIntro>
  )
}

export default App
