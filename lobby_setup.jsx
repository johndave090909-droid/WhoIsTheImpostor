// Lobby + Setup screens
const { PLAYERS, TRACKS, ROOM } = window.IMP;

/* ════════════════════ LOBBY ════════════════════ */
function LobbyScreen({ players, round, scores, onStart }) {
  const live = players.filter(p => p.state === 'connected');
  const canStart = live.length >= 3;

  return (
    <div className="screen">
      <div className="screen__scroll">

        {/* wordmark + round */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <p className="eyebrow" style={{ color: 'var(--magenta)' }}>● Live booth</p>
            <h1 className="h-display" style={{ fontSize: 26, marginTop: 6 }}>
              WHO&apos;S THE<br/><span style={{ color: 'var(--magenta)', textShadow: 'var(--glow-magenta)' }}>IMPOSTOR</span>
            </h1>
          </div>
          <div className="chip" style={{ color: 'var(--cyan)' }}>Round {round}</div>
        </div>

        {/* room hero */}
        <div className="card" style={{ padding: 20, marginBottom: 22, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 100% 0%, rgba(37,230,255,0.16), transparent 60%)' }} />
          <div style={{ position: 'relative' }}>
            <p className="eyebrow">Players join at room</p>
            <div className="h-display" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 42, letterSpacing: '0.02em', margin: '8px 0 4px', color: 'var(--cyan)', textShadow: 'var(--glow-cyan)' }}>{ROOM}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <button className="chip" style={{ cursor: 'pointer' }}><Icon.share s={14}/> Share link</button>
              <span style={{ color: 'var(--faint)', fontSize: 13 }}>impostor.live/{ROOM.toLowerCase()}</span>
            </div>
          </div>
          {/* QR placeholder */}
          <div style={{ position: 'absolute', top: 18, right: 18, width: 54, height: 54, borderRadius: 10, background: '#fff', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gridTemplateRows: 'repeat(5,1fr)', gap: 1.5, padding: 6 }}>
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i} style={{ background: [0,1,2,4,5,9,10,12,14,15,19,20,21,23,24,6,8,16,18].includes(i) ? '#07060C' : 'transparent', borderRadius: 1 }} />
            ))}
          </div>
        </div>

        {/* players */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 4px 12px' }}>
          <SectionLabel accent="var(--cyan)">Headsets · {live.length} linked</SectionLabel>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--faint)' }}>{live.length}/8</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {players.map((p, i) => <PlayerCell key={p.id} p={p} score={scores[p.id] || 0} delay={i*0.04} />)}
        </div>

      </div>

      <div className="dock">
        {!canStart && <p style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 12, margin: '0 0 10px', fontFamily: 'var(--font-mono)' }}>Need at least 3 linked headsets</p>}
        <button className="btn btn--primary" disabled={!canStart} onClick={onStart}>
          Set up round <Icon.arrow c="#0A0410" />
        </button>
      </div>
    </div>
  );
}

function PlayerCell({ p, score, delay }) {
  const empty = p.state === 'empty';
  const pairing = p.state === 'pairing';
  const status = empty ? { t: 'Open slot', c: 'var(--faint)' }
    : pairing ? { t: 'Pairing…', c: 'var(--amber)' }
    : { t: 'Linked', c: 'var(--cyan)' };
  return (
    <div className="card float-up" style={{
      padding: 12, display: 'flex', alignItems: 'center', gap: 11,
      animationDelay: `${delay}s`,
      border: empty ? '1px dashed var(--line-2)' : 'none',
      background: empty ? 'transparent' : 'var(--surface)',
      boxShadow: empty ? 'none' : '0 0 0 1px var(--line) inset',
    }}>
      {empty
        ? <div style={{ width: 44, height: 44, borderRadius: '50%', border: '1px dashed var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', flexShrink: 0 }}><Icon.head s={18} c="var(--faint)"/></div>
        : <div className={pairing ? 'pulse' : ''} style={{ borderRadius: '50%' }}><Avatar p={p} size={44} /></div>}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: empty ? 'var(--faint)' : 'var(--ink)' }}>{empty ? '—' : p.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.c, boxShadow: empty ? 'none' : `0 0 8px ${status.c}` }} />
          <span style={{ fontSize: 11, color: status.c, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{status.t}</span>
        </div>
      </div>
      {!empty && score > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--violet)' }}>{score}</span>}
    </div>
  );
}

