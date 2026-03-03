import React, { useEffect, useState, useRef } from 'react';

const COLORS = ['#7c3aed','#8b5cf6','#c026d3','#d946ef','#a78bfa'];

const splashStyles = `
  .splash-root {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    overflow: hidden;
    font-family: 'DM Sans', sans-serif;
    transition: opacity .5s ease, transform .5s ease;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .splash-root.splash-exit {
    opacity: 0;
    transform: scale(1.05);
    pointer-events: none;
  }

  .splash-root::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 50% 0%,   rgba(139,92,246,.10) 0%, transparent 65%),
      radial-gradient(ellipse 60% 40% at 80% 100%, rgba(192,38,211,.08) 0%, transparent 60%),
      radial-gradient(ellipse 50% 50% at 10% 80%,  rgba(124,58,237,.06) 0%, transparent 55%);
    pointer-events: none;
  }

  .splash-rings {
    position: absolute;
    bottom: -60px;
    left: 50%;
    transform: translateX(-50%);
    width: 500px;
    height: 300px;
  }
  .splash-ring {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 50%;
    border: 1.5px solid;
    opacity: 0;
    animation: splashRingExpand 3.6s ease-out infinite;
  }
  .splash-ring:nth-child(1) { width: 160px; height: 80px; border-color: rgba(139,92,246,.4);  animation-delay: 0s; }
  .splash-ring:nth-child(2) { width: 260px; height: 120px; border-color: rgba(192,38,211,.28); animation-delay: .6s; }
  .splash-ring:nth-child(3) { width: 380px; height: 170px; border-color: rgba(124,58,237,.18); animation-delay: 1.2s; }
  .splash-ring:nth-child(4) { width: 500px; height: 220px; border-color: rgba(217,70,239,.10);  animation-delay: 1.8s; }

  @keyframes splashRingExpand {
    0%   { opacity: 0;   transform: translateX(-50%) scaleX(.4) scaleY(.4); }
    15%  { opacity: 1; }
    100% { opacity: 0;   transform: translateX(-50%) scaleX(1)  scaleY(1); }
  }

  .splash-particles { position: absolute; inset: 0; pointer-events: none; }
  .splash-dot {
    position: absolute;
    border-radius: 50%;
    animation: splashFloatUp linear infinite;
    opacity: 0;
  }
  @keyframes splashFloatUp {
    0%   { opacity: 0;   transform: translateY(0)   scale(.6); }
    15%  { opacity: .7; }
    85%  { opacity: .4; }
    100% { opacity: 0;   transform: translateY(-180px) scale(1); }
  }

  .splash-logo-wrap {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    animation: splashFadeUp .9s cubic-bezier(.22,1,.36,1) .3s both;
  }

  .splash-icon-ring {
    width: 96px;
    height: 96px;
    border-radius: 28px;
    background: linear-gradient(135deg, #7c3aed, #c026d3);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      0 0 0 12px rgba(124,58,237,.08),
      0 0 0 24px rgba(124,58,237,.04),
      0 20px 50px rgba(124,58,237,.35);
    animation: splashPulse 3s ease-in-out infinite .9s;
  }

  @keyframes splashPulse {
    0%, 100% { box-shadow: 0 0 0 12px rgba(124,58,237,.08), 0 0 0 24px rgba(124,58,237,.04), 0 20px 50px rgba(124,58,237,.35); }
    50%       { box-shadow: 0 0 0 16px rgba(192,38,211,.13), 0 0 0 32px rgba(192,38,211,.05), 0 24px 64px rgba(192,38,211,.40); }
  }

  .splash-icon-ring svg {
    width: 52px;
    height: 52px;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,.4));
  }

  .splash-wordmark {
    text-align: center;
    animation: splashFadeUp .9s cubic-bezier(.22,1,.36,1) .55s both;
  }

  .splash-wordmark h1 {
    font-family: 'Playfair Display', serif;
    font-weight: 900;
    font-size: 2.55rem;
    letter-spacing: -.01em;
    line-height: 1;
    background: linear-gradient(100deg, #7c3aed 0%, #8b5cf6 40%, #c026d3 75%, #d946ef 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .splash-wordmark .splash-sub {
    margin-top: 8px;
    font-size: .8rem;
    font-weight: 300;
    letter-spacing: .22em;
    text-transform: uppercase;
    color: rgba(124,58,237,.4);
  }

  .splash-tagline {
    position: relative;
    z-index: 10;
    margin-top: 36px;
    font-size: .82rem;
    font-weight: 300;
    letter-spacing: .06em;
    color: rgba(124,58,237,.45);
    text-align: center;
    animation: splashFadeUp .9s cubic-bezier(.22,1,.36,1) .75s both;
  }

  .splash-loader-wrap {
    position: relative;
    z-index: 10;
    margin-top: 52px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    animation: splashFadeUp .9s cubic-bezier(.22,1,.36,1) .95s both;
  }

  .splash-bar-track {
    width: 140px;
    height: 3px;
    border-radius: 99px;
    background: rgba(124,58,237,.1);
    overflow: hidden;
  }

  .splash-bar-fill {
    height: 100%;
    border-radius: 99px;
    background: linear-gradient(90deg, #7c3aed, #d946ef);
    animation: splashLoadFill 2.4s cubic-bezier(.4,0,.2,1) 1.1s both;
    transform-origin: left;
  }

  @keyframes splashLoadFill {
    0%   { width: 0%; }
    60%  { width: 75%; }
    100% { width: 100%; }
  }

  .splash-loader-dots {
    display: flex;
    gap: 6px;
  }
  .splash-loader-dots span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #8b5cf6;
    animation: splashDotPop .9s ease-in-out infinite;
  }
  .splash-loader-dots span:nth-child(1) { animation-delay: 0s; }
  .splash-loader-dots span:nth-child(2) { animation-delay: .18s; }
  .splash-loader-dots span:nth-child(3) { animation-delay: .36s; }

  @keyframes splashDotPop {
    0%, 100% { transform: scale(1);   opacity: .3; }
    50%       { transform: scale(1.5); opacity: 1;  background: #d946ef; }
  }

  .splash-version {
    position: absolute;
    bottom: 42px;
    font-size: .68rem;
    letter-spacing: .18em;
    color: rgba(124,58,237,.25);
    z-index: 10;
    animation: splashFadeUp .9s ease 1.2s both;
  }

  @keyframes splashFadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .splash-grain {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 20;
    opacity: .015;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    background-size: 180px 180px;
  }
`;

