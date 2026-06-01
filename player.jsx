// Player app — join a room, hear your assigned track, vote on the reveal.
const pfmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const wId = (obj, id) => (obj ? Object.assign({ id }, obj) : null);

function PlayerApp() {
  const roomParam = (new URLSearchParams(location.search).get('room') || '').toUpperCase();

  const [uid, setUid] = useState(null);
  const [room, setRoom] = useState(roomParam);
  const [roomInput, setRoomInput] = useState('');
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

  const [ps, setPs] = useState(null);
  const [players, setPlayers] = useState({});
  const [scores, setScores] = useState({});
  const [results, setResults] = useState({});
  const [assign, setAssign] = useState(null);
  const [myVote, setMyVote] = useState(null);

  const [started, setStarted] = useState(false); // audio gate
  const [, setTick] = useState(0);
  const audioRef = useRef(null);
  const liveRef = useRef({});

  /* ── auth + auto-resume ── */
  useEffect(() => {
    (async () => {
      try {
        const id = await window.fb.ready;
        setUid(id);
        if (roomParam) {
          if (!(await Game.roomExists(roomParam))) { setError('Room ' + roomParam + ' not found.'); return; }
          const mine = await window.fb.db.ref('rooms/' + roomParam + '/players/' + id).get();
          if (mine.exists() && mine.val().name) {
            setName(mine.val().name);
            Game.bindPresence(roomParam, id);
            setJoined(true);
          }
        }
      } catch (e) { setError((e && e.message) || 'Connection error'); }
    })();
  }, []);

  /* ── subscriptions ── */
  useEffect(() => {
    if (!joined || !room || !uid) return;
    const unsubs = [
      Game.watchNode(room, 'publicState', setPs),
      Game.watchNode(room, 'players', (v) => setPlayers(v || {})),
      Game.watchNode(room, 'scores', (v) => setScores(v || {})),
      Game.watchNode(room, 'results', (v) => setResults(v || {})),
      Game.watchNode(room, 'assignments/' + uid, setAssign),
      Game.watchNode(room, 'votes/' + uid, setMyVote),
    ];
    return () => unsubs.forEach((u) => u());
  }, [joined, room, uid]);

  useEffect(() => { liveRef.current = { ps, started }; });

  /* ── ticking clock for the timer display ── */
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  /* ── point the audio element at my assigned track ── */
  useEffect(() => {
    const a = audioRef.current;
    if (a && assign && assign.url && a.src !== assign.url) a.src = assign.url;
  }, [assign]);

  /* ── drift-correcting sync loop ── */
  useEffect(() => {
    const id = setInterval(() => {
      const { ps, started } = liveRef.current;
      const a = audioRef.current;
      if (!a || !started || !ps || !ps.audio) return;
      const expected = Game.audioPos(ps.audio);
      if (ps.audio.playing) {
        if (a.paused) a.play().catch(() => {});
        if (Math.abs(a.currentTime - expected) > 0.35) { try { a.currentTime = expected; } catch (_) {} }
      } else {
        if (!a.paused) a.pause();
        if (Math.abs(a.currentTime - expected) > 0.2) { try { a.currentTime = expected; } catch (_) {} }
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  /* ── drop the headset gate whenever we leave the live round ── */
  const status = ps && ps.status;
  useEffect(() => {
    if (status !== 'live' && started) {
      setStarted(false);
      if (audioRef.current) audioRef.current.pause();
    }
  }, [status]);

  /* ── actions ── */
  const doJoin = async () => {
    const code = (room || roomInput).toUpperCase().trim();
    if (!code) { setError('Enter a room code.'); return; }
    if (!name.trim()) { setError('Enter a name.'); return; }
    setJoining(true); setError(null);
    try {
      if (!(await Game.roomExists(code))) { setError('Room ' + code + ' not found.'); setJoining(false); return; }
      await Game.joinRoom(code, name.trim());
      setRoom(code);
      setJoined(true);
    } catch (e) { setError((e && e.message) || 'Could not join.'); }
    setJoining(false);
  };

  const startListening = () => {
    const a = audioRef.current;
    if (a && assign && assign.url) {
      if (a.src !== assign.url) a.src = assign.url;
      a.play().then(() => setStarted(true)).catch(() => setStarted(true));
    } else {
      setStarted(true);
    }
  };

  const me = wId(players[uid], uid) || { id: uid, name: name || 'YOU', c1: '#9A6BFF', c2: '#25E6FF' };

  /* ── render ── */
  let view;
  if (!joined) {
    view = <JoinView room={room} roomParam={roomParam} roomInput={roomInput} setRoomInput={setRoomInput} name={name} setName={setName} onJoin={doJoin} joining={joining} error={error} />;
  } else if (!ps || status === 'lobby' || status === 'setup') {
    view = <WaitView me={me} room={room} count={window.IMP.connectedList(players).length} status={status} />;
  } else if (status === 'live') {
    view = <PlayLiveView me={me} ps={ps} players={players} uid={uid} assignReady={!!(assign && assign.url)} started={started} onStart={startListening} myVote={myVote} onVote={(t) => Game.castVote(room, t)} />;
  } else if (status === 'reveal') {
    view = <PlayRevealView uid={uid} players={players} result={results[ps.round]} myVote={myVote} />;
  } else {
    view = <PlayScoresView uid={uid} players={players} scores={scores} />;
  }

  return (
    <div className="stage">
      <IOSDevice dark width={390} height={844}>{view}</IOSDevice>
      <audio ref={audioRef} preload="auto" playsInline />
    </div>
  );
}

/* ════════════ JOIN ════════════ */
function JoinView({ room, roomParam, roomInput, setRoomInput, name, setName, onJoin, joining, error }) {
  return (
    <div className="screen">
      <div className="screen__scroll" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 60 }}>
        <p className="eyebrow" style={{ color: 'var(--magenta)', textAlign: 'center' }}>● Tap in</p>
        <h1 className="h-display" style={{ fontSize: 34, textAlign: 'center', margin: '8px 0 4px' }}>
          WHO&apos;S THE<br/><span style={{ color: 'var(--magenta)', textShadow: 'var(--glow-magenta)' }}>IMPOSTOR</span>
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--faint)', fontFamily: 'var(--font-mono)', fontSize: 12.5, margin: '6px 0 28px' }}>
          {room ? 'Joining room ' + room : 'Enter your room code'}
        </p>

        {!roomParam && (
          <input value={roomInput} onChange={(e) => setRoomInput(e.target.value.toUpperCase())} placeholder="ROOM CODE" className="field" style={fieldStyle} />
        )}
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 8))} placeholder="YOUR NAME" className="field" style={{ ...fieldStyle, marginTop: 12 }} />

        {error && <p style={{ color: 'var(--magenta)', fontFamily: 'var(--font-mono)', fontSize: 12.5, textAlign: 'center', marginTop: 14 }}>{error}</p>}
      </div>
      <div className="dock">
        <button className="btn btn--primary" disabled={joining} onClick={onJoin}>
          {joining ? 'Joining…' : <>Join the room <Icon.arrow c="#0A0410" /></>}
        </button>
      </div>
    </div>
  );
}
const fieldStyle = {
  width: '100%', border: 'none', borderRadius: 16, padding: '16px 18px',
  background: 'var(--surface-2)', color: 'var(--ink)', boxShadow: '0 0 0 1px var(--line) inset',
  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '0.04em',
  textAlign: 'center', textTransform: 'uppercase', outline: 'none',
};

