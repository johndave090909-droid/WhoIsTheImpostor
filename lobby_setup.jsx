// Lobby + Setup screens (booth) — live Firebase data
const { toList, connectedList, playingList, audienceList, isPlaying } = window.IMP;

/* ───────────── QR code ───────────── */
function QR({ text, size = 54 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !window.QRCode || !text) return;
    ref.current.innerHTML = '';
    new window.QRCode(ref.current, {
      text, width: size, height: size,
      colorDark: '#07060C', colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.M,
    });
  }, [text, size]);
  return <div ref={ref} style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', background: '#fff' }} />;
}

/* ════════════════════ LOBBY ════════════════════ */
function LobbyScreen({ roomCode, players, round, scores, onStart, onKick, onRole, onSignOut, onEndGame }) {
  const live = connectedList(players);
  const playing = playingList(players);
  const audience = audienceList(players);
  const canStart = playing.length >= 3;
  const link = Game.playerURL(roomCode);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Who's The Impostor", text: 'Join the round', url: link });
      else { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    } catch (e) { /* dismissed */ }
  };

  return (
    <div className="screen">
      <div className="screen__scroll">

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <p className="eyebrow" style={{ color: 'var(--magenta)' }}>● Live booth</p>
            <h1 className="h-display" style={{ fontSize: 26, marginTop: 6 }}>
              WHO&apos;S THE<br/><span style={{ color: 'var(--magenta)', textShadow: 'var(--glow-magenta)' }}>IMPOSTOR</span>
            </h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div className="chip" style={{ color: 'var(--cyan)' }}>Round {round}</div>
            {onEndGame && <button className="chip" style={{ cursor: 'pointer', color: 'var(--magenta)' }} onClick={onEndGame}>End game</button>}
            {onSignOut && <button className="chip" style={{ cursor: 'pointer' }} onClick={onSignOut}>Sign out</button>}
          </div>
        </div>

        {/* room hero */}
        <div className="card" style={{ padding: 20, marginBottom: 22, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 100% 0%, rgba(37,230,255,0.16), transparent 60%)' }} />
          <div style={{ position: 'relative' }}>
            <p className="eyebrow">Players join at room</p>
            <div className="h-display" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 38, letterSpacing: '0.02em', margin: '8px 0 4px', color: 'var(--cyan)', textShadow: 'var(--glow-cyan)' }}>{roomCode}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <button className="chip" style={{ cursor: 'pointer' }} onClick={share}><Icon.share s={14}/> {copied ? 'Copied!' : 'Share link'}</button>
            </div>
          </div>
          <div style={{ position: 'absolute', top: 18, right: 18 }}>
            <QR text={link} size={56} />
          </div>
        </div>

        {/* roster — tap a tile to toggle Playing / Audience */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 4px 12px' }}>
          <SectionLabel accent="var(--cyan)">Roster · tap to set who&apos;s playing</SectionLabel>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--faint)' }}>
            <span style={{ color: 'var(--lime)' }}>{playing.length} playing</span> · {audience.length} audience
          </span>
        </div>

        {live.length === 0 ? (
          <div className="card" style={{ padding: '22px 16px', textAlign: 'center', color: 'var(--faint)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
            Waiting for phones to join… share the room code above.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {live.map((p, i) => <PlayerCell key={p.id} p={p} score={scores[p.id] || 0} delay={i * 0.04} onKick={onKick} onRole={onRole} />)}
          </div>
        )}

      </div>

      <div className="dock">
        {!canStart && <p style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 12, margin: '0 0 10px', fontFamily: 'var(--font-mono)' }}>Tap players to set at least 3 as <span style={{ color: 'var(--lime)' }}>Playing</span></p>}
        <button className="btn btn--primary" disabled={!canStart} onClick={onStart}>
          Set up round <Icon.arrow c="#0A0410" />
        </button>
      </div>
    </div>
  );
}

