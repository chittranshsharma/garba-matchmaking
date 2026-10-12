import { useState } from 'react'
import MotionScene from './MotionScene'

const VIBES = [
  { name: 'Full filmy', line: 'Main character energy. Every single song.', prompt: 'The way to win me over is…', answer: 'Match my energy when Nagada Sang Dhol comes on.' },
  { name: 'First-timer', line: 'Two left feet. One very good night.', prompt: 'I will teach you…', answer: 'Absolutely nothing. We can learn the steps together.' },
  { name: 'Last song loyal', line: 'The lights are off. You are still dancing.', prompt: 'After garba, find me…', answer: 'Convincing the DJ to play just one more song.' },
]

export default function Landing({ onSignIn, error }: { onSignIn: () => void, error: string }) {
  const [vibe, setVibe] = useState(0)
  return <div className={`cinematic-home vibe-${vibe}`}>
    <section className="cinema-hero">
      <div className="cinema-photo" aria-hidden="true" />
      <div className="cinema-shade" aria-hidden="true" />
      <div className="light-sweep" aria-hidden="true" /><div className="light-sweep second" aria-hidden="true" />
      <MotionScene />
      <header className="cinema-nav"><span className="brand">✺ raas<span className="brand-dot">.</span></span><a href="#the-circle">Meet the circle ↘</a><span className="city-tag">DELHI NCR <i>✦</i> 18+</span></header>
      <div className="cinema-content">
        <span className="live-tag"><i /> NINE NIGHTS. A THOUSAND POSSIBILITIES.</span>
        <h1><span>Same beat.</span><span>New <em>people.</em></span></h1>
        <p>Your next dance partner. Your new favourite person.<br /> Your reason to stay for one more song.</p>
        <button className="cinema-cta" onClick={onSignIn}><span>Find my garba person</span><b>↗</b></button>
        <small>Continue with Google · Free for everyone · Delhi NCR only</small>
        {error && <div className="cinema-error" role="alert">{error}</div>}
      </div>
      <div className="floating-story" data-tilt><span>SMALL PROMPTS. BIG PERSONALITY.</span><div key={vibe} className="story-answer"><h3>{VIBES[vibe].prompt}</h3><p>“{VIBES[vibe].answer}”</p></div><div className="story-foot"><i>♡</i> A little more than a swipe <b>✦</b></div></div>
      <div className="hero-bottom"><span className="scroll-cue">SCROLL INTO THE CIRCLE <i>↓</i></span><div className="energy-picker"><span>WHAT'S YOUR GARBA ENERGY?</span><div>{VIBES.map((item, index) => <button key={item.name} aria-pressed={index === vibe} className={index === vibe ? 'selected' : ''} onClick={() => setVibe(index)}>{item.name} <i>{index === vibe ? '✦' : '↗'}</i></button>)}</div><small key={vibe}>{VIBES[vibe].line}</small></div></div>
      <span className="hero-year" aria-hidden="true">NAVRATRI / 2026</span>
    </section>
    <div className="rhythm-marquee" aria-hidden="true"><div>{[0, 1, 2, 3].map(i => <span key={i}>GOOD COMPANY <i>✳</i> GREAT GARBA <i>✳</i> MAYBE A SPARK <i>✳</i></span>)}</div></div>
    <section id="the-circle" className="circle-section"><div className="circle-heading"><span className="eyebrow">THE PLAN IS SIMPLE</span><h2>A whole night starts<br />with a little <em>hello.</em></h2><p>Friends, dance partners, or something unexpected.<br />You decide what the connection becomes.</p></div><div className="experience-grid">
      <article data-tilt className="experience-tile tile-photos"><span className="tile-number">01 / SHOW UP AS YOU</span><div className="mini-frames"><span>✺</span><span>YOU</span><span>✦</span></div><h3>Three photos.<br />A whole story.</h3><p>Bring your personality with photos and prompts people can actually respond to.</p></article>
      <article data-tilt className="experience-tile tile-match"><span className="tile-number">02 / FIND YOUR RHYTHM</span><div className="heart-orbit"><span>♡</span><i>✦</i><b>✺</b></div><h3>Good vibes.<br />Both ways.</h3><p>Explore by age and area. Everyone can choose who they'd like to meet.</p></article>
      <article data-tilt className="experience-tile tile-chat"><span className="tile-number">03 / TAKE IT FROM HERE</span><div className="mini-chat"><span>Garba this weekend? ✨</span><span>Only if we stay for the last song.</span></div><h3>A match.<br />Then a plan.</h3><p>Chat right here when you both like each other. Share your socials when you feel ready.</p></article>
    </div></section>
    <section className="last-song"><span aria-hidden="true">✺</span><div><p>THE CIRCLE HAS ROOM FOR YOU.</p><h2>Come for the garba.<br /><em>Stay for the people.</em></h2><button className="cinema-cta" onClick={onSignIn}>I'm in. Let's go. <b>↗</b></button></div></section>
    <footer className="cinema-footer"><span className="brand">✺ raas.</span><p>Made for Delhi NCR. Made for a good night.</p><small>18+ · All genders welcome · Always free</small></footer>
  </div>
}
