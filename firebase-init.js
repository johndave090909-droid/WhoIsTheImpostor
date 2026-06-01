// ─────────────────────────────────────────────────────────────
// Firebase bootstrap — shared by booth.html and index.html.
// Loads after the firebase-*-compat.js CDN scripts (global `firebase`)
// and after firebase-config.js. Exposes window.fb.
//
// Local dev: add ?emu=1 to the URL (or set localStorage.emu="1") to use
// the Firebase Emulator Suite — no real project/credentials needed.
// ─────────────────────────────────────────────────────────────
(function () {
  const params = new URLSearchParams(location.search);
  const useEmu =
    params.get("emu") === "1" ||
    (window.localStorage && window.localStorage.getItem("emu") === "1");

  const DEMO = {
    apiKey: "demo",
    authDomain: "demo-impostor.firebaseapp.com",
    databaseURL: "https://demo-impostor-default-rtdb.firebaseio.com",
    projectId: "demo-impostor",
    storageBucket: "demo-impostor.appspot.com",
  };

  const realCfg = window.FIREBASE_CONFIG || {};
  const placeholder = !realCfg.apiKey || String(realCfg.apiKey).startsWith("PASTE_");
  const cfg = useEmu ? DEMO : realCfg;

  if (!useEmu && placeholder) {
    showBanner(
      "Firebase isn't configured yet. Paste your web config into " +
        "firebase-config.js — or append ?emu=1 to use the local emulator."
    );
  }

  firebase.initializeApp(cfg);

  const auth = firebase.auth();
  const db = firebase.database();
  const storage = firebase.storage();

  if (useEmu) {
    const host = location.hostname || "127.0.0.1";
    auth.useEmulator("http://" + host + ":9099", { disableWarnings: true });
    db.useEmulator(host, 9000);
    storage.useEmulator(host, 9199);
    showBanner("Emulator mode (?emu=1) — using local Firebase suite.", "#9A6BFF");
  }

  // server clock offset (RTDB built-in) — used for audio/timer sync
  let serverTimeOffset = 0;
  db.ref(".info/serverTimeOffset").on("value", (s) => {
    serverTimeOffset = s.val() || 0;
  });

  // anonymous identity; resolves with uid
  const ready = new Promise((resolve, reject) => {
    auth.onAuthStateChanged((user) => {
      if (user) resolve(user.uid);
    });
    auth.signInAnonymously().catch((err) => {
      showBanner(
        "Sign-in failed: " +
          (err && err.message) +
          " — enable Anonymous auth in the Firebase console (or use ?emu=1)."
      );
      reject(err);
    });
  });

  window.fb = {
    app: firebase.app(),
    auth,
    db,
    storage,
    ready, // Promise<uid>
    uid: null,
    emulated: useEmu,
    serverNow: () => Date.now() + serverTimeOffset,
    TS: firebase.database.ServerValue.TIMESTAMP,
    showBanner,
  };
  ready.then((uid) => (window.fb.uid = uid));

  function showBanner(msg, color) {
    let el = document.getElementById("fb-banner");
    if (!el) {
      el = document.createElement("div");
      el.id = "fb-banner";
      el.style.cssText =
        "position:fixed;left:0;right:0;top:0;z-index:9999;padding:12px 16px;" +
        "color:#fff;font:600 13px/1.4 system-ui,sans-serif;" +
        "box-shadow:0 4px 20px rgba(0,0,0,.4)";
      document.body.appendChild(el);
    }
    el.style.background = color || "#FF2E9A";
    el.textContent = msg;
  }
})();