function PlayerCell({ p, score, delay, onKick, onRole }) {
  const playing = isPlaying(p);
  const accent = playing ? 'var(--lime)' : 'var(--faint)';
  const toggleRole = () => onRole && onRole(p.id, playing ? 'audience' : 'playing');
  return (
    <div className="card float-up" onClick={onRole ? toggleRole : undefined} style={{
      padding: 12, display: 'flex', alignItems: 'center', gap: 11,
      animationDelay: `${delay}s`, cursor: onRole ? 'pointer' : 'default',
      background: 'var(--surface)',
      boxShadow: playing ? '0 0 0 1.5px var(--lime) inset' : '0 0 0 1px var(--line) inset',
    }}>
      <Avatar p={p} size={44} dim={!playing} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}` }} />
          <span style={{ fontSize: 11, color: accent, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{playing ? 'Playing' : 'Audience'}</span>
        </div>
      </div>
      {score > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--violet)' }}>{score}</span>}
      {onKick && (
        <button onClick={(e) => { e.stopPropagation(); onKick(p.id); }} title="Remove player" style={{
          border: 'none', cursor: 'pointer', background: 'var(--surface-3)',
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 1px var(--line) inset',
        }}><Icon.x s={13} c="var(--magenta)"/></button>
      )}
    </div>
  );
}

/* ════════════════════ SETUP ════════════════════ */
function SetupScreen({ roomCode, players, tracks, round, draft, setDraft, voting, onVoting, onBack, onStart, onUpload, onTag, onDeleteTrack }) {
  voting = voting || { players: true, audience: true };
  const audienceCount = audienceList(players).length;
  const [target, setTarget] = useState('crowd');
  const [uploadPct, setUploadPct] = useState(null);
  const fileRef = useRef(null);
  const live = playingList(players);   // only playing members can be the impostor
  const allTracks = toList(tracks);
  // a track suits the active slot if it's tagged for that slot or "both" (default)
  const suitsSlot = (t, slot) => { const tag = t.tag || 'both'; return tag === 'both' || tag === slot; };
  const trackList = allTracks.filter(t => suitsSlot(t, target));
  const impostorConnected = live.some(p => p.id === draft.impostorId);
  const someoneCanVote = voting.players || voting.audience;
  const ready = draft.common && draft.impostor && draft.impostorId && impostorConnected && someoneCanVote;

  const trackById = (id) => tracks[id] ? Object.assign({ id }, tracks[id]) : null;

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
    if (!live.length) return;
    const r = live[Math.floor(Math.random() * live.length)];
    setDraft(d => ({ ...d, impostorId: r.id }));
  };

  const deleteTrack = (t) => {
    // drop it from the draft if it was selected, then ask the host to delete
    setDraft(d => ({
      ...d,
      common: d.common === t.id ? null : d.common,
      impostor: d.impostor === t.id ? null : d.impostor,
    }));
    onDeleteTrack && onDeleteTrack(t.id, t.title);
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploadPct(0);
    let dur = '';
    try { dur = await readDuration(file); } catch (_) {}
    try {
      // new uploads default to the slot you're currently filling
      await onUpload(file, { dur, tag: target, onProgress: (p) => setUploadPct(Math.round(p * 100)) });
    } catch (err) {
      window.fb.showBanner('Upload failed: ' + (err && err.message));
    }
    setUploadPct(null);
  };

  return (
    <div className="screen">
      <div className="screen__scroll">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="chip" style={{ cursor: 'pointer' }} onClick={onBack}><Icon.back s={14}/> Booth</button>
          {roomCode && <div className="chip" style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>Room {roomCode}</div>}
        </div>
        <p className="eyebrow">Round {round} · setup</p>
        <h1 className="h-display" style={{ fontSize: 30, margin: '6px 0 20px' }}>SET THE TRAP</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
          <SlotCard label="The crowd hears" accent="var(--cyan)" t={trackById(draft.common)} active={target==='crowd'} onClick={() => setTarget('crowd')} />
          <SlotCard label="The impostor hears" accent="var(--magenta)" t={trackById(draft.impostor)} active={target==='impostor'} onClick={() => setTarget('impostor')} />
        </div>
        <p style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 12, margin: '0 0 18px', fontFamily: 'var(--font-mono)' }}>
          Tap a slot, then pick a track below
        </p>

        {/* track library — filtered to the active slot */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 4px 12px' }}>
          <SectionLabel accent={target === 'crowd' ? 'var(--cyan)' : 'var(--magenta)'}>
            {target === 'crowd' ? 'Crowd' : 'Impostor'} tracks · {trackList.length}{trackList.length > 5 ? ' · scroll ↕' : ''}
          </SectionLabel>
          <button className="chip" style={{ cursor: 'pointer', color: 'var(--violet)' }} onClick={() => fileRef.current && fileRef.current.click()} disabled={uploadPct !== null}>
            <Icon.share s={13} c="var(--violet)"/> {uploadPct !== null ? `Uploading ${uploadPct}%` : 'Upload'}
          </button>
          <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={onFile} />
        </div>
        <div className="card track-scroll" style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: 290, marginBottom: 24, WebkitOverflowScrolling: 'touch' }}>
          {trackList.length === 0 && (
            <div style={{ padding: '22px 16px', textAlign: 'center', color: 'var(--faint)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
              No {target} tracks yet — tap <span style={{ color: 'var(--violet)' }}>Upload</span> to add one, or set an existing track to <span style={{ color: target === 'crowd' ? 'var(--cyan)' : 'var(--magenta)' }}>{target}</span> / Both below.
            </div>
          )}
          {trackList.map((t, i) => {
            const isCrowd = draft.common === t.id;
            const isImp = draft.impostor === t.id;
            const sel = isCrowd ? { t: 'CROWD', c: 'var(--cyan)' } : isImp ? { t: 'IMPOSTOR', c: 'var(--magenta)' } : null;
            const ttag = t.tag || 'both';
            return (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                background: sel ? `${sel.c}14` : 'transparent',
                borderBottom: i < trackList.length-1 ? '1px solid var(--line)' : 'none',
                boxShadow: sel ? `inset 3px 0 0 ${sel.c}` : 'none',
              }}>
                <button onClick={() => pickTrack(t)} style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: 0 }}>
                  <Cover t={t} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--faint)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.file}</div>
                  </div>
                </button>
                {sel
                  ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: sel.c, padding: '4px 8px', borderRadius: 999, boxShadow: `0 0 0 1px ${sel.c}55 inset`, flexShrink: 0 }}>{sel.t}</span>
                  : <TagPicker tag={ttag} onSet={(g) => onTag(t.id, g)} />}
                {onDeleteTrack && (
                  <button onClick={(e) => { e.stopPropagation(); deleteTrack(t); }} title="Delete track" style={{
                    border: 'none', cursor: 'pointer', background: 'var(--surface-3)',
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 0 1px var(--line) inset',
                  }}><Icon.x s={13} c="var(--magenta)"/></button>
                )}
              </div>
            );
          })}
        </div>

        {/* who votes */}
        <SectionLabel accent="var(--amber)">Who can vote?</SectionLabel>
        <div className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
          <VoteToggle label="Players" sub={`${live.length} playing`} accent="var(--lime)" on={voting.players} onClick={() => onVoting({ players: !voting.players })} />
          <div style={{ height: 1, background: 'var(--line)' }} />
          <VoteToggle label="Audience" sub={`${audienceCount} watching`} accent="var(--violet)" on={voting.audience} onClick={() => onVoting({ audience: !voting.audience })} />
          {!voting.players && !voting.audience && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--magenta)', textAlign: 'center', margin: 0, padding: '10px 14px' }}>
              Nobody can vote — turn on at least one.
            </p>
          )}
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

// compact 3-way role tag for a library track: Crowd / Imp / Both
function TagPicker({ tag, onSet }) {
  const opts = [
    { k: 'crowd', t: 'C', c: 'var(--cyan)', title: 'Crowd only' },
    { k: 'impostor', t: 'I', c: 'var(--magenta)', title: 'Impostor only' },
    { k: 'both', t: 'B', c: 'var(--violet)', title: 'Both slots' },
  ];
  return (
    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      {opts.map(o => {
        const on = tag === o.k;
        return (
          <button key={o.k} title={o.title} onClick={() => onSet(o.k)} style={{
            width: 24, height: 24, borderRadius: 7, cursor: 'pointer', border: 'none',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            background: on ? o.c : 'var(--surface-3)',
            color: on ? '#0A0410' : 'var(--faint)',
            boxShadow: on ? `0 0 8px ${o.c}66` : '0 0 0 1px var(--line) inset',
          }}>{o.t}</button>
        );
      })}
    </div>
  );
}

function VoteToggle({ label, sub, accent, on, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px',
      background: on ? `${accent}14` : 'transparent',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: on ? 'var(--ink)' : 'var(--muted)' }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--faint)' }}>{sub}</div>
      </div>
      {/* switch */}
      <div style={{
        width: 44, height: 26, borderRadius: 999, flexShrink: 0, position: 'relative',
        background: on ? accent : 'var(--surface-3)', transition: 'background .15s ease',
        boxShadow: on ? `0 0 12px ${accent}66` : '0 0 0 1px var(--line) inset',
      }}>
        <div style={{
          position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20,
          borderRadius: '50%', background: '#0A0410', transition: 'left .15s ease',
        }} />
      </div>
    </button>
  );
}

function SlotCard({ label, accent, t, active, onClick }) {
  return (
    <button onClick={onClick} className="card" style={{
      padding: 14, textAlign: 'left', cursor: 'pointer', border: 'none',
      background: active ? `${accent}1A` : 'var(--surface)',
      boxShadow: active ? `0 0 0 1.5px ${accent}, 0 0 22px ${accent}40` : '0 0 0 1px var(--line) inset',
      minHeight: 118, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      overflow: 'hidden', maxWidth: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}`, flexShrink: 0 }} />
        <span className="eyebrow" style={{ color: accent, fontSize: 10 }}>{label}</span>
      </div>
      {t ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, width: '100%' }}>
          <Cover t={t} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
            <div style={{ fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artist}</div>
          </div>
        </div>
      ) : (
        <div style={{ color: 'var(--faint)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>Tap a track ↓</div>
      )}
    </button>
  );
}

// read an audio file's duration as "m:ss" without uploading
function readDuration(file) {
  return new Promise((resolve, reject) => {
    const a = document.createElement('audio');
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(a.src);
      const s = Math.round(a.duration || 0);
      resolve(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    };
    a.onerror = reject;
    a.src = URL.createObjectURL(file);
  });
}

Object.assign(window, { LobbyScreen, SetupScreen, QR });