/* ════════════ WAITING ════════════ */
function WaitView({ me, room, count, status }) {
  return (
    <div className="screen">
      <div className="screen__scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 8 }}>
        <div className="pulse" style={{ borderRadius: '50%', marginBottom: 6 }}><Avatar p={me} size={96} glow /></div>
        <h1 className="h-display" style={{ fontSize: 30, color: 'var(--ink)' }}>{me.name}</h1>
        <div className="chip" style={{ color: 'var(--cyan)' }}>Room {room}</div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--faint)', marginTop: 18 }}>
          {status === 'setup' ? 'The booth is setting the trap…' : "You're in. Waiting for the booth…"}
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--violet)' }}>{count} in the room</p>
      </div>
    </div>
  );
}

/* ════════════ LIVE (player) ════════════ */
function PlayLiveView({ me, ps, players, uid, assignReady, started, onStart, myVote, onVote }) {
  const remaining = Game.timerRemaining(ps.timer);
  const playing = !!(ps.audio && ps.audio.playing);
  const others = window.IMP.connectedList(players).filter((p) => p.id !== uid);

  if (!started) {
    return (
      <div className="screen">
        <div className="screen__scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10 }}>
          <Icon.head s={64} c="var(--cyan)" />
          <h1 className="h-display" style={{ fontSize: 28, margin: '10px 0 2px' }}>PUT ON YOUR<br/>HEADSET</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--faint)', maxWidth: 240 }}>
            {assignReady ? 'Tap to start listening. Keep it to yourself.' : 'Getting your track ready…'}
          </p>
        </div>
        <div className="dock">
          <button className="btn btn--primary" disabled={!assignReady} onClick={onStart}>
            <Icon.play c="#0A0410" /> Tap to listen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen__scroll" style={{ paddingTop: 54 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div className="chip" style={{ color: 'var(--magenta)' }}>
            <span className="pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--magenta)', display: 'inline-block' }} /> Live
          </div>
          <div className="chip" style={{ fontFamily: 'var(--font-mono)' }}>{pfmt(Math.ceil(remaining))}</div>
        </div>

        {/* now playing (no track name — stays secret) */}
        <div className="card" style={{ padding: '28px 20px', marginBottom: 22, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(100% 100% at 50% 0%, rgba(37,230,255,0.16), transparent 65%)' }} />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div className="breathe" style={{ width: 84, height: 84, borderRadius: 20, background: `linear-gradient(135deg, ${me.c1}, ${me.c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ transform: 'scale(1.6)' }}><Eq color="#0A0410" bars={4} playing={playing} /></div>
            </div>
            <div>
              <p className="eyebrow">{playing ? 'Now playing in your ears' : 'Paused by the booth'}</p>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, marginTop: 4 }}>Listen closely 🎧</p>
            </div>
          </div>
        </div>

        {/* vote */}
        <SectionLabel accent="var(--magenta)">Who&apos;s the impostor?</SectionLabel>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--faint)', margin: '0 4px 14px' }}>
          Hearing something off? Lock your guess — you can change it until the reveal.
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', padding: '4px 0' }}>
          {others.map((p) => {
            const sel = myVote === p.id;
            return (
              <button key={p.id} onClick={() => onVote(p.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 66 }}>
                <Avatar p={p} size={56} ring={sel ? 'var(--magenta)' : undefined} dim={myVote && !sel} />
                <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, color: sel ? 'var(--magenta)' : 'var(--muted)' }}>{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="dock">
        <p style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: myVote ? 'var(--lime)' : 'var(--faint)', margin: 0 }}>
          {myVote ? '✓ Vote locked — tap another to change' : 'No vote yet'}
        </p>
      </div>
    </div>
  );
}

