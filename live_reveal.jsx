// Live round + Reveal + Scoreboard screens
const TRACKS_LR = window.IMP.TRACKS;
const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const trackBy = (id) => TRACKS_LR.find(t => t.id === id);

/* ════════════════════ LIVE ROUND ════════════════════ */
function LiveScreen({ players, round, draft, onReveal }) {
  const [secs, setSecs] = useState(120);
  const [playing, setPlaying] = useState(true);
  const [revealView, setRevealView] = useState(true); // operator's secret monitor on/off

  useEffect(() => {
    if (!playing || secs <= 0) return;
    const id = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [playing, secs]);

  const live = players.filter(p => p.state === 'connected');
  const crowd = trackBy(draft.common);
  const imp = trackBy(draft.impostor);
  const over = secs <= 0;
  const pct = (secs / 120) * 100;

  return (
    <div className="screen">
      <div className="screen__scroll" style={{ paddingTop: 54 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div className="chip" style={{ color: 'var(--magenta)' }}>
            <span className="pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--magenta)', display: 'inline-block' }} /> Live · Round {round}
          </div>
          <div className="chip"><Icon.head s={13} c="var(--cyan)"/> {live.length} synced</div>
        </div>

        {/* timer ring */}
        <div className="card" style={{ padding: '24px 20px', marginBottom: 14, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: over ? 'radial-gradient(100% 100% at 50% 0%, rgba(255,46,154,0.2), transparent 65%)' : 'radial-gradient(100% 100% at 50% 0%, rgba(154,107,255,0.16), transparent 65%)' }} />
          <div style={{ position: 'relative' }}>
            <p className="eyebrow">{over ? 'Time' : 'Time remaining'}</p>
            <div className="h-display" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 60, lineHeight: 1, letterSpacing: '0.01em', margin: '6px 0 16px', color: over ? 'var(--magenta)' : 'var(--ink)', textShadow: over ? 'var(--glow-magenta)' : 'none' }}>{fmt(secs)}</div>
            {/* progress */}
            <div style={{ height: 5, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden', marginBottom: 18 }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: 'linear-gradient(90deg, var(--cyan), var(--violet), var(--magenta))', transition: 'width 1s linear' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
              <button onClick={() => setSecs(120)} className="ctl"><Icon.sync s={18}/></button>
              <button onClick={() => setPlaying(p => !p)} className="ctl ctl--play">{playing ? <Icon.pause s={26} c="#0A0410"/> : <Icon.play s={26} c="#0A0410"/>}</button>
              <button onClick={() => setSecs(s => Math.min(120, s + 30))} className="ctl" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>+30</button>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--faint)', fontFamily: 'var(--font-mono)', margin: '16px 0 0' }}>
              {playing ? 'All headsets playing in sync' : 'Paused on every headset'}
            </p>
          </div>
        </div>

        {/* now playing — two streams */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
          <StreamCard label="Crowd stream" accent="var(--cyan)" t={crowd} count={live.length - 1} playing={playing} />
          <StreamCard label="Impostor stream" accent="var(--magenta)" t={imp} count={1} playing={playing} />
        </div>

        {/* secret monitor */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 4px 12px' }}>
          <SectionLabel accent="var(--magenta)">Booth monitor · what each hears</SectionLabel>
          <button className="chip" style={{ cursor: 'pointer' }} onClick={() => setRevealView(v => !v)}>
            <Icon.eye s={13} c={revealView ? 'var(--cyan)' : 'var(--faint)'}/> {revealView ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          {live.map((p, i) => {
            const isImp = p.id === draft.impostorId;
            const t = isImp ? imp : crowd;
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                background: isImp && revealView ? 'rgba(255,46,154,0.1)' : 'transparent',
                borderBottom: i < live.length-1 ? '1px solid var(--line)' : 'none',
                boxShadow: isImp && revealView ? 'inset 3px 0 0 var(--magenta)' : 'none',
              }}>
                <Avatar p={p} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                  {revealView
                    ? <div style={{ fontSize: 11.5, color: isImp ? 'var(--magenta)' : 'var(--faint)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isImp ? '◆ ' : ''}{t.title}</div>
                    : <div style={{ fontSize: 11.5, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>•••••••••</div>}
                </div>
                {revealView && isImp && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--magenta)', padding: '3px 8px', borderRadius: 999, boxShadow: '0 0 0 1px var(--magenta) inset' }}>IMP</span>}
                <Eq color={revealView && isImp ? 'var(--magenta)' : 'var(--cyan)'} playing={playing} />
              </div>
            );
          })}
        </div>

      </div>

      <div className="dock">
        <button className="btn btn--danger" onClick={onReveal}><Icon.eye c="#fff"/> Reveal the impostor</button>
      </div>
    </div>
  );
}

function StreamCard({ label, accent, t, count, playing }) {
  return (
    <div className="card" style={{ padding: 14, boxShadow: `0 0 0 1px ${accent}33 inset` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="eyebrow" style={{ color: accent, fontSize: 10 }}>{label}</span>
        <Eq color={accent} playing={playing} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Cover t={t} size={38} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
          <div style={{ fontSize: 11, color: 'var(--faint)' }}>{count} {count === 1 ? 'listener' : 'listeners'}</div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ REVEAL ════════════════════ */
function RevealScreen({ players, round, draft, result, onNext, onScores }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const id = setTimeout(() => setShown(true), 700); return () => clearTimeout(id); }, []);

  const live = players.filter(p => p.state === 'connected');
  const impP = players.find(p => p.id === draft.impostorId);
  const crowd = trackBy(draft.common);
  const imp = trackBy(draft.impostor);
  const maxVotes = Math.max(...Object.values(result.votes));

  return (
    <div className="screen">
      <div className="screen__scroll" style={{ paddingTop: 54 }}>
        <p className="eyebrow" style={{ textAlign: 'center' }}>Round {round} · the reveal</p>

        {/* hero */}
        <div style={{ textAlign: 'center', margin: '18px 0 26px' }}>
          <p className="h-display" style={{ fontSize: 17, color: 'var(--muted)', letterSpacing: '0.04em', marginBottom: 18 }}>THE IMPOSTOR WAS</p>
          {!shown
            ? <div style={{ width: 120, height: 120, borderRadius: '50%', margin: '0 auto', border: '2px dashed var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 40, fontFamily: 'var(--font-display)' }}>?</div>
            : <div className="breathe" style={{ width: 'fit-content', margin: '0 auto' }}><Avatar p={impP} size={120} glow /></div>}
          {shown && <>
            <h1 className="h-display float-up" style={{ fontSize: 46, margin: '18px 0 6px', color: 'var(--magenta)', textShadow: 'var(--glow-magenta)' }}>{impP.name}</h1>
            <div className="float-up" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 13, color: result.caught ? 'var(--cyan)' : 'var(--magenta)', animationDelay: '.1s' }}>
              {result.caught ? '✓ Caught by the crowd' : '✗ Got away with it'}
            </div>
          </>}
        </div>

        {shown && <div className="float-up" style={{ animationDelay: '.15s' }}>
          {/* what they heard */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
            <MiniTrack label="Crowd heard" accent="var(--cyan)" t={crowd} />
            <MiniTrack label="Impostor heard" accent="var(--magenta)" t={imp} />
          </div>

          {/* audience votes */}
          <SectionLabel accent="var(--violet)">Audience votes · {result.voters} watching</SectionLabel>
          <div className="card" style={{ padding: '14px 16px', marginBottom: 22 }}>
            {live.filter(p => result.votes[p.id]).sort((a,b) => result.votes[b.id]-result.votes[a.id]).map(p => {
              const v = result.votes[p.id];
              const isImp = p.id === draft.impostorId;
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Avatar p={p} size={28} />
                  <span style={{ width: 52, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: isImp ? 'var(--magenta)' : 'var(--ink)' }}>{p.name}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(v/maxVotes)*100}%`, borderRadius: 999, background: isImp ? 'linear-gradient(90deg,var(--magenta),#FF5C3E)' : 'var(--violet)' }} />
                  </div>
                  <span style={{ width: 18, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: isImp ? 'var(--magenta)' : 'var(--faint)' }}>{v}</span>
                </div>
              );
            })}
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--cyan)', margin: '6px 0 0', textAlign: 'center' }}>
              {result.votes[draft.impostorId] || 0} of {result.voters} spotted {impP.name}
            </p>
          </div>

          {/* points */}
          <SectionLabel accent="var(--lime)">Points this round</SectionLabel>
          <div className="card" style={{ padding: '12px 16px' }}>
            {live.map((p, i) => {
              const d = result.deltas[p.id] || 0;
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < live.length-1 ? '1px solid var(--line)' : 'none' }}>
                  <Avatar p={p} size={26} />
                  <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: p.id===draft.impostorId?'var(--magenta)':'var(--ink)' }}>{p.name}{p.id===draft.impostorId?' · impostor':''}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: d > 0 ? 'var(--lime)' : 'var(--faint)' }}>{d > 0 ? `+${d}` : '—'}</span>
                </div>
              );
            })}
          </div>
        </div>}
      </div>

      <div className="dock" style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn--ghost" style={{ flex: '0 0 auto', width: 56, padding: 0 }} onClick={onScores}><Icon.crown c="var(--amber)"/></button>
        <button className="btn btn--primary" style={{ flex: 1 }} onClick={onNext}>Next round <Icon.arrow c="#0A0410"/></button>
      </div>
    </div>
  );
}

function MiniTrack({ label, accent, t }) {
  return (
    <div className="card" style={{ padding: 12, boxShadow: `0 0 0 1px ${accent}33 inset` }}>
      <span className="eyebrow" style={{ color: accent, fontSize: 10 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 9 }}>
        <Cover t={t} size={34} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
          <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{t.artist}</div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ SCOREBOARD ════════════════════ */
function ScoreboardScreen({ players, round, scores, completed, onBack }) {
  const live = players.filter(p => p.state === 'connected');
  const ranked = [...live].sort((a,b) => (scores[b.id]||0) - (scores[a.id]||0));
  const medal = ['var(--amber)', '#C9D2E0', '#E08A4B'];
  const top = scores[ranked[0].id] || 0;

  return (
    <div className="screen">
      <div className="screen__scroll" style={{ paddingTop: 54 }}>
        <button className="chip" style={{ cursor: 'pointer', marginBottom: 16 }} onClick={onBack}><Icon.back s={14}/> Back</button>
        <p className="eyebrow" style={{ color: 'var(--amber)' }}>{completed === 0 ? 'Game not started' : `After ${completed} ${completed === 1 ? 'round' : 'rounds'}`}</p>
        <h1 className="h-display" style={{ fontSize: 34, margin: '6px 0 22px' }}>SCOREBOARD</h1>

        {/* podium leader */}
        <div className="card" style={{ padding: 20, marginBottom: 18, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(110% 90% at 50% 0%, rgba(255,178,62,0.18), transparent 60%)' }} />
          <div style={{ position: 'relative' }}>
            <Icon.crown s={26} c="var(--amber)"/>
            <div className="breathe" style={{ width: 'fit-content', margin: '10px auto' }}><Avatar p={ranked[0]} size={84} glow /></div>
            <div className="h-display" style={{ fontSize: 30, color: 'var(--amber)' }}>{ranked[0].name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{top} pts · in the lead</div>
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          {ranked.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < ranked.length-1 ? '1px solid var(--line)' : 'none' }}>
              <span style={{ width: 22, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: medal[i] || 'var(--faint)', textAlign: 'center' }}>{i+1}</span>
              <Avatar p={p} size={38} />
              <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{p.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: i===0?'var(--amber)':'var(--ink)' }}>{scores[p.id]||0}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="dock">
        <button className="btn btn--primary" onClick={onBack}>Back to round <Icon.arrow c="#0A0410"/></button>
      </div>
    </div>
  );
}

Object.assign(window, { LiveScreen, RevealScreen, ScoreboardScreen });
