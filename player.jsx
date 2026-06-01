// Player app — join a room, hear your assigned track, vote on the reveal.
const pfmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const wId = (obj, id) => (obj ? Object.assign({ id }, obj) : null);

// remember the room this phone is in, so a page reload rejoins instead of
// dropping out (the anonymous uid persists, so the player's slot still exists).
const RKEY = 'imp_room';
const saveRoom = (code) => { try { localStorage.setItem(RKEY, code); } catch (_) {} };
const clearRoom = () => { try { localStorage.removeItem(RKEY); } catch (_) {} };

// is time `t` inside one of the audio element's buffered ranges?
const isBuffered = (a, t) => {
  try {
    for (let i = 0; i < a.buffered.length; i++) {
      if (t >= a.buffered.start(i) - 0.1 && t <= a.buffered.end(i) + 0.1) return true;
    }
  } catch (_) {}
  return false;
};

function PlayerApp() {
  const roomParam = (new URLSearchParams(location.search).get('room') || '').toUpperCase();

  const [uid, setUid] = useState(null);
  const [room, setRoom] = useState(roomParam);
  const [roomInput, setRoomInput] = useState(roomParam); // prefilled from link, still editable
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
  const [showBoard, setShowBoard] = useState(false); // player-opened leaderboard

  const [started, setStarted] = useState(false); // audio gate
  const [, setTick] = useState(0);
  const audioRef = useRef(null);
  const liveRef = useRef({});
  const objUrlRef = useRef(null);
  const pctWriteRef = useRef(-1);
  const [audioUrl, setAudioUrl] = useState(null); // local blob URL once fully fetched
  const [loadPct, setLoadPct] = useState(0);

  // tell the booth how this phone's download/arming is going
  const reportReady = (val) => {
    if (!room || !uid) return;
    try { window.fb.db.ref('rooms/' + room + '/ready/' + uid).set(val); } catch (_) {}
  };

  /* ── auth + auto-resume (survives reloads) ── */
  useEffect(() => {
    (async () => {
      try {
        const id = await window.fb.ready;
        setUid(id);
        // resume from the link's ?room=, or the last room saved on this device
        let resume = roomParam;
        if (!resume) { try { resume = localStorage.getItem(RKEY) || ''; } catch (_) {} }
        if (!resume) return;

        if (!(await Game.roomExists(resume))) {
          if (roomParam) setError('Room ' + resume + ' not found.'); else clearRoom();
          return;
        }
        const status = (await window.fb.db.ref('rooms/' + resume + '/publicState/status').get()).val();
        if (status === 'ended') { clearRoom(); return; }

        const mine = await window.fb.db.ref('rooms/' + resume + '/players/' + id).get();
        if (mine.exists() && mine.val().name && !mine.val().kicked) {
          // still a member → rejoin seamlessly
          setName(mine.val().name);
          setRoom(resume);
          setRoomInput(resume);
          Game.bindPresence(resume, id);
          setJoined(true);
          saveRoom(resume);
        } else if (roomParam) {
          // arrived via link but not a member yet → prefill the join screen
          setRoom(resume);
          setRoomInput(resume);
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
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  /* ── pre-fetch the WHOLE assigned track into memory, then play from a
     local blob URL. Streaming during playback was the source of the
     intermittent stalls; a fully-downloaded blob never stalls mid-track.
     Falls back to the direct streaming URL if fetch is blocked (e.g. CORS). ── */
  const assignUrl = assign && assign.url;
  useEffect(() => {
    // reset any previous track
    setAudioUrl(null);
    setLoadPct(0);
    pctWriteRef.current = -1;
    if (objUrlRef.current) { URL.revokeObjectURL(objUrlRef.current); objUrlRef.current = null; }
    if (!assignUrl) { reportReady(null); return; }
    reportReady({ pct: 0, armed: false });

    let cancelled = false;
    const ready = () => {                // download finished — tell the booth
      reportReady({ pct: 100, armed: false });
      pctWriteRef.current = 100;
    };
    const useStream = () => {           // graceful fallback: stream the URL directly
      if (cancelled) return;
      const a = audioRef.current;
      if (a && a.src !== assignUrl) { a.src = assignUrl; a.load(); }
      setAudioUrl(assignUrl);
      setLoadPct(100);
      ready();
    };
    const useBlob = (blob) => {
      if (cancelled) return;
      const obj = URL.createObjectURL(blob);
      objUrlRef.current = obj;
      const a = audioRef.current;
      if (a) { a.src = obj; a.load(); }
      setAudioUrl(obj);
      setLoadPct(100);
      ready();
    };

    (async () => {
      try {
        const res = await fetch(assignUrl);
        if (!res.ok) throw new Error('http ' + res.status);
        const total = Number(res.headers.get('Content-Length')) || 0;
        if (res.body && total) {
          const reader = res.body.getReader();
          const chunks = [];
          let got = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (cancelled) { reader.cancel(); return; }
            chunks.push(value); got += value.length;
            const pct = Math.min(99, Math.round((got / total) * 100));
            setLoadPct(pct);
            if (pct - pctWriteRef.current >= 5) { pctWriteRef.current = pct; reportReady({ pct, armed: false }); }
          }
          useBlob(new Blob(chunks, { type: res.headers.get('Content-Type') || 'audio/mpeg' }));
        } else {
          useBlob(await res.blob());
        }
      } catch (_) {
        useStream();                    // CORS or network — fall back to streaming
      }
    })();

    return () => { cancelled = true; };
  }, [assignUrl]);

  // release the blob URL when the component goes away
  useEffect(() => () => { if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current); }, []);

  /* ── drift-correcting sync loop ──
     Buffer-aware + gentle: nudge playbackRate for small drift (inaudible),
     only hard-seek for a big gap, and never fight an active buffer/stall —
     which is what caused the seek→stall→seek "cutting" before. */
  useEffect(() => {
    const id = setInterval(() => {
      const { ps, started } = liveRef.current;
      const a = audioRef.current;
      if (!a || !started || !ps || !ps.audio) return;

      // paused by the booth
      if (!ps.audio.playing) {
        if (!a.paused) a.pause();
        if (a.playbackRate !== 1) a.playbackRate = 1;
        const expected = Game.audioPos(ps.audio);
        if (Math.abs(a.currentTime - expected) > 0.5) { try { a.currentTime = expected; } catch (_) {} }
        return;
      }

      // should be playing
      if (a.paused) a.play().catch(() => {});

      // mid-seek or starved buffer → let it recover, don't pile on more seeks
      if (a.seeking || a.readyState < 3 /* HAVE_FUTURE_DATA */) {
        if (a.playbackRate !== 1) a.playbackRate = 1;
        return;
      }

      const expected = Game.audioPos(ps.audio);
      const drift = a.currentTime - expected;   // +ahead, −behind
      const ad = Math.abs(drift);

      if (ad > 2) {
        // big gap → hard-seek, but only if the target is actually buffered
        if (isBuffered(a, expected)) { try { a.currentTime = expected; } catch (_) {} }
        a.playbackRate = 1;
      } else if (ad > 0.12) {
        // small drift → gently slew speed ±3% (no audible cut)
        a.playbackRate = drift > 0 ? 0.97 : 1.03;
      } else if (a.playbackRate !== 1) {
        a.playbackRate = 1;
      }
    }, 500);
    return () => { clearInterval(id); const a = audioRef.current; if (a) a.playbackRate = 1; };
  }, []);

  /* ── react instantly when the booth hits play/pause, so every armed phone
     starts the song on the same Firebase event (not up to a loop-tick late). ── */
  const psAudio = ps && ps.audio;
  useEffect(() => {
    if (!started) return;
    const a = audioRef.current;
    if (!a || !psAudio) return;
    const expected = Game.audioPos(psAudio);
    if (psAudio.playing) {
      if (isBuffered(a, expected)) { try { a.currentTime = expected; } catch (_) {} }
      a.play().catch(() => {});
    } else {
      if (!a.paused) a.pause();
      try { a.currentTime = expected; } catch (_) {}
    }
  }, [started, psAudio && psAudio.playing, psAudio && psAudio.anchorServerMs]);

  /* ── drop the headset gate whenever we leave the live round ── */
  const status = ps && ps.status;
  useEffect(() => {
    if (status !== 'live') {
      if (started) {
        setStarted(false);
        if (audioRef.current) audioRef.current.pause();
      }
      reportReady(null);
    } else {
      setShowBoard(false); // a new round started — leave the leaderboard
    }
  }, [status]);

  /* ── the host removed me from the room ── */
  const meKicked = !!(players[uid] && players[uid].kicked);
  useEffect(() => {
    if (joined && meKicked) {
      clearRoom();
      Game.unbindPresence(room, uid);
      if (audioRef.current) audioRef.current.pause();
      setStarted(false);
      setShowBoard(false);
      setJoined(false);
      setError('You were removed from the room by the host.');
    }
  }, [joined, meKicked]);

  /* ── the host ended the game ── */
  useEffect(() => {
    if (joined && status === 'ended') {
      clearRoom();
      Game.leaveRoom(room, uid).catch(() => {});
      if (audioRef.current) audioRef.current.pause();
      setStarted(false);
      setShowBoard(false);
      setJoined(false);
      setError('The host ended the game.');
    }
  }, [joined, status]);

  /* ── actions ── */
  const doJoin = async () => {
    const code = (roomInput || room).toUpperCase().trim();
    if (!code) { setError('Enter a room code.'); return; }
    if (!name.trim()) { setError('Enter a name.'); return; }
    setJoining(true); setError(null);
    try {
      if (!(await Game.roomExists(code))) { setError('Room ' + code + ' not found.'); setJoining(false); return; }
      await Game.joinRoom(code, name.trim());
      setRoom(code);
      setJoined(true);
      saveRoom(code);
    } catch (e) { setError((e && e.message) || 'Could not join.'); }
    setJoining(false);
  };

  // Tap "I'm ready": unlock audio with a user gesture (required by mobile
  // browsers so the booth can start sound remotely) WITHOUT starting the song,
  // then report armed. The booth starts everyone together.
  const arm = () => {
    const a = audioRef.current;
    const done = () => { setStarted(true); reportReady({ pct: 100, armed: true }); };
    if (a && audioUrl) {
      if (a.src !== audioUrl) a.src = audioUrl;
      a.play().then(() => {
        const live = liveRef.current.ps;
        const hostPlaying = !!(live && live.audio && live.audio.playing);
        if (!hostPlaying) { a.pause(); try { a.currentTime = 0; } catch (_) {} }
        done();
      }).catch(done);
    } else {
      done();
    }
  };

  // voluntarily leave the room
  const leave = async () => {
    if (!window.confirm('Leave the game?')) return;
    clearRoom();
    try { await Game.leaveRoom(room, uid); } catch (_) {}
    if (audioRef.current) audioRef.current.pause();
    setStarted(false);
    setShowBoard(false);
    setJoined(false);
    setRoom('');
  };

  const me = wId(players[uid], uid) || { id: uid, name: name || 'YOU', c1: '#9A6BFF', c2: '#25E6FF' };
  const amPlaying = window.IMP.isPlaying(players[uid]);

  /* ── render ── */
  let view;
  if (!joined) {
    view = <JoinView room={room} roomParam={roomParam} roomInput={roomInput} setRoomInput={setRoomInput} name={name} setName={setName} onJoin={doJoin} joining={joining} error={error} />;
  } else if (showBoard) {
    view = <PlayScoresView uid={uid} players={players} scores={scores} onBack={() => setShowBoard(false)} />;
  } else if (!ps || status === 'lobby' || status === 'setup') {
    view = <WaitView me={me} room={room} count={window.IMP.connectedList(players).length} status={status} amPlaying={amPlaying} onBoard={() => setShowBoard(true)} onLeave={leave} />;
  } else if (status === 'live') {
    view = <PlayLiveView me={me} ps={ps} players={players} uid={uid} amPlaying={amPlaying} canVote={Game.canVote(ps, players[uid])} assignReady={!!audioUrl} loadPct={loadPct} started={started} onStart={arm} myVote={myVote} onVote={(t) => Game.castVote(room, t)} />;
  } else if (status === 'reveal') {
    view = <PlayRevealView uid={uid} players={players} result={results[ps.round]} myVote={myVote} onBoard={() => setShowBoard(true)} onLeave={leave} />;
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
          Enter the room code from the booth
        </p>

        <input value={roomInput} onChange={(e) => setRoomInput(e.target.value.toUpperCase())} placeholder="ROOM CODE" className="field" style={fieldStyle} autoCapitalize="characters" autoCorrect="off" />
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
function WaitView({ me, room, count, status, amPlaying, onBoard, onLeave }) {
  return (
    <div className="screen">
      <div className="screen__scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 8 }}>
        <div className="pulse" style={{ borderRadius: '50%', marginBottom: 6 }}><Avatar p={me} size={96} glow /></div>
        <h1 className="h-display" style={{ fontSize: 30, color: 'var(--ink)' }}>{me.name}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="chip" style={{ color: 'var(--cyan)' }}>Room {room}</div>
          <div className="chip" style={{ color: amPlaying ? 'var(--lime)' : 'var(--violet)' }}>
            {amPlaying ? '🎧 Playing' : '👀 Audience'}
          </div>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--faint)', marginTop: 18 }}>
          {status === 'setup' ? 'The booth is setting the trap…' : "You're in. Waiting for the booth…"}
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: amPlaying ? 'var(--lime)' : 'var(--violet)', maxWidth: 260 }}>
          {amPlaying ? 'You’ll hear a track this round — get your headset ready.' : 'You’ll hear the crowd track and guess — the booth can move you into the game.'}
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--faint)' }}>{count} in the room</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          {onBoard && (
            <button className="chip" style={{ cursor: 'pointer', color: 'var(--amber)' }} onClick={onBoard}>
              <Icon.crown s={14} c="var(--amber)"/> Standings
            </button>
          )}
          {onLeave && (
            <button className="chip" style={{ cursor: 'pointer', color: 'var(--magenta)' }} onClick={onLeave}>
              <Icon.x s={13} c="var(--magenta)"/> Leave
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════ LIVE (player) ════════════ */
function PlayLiveView({ me, ps, players, uid, amPlaying, canVote, assignReady, loadPct, started, onStart, myVote, onVote }) {
  const remaining = Game.timerRemaining(ps.timer);
  const playing = !!(ps.audio && ps.audio.playing);
  // you can only accuse someone who's actually playing this round
  const others = window.IMP.playingList(players).filter((p) => p.id !== uid);

  // Everyone (players AND audience) hears a track now, so everyone arms their
  // headset first. Audience hears the crowd track; the impostor hears theirs.
  if (!started) {
    return (
      <div className="screen">
        <div className="screen__scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10 }}>
          <Icon.head s={64} c="var(--cyan)" />
          <h1 className="h-display" style={{ fontSize: 28, margin: '10px 0 2px' }}>PUT ON YOUR<br/>HEADSET</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--faint)', maxWidth: 250 }}>
            {assignReady
              ? 'Track loaded. Tap ready — the booth starts the music for everyone at once.'
              : `Downloading your track… ${loadPct || 0}%`}
          </p>
        </div>
        <div className="dock">
          <button className="btn btn--primary" disabled={!assignReady} onClick={onStart}>
            <Icon.head c="#0A0410" /> {assignReady ? "I'm ready" : `Downloading… ${loadPct || 0}%`}
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
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="chip" style={{ color: amPlaying ? 'var(--lime)' : 'var(--violet)' }}>{amPlaying ? '🎧 Playing' : '👀 Audience'}</div>
            <div className="chip" style={{ fontFamily: 'var(--font-mono)' }}>{pfmt(Math.ceil(remaining))}</div>
          </div>
        </div>

        {/* now playing (playing) / watching (audience) — no track name, stays secret */}
        <div className="card" style={{ padding: '28px 20px', marginBottom: 22, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: amPlaying ? 'radial-gradient(100% 100% at 50% 0%, rgba(37,230,255,0.16), transparent 65%)' : 'radial-gradient(100% 100% at 50% 0%, rgba(154,107,255,0.16), transparent 65%)' }} />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div className="breathe" style={{ width: 84, height: 84, borderRadius: 20, background: `linear-gradient(135deg, ${me.c1}, ${me.c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ transform: 'scale(1.6)' }}><Eq color="#0A0410" bars={4} playing={playing} /></div>
            </div>
            <div>
              {amPlaying ? (
                <>
                  <p className="eyebrow">{playing ? 'Now playing in your ears' : 'Paused by the booth'}</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, marginTop: 4 }}>Listen closely 🎧</p>
                </>
              ) : (
                <>
                  <p className="eyebrow">{playing ? 'Now playing in your ears' : 'Paused by the booth'}</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, marginTop: 4 }}>Listen &amp; guess 🎧</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* vote */}
        {canVote ? (
          <>
            <SectionLabel accent="var(--magenta)">Who&apos;s the impostor?</SectionLabel>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--faint)', margin: '0 4px 14px' }}>
              {amPlaying
                ? 'Hearing something off? Lock your guess — you can change it until the reveal.'
                : 'Watch the players react. Lock your guess — you can change it until the reveal.'}
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
          </>
        ) : (
          <div className="card" style={{ padding: '22px 18px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', margin: 0 }}>Voting is off for your group</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--faint)', margin: '8px 0 0' }}>
              {amPlaying ? 'The booth has only the audience voting this round.' : 'The booth has only the players voting this round.'}
            </p>
          </div>
        )}
      </div>
      <div className="dock">
        <p style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: !canVote ? 'var(--faint)' : myVote ? 'var(--lime)' : 'var(--faint)', margin: 0 }}>
          {!canVote ? 'Sit back and watch' : myVote ? '✓ Vote locked — tap another to change' : 'No vote yet'}
        </p>
      </div>
    </div>
  );
}

/* ════════════ REVEAL (player) ════════════ */
function PlayRevealView({ uid, players, result, myVote, onBoard, onLeave }) {
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
        {onBoard && (
          <button className="btn btn--ghost" style={{ marginTop: 22 }} onClick={onBoard}>
            <Icon.crown c="var(--amber)"/> View standings
          </button>
        )}
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--faint)', marginTop: 22 }}>Waiting for the next round…</p>
        {onLeave && (
          <button onClick={onLeave} style={{ background: 'none', border: 'none', color: 'var(--magenta)', fontFamily: 'var(--font-mono)', fontSize: 12.5, marginTop: 14, cursor: 'pointer' }}>
            Leave game
          </button>
        )}
      </div>
    </div>
  );
}

/* ════════════ SCOREBOARD (player) ════════════ */
function PlayScoresView({ uid, players, scores, onBack }) {
  const ranked = window.IMP.connectedList(players).sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
  const medal = ['var(--amber)', '#C9D2E0', '#E08A4B'];
  return (
    <div className="screen">
      <div className="screen__scroll" style={{ paddingTop: 54 }}>
        {onBack && (
          <button className="chip" style={{ cursor: 'pointer', marginBottom: 16 }} onClick={onBack}>
            <Icon.back s={14}/> Back
          </button>
        )}
        <p className="eyebrow" style={{ color: 'var(--amber)' }}>Standings</p>
        <h1 className="h-display" style={{ fontSize: 34, margin: '6px 0 22px' }}>SCOREBOARD</h1>
        <div className="card" style={{ overflow: 'hidden' }}>
          {ranked.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: p.id === uid ? 'rgba(154,107,255,0.12)' : 'transparent', borderBottom: i < ranked.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <span style={{ width: 22, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: medal[i] || 'var(--faint)', textAlign: 'center' }}>{i + 1}</span>
              <Avatar p={p} size={38} dim={!window.IMP.isPlaying(p)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}{p.id === uid ? ' · you' : ''}</div>
                <RoleTag playing={window.IMP.isPlaying(p)} />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: i === 0 ? 'var(--amber)' : 'var(--ink)' }}>{scores[p.id] || 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PlayerApp />);
