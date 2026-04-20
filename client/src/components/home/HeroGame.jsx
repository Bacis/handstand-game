import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import HeroSkeleton from './HeroSkeleton.jsx';
import './HeroGame.css';

const TOTAL_PIPS = 40;
const ACTIVE_PIP = 2;

export default function HeroGame() {
  const [t, setT] = useState({ m: '00', s: '12', ms: '34' });

  useEffect(() => {
    const start = performance.now() - 12340;
    const id = setInterval(() => {
      const el = performance.now() - start;
      const s = Math.floor(el / 1000);
      setT({
        m: String(Math.floor(s / 60)).padStart(2, '0'),
        s: String(s % 60).padStart(2, '0'),
        ms: String(Math.floor((el % 1000) / 10)).padStart(2, '0'),
      });
    }, 33);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="hero-game">
      <div className="play-main">
        <div className="play-left">
          <div className="play-eyebrow">
            <span className="d" />
            A webcam game · no install · no account
          </div>
          <h1 className="play-head">
            How long can you stand on your <em>hands?</em>
          </h1>
          <p className="play-sub">
            Your webcam watches your pose. Kick up, hold, and the clock counts. Rank up
            through 40 tiers, from Toes Up (3s) to Vertical Monk (2m+). Falls don&apos;t
            hurt your rank — only your streak.
          </p>

          <div className="play-how">
            <div className="s">
              <div className="n">01</div>
              <div className="t"><b>Point the camera.</b>Floor in frame, space to kick.</div>
            </div>
            <div className="s">
              <div className="n">02</div>
              <div className="t"><b>Kick up.</b>Toes cross the sky line, wrists lock.</div>
            </div>
            <div className="s">
              <div className="n">03</div>
              <div className="t"><b>Hold.</b>The clock runs until you come down.</div>
            </div>
          </div>

          <div className="play-ctas">
            <Link to="/play" className="play-btn">
              <span className="i">▶</span>Start a run
            </Link>
            <Link to="/leaderboard" className="play-btn ghost">
              <span className="i">#</span>Watch leaderboard
            </Link>
          </div>

          <div className="play-perm">
            <span className="cam" />
            camera stays on device · nothing uploaded
          </div>
        </div>

        <div className="play-right">
          <div className="viewfinder">
            <div className="vf-scene">
              <div className="vf-floor" />
              <div className="vf-wall-lines" />
              <div className="vf-door" />
              <div className="vf-floor-grid" />
            </div>
            <div className="vf-sky" />
            <div className="vf-gnd" />

            <HeroSkeleton className="vf-fig-pixi" />

            <div className="vf-hud">
              <div className="vf-corner tl" />
              <div className="vf-corner tr" />
              <div className="vf-corner bl" />
              <div className="vf-corner br" />

              <div className="vf-rec">
                <span className="dot" />REC · 30fps
              </div>
              <div className="vf-cam">CAM · 1280×720</div>

              <div className="vf-timer">
                {t.m}:<span>{t.s}</span>
                <span className="ms">.{t.ms}</span>
              </div>
              <div className="vf-rank">RANK 03 · TOES UP</div>

              <div className="vf-ranks">
                {Array.from({ length: TOTAL_PIPS }, (_, i) => {
                  const cls =
                    i === ACTIVE_PIP ? 'pip cur' : i < ACTIVE_PIP ? 'pip on' : 'pip';
                  return <div key={i} className={cls} />;
                })}
              </div>

              <div className="vf-tel">
                <div className="row"><span className="k">wrists &lt; floor</span><span className="v">✓</span></div>
                <div className="row"><span className="k">ankles &gt; sky</span><span className="v">✓</span></div>
                <div className="row"><span className="k">visibility</span><span className="v">0.94</span></div>
                <div className="row"><span className="k">current rank</span><span className="v">03/40</span></div>
              </div>

              <div className="vf-status">
                ● RECORDING · HOLD IT
                <span className="next">next: wobble mode in 8s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
