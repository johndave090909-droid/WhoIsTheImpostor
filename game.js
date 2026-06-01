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
    const uid = await window.fb.ready;
    const code = randomRoomCode();
    await roomRef(code, "meta").set({
      code,
      hostUid: uid,
      createdAt: window.fb.TS,
    });
    await roomRef(code, "publicState").set({
      status: "lobby",
      round: 1,
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
    const uid = await window.fb.ready;
    const colors = randomColors();
    await roomRef(room, "players/" + uid).update({
      name: (name || "GUEST").toUpperCase().slice(0, 8),
      c1: colors.c1,
      c2: colors.c2,
      joinedAt: window.fb.TS,
      connected: true,
    });
    bindPresence(room, uid);
    return uid;
  }

  function bindPresence(room, uid) {
    const ref = roomRef(room, "players/" + uid + "/connected");
    const info = db().ref(".info/connected");
    info.on("value", (s) => {
      if (s.val() === true) {
        ref.onDisconnect().set(false);
        ref.set(true);
      }
    });
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

  // ── host: status + setup ─────────────────────────────────
  function setStatus(room, status) {
    return roomRef(room, "publicState/status").set(status);
  }

  // tracks library
  async function uploadTrack(room, file, meta) {
    const uid = await window.fb.ready;
    const id = newId("t");
    const path = "rooms/" + room + "/tracks/" + id + "_" + file.name;
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
    const entry = {
      title: (meta && meta.title) || file.name.replace(/\.[^.]+$/, ""),
      artist: (meta && meta.artist) || "Local file",
      dur: (meta && meta.dur) || "",
      file: file.name,
      url,
      c1: colors.c1,
      c2: colors.c2,
    };
    await roomRef(room, "tracks/" + id).set(entry);
    return Object.assign({ id }, entry);
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

    // each connected player gets only their own URL — no crowd/impostor label
    const assignments = {};
    Object.keys(players || {}).forEach((uid) => {
      if (!players[uid].connected) return;
      const isImp = uid === draft.impostorId;
      assignments[uid] = {
        url: isImp ? impUrl : commonUrl,
        trackId: isImp ? draft.impostor : draft.common,
      };
    });
    await roomRef(room, "assignments").set(assignments);

    // clear previous votes
    await roomRef(room, "votes").set(null);

    const now = window.fb.serverNow();
    await roomRef(room, "publicState").update({
      status: "live",
      audio: { playing: true, anchorServerMs: now, anchorPosSec: 0 },
      timer: { running: true, anchorServerMs: now, remainingAtAnchor: ROUND_SECS },
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
    const uid = await window.fb.ready;
    return roomRef(room, "votes/" + uid).set(targetUid);
  }

  // ── host: reveal + scoring ───────────────────────────────
  async function tallyAndReveal(room) {
    const round = (await roomRef(room, "publicState/round").get()).val() || 1;
    const secret = (await roomRef(room, "round").get()).val() || {};
    const votes = (await roomRef(room, "votes").get()).val() || {};
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

    // deltas: correct guessers +2 each; impostor +5 if not caught
    const deltas = {};
    Object.entries(votes).forEach(([voterUid, target]) => {
      if (target === impostorUid) deltas[voterUid] = (deltas[voterUid] || 0) + 2;
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
    });

    // apply deltas to running scores
    const cur = (await roomRef(room, "scores").get()).val() || {};
    Object.entries(deltas).forEach(([uid, d]) => {
      cur[uid] = (cur[uid] || 0) + d;
    });
    await roomRef(room, "scores").set(cur);

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
    roomExists,
    watch,
    watchNode,
    // host
    setStatus,
    uploadTrack,
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
