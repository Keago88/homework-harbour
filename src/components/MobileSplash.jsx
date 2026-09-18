import React, { useEffect, useState, useRef } from 'react';

const splashStyles = `
  .splash-root {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #f4f0e6;
    overflow: hidden;
    font-family: Nunito, system-ui, sans-serif;
    transition: opacity .4s ease, transform .4s ease;
    cursor: pointer;
    color: #111;
  }
  .splash-root.splash-exit { opacity: 0; transform: scale(1.03); pointer-events: none; }
  .splash-logo-wrap { display: flex; flex-direction: column; align-items: center; gap: 20px; }
  .splash-hh {
    width: 88px; height: 88px;
    display: flex; align-items: center; justify-content: center;
    background: #f6e7a3;
    border: 2.5px solid #111;
    border-radius: 24px;
    font-weight: 900; font-size: 1.7rem; letter-spacing: -0.04em;
  }
  .splash-wordmark { text-align: center; }
  .splash-wordmark h1 {
    font-weight: 900; font-size: 2.4rem; letter-spacing: -0.03em; line-height: 1.05; margin: 0;
  }
  .splash-wordmark h1 span {
    display: inline-block;
    background: #f6e7a3;
    border: 2.5px solid #111;
    border-radius: 10px;
    padding: 0.02em 0.25em;
  }
  .splash-wordmark .splash-sub {
    margin-top: 10px;
    font-size: .85rem;
    font-weight: 800;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #6b655c;
  }
  .splash-tagline {
    margin-top: 28px;
    font-size: .95rem;
    font-weight: 700;
    color: #6b655c;
  }
  .splash-version {
    position: absolute;
    bottom: 42px;
    font-size: .7rem;
    font-weight: 800;
    letter-spacing: .16em;
    color: #6b655c;
  }
`;

export default function MobileSplash({ onDone }) {
  const [exiting, setExiting] = useState(false);
  const [removed, setRemoved] = useState(false);
  const doneRef = useRef(false);

  const dismiss = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setExiting(true);
    setTimeout(() => {
      setRemoved(true);
      onDone?.();
    }, 400);
  };

  useEffect(() => {
    const autoTimer = setTimeout(dismiss, 3500);
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
      <style>{splashStyles}</style>
      <div className={`splash-root ${exiting ? 'splash-exit' : ''}`} onClick={dismiss}>
        <div className="splash-logo-wrap">
          <div className="splash-hh">HH</div>
          <div className="splash-wordmark">
            <h1>Homework <span>Harbour</span></h1>
            <p className="splash-sub">Your study dock</p>
          </div>
        </div>
        <p className="splash-tagline">Cast off. Stay on course.</p>
        <p className="splash-version">v1.0.0</p>
      </div>
    </>
  );
}
