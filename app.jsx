// Booth (operator) root — drives the room over Firebase.
const { useState: useAppState, useEffect: useAppEffect } = React;

function Splash({ msg }) {
  return (
    <div className="screen">
      <div className="screen__scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 14 }}>
        <div className="breathe">
          <h1 className="h-display" style={{ fontSize: 30, color: 'var(--magenta)', textShadow: 'var(--glow-magenta)' }}>WHO&apos;S THE<br/>IMPOSTOR</h1>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--faint)' }}>{msg || 'Opening the booth…'}</p>
      </div>
    </div>
  );
}

function BoothApp() {
  const [room, setRoom] = useAppState(null);
  const [state, setState] = useAppState({});
  const [library, setLibrary] = useAppState({});
  const [draft, setDraft] = useAppState({ common: null, impostor: null, impostorId: null });
  const [peekScores, setPeekScores] = useAppState(false);

  useAppEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        await window.fb.ready;
        const uid = await window.fb.getUid();
        let code = sessionStorage.getItem('boothRoom');
        // only reuse a room this operator actually owns; otherwise start fresh
        if (code && !(await Game.roomOwnedBy(code, uid))) code = null;
        if (!code) {
          code = await Game.createRoom();
          sessionStorage.setItem('boothRoom', code);
        }
        setRoom(code);
        unsub = Game.watch(code, (snap) => setState(snap));
      } catch (e) {
        window.fb.showBanner('Could not open the booth: ' + (e && e.message));
      }
    })();
    return () => unsub();
  }, []);

  // shared, persistent music library (across all rooms/sessions)
  useAppEffect(() => {
    let unsub = () => {};
    (async () => {
      await window.fb.ready;
      unsub = Game.watchLibrary(setLibrary);
      Game.reconcileLibrary().catch(() => {});
    })();
    return () => unsub();
  }, []);

  if (!room) {
    return <div className="stage"><IOSDevice dark width={390} height={844}><Splash /></IOSDevice></div>;
  }

  const ps = state.publicState || {};
  const status = ps.status || 'lobby';
  const round = ps.round || 1;
  const players = state.players || {};
  const tracks = library;                 // shared library is the track source
  const scores = state.scores || {};
  const streaks = state.streaks || {};
  const roundNode = state.round || {};
  const votes = state.votes || {};
  const results = state.results || {};
  const liveDraft = {
    common: roundNode.commonTrackId,
    impostor: roundNode.impostorTrackId,
    impostorId: roundNode.impostorUid,
  };

  const upload = (file, meta) => Game.uploadTrack(file, meta);

  const endGame = async () => {
    if (!window.confirm('End the game for everyone? Players will be removed and you’ll start a fresh room.')) return;
    try { await Game.endGame(room); } catch (_) {}
    sessionStorage.removeItem('boothRoom');
    location.reload(); // booth reopens into a brand-new owned room
  };

  let screen;
  if (peekScores) {
    screen = (
      <ScoreboardScreen
        players={players}
        round={round}
        scores={scores}
        completed={Object.keys(results).length}
        onBack={() => setPeekScores(false)}
      />
    );
  } else if (status === 'lobby') {
    screen = <LobbyScreen roomCode={room} players={players} round={round} scores={scores} onStart={() => Game.setStatus(room, 'setup')} onKick={(uid) => { if (window.confirm('Remove this player from the game?')) Game.kick(room, uid); }} onRole={(uid, role) => Game.setRole(room, uid, role)} onSignOut={() => window.fb.signOutUser()} onEndGame={endGame} />;
  } else if (status === 'setup') {
    screen = <SetupScreen roomCode={room} players={players} tracks={tracks} round={round} draft={draft} setDraft={setDraft} voting={Game.votingConfig(ps)} onVoting={(v) => Game.setVoting(room, v)} onBack={() => Game.setStatus(room, 'lobby')} onStart={() => Game.startRound(room, draft, players, tracks)} onUpload={upload} />;
  } else if (status === 'live') {
    screen = <LiveScreen room={room} players={players} tracks={tracks} round={round} draft={liveDraft} ps={ps} votes={votes} ready={state.ready || {}} assignments={state.assignments || {}} onReveal={() => Game.tallyAndReveal(room)} onEndGame={endGame} />;
  } else if (status === 'reveal') {
    screen = <RevealScreen players={players} tracks={tracks} round={round} result={results[round]} streaks={streaks} scores={scores} onNext={() => { setDraft({ common: null, impostor: null, impostorId: null }); Game.nextRound(room); }} onScores={() => setPeekScores(true)} />;
  } else {
    screen = <ScoreboardScreen players={players} round={round} scores={scores} completed={Object.keys(results).length} onBack={() => Game.setStatus(room, 'lobby')} />;
  }

  return (
    <div className="stage">
      <IOSDevice dark width={390} height={844}>{screen}</IOSDevice>
    </div>
  );
}

