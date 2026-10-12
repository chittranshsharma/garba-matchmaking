import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Session } from '@supabase/supabase-js'
import { configured, formatDistance, getGpsCoords, INDIA_STATES, photoUrl, supabase, type IndiaState, type Match, type Message, type Profile } from './lib'
import ProfileEditor from './ProfileEditor'
import Landing from './Landing'
import { MotionProvider } from './Motion'
import MotionScene from './MotionScene'
import DiscoverEmpty from './DiscoverEmpty'
import AgeRange from './AgeRange'
import './style.css'
import './festival.css'
import './motion.css'
import './wizard.css'
import './discover.css'
import './mobile.css'
import './likes.css'

type Candidate = Omit<Profile, 'birth_date' | 'interested_in'> & { age: number, distance_km?: number | null }
type IncomingLike = Candidate & { liked_at: string }
type View = 'discover' | 'matches' | 'profile'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('discover')
  const [matches, setMatches] = useState<Match[]>([])
  const [likes, setLikes] = useState<IncomingLike[]>([])
  const [likesLoading, setLikesLoading] = useState(false)
  const [selectedLike, setSelectedLike] = useState<IncomingLike | null>(null)
  const [likeAction, setLikeAction] = useState(false)
  const [activeMatch, setActiveMatch] = useState<Match | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [filters, setFilters] = useState<{ min: number, max: number, state: IndiaState | '' }>({ min: 18, max: 60, state: '' })
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [matchReveal, setMatchReveal] = useState<Candidate | null>(null)
  const [swipeMotion, setSwipeMotion] = useState<'left' | 'right' | ''>('')
  const [refreshing, setRefreshing] = useState(false)
  const [discoverLoading, setDiscoverLoading] = useState(true)
  const [userCoords, setUserCoords] = useState<{ lat: number, lng: number } | null>(null)
  const swipePending = React.useRef(false)
  const candidateRequest = React.useRef(0)

  // Grab GPS coords once on mount for distance-based sorting
  useEffect(() => {
    getGpsCoords().then(coords => { if (coords) setUserCoords(coords) })
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedFilters(filters), 350)
    return () => window.clearTimeout(timer)
  }, [filters])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session)).finally(() => setLoading(false))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session || !supabase) { setProfile(null); return }
    let live = true
    setLoading(true)
    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle().then(({ data, error: e }) => {
      if (!live) return
      if (e) setError(e.message)
      setProfile(data as Profile | null)
      setLoading(false)
    })
    return () => { live = false }
  }, [session?.user.id])

  async function loadCandidates() {
    if (!supabase) return
    const request = ++candidateRequest.current
    setDiscoverLoading(true)
    try {
      const coords = userCoords || (profile?.lat && profile?.lng ? { lat: profile.lat, lng: profile.lng } : null)
      const { data, error: e } = await supabase.rpc('discover_profiles_v2', {
        p_min_age: appliedFilters.min,
        p_max_age: appliedFilters.max,
        p_state: appliedFilters.state || null,
        p_lat: coords?.lat ?? null,
        p_lng: coords?.lng ?? null,
      })
      if (e) { if (request === candidateRequest.current) setError(e.message); return }
      const people = data as Candidate[]
      const paths = [...new Set(people.flatMap(person => person.photo_paths?.length ? person.photo_paths : person.photo_path ? [person.photo_path] : []))]
      const { data: signed, error: photoError } = paths.length
        ? await supabase.storage.from('profile-photos').createSignedUrls(paths, 3600)
        : { data: [], error: null }
      if (photoError) console.warn('Could not load profile photos', photoError)
      const urls = new Map(signed?.filter(item => item.path && item.signedUrl).map(item => [item.path!, item.signedUrl!]) || [])
      const withPhotos = people.map(person => ({ ...person, photo_urls: (person.photo_paths?.length ? person.photo_paths : person.photo_path ? [person.photo_path] : []).map(path => urls.get(path)).filter((url): url is string => Boolean(url)) }))
      if (request === candidateRequest.current) setCandidates(withPhotos)
    } finally { if (request === candidateRequest.current) setDiscoverLoading(false) }
  }

  async function refreshCandidates() {
    setRefreshing(true)
    try { await loadCandidates() }
    finally { setRefreshing(false) }
  }

  async function loadMatches() {
    if (!supabase) return
    const { data, error: e } = await supabase.rpc('my_matches')
    if (e) { setError(e.message); return }
    setMatches(await Promise.all((data as Match[]).map(async match => ({ ...match, other_photo_url: await photoUrl(match.other_photo_path) }))))
  }

  async function loadLikes() {
    if (!supabase) return
    setLikesLoading(true)
    try {
      const { data, error: e } = await supabase.rpc('my_likes')
      if (e) { setError(e.message); return }
      const people = data as IncomingLike[]
      const paths = [...new Set(people.flatMap(person => person.photo_paths?.length ? person.photo_paths : person.photo_path ? [person.photo_path] : []))]
      const { data: signed, error: photoError } = paths.length
        ? await supabase.storage.from('profile-photos').createSignedUrls(paths, 3600)
        : { data: [], error: null }
      if (photoError) console.warn('Could not load incoming like photos', photoError)
      const urls = new Map(signed?.filter(item => item.path && item.signedUrl).map(item => [item.path!, item.signedUrl!]) || [])
      setLikes(people.map(person => ({ ...person, photo_urls: (person.photo_paths?.length ? person.photo_paths : person.photo_path ? [person.photo_path] : []).map(path => urls.get(path)).filter((url): url is string => Boolean(url)) })))
    } finally { setLikesLoading(false) }
  }

  useEffect(() => { if (profile) void loadCandidates() }, [profile?.id, profile?.gender, profile?.interested_in?.join(','), appliedFilters.min, appliedFilters.max, appliedFilters.state, userCoords?.lat])
  useEffect(() => { if (profile && view === 'matches') { void loadMatches(); void loadLikes() } }, [profile?.id, view])
  useEffect(() => {
    const nextPhoto = candidates[1]?.photo_urls?.[0]
    if (nextPhoto) { const image = new Image(); image.fetchPriority = 'low'; image.src = nextPhoto }
  }, [candidates])

  async function swipe(person: Candidate, liked: boolean) {
    if (!supabase || swipePending.current) return
    swipePending.current = true
    setError('')
    const { data, error: e } = await supabase.rpc('swipe_profile', { p_target: person.id, p_liked: liked })
    if (e) { swipePending.current = false; setError(e.message); return }
    setSwipeMotion(liked ? 'right' : 'left')
    await new Promise(resolve => window.setTimeout(resolve, 380))
    setCandidates(current => current.filter(candidate => candidate.id !== person.id))
    setSwipeMotion('')
    swipePending.current = false
    if (data) { setMatchReveal(person); void loadMatches() }
  }

  async function respondToLike(person: IncomingLike, liked: boolean) {
    if (!supabase || likeAction) return
    setLikeAction(true)
    setError('')
    try {
      const { data, error: e } = await supabase.rpc('swipe_profile', { p_target: person.id, p_liked: liked })
      if (e) { setError(e.message); return }
      setLikes(current => current.filter(like => like.id !== person.id))
      setCandidates(current => current.filter(candidate => candidate.id !== person.id))
      setSelectedLike(null)
      if (data) { setMatchReveal(person); void loadMatches() }
    } finally { setLikeAction(false) }
  }

  async function deleteProfile() {
    if (!supabase || !session) throw new Error('Sign in again to delete your profile.')
    const userId = session.user.id
    const bucket = supabase.storage.from('profile-photos')
    const { data: files, error: listError } = await bucket.list(userId, { limit: 1000 })
    if (listError) throw listError
    const paths = (files || []).filter(file => file.id).map(file => `${userId}/${file.name}`)
    if (paths.length) {
      const { error: removeError } = await bucket.remove(paths)
      if (removeError) throw removeError
    }
    const { data, error: deleteError } = await supabase.from('profiles').delete().eq('id', userId).select('id')
    if (deleteError) throw deleteError
    if (!data?.length) throw new Error('Could not delete your profile. Please try again.')
    setProfile(null)
    setMatches([])
    setLikes([])
    setActiveMatch(null)
    await supabase.auth.signOut()
  }

  async function block(otherId: string) {
    if (!supabase || !session || !window.confirm('Block this person? You will no longer see or message each other.')) return
    const { error: e } = await supabase.from('blocks').insert({ blocker_id: session.user.id, blocked_id: otherId })
    if (e) { setError(e.message); return }
    setActiveMatch(null)
    setMatches(current => current.filter(match => match.other_id !== otherId))
    setCandidates(current => current.filter(person => person.id !== otherId))
  }

  async function report(otherId: string) {
    if (!supabase || !session) return
    const reason = window.prompt('What happened? Your report is private.')?.trim()
    if (!reason) return
    if (reason.length < 5) { setError('Please add a little more detail to your report.'); return }
    const { error: e } = await supabase.from('reports').insert({ reporter_id: session.user.id, reported_id: otherId, reason })
    setError(e ? e.message : 'Report sent. Thank you for letting us know.')
  }

  if (!configured) return <Landing onSignIn={() => setError('Connect Supabase first: add the project URL and publishable key to .env.local, then restart the app. See README.md.')} error={error} />
  if (loading) return <div className="loading"><span className="brand">✺ raas</span><span>Getting your circle ready…</span></div>
  if (!session) return <Landing onSignIn={async () => {
    const { error: e } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (e) setError(e.message)
  }} error={error} />
  if (!profile) return <ProfileEditor userId={session.user.id} onSaved={setProfile} onSignOut={() => supabase!.auth.signOut()} />

  const person = candidates[0]
  const filtersActive = Boolean(filters.state || filters.min !== 18 || filters.max !== 60)
  const profileLocation = profile.city ? `${profile.city}, ${profile.state || profile.area}` : (profile.state || profile.area || 'India')

  return <div className="app-shell">
    <MotionScene ambient />
    <header className="topbar">
      <div className="brand">✺ raas<span className="brand-dot">.</span></div>
      <div className="topbar-right">
        <span className="ncr-pill"><span className="pin">◆</span> {profileLocation}</span>
        <button className="avatar-small" onClick={() => setView('profile')} aria-label="Open profile">{profile.name.charAt(0).toUpperCase()}</button>
      </div>
    </header>
    <div className="app-content">
      <aside className="sidebar">
        <div className="sidebar-kicker">YOUR SPACE</div>
        <button className={view === 'discover' ? 'side-link active' : 'side-link'} onClick={() => { setView('discover'); setActiveMatch(null) }}><span>✦</span> Discover</button>
        <button className={view === 'matches' ? 'side-link active' : 'side-link'} onClick={() => setView('matches')}><span>♡</span> Matches {matches.length > 0 && <b>{matches.length}</b>}</button>
        <button className={view === 'profile' ? 'side-link active' : 'side-link'} onClick={() => setView('profile')}><span>◌</span> My profile</button>
        <div className="sidebar-note"><span>✺</span><strong>Find your people.</strong><p>Good garba starts with good company.</p></div>
      </aside>
      <main className={view === 'discover' ? 'main-panel discover-main' : 'main-panel'} key={view}>
        {error && <div className="notice" role="status">{error}<button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
        {view === 'discover' && <>
          <div className="page-heading discover-heading">
            <div>
              <span className="eyebrow">DISCOVER / INDIA <i>✦</i> YOUR CIRCLE IS OPEN</span>
              <h1>Find your <em>garba person.</em></h1>
              <p>Meet people across India. If the vibe is mutual, say hello.</p>
            </div>
            <div className="heading-decoration">✺</div>
          </div>
          <div className={person ? 'discover-layout' : 'discover-layout is-empty'}>
            <div className="card-zone">
              {person ? <>
                <div className={`swipe-frame ${swipeMotion ? `fly-${swipeMotion}` : ''}`}>
                  <ProfileCard key={person.id} person={person} onSwipe={liked => void swipe(person, liked)} />
                </div>
                <div className="swipe-actions">
                  <button className="action-pass" disabled={Boolean(swipeMotion)} onClick={() => swipe(person, false)} aria-label={`Pass on ${person.name}`}>×</button>
                  <span>THE VIBE CHECK <i>✦</i></span>
                  <button className="action-like" disabled={Boolean(swipeMotion)} onClick={() => swipe(person, true)} aria-label={`Like ${person.name}`}>♥</button>
                </div>
                <p className="swipe-hint">Tap through their photos &amp; stories before you decide.</p>
              </> : <DiscoverEmpty filtersActive={filtersActive} loading={discoverLoading} refreshing={refreshing} onRefresh={() => { void refreshCandidates() }} onReset={() => setFilters({ min: 18, max: 60, state: '' })} onProfile={() => setView('profile')} />}
            </div>
            <div className="filters-panel">
              <span className="filter-kicker">✦ &nbsp; TUNE YOUR CIRCLE</span>
              <div className="filters-title"><span>✧</span><h2>Your preferences</h2></div>
              <p>Make your circle feel right for you.</p>
              <label>State
                <select value={filters.state} onChange={e => setFilters({ ...filters, state: e.target.value as IndiaState | '' })}>
                  <option value="">Anywhere in India</option>
                  {INDIA_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </label>
              <AgeRange min={filters.min} max={filters.max} onChange={(min, max) => setFilters(current => ({ ...current, min, max }))} />
              <div className="filter-foot">✦ &nbsp;All matches are based on mutual preferences.</div>
            </div>
          </div>
        </>}
        {view === 'matches' && <>
          <div className="page-heading compact">
            <div><span className="eyebrow">GOOD VIBES, BOTH WAYS</span><h1>Your <em>matches.</em></h1><p>The people who liked you back. Go start a conversation.</p></div>
          </div>
          <section className="likes-section" aria-label="People who liked you">
            <div className="likes-heading">
              <span>✦</span>
              <div><h2>Liked you <b>{likes.length}</b></h2><p>They made the first move. See who catches your eye.</p></div>
            </div>
            <div className="likes-list">
              {likesLoading ? <p className="likes-empty">Finding your admirers…</p> : likes.length ? likes.map(like => (
                <button className="like-card" key={like.id} onClick={() => setSelectedLike(like)} aria-label={`View ${like.name}'s profile`}>
                  {like.photo_urls?.[0] ? <img src={like.photo_urls[0]} alt="" loading="lazy" decoding="async" /> : <span className="like-photo-fallback">✺</span>}
                  <span>
                    <strong>{like.name}, {like.age}</strong>
                    <small>{like.city || like.state || like.area}{like.distance_km != null ? ` · ${formatDistance(like.distance_km)}` : ''}</small>
                  </span>
                  <i>↗</i>
                </button>
              )) : <p className="likes-empty">No new likes yet. When someone likes you, they'll appear here.</p>}
            </div>
          </section>
          <div className={activeMatch ? 'messages-layout chat-open' : 'messages-layout'}>
            <div className="match-list">
              {matches.length ? matches.map(match => (
                <button className={activeMatch?.id === match.id ? 'match-item selected' : 'match-item'} key={match.id} onClick={() => setActiveMatch(match)}>
                  <Avatar name={match.other_name} url={match.other_photo_url} />
                  <span><strong>{match.other_name}</strong><small>{match.other_city || match.other_state || match.other_area}</small></span>
                  <span className="match-arrow">›</span>
                </button>
              )) : <div className="match-empty"><span>♡</span><h3>No matches yet</h3><p>Discover someone you'd like to meet.</p><button className="text-btn" onClick={() => setView('discover')}>Explore profiles →</button></div>}
            </div>
            <div className="chat-pane">
              {activeMatch
                ? <Chat key={activeMatch.id} match={activeMatch} userId={session.user.id} onBack={() => setActiveMatch(null)} onBlock={() => block(activeMatch.other_id)} onReport={() => report(activeMatch.other_id)} />
                : <div className="chat-placeholder"><span>✺</span><h3>A conversation starts here.</h3><p>Choose a match to say hello.</p></div>}
            </div>
          </div>
        </>}
        {view === 'profile' && <>
          <div className="page-heading compact"><div><span className="eyebrow">MAKE IT YOU</span><h1>Your <em>profile.</em></h1><p>This is what people in your circle get to see.</p></div></div>
          <ProfileEditor userId={session.user.id} initial={profile} onSaved={setProfile} onSignOut={() => supabase!.auth.signOut()} onDelete={deleteProfile} />
        </>}
      </main>
    </div>
    <nav className={view === 'matches' && activeMatch ? 'mobile-nav chat-hidden' : 'mobile-nav'}>
      <button className={view === 'discover' ? 'current' : ''} onClick={() => setView('discover')}>✦<span>Discover</span></button>
      <button className={view === 'matches' ? 'current' : ''} onClick={() => setView('matches')}>♡<span>Matches</span></button>
      <button className={view === 'profile' ? 'current' : ''} onClick={() => setView('profile')}>◌<span>Profile</span></button>
    </nav>
    {selectedLike && <div className="like-overlay" onClick={() => { if (!likeAction) setSelectedLike(null) }}>
      <div className="like-detail" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${selectedLike.name}'s profile`}>
        <div className="like-detail-top"><span>✦ THEY LIKED YOU</span><button onClick={() => setSelectedLike(null)} disabled={likeAction} aria-label="Close profile">×</button></div>
        <ProfileCard key={selectedLike.id} person={selectedLike} onSwipe={liked => { void respondToLike(selectedLike, liked) }} />
        <div className="like-detail-actions">
          <button className="action-pass" onClick={() => { void respondToLike(selectedLike, false) }} disabled={likeAction} aria-label={`Pass on ${selectedLike.name}`}>×</button>
          <span>{likeAction ? 'SAVING…' : 'YOUR MOVE'}</span>
          <button className="action-like" onClick={() => { void respondToLike(selectedLike, true) }} disabled={likeAction} aria-label={`Like ${selectedLike.name} back`}>♥</button>
        </div>
      </div>
    </div>}
    {matchReveal && <div className="modal-backdrop" onClick={() => setMatchReveal(null)}>
      <div className="match-modal" onClick={e => e.stopPropagation()}>
        <span className="match-spark">✺</span>
        <span className="eyebrow">IT'S A MATCH</span>
        <h2>You and {matchReveal.name}<br /><em>clicked.</em></h2>
        <p>Go say hello and see where the rhythm takes you.</p>
        <button className="primary-btn" onClick={() => { setMatchReveal(null); setView('matches') }}>Open matches</button>
        <button className="text-btn" onClick={() => setMatchReveal(null)}>Keep discovering</button>
      </div>
    </div>}
  </div>
}

function Avatar({ name, url }: { name: string, url?: string }) { return <span className="avatar">{url ? <img src={url} alt="" loading="lazy" decoding="async" /> : name.charAt(0).toUpperCase()}</span> }

function ProfileCard({ person, onSwipe }: { person: Candidate, onSwipe: (liked: boolean) => void }) {
  const [slide, setSlide] = useState(0)
  const [drag, setDrag] = useState(0)
  const dragStart = React.useRef<{ x: number, y: number } | null>(null)
  const photos = person.photo_urls?.filter((url): url is string => Boolean(url)) || []
  const preloadOtherPhotos = () => {
    photos.slice(1).forEach(url => { const image = new Image(); image.fetchPriority = 'low'; image.src = url })
  }
  const content = [
    { type: 'photo', value: photos[0] },
    ...(person.prompt_answers || []).slice(0, 1).map(item => ({ type: 'prompt', value: item })),
    ...photos.slice(1).map(value => ({ type: 'photo', value })),
    ...(person.prompt_answers || []).slice(1).map(item => ({ type: 'prompt', value: item })),
  ]
  const current = content[slide] || content[0]
  const locationLabel = person.city ? `${person.city}, ${person.state || person.area}` : (person.state || person.area || '')
  const distLabel = formatDistance(person.distance_km)

  return <article className="profile-card" data-tilt key={person.id} style={{ translate: `${drag}px 0`, rotate: `${drag / 22}deg` }}>
    <div className="profile-visual" onPointerDown={e => {
      if ((e.target as HTMLElement).closest('button')) return
      dragStart.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId)
    }} onPointerMove={e => {
      if (!dragStart.current) return
      const x = e.clientX - dragStart.current.x, y = e.clientY - dragStart.current.y
      if (Math.abs(x) > Math.abs(y)) setDrag(x)
    }} onPointerUp={() => {
      if (Math.abs(drag) > 100) onSwipe(drag > 0)
      dragStart.current = null; setDrag(0)
    }} onPointerCancel={() => { dragStart.current = null; setDrag(0) }}>
      {Math.abs(drag) > 30 && <span className={drag > 0 ? 'drag-label like' : 'drag-label pass'}>{drag > 0 ? 'GOOD VIBES ♡' : 'NEXT PERSON ↗'}</span>}
      {current?.type === 'photo' && typeof current.value === 'string' ? <img key={current.value} src={current.value} alt={`${person.name}'s photo ${slide + 1}`} decoding="async" fetchPriority="high" onLoad={slide === 0 ? preloadOtherPhotos : undefined} /> :
        current?.type === 'prompt' && typeof current.value === 'object' ? <div className="prompt-slide"><span>THE REAL ME ✦</span><h3>{current.value.prompt}</h3><p>{current.value.answer}</p><i>✺</i></div> :
        <div className="profile-placeholder"><span>✺</span><strong>{person.name.charAt(0).toUpperCase()}</strong></div>}
      <div className="slide-dots" aria-label="Profile pages">{content.map((_, index) => <button key={index} className={index === slide ? 'active' : ''} onClick={() => setSlide(index)} aria-label={`Show profile page ${index + 1}`} />)}</div>
      {content.length > 1 && <><button className="slide-edge previous" onClick={() => setSlide((slide - 1 + content.length) % content.length)} aria-label="Previous profile page">‹</button><button className="slide-edge next" onClick={() => setSlide((slide + 1) % content.length)} aria-label="Next profile page">›</button></>}
      <span className="photo-tag">✦ &nbsp; HERE FOR GARBA</span>
    </div>
    <div className="profile-info">
      <span className="profile-meta">✦ {locationLabel.toUpperCase()}{distLabel ? ` · ${distLabel.toUpperCase()}` : ''}</span>
      <h2>{person.name}<span>, {person.age}</span></h2>
      <p>{person.bio || 'Meet me where the music is.'}</p>
      <div className="card-footer">A little more than a photo <span>♡</span></div>
    </div>
  </article>
}

function Chat({ match, userId, onBack, onBlock, onReport }: { match: Match, userId: string, onBack: () => void, onBlock: () => void, onReport: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [menu, setMenu] = useState(false)
  const messagesRef = React.useRef<HTMLDivElement>(null)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport || !window.matchMedia('(max-width: 680px)').matches) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const syncViewport = () => {
      document.documentElement.style.setProperty('--chat-viewport-height', `${viewport.height}px`)
      document.documentElement.style.setProperty('--chat-viewport-top', `${viewport.offsetTop}px`)
    }
    syncViewport()
    viewport.addEventListener('resize', syncViewport)
    viewport.addEventListener('scroll', syncViewport)
    return () => {
      document.body.style.overflow = previousOverflow
      document.documentElement.style.removeProperty('--chat-viewport-height')
      document.documentElement.style.removeProperty('--chat-viewport-top')
      viewport.removeEventListener('resize', syncViewport)
      viewport.removeEventListener('scroll', syncViewport)
    }
  }, [])
  useEffect(() => {
    if (!supabase) return
    let live = true
    const load = async () => {
      const { data, error: e } = await supabase!.from('messages').select('*').eq('match_id', match.id).order('created_at', { ascending: false }).limit(100)
      if (live) { if (e) setError(e.message); else setMessages((data as Message[]).reverse()) }
    }
    void load()
    const channel = supabase.channel(`chat-${match.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${match.id}` }, payload => {
      if (live) setMessages(current => current.some(message => message.id === (payload.new as Message).id) ? current : [...current, payload.new as Message])
    }).subscribe()
    return () => { live = false; void supabase!.removeChannel(channel) }
  }, [match.id])
  useEffect(() => { const list = messagesRef.current; if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'instant' }) }, [messages.length])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !draft.trim() || sending) return
    setSending(true); setError('')
    const body = draft.trim()
    const { data, error: sendError } = await supabase.from('messages').insert({ match_id: match.id, sender_id: userId, body }).select('*').single()
    if (sendError) setError(sendError.message)
    else { setMessages(current => current.some(message => message.id === data.id) ? current : [...current, data as Message]); setDraft('') }
    setSending(false)
  }

  const locationLabel = match.other_city ? `${match.other_city}, ${match.other_state || match.other_area}` : (match.other_state || match.other_area || 'India')

  return <div className="chat">
    <div className="chat-header">
      <button className="chat-back" onClick={onBack} aria-label="Back to matches">‹</button>
      <Avatar name={match.other_name} url={match.other_photo_url} />
      <div><strong>{match.other_name}</strong><small>{locationLabel}</small></div>
      <div className="chat-menu-wrap">
        <button className="menu-button" onClick={() => setMenu(!menu)} aria-label="Conversation options">⋯</button>
        {menu && <div className="chat-menu"><button onClick={() => { setMenu(false); onReport() }}>Report</button><button onClick={() => { setMenu(false); onBlock() }}>Block</button></div>}
      </div>
    </div>
    <div className="chat-messages" ref={messagesRef}>
      {messages.length ? messages.map(message => <div className={message.sender_id === userId ? 'bubble mine' : 'bubble'} key={message.id}><span>{message.body}</span><time>{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div>) : <div className="chat-start"><span>✺</span><h3>Say hello to {match.other_name}</h3><p>A good conversation is the first step.</p></div>}
    </div>
    {error && <div className="chat-error" role="alert">{error}</div>}
    <form className="chat-compose" onSubmit={send}>
      <input aria-label="Message" maxLength={1000} placeholder="Write a message…" value={draft} onChange={e => setDraft(e.target.value)} />
      <button disabled={!draft.trim() || sending} aria-label="Send message">↗</button>
    </form>
  </div>
}

createRoot(document.getElementById('root')!).render(<MotionProvider><App /></MotionProvider>)
