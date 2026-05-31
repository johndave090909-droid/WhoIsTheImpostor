// App root — operator state machine
const { useState: useStateApp } = React;

function computeResult(live, impostorId, voters = 8) {
  const others = live.filter(p => p.id !== impostorId);
  const correct = 2 + Math.floor(Math.random() * (voters - 3)); // 2 .. voters-2
  const votes = { [impostorId]: correct };
  let remaining = voters - correct;
  // scatter the wrong guesses
  const pool = [...others];
  while (remaining > 0 && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    const p = pool[idx];
    votes[p.id] = (votes[p.id] || 0) + 1;
    remaining--;
    if (Math.random() > 0.55) pool.splice(idx, 1);
  }
  const caught = correct > voters / 2;
  const deltas = {};
  if (caught) others.forEach(p => { deltas[p.id] = 2; });
  else deltas[impostorId] = 5;
  return { votes, voters, caught, deltas };
}

function App() {
  const players = window.IMP.PLAYERS;
  const [screen, setScreen] = useStateApp('lobby');
  const [round, setRound] = useStateApp(1);
  const [scores, setScores] = useStateApp({});
  const [draft, setDraft] = useStateApp({ common: null, impostor: null, impostorId: null });
  const [result, setResult] = useStateApp(null);

  const goReveal = () => {
    const live = players.filter(p => p.state === 'connected');
    const r = computeResult(live, draft.impostorId);
    setScores(s => {
      const next = { ...s };
      Object.entries(r.deltas).forEach(([id, d]) => { next[id] = (next[id] || 0) + d; });
      return next;
    });
    setResult(r);
    setScreen('reveal');
  };

  const nextRound = () => {
    setRound(r => r + 1);
    setDraft({ common: null, impostor: null, impostorId: null });
    setResult(null);
    setScreen('setup');
  };

  let view;
  if (screen === 'lobby')
    view = <LobbyScreen players={players} round={round} scores={scores} onStart={() => setScreen('setup')} />;
  else if (screen === 'setup')
    view = <SetupScreen players={players} round={round} draft={draft} setDraft={setDraft} onBack={() => setScreen('lobby')} onStart={() => setScreen('live')} />;
  else if (screen === 'live')
    view = <LiveScreen players={players} round={round} draft={draft} onReveal={goReveal} />;
  else if (screen === 'reveal')
    view = <RevealScreen players={players} round={round} draft={draft} result={result} onNext={nextRound} onScores={() => setScreen('scoreboard')} />;
  else
    view = <ScoreboardScreen players={players} round={round} scores={scores} completed={result ? round : round - 1} onBack={() => setScreen(result ? 'reveal' : 'lobby')} />;

  return (
    <div className="stage">
      <IOSDevice dark width={390} height={844}>
        {view}
      </IOSDevice>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
