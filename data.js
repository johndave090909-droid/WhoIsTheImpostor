// Shared helpers for live (Firebase-backed) data.
// Players self-register at runtime, so there is no mock roster anymore.
window.IMP = window.IMP || {};

window.IMP.MAX_SLOTS = 8;

// { uid: {...} } → [ { id: uid, ... } ]
window.IMP.toList = (obj) =>
  Object.entries(obj || {}).map(([id, v]) => Object.assign({ id }, v));

// connected players, oldest-joined first
window.IMP.connectedList = (obj) =>
  window.IMP.toList(obj)
    .filter((p) => p.connected)
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
