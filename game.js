// ─────────────────────────────────────────────────────────────
// game.js — framework-agnostic room API over Firebase RTDB + Storage.
// Used by both the booth (host) and the player app. Exposes window.Game.
// Requires window.fb (firebase-init.js) to be loaded first.
// ─────────────────────────────────────────────────────────────
(function () {
  const ROUND_SECS = 120;
  const NEON = ["#FF2E9A", "#25E6FF", "#C6FF3D", "#FFB23E", "#9A6BFF"];
  const WORDS = ["PULSE", "NEON", "VOLT", "ECHO", "RIFT", "FLUX", "HALO", "DUSK"];

  const db = () => window.fb.db;
  const roomRef = (room, path) =>
    db().ref("rooms/" + room + (path ? "/" + path : ""));

  // ── helpers ──────────────────────────────────────────────
  function randomRoomCode() {
    const w = WORDS[Math.floor(Math.random() * WORDS.length)];
    const n = 10 + Math.floor(Math.random() * 89);
    return w + "-" + n;
  }
  function randomColors() {
    const a = NEON[Math.floor(Math.random() * NEON.length)];
    let b = a;
    while (b === a) b = NEON[Math.floor(Math.random() * NEON.length)];
    return { c1: a, c2: b };
  }
  function newId(prefix) {
    return (
      (prefix || "id") +
      "_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 7)
    );
  }
  const playerURL = (room) =>
    location.origin + "/index.html?room=" + encodeURIComponent(room);

  // ── time / anchor math (shared clock) ────────────────────
  function audioPos(audio) {
    if (!audio) return 0;
    if (!audio.playing) return audio.anchorPosSec || 0;
    return (
      (audio.anchorPosSec || 0) +
      (window.fb.serverNow() - (audio.anchorServerMs || 0)) / 1000
    );
  }
  function timerRemaining(timer) {
    if (!timer) return ROUND_SECS;
    if (!timer.running) return timer.remainingAtAnchor || 0;
    return Math.max(
      0,
      (timer.remainingAtAnchor || 0) -
        (window.fb.serverNow() - (timer.anchorServerMs || 0)) / 1000
    );
  }

  // ── room lifecycle ───────────────────────────────────────
  async function createRoom() {
    const uid = await window.fb.getUid();
    const code = randomRoomCode();
    await roomRef(code, "meta").set({
      code,
      hostUid: uid,
      createdAt: window.fb.TS,
    });
    await roomRef(code, "publicState").set({
      status: "lobby",
      round: 1,
      // who is allowed to vote — operator-controlled, persists across rounds
      voting: { players: true, audience: true },
      audio: { playing: false, anchorServerMs: window.fb.serverNow(), anchorPosSec: 0 },
      timer: {
        running: false,
        anchorServerMs: window.fb.serverNow(),
        remainingAtAnchor: ROUND_SECS,
      },
    });
    return code;
  }

  async function joinRoom(room, name) {
    const uid = await window.fb.getUid();
    const colors = randomColors();
    await roomRef(room, "players/" + uid).update({
      name: (name || "GUEST").toUpperCase().slice(0, 8),
      c1: colors.c1,
      c2: colors.c2,
      joinedAt: window.fb.TS,
      connected: true,
      role: "audience",        // default role — operator promotes to "playing"
      kicked: null,            // clear any previous kick when (re)joining
    });
    bindPresence(room, uid);
    return uid;
  }

  // keep presence handlers so they can be torn down (e.g. when kicked)
  const _presence = {};
  function bindPresence(room, uid) {
    const key = room + "/" + uid;
    if (_presence[key]) return _presence[key];
    const ref = roomRef(room, "players/" + uid + "/connected");
    const kickedRef = roomRef(room, "players/" + uid + "/kicked");
    const info = db().ref(".info/connected");
    let online = false;

    const ih = info.on("value", (s) => {
      online = s.val() === true;
      if (online) {
        ref.onDisconnect().set(false); // mark offline if THIS tab disconnects
        ref.set(true);
      }
    });

    // Self-heal the reload race: a previous tab's onDisconnect can set our
    // flag to false *after* the new tab set it true. If connected ever reads
    // false while we're genuinely online (and not kicked), re-assert true.
    const ch = ref.on("value", async (s) => {
      if (!online || s.val() === true) return;
      let kicked = false;
      try { kicked = !!(await kickedRef.get()).val(); } catch (_) {}
      if (online && !kicked) ref.set(true);
    });

    const unbind = () => {
      info.off("value", ih);
      ref.off("value", ch);
      try { ref.onDisconnect().cancel(); } catch (_) {}
      delete _presence[key];
    };
    _presence[key] = unbind;
    return unbind;
  }
  function unbindPresence(room, uid) {
    const u = _presence[room + "/" + uid];
    if (u) u();
  }

  // host: set a member's role ("playing" | "audience")
  function setRole(room, uid, role) {
    return roomRef(room, "players/" + uid + "/role").set(role);
  }

  // host: remove a player from the room (they get bounced to the join screen)
  async function kick(room, uid) {
    await roomRef(room, "players/" + uid).update({ kicked: true, connected: false });
    await roomRef(room, "assignments/" + uid).set(null);
    await roomRef(room, "ready/" + uid).set(null);
    await roomRef(room, "votes/" + uid).set(null);
  }

  // player: voluntarily leave the room (opt out)
  async function leaveRoom(room, uid) {
    unbindPresence(room, uid);
    await roomRef(room, "players/" + uid).remove();
    await roomRef(room, "ready/" + uid).remove();
  }

  // host: end the game for everyone (players observe 'ended' and exit)
  async function endGame(room) {
    await roomRef(room, "publicState/status").set("ended");
  }

  // ── live subscriptions ───────────────────────────────────
  // Subscribe to the whole room subtree the caller is allowed to read.
  function watch(room, cb) {
    const ref = roomRef(room);
    const handler = ref.on("value", (s) => cb(s.val() || {}));
    return () => ref.off("value", handler);
  }
  function watchNode(room, path, cb) {
    const ref = roomRef(room, path);
    const handler = ref.on("value", (s) => cb(s.val()));
    return () => ref.off("value", handler);
  }
  async function roomExists(room) {
    const s = await roomRef(room, "meta").get();
    return s.exists();
  }
  // true only if the room exists AND this uid is its host (can read/control it)
  async function roomOwnedBy(room, uid) {
    try {
      const s = await roomRef(room, "meta/hostUid").get();
      return s.exists() && s.val() === uid;
    } catch (_) {
      return false;
    }
  }

  // ── host: status + setup ─────────────────────────────────
  function setStatus(room, status) {
    return roomRef(room, "publicState/status").set(status);
  }

  // host: set who may vote ("players" / "audience" booleans). Persists across rounds.
  function setVoting(room, voting) {
    return roomRef(room, "publicState/voting").update(voting);
  }

  // default when a room predates the voting config: both roles may vote.
  function votingConfig(ps) {
    const v = (ps && ps.voting) || {};
    return {
      players: v.players !== false,
      audience: v.audience !== false,
    };
  }
  // can this player (by role) vote, given the room's voting config?
  function canVote(ps, player) {
    const v = votingConfig(ps);
    return window.IMP.isPlaying(player) ? v.players : v.audience;
  }

  // ── shared music library (global, persists across rooms/sessions) ──
  // Files live in Storage under library/ and metadata in RTDB /library,
  // keyed by a sanitized version of the storage path so each file maps to
  // exactly one entry (no dupes, even across concurrent booths).
  const libKey = (path) => path.replace(/[.#$\[\]/]/g, "_");
  const niceTitle = (file) =>
    file.replace(/^t_[a-z0-9]+_/i, "").replace(/\.[^.]+$/, "");

  function watchLibrary(cb) {
    const ref = db().ref("library");
    const h = ref.on("value", (s) => cb(s.val() || {}));
    return () => ref.off("value", h);
  }

  async function uploadTrack(file, meta) {
    await window.fb.getUid();
    const id = newId("t");
    const path = "library/" + id + "_" + file.name;
    const ref = window.fb.storage.ref(path);
    const task = ref.put(file, { contentType: file.type });
    if (meta && meta.onProgress) {
      task.on("state_changed", (snap) =>
        meta.onProgress(snap.bytesTransferred / snap.totalBytes)
      );
    }
    await task;
    const url = await ref.getDownloadURL();
    const colors = randomColors();
    const key = libKey(path);
    const entry = {
      title: (meta && meta.title) || file.name.replace(/\.[^.]+$/, ""),
      artist: (meta && meta.artist) || "Local file",
      dur: (meta && meta.dur) || "",
      file: file.name,
      url,
      c1: colors.c1,
      c2: colors.c2,
      path,
      // which slot this track suits: "crowd" | "impostor" | "both"
      tag: (meta && meta.tag) || "both",
    };
    await db().ref("library/" + key).set(entry);
    return Object.assign({ id: key }, entry);
  }

  // host: retag a library track ("crowd" | "impostor" | "both")
  function setTrackTag(trackId, tag) {
    return db().ref("library/" + trackId + "/tag").set(tag);
  }

  // host: permanently delete a library track — removes the RTDB entry AND the
  // underlying Storage file. Best-effort on the file (ignore if already gone).
  async function deleteTrack(trackId) {
    await window.fb.getUid();
    const entry = (await db().ref("library/" + trackId).get()).val();
    await db().ref("library/" + trackId).remove();
    const path = entry && entry.path;
    if (path) {
      try { await window.fb.storage.ref(path).delete(); } catch (_) {}
    }
  }

  // Pull in any audio already sitting in the Storage library/ folder that
  // doesn't yet have a metadata entry (e.g. uploaded via the Firebase console).
  async function reconcileLibrary() {
    await window.fb.getUid();
    let res;
    try {
      res = await window.fb.storage.ref("library").listAll();
    } catch (_) { return; }
    const snap = (await db().ref("library").get()).val() || {};
    const known = new Set(
      Object.values(snap).map((e) => e && e.path).filter(Boolean)
    );
    for (const item of res.items) {
      const path = item.fullPath; // "library/…"
      const key = libKey(path);
      if (known.has(path) || snap[key]) continue;
      try {
        const url = await item.getDownloadURL();
        const colors = randomColors();
        await db().ref("library/" + key).set({
          title: niceTitle(item.name),
          artist: "Library",
          dur: "",
          file: item.name,
          url,
          c1: colors.c1,
          c2: colors.c2,
          path,
        });
      } catch (_) {}
    }
  }

  // Start a round: write the secret + per-player opaque assignments, then go live.
  async function startRound(room, draft, players, tracks) {
    const commonUrl = tracks[draft.common] && tracks[draft.common].url;
    const impUrl = tracks[draft.impostor] && tracks[draft.impostor].url;

    await roomRef(room, "round").set({
      commonTrackId: draft.common,
      impostorTrackId: draft.impostor,
      impostorUid: draft.impostorId,
    });

    // clear the previous round's votes + readiness BEFORE handing out new
    // assignments, so phones start their download against a clean handshake.
    await roomRef(room, "votes").set(null);
    await roomRef(room, "ready").set(null);

    // Everyone connected gets audio: the impostor hears the impostor track;
    // everyone else (other players AND the audience) hears the common crowd
    // track. The audience never receives the impostor URL, so the secret holds.
    const assignments = {};
    Object.keys(players || {}).forEach((uid) => {
      const p = players[uid];
      if (!p || !p.connected) return;
      const isImp = uid === draft.impostorId;
      assignments[uid] = {
        url: isImp ? impUrl : commonUrl,
        trackId: isImp ? draft.impostor : draft.common,
      };
    });
    await roomRef(room, "assignments").set(assignments);

    // Go live but PAUSED. Each phone now downloads its track and reports
    // ready at rooms/$room/ready/$uid; the booth presses play once everyone
    // is armed, so all headsets start the song at the same moment.
    const now = window.fb.serverNow();
    await roomRef(room, "publicState").update({
      status: "live",
      audio: { playing: false, anchorServerMs: now, anchorPosSec: 0 },
      timer: { running: false, anchorServerMs: now, remainingAtAnchor: ROUND_SECS },
    });
  }

  // ── host: transport (audio + timer anchors) ──────────────
  function play(room) {
    const now = window.fb.serverNow();
    return roomRef(room, "publicState").transaction((ps) => {
      if (!ps) return ps;
      const pos = audioPos(ps.audio);
      const rem = timerRemaining(ps.timer);
      ps.audio = { playing: true, anchorServerMs: now, anchorPosSec: pos };
      ps.timer = { running: true, anchorServerMs: now, remainingAtAnchor: rem };
      return ps;
    });
  }
  function pause(room) {
    const now = window.fb.serverNow();
    return roomRef(room, "publicState").transaction((ps) => {
      if (!ps) return ps;
      const pos = audioPos(ps.audio);
      const rem = timerRemaining(ps.timer);
      ps.audio = { playing: false, anchorServerMs: now, anchorPosSec: pos };
      ps.timer = { running: false, anchorServerMs: now, remainingAtAnchor: rem };
      return ps;
    });
  }
  function toggle(room, playing) {
    return playing ? pause(room) : play(room);
  }
  function restart(room) {
    const now = window.fb.serverNow();
    return roomRef(room, "publicState").update({
      audio: { playing: true, anchorServerMs: now, anchorPosSec: 0 },
      timer: { running: true, anchorServerMs: now, remainingAtAnchor: ROUND_SECS },
    });
  }
  function addTime(room, secs) {
    const now = window.fb.serverNow();
    return roomRef(room, "publicState/timer").transaction((t) => {
      if (!t) return t;
      const rem = timerRemaining(t);
      return {
        running: t.running,
        anchorServerMs: now,
        remainingAtAnchor: Math.min(ROUND_SECS, rem + secs),
      };
    });
  }

  // ── player: voting ───────────────────────────────────────
  async function castVote(room, targetUid) {
    const uid = await window.fb.getUid();
    return roomRef(room, "votes/" + uid).set(targetUid);
  }

  // ── host: reveal + scoring ───────────────────────────────
  async function tallyAndReveal(room) {
    const round = (await roomRef(room, "publicState/round").get()).val() || 1;
    const ps = (await roomRef(room, "publicState").get()).val() || {};
    const secret = (await roomRef(room, "round").get()).val() || {};
    const votes = (await roomRef(room, "votes").get()).val() || {};
    const players = (await roomRef(room, "players").get()).val() || {};
    const prevStreaks = (await roomRef(room, "streaks").get()).val() || {};
    const impostorUid = secret.impostorUid;

    const tally = {};
    let voters = 0;
    Object.values(votes).forEach((target) => {
      if (!target) return;
      tally[target] = (tally[target] || 0) + 1;
      voters++;
    });
    const forImpostor = tally[impostorUid] || 0;
    const caught = voters > 0 && forImpostor > voters / 2;

    // Scoring: everyone (players + audience) who guesses the impostor earns
    // 5 pts + a per-person consecutive-streak bonus (+1 per round in the streak).
    // A wrong guess or no vote resets that person's streak to 0.
    // The impostor doesn't guess; they get +5 if they got away.
    // Only roles allowed to vote this round are scored. A role that wasn't
    // allowed to vote has its streak FROZEN (left as-is, not reset).
    const deltas = {};
    const streaks = {};
    Object.entries(players).forEach(([uid, p]) => {
      if (!p || !p.connected || uid === impostorUid) return; // impostor scored separately
      if (!canVote(ps, p)) return;                           // role couldn't vote → freeze streak
      const guessedRight = votes[uid] === impostorUid;
      if (guessedRight) {
        const newStreak = (prevStreaks[uid] || 0) + 1;
        streaks[uid] = newStreak;
        deltas[uid] = 5 + (newStreak - 1); // 5 base + streak-so-far bonus
      } else {
        streaks[uid] = 0; // wrong or didn't vote → streak broken
      }
    });
    if (!caught) deltas[impostorUid] = (deltas[impostorUid] || 0) + 5;

    await roomRef(room, "results/" + round).set({
      impostorUid,
      commonTrackId: secret.commonTrackId,
      impostorTrackId: secret.impostorTrackId,
      caught,
      tally,
      voters,
      deltas,
      streaks,
    });

    // apply deltas to running scores
    const cur = (await roomRef(room, "scores").get()).val() || {};
    Object.entries(deltas).forEach(([uid, d]) => {
      cur[uid] = (cur[uid] || 0) + d;
    });
    await roomRef(room, "scores").set(cur);

    // persist updated streaks (merge so disconnected members keep theirs)
    const mergedStreaks = Object.assign({}, prevStreaks, streaks);
    await roomRef(room, "streaks").set(mergedStreaks);

    await roomRef(room, "publicState").update({
      status: "reveal",
      audio: {
        playing: false,
        anchorServerMs: window.fb.serverNow(),
        anchorPosSec: 0,
      },
      timer: {
        running: false,
        anchorServerMs: window.fb.serverNow(),
        remainingAtAnchor: 0,
      },
    });
    return { round, caught, tally, voters, deltas, impostorUid };
  }

  async function nextRound(room) {
    const round = (await roomRef(room, "publicState/round").get()).val() || 1;
    await roomRef(room, "round").set(null);
    await roomRef(room, "assignments").set(null);
    await roomRef(room, "votes").set(null);
    await roomRef(room, "ready").set(null);
    await roomRef(room, "publicState").update({
      status: "setup",
      round: round + 1,
    });
  }

  window.Game = {
    ROUND_SECS,
    NEON,
    randomColors,
    playerURL,
    // math
    audioPos,
    timerRemaining,
    // lifecycle
    createRoom,
    joinRoom,
    bindPresence,
    unbindPresence,
    setRole,
    kick,
    leaveRoom,
    endGame,
    roomExists,
    watch,
    watchNode,
    roomOwnedBy,
    // host
    setStatus,
    setVoting,
    votingConfig,
    canVote,
    uploadTrack,
    setTrackTag,
    deleteTrack,
    watchLibrary,
    reconcileLibrary,
    startRound,
    play,
    pause,
    toggle,
    restart,
    addTime,
    tallyAndReveal,
    nextRound,
    // player
    castVote,
  };
})();