/* ════════════════════ OPERATOR LOGIN ════════════════════ */
function prettyAuthError(e) {
  const c = (e && e.code) || '';
  if (c.includes('email-already-in-use')) return 'That email already has an account — sign in instead.';
  if (c.includes('invalid-email')) return 'That email looks invalid.';
  if (c.includes('weak-password')) return 'Password should be at least 6 characters.';
  if (c.includes('wrong-password') || c.includes('invalid-credential') || c.includes('invalid-login')) return 'Wrong email or password.';
  if (c.includes('user-not-found')) return 'No account with that email — create one.';
  if (c.includes('too-many-requests')) return 'Too many attempts — try again in a moment.';
  if (c.includes('popup-closed') || c.includes('cancelled-popup')) return 'Google sign-in was cancelled.';
  if (c.includes('operation-not-allowed')) return 'This sign-in method isn’t enabled in Firebase yet.';
  if (c.includes('unauthorized-domain')) return 'This domain isn’t authorized for sign-in (Firebase Auth → Settings → Authorized domains).';
  return (e && e.message) || 'Something went wrong.';
}

function LoginScreen() {
  const [mode, setMode] = useAppState('signin');     // 'signin' | 'signup'
  const [email, setEmail] = useAppState('');
  const [pw, setPw] = useAppState('');
  const [err, setErr] = useAppState(null);
  const [busy, setBusy] = useAppState(false);

  const fld = {
    width: '100%', border: 'none', borderRadius: 16, padding: '16px 18px',
    background: 'var(--surface-2)', color: 'var(--ink)', boxShadow: '0 0 0 1px var(--line) inset',
    fontFamily: 'var(--font-ui)', fontSize: 16, outline: 'none',
  };

  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      if (mode === 'signup') await window.fb.signUpEmail(email.trim(), pw);
      else await window.fb.signInEmail(email.trim(), pw);
    } catch (e) { setErr(prettyAuthError(e)); setBusy(false); }
  };
  const google = async () => {
    setErr(null); setBusy(true);
    try { await window.fb.signInGoogle(); }
    catch (e) { setErr(prettyAuthError(e)); setBusy(false); }
  };

  return (
    <div className="stage"><IOSDevice><div className="screen">
      <div className="screen__scroll" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 60 }}>
        <p className="eyebrow" style={{ color: 'var(--magenta)', textAlign: 'center' }}>● Operator booth</p>
        <h1 className="h-display" style={{ fontSize: 34, textAlign: 'center', margin: '8px 0 4px' }}>
          WHO&apos;S THE<br/><span style={{ color: 'var(--magenta)', textShadow: 'var(--glow-magenta)' }}>IMPOSTOR</span>
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--faint)', fontFamily: 'var(--font-mono)', fontSize: 12.5, margin: '6px 0 26px' }}>
          {mode === 'signup' ? 'Create an operator account' : 'Sign in to host a game'}
        </p>

        <input type="email" value={email} autoCapitalize="none" autoCorrect="off"
          onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={fld} />
        <input type="password" value={pw}
          onChange={(e) => setPw(e.target.value)} placeholder="Password" style={{ ...fld, marginTop: 12 }}
          onKeyDown={(e) => { if (e.key === 'Enter' && email && pw) submit(); }} />

        {err && <p style={{ color: 'var(--magenta)', fontFamily: 'var(--font-mono)', fontSize: 12.5, textAlign: 'center', marginTop: 14 }}>{err}</p>}

        <button className="btn btn--primary" style={{ marginTop: 18 }} disabled={busy || !email || !pw} onClick={submit}>
          {busy ? 'Please wait…' : (mode === 'signup' ? 'Create account' : 'Sign in')}
        </button>
        <button className="btn btn--ghost" style={{ marginTop: 10 }} disabled={busy} onClick={google}>
          <svg width="17" height="17" viewBox="0 0 18 18" style={{ flexShrink: 0 }}><path fill="#4285F4" d="M17.6 9.2c0-.6-.05-1.18-.16-1.74H9v3.3h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.64-3.88 2.64-6.54z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
          Continue with Google
        </button>

        <button onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setErr(null); }}
          style={{ background: 'none', border: 'none', color: 'var(--cyan)', fontFamily: 'var(--font-mono)', fontSize: 12.5, marginTop: 18, cursor: 'pointer' }}>
          {mode === 'signup' ? 'Have an account? Sign in' : 'New here? Create an account'}
        </button>

        <div style={{ height: 1, background: 'var(--line)', margin: '24px 0 0' }} />
        <p style={{ textAlign: 'center', color: 'var(--faint)', fontFamily: 'var(--font-mono)', fontSize: 11.5, margin: '16px 0 10px' }}>
          Here to play, not host?
        </p>
        <button className="btn btn--ghost" onClick={() => { window.location.href = '/'; }}>
          <Icon.head c="var(--ink)" /> Join a game as a player
        </button>
      </div>
    </div></IOSDevice></div>
  );
}

/* ════════════════════ AUTH GATE ════════════════════ */
function BoothRoot() {
  const [user, setUser] = useAppState(undefined); // undefined = still checking
  useAppEffect(() => window.fb.onUser((u) => {
    if (u && u.isAnonymous) { window.fb.signOutUser(); setUser(null); return; }
    setUser(u || null);
  }), []);

  if (user === undefined) return <div className="stage"><IOSDevice><Splash msg="Loading…" /></IOSDevice></div>;
  if (!user) return <LoginScreen />;
  return <BoothApp user={user} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<BoothRoot />);