/* ════════════ REVEAL (player) ════════════ */
function PlayRevealView({ uid, players, result, myVote }) {
  if (!result) {
    return <div className="screen"><div className="screen__scroll" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ fontFamily: 'var(--font-mono)', color: 'var(--faint)' }}>Tallying…</p></div></div>;
  }
  const impP = wId(players[result.impostorUid], result.impostorUid);
  const youWereImp = uid === result.impostorUid;
  const youGuessed = myVote === result.impostorUid;
  const delta = (result.deltas && result.deltas[uid]) || 0;

  const verdict = youWereImp
    ? (result.caught ? 'You were the impostor — busted!' : 'You were the impostor — you got away! 😈')
    : (youGuessed ? 'Nailed it — you spotted the impostor.' : 'Not quite. Better luck next round.');

  return (
    <div className="screen">
      <div className="screen__scroll" style={{ paddingTop: 54, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <p className="eyebrow">The reveal</p>
        <p className="h-display" style={{ fontSize: 16, color: 'var(--muted)', margin: '14px 0 16px' }}>THE IMPOSTOR WAS</p>
        {impP && <div className="breathe"><Avatar p={impP} size={110} glow /></div>}
        {impP && <h1 className="h-display" style={{ fontSize: 40, margin: '16px 0 6px', color: 'var(--magenta)', textShadow: 'var(--glow-magenta)' }}>{impP.name}</h1>}
        <div className="chip" style={{ color: result.caught ? 'var(--cyan)' : 'var(--magenta)', marginBottom: 26 }}>
          {result.caught ? '✓ Caught by the crowd' : '✗ Got away with it'}
        </div>

        <div className="card" style={{ padding: '20px 18px', width: '100%' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', margin: 0 }}>{verdict}</p>
          <div className="h-display" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 34, marginTop: 10, color: delta > 0 ? 'var(--lime)' : 'var(--faint)' }}>
            {delta > 0 ? `+${delta}` : '+0'} <span style={{ fontSize: 14, color: 'var(--faint)' }}>pts</span>
          </div>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--faint)', marginTop: 22 }}>Waiting for the next round…</p>
      </div>
    </div>
  );
}

/* ════════════ SCOREBOARD (player) ════════════ */
function PlayScoresView({ uid, players, scores }) {
  const ranked = window.IMP.connectedList(players).sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
  const medal = ['var(--amber)', '#C9D2E0', '#E08A4B'];
  return (
    <div className="screen">
      <div className="screen__scroll" style={{ paddingTop: 54 }}>
        <p className="eyebrow" style={{ color: 'var(--amber)' }}>Standings</p>
        <h1 className="h-display" style={{ fontSize: 34, margin: '6px 0 22px' }}>SCOREBOARD</h1>
        <div className="card" style={{ overflow: 'hidden' }}>
          {ranked.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: p.id === uid ? 'rgba(154,107,255,0.12)' : 'transparent', borderBottom: i < ranked.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <span style={{ width: 22, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: medal[i] || 'var(--faint)', textAlign: 'center' }}>{i + 1}</span>
              <Avatar p={p} size={38} />
              <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{p.name}{p.id === uid ? ' · you' : ''}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: i === 0 ? 'var(--amber)' : 'var(--ink)' }}>{scores[p.id] || 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PlayerApp />);