function generateParticles() {
  const dots = [];
  for (let i = 0; i < 28; i++) {
    const size = 2 + Math.random() * 4;
    dots.push({
      key: i,
      size,
      left: `${5 + Math.random() * 90}%`,
      bottom: `${Math.random() * 55}%`,
      background: COLORS[Math.floor(Math.random() * COLORS.length)],
      duration: `${3 + Math.random() * 5}s`,
      delay: `${Math.random() * 6}s`,
    });
  }
  return dots;
}

export default function MobileSplash({ onDone }) {
  const [exiting, setExiting] = useState(false);
  const [removed, setRemoved] = useState(false);
  const particles = useRef(generateParticles());
  const doneRef = useRef(false);

  const dismiss = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setExiting(true);
    setTimeout(() => {
      setRemoved(true);
      onDone?.();
    }, 500);
  };

  useEffect(() => {
    // Auto-dismiss after 3.5s
    const autoTimer = setTimeout(dismiss, 3500);
    // Fallback: if page becomes visible again after being hidden, dismiss immediately
    const onVisible = () => { if (document.visibilityState === 'visible') dismiss(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(autoTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (removed) return null;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400&display=swap" rel="stylesheet" />
      <style>{splashStyles}</style>
      <div className={`splash-root ${exiting ? 'splash-exit' : ''}`} onClick={dismiss}>
        <div className="splash-grain" />

        <div className="splash-rings">
          <div className="splash-ring" />
          <div className="splash-ring" />
          <div className="splash-ring" />
          <div className="splash-ring" />
        </div>

        <div className="splash-particles">
          {particles.current.map(d => (
            <div
              key={d.key}
              className="splash-dot"
              style={{
                width: d.size, height: d.size,
                left: d.left, bottom: d.bottom,
                background: d.background,
                animationDuration: d.duration,
                animationDelay: d.delay,
              }}
            />
          ))}
        </div>

        <div className="splash-logo-wrap">
          <div className="splash-icon-ring">
            <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="26" cy="12" r="5" stroke="white" strokeWidth="2.4" fill="none"/>
              <line x1="26" y1="17" x2="26" y2="44" stroke="white" strokeWidth="2.4" strokeLinecap="round"/>
              <line x1="16" y1="22" x2="36" y2="22" stroke="white" strokeWidth="2.4" strokeLinecap="round"/>
              <path d="M26 44 C14 44 10 36 10 30" stroke="white" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
              <path d="M26 44 C38 44 42 36 42 30" stroke="white" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
              <path d="M10 30 Q6 30 8 26" stroke="white" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
              <path d="M42 30 Q46 30 44 26" stroke="white" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
            </svg>
          </div>

          <div className="splash-wordmark">
            <h1>Homework<br/>Harbour</h1>
            <p className="splash-sub">Your study dock</p>
          </div>
        </div>

        <p className="splash-tagline">Cast off. Stay on course.</p>

        <div className="splash-loader-wrap">
          <div className="splash-bar-track"><div className="splash-bar-fill" /></div>
          <div className="splash-loader-dots">
            <span /><span /><span />
          </div>
        </div>

        <p className="splash-version">v1.0.0</p>
      </div>
    </>
  );
}
