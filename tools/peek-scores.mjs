// Read-only diagnostic: dump a room's scores / streaks / per-round deltas / players
// from the live Realtime Database. Signs in anonymously (same as the game).
//
//   node tools/peek-scores.mjs ROOM-CODE
//
// Use it after playing 2+ rounds to see whether scores are accumulating and
// whether each named player keeps the SAME uid across rounds.
const KEY = "AIzaSyD8CadhUR1Mp-1bc7YBWE5wO5KzyqFXVh4";
const DB = "https://game-dave-default-rtdb.firebaseio.com";
const room = (process.argv[2] || "").toUpperCase();
if (!room) { console.log("usage: node tools/peek-scores.mjs ROOM-CODE"); process.exit(1); }

const tok = await (await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`,
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) }
)).json();
const auth = tok.idToken;
const get = async (p) => (await fetch(`${DB}/rooms/${room}/${p}.json?auth=${auth}`)).json();

const [players, scores, streaks, results, ps] = await Promise.all(
  ["players", "scores", "streaks", "results", "publicState"].map(get)
);

const name = (uid) => (players && players[uid] && players[uid].name) || uid.slice(0, 6);

console.log(`\nroom ${room} · status=${ps && ps.status} · round=${ps && ps.round}`);
console.log("\n── SCORES (cumulative) ──");
for (const [uid, s] of Object.entries(scores || {})) console.log(`  ${name(uid).padEnd(10)} ${s}`);
if (!scores) console.log("  (none)");

console.log("\n── STREAKS ──");
for (const [uid, s] of Object.entries(streaks || {})) console.log(`  ${name(uid).padEnd(10)} ${s}`);
if (!streaks) console.log("  (none)");

console.log("\n── PER-ROUND deltas ──");
for (const [r, v] of Object.entries(results || {})) {
  if (!v) { console.log(`  round ${r}: (null)`); continue; }
  const ds = Object.entries(v.deltas || {}).map(([u, d]) => `${name(u)}(${u.slice(0,6)})+${d}`).join(", ") || "(none)";
  console.log(`  round ${r}: ${ds}   [impostor=${name(v.impostorUid || "")}, caught=${v.caught}]`);
}

console.log("\n── SCORES with uid ──");
for (const [uid, s] of Object.entries(scores || {})) console.log(`  ${uid.slice(0,10)}…  ${name(uid).padEnd(10)} ${s}`);

console.log("\n── PLAYERS (uid → name) ──");
for (const [uid, p] of Object.entries(players || {})) {
  console.log(`  ${uid.slice(0, 10)}…  ${p.name}  connected=${p.connected}  role=${p.role || "?"}`);
}
console.log("\nTip: if the same person's name maps to DIFFERENT uids across rounds,");
console.log("that's the bug — rejoining made a new identity, so their score 'resets'.\n");
