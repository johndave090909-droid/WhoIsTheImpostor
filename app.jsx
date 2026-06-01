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
  const [draft, setDraft] = useAppState({ common: null, impostor: null, impostorId: null });
  const [peekScores, setPeekScores] = useAppState(false);

  useAppEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        await window.fb.ready;
        let code = sessionStorage.getItem('boothRoom');
        if (code && !(await Game.roomExists(code))) code = null;
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

  if (!room) {
    return <div className="stage"><IOSDevice dark width={390} height={844}><Splash /></IOSDevice></div>;
  }

  const ps = state.publicState || {};
  const status = ps.status || 'lobby';
  const round = ps.round || 1;
  const players = state.players || {};
  const tracks = state.tracks || {};
  const scores = state.scores || {};
  const roundNode = state.round || {};
  const votes = state.votes || {};
  const results = state.results || {};
  const liveDraft = {
    common: roundNode.commonTrackId,
    impostor: roundNode.impostorTrackId,
    impostorId: roundNode.impostorUid,
  };

  const upload = (file, meta) => Game.uploadTrack(room, file, meta);

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
    screen = <LobbyScreen roomCode={room} players={players} round={round} scores={scores} onStart={() => Game.setStatus(room, 'setup')} />;
  } else if (status === 'setup') {
    screen = <SetupScreen players={players} tracks={tracks} round={round} draft={draft} setDraft={setDraft} onBack={() => Game.setStatus(room, 'lobby')} onStart={() => Game.startRound(room, draft, players, tracks)} onUpload={upload} />;
  } else if (status === 'live') {
    screen = <LiveScreen room={room} players={players} tracks={tracks} round={round} draft={liveDraft} ps={ps} votes={votes} onReveal={() => Game.tallyAndReveal(room)} />;
  } else if (status === 'reveal') {
    screen = <RevealScreen players={players} tracks={tracks} round={round} result={results[round]} onNext={() => { setDraft({ common: null, impostor: null, impostorId: null }); Game.nextRound(room); }} onScores={() => setPeekScores(true)} />;
  } else {
    screen = <ScoreboardScreen players={players} round={round} scores={scores} completed={Object.keys(results).length} onBack={() => Game.setStatus(room, 'lobby')} />;
  }

  return (
    <div className="stage">
      <IOSDevice dark width={390} height={844}>{screen}</IOSDevice>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<BoothApp />);