/* ════════════════════ SETUP ════════════════════ */
function SetupScreen({ players, round, draft, setDraft, onBack, onStart }) {
  const [target, setTarget] = useState('crowd');   // which slot a tapped track fills
  const live = players.filter(p => p.state === 'connected');
  const ready = draft.common && draft.impostor && draft.impostorId;

  const pickTrack = (t) => {
    setDraft(d => {
      const next = { ...d };
      if (target === 'crowd') { next.common = t.id; if (d.impostor === t.id) next.impostor = null; }
      else { next.impostor = t.id; if (d.common === t.id) next.common = null; }
      return next;
    });
    if (target === 'crowd' && !draft.impostor) setTarget('impostor');
  };

  const randomize = () => {
    const r = live[Math.floor(Math.random() * live.length)];
    setDraft(d => ({ ...d, impostorId: r.id }));
  };

  const trackById = (id) => TRACKS.find(t => t.id === id);

  return (
    <div className="screen">
      <div className="screen__scroll">
        <button className="chip" style={{ cursor: 'pointer', marginBottom: 16 }} onClick={onBack}><Icon.back s={14}/> Booth</button>
        <p className="eyebrow">Round {round} · setup</p>
        <h1 className="h-display" style={{ fontSize: 30, margin: '6px 0 20px' }}>SET THE TRAP</h1>

        {/* two slots */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
          <SlotCard label="The crowd hears" accent="var(--cyan)" t={trackById(draft.common)} active={target==='crowd'} onClick={() => setTarget('crowd')} />
          <SlotCard label="The impostor hears" accent="var(--magenta)" t={trackById(draft.impostor)} active={target==='impostor'} onClick={() => setTarget('impostor')} />
        </div>
        <p style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 12, margin: '0 0 18px', fontFamily: 'var(--font-mono)' }}>
          Tap a slot, then pick a track below
        </p>

        {/* track library */}
        <SectionLabel accent="var(--violet)">Your library · {TRACKS.length} local tracks</SectionLabel>
        <div className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
          {TRACKS.map((t, i) => {
            const isCrowd = draft.common === t.id;
            const isImp = draft.impostor === t.id;
            const tag = isCrowd ? { t: 'CROWD', c: 'var(--cyan)' } : isImp ? { t: 'IMPOSTOR', c: 'var(--magenta)' } : null;
            return (
              <button key={t.id} onClick={() => pickTrack(t)} style={{
                width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                background: tag ? `${tag.c}14` : 'transparent',
                borderBottom: i < TRACKS.length-1 ? '1px solid var(--line)' : 'none',
                boxShadow: tag ? `inset 3px 0 0 ${tag.c}` : 'none',
              }}>
                <Cover t={t} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.file}</div>
                </div>
                {tag
                  ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: tag.c, padding: '4px 8px', borderRadius: 999, boxShadow: `0 0 0 1px ${tag.c}55 inset` }}>{tag.t}</span>
                  : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--faint)' }}>{t.dur}</span>}
              </button>
            );
          })}
        </div>

        {/* impostor picker */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 4px 12px' }}>
          <SectionLabel accent="var(--magenta)">Who&apos;s the impostor?</SectionLabel>
          <button className="chip" style={{ cursor: 'pointer', color: 'var(--magenta)' }} onClick={randomize}><Icon.dice s={14} c="var(--magenta)"/> Random</button>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', padding: '4px 0' }}>
          {live.map(p => {
            const sel = draft.impostorId === p.id;
            return (
              <button key={p.id} onClick={() => setDraft(d => ({ ...d, impostorId: p.id }))} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 60 }}>
                <Avatar p={p} size={52} ring={sel ? 'var(--magenta)' : undefined} dim={draft.impostorId && !sel} />
                <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, color: sel ? 'var(--magenta)' : 'var(--muted)' }}>{p.name}</span>
              </button>
            );
          })}
        </div>
        <p style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 11.5, margin: '14px 0 0', fontFamily: 'var(--font-mono)', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
          <Icon.eye s={13} c="var(--faint)"/> Only the booth sees this — players&apos; phones look identical
        </p>
      </div>

      <div className="dock">
        <button className="btn btn--primary" disabled={!ready} onClick={onStart}>
          <Icon.bolt c="#0A0410"/> Start round
        </button>
      </div>
    </div>
  );
}

function SlotCard({ label, accent, t, active, onClick }) {
  return (
    <button onClick={onClick} className="card" style={{
      padding: 14, textAlign: 'left', cursor: 'pointer', border: 'none',
      background: active ? `${accent}1A` : 'var(--surface)',
      boxShadow: active ? `0 0 0 1.5px ${accent}, 0 0 22px ${accent}40` : '0 0 0 1px var(--line) inset',
      minHeight: 118, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}` }} />
        <span className="eyebrow" style={{ color: accent, fontSize: 10 }}>{label}</span>
      </div>
      {t ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Cover t={t} size={40} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
            <div style={{ fontSize: 11, color: 'var(--faint)' }}>{t.artist}</div>
          </div>
        </div>
      ) : (
        <div style={{ color: 'var(--faint)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>Tap a track ↓</div>
      )}
    </button>
  );
}

Object.assign(window, { LobbyScreen, SetupScreen });
