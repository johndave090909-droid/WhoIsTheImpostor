// Shared primitives for the operator app
const { useState, useEffect, useRef } = React;

/* ───────────── icons ───────────── */
const Icon = {
  head: (p) => (<svg viewBox="0 0 24 24" width={p.s||20} height={p.s||20} fill="none" stroke={p.c||'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="13.5" width="4" height="7" rx="1.6" fill={p.c||'currentColor'} stroke="none"/><rect x="17.5" y="13.5" width="4" height="7" rx="1.6" fill={p.c||'currentColor'} stroke="none"/></svg>),
  play: (p) => (<svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill={p.c||'currentColor'}><path d="M7 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 7 5.5z"/></svg>),
  pause: (p) => (<svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill={p.c||'currentColor'}><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>),
  sync: (p) => (<svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke={p.c||'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>),
  dice: (p) => (<svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke={p.c||'currentColor'} strokeWidth="2" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.4" fill={p.c||'currentColor'} stroke="none"/><circle cx="15.5" cy="15.5" r="1.4" fill={p.c||'currentColor'} stroke="none"/><circle cx="15.5" cy="8.5" r="1.4" fill={p.c||'currentColor'} stroke="none"/><circle cx="8.5" cy="15.5" r="1.4" fill={p.c||'currentColor'} stroke="none"/></svg>),
  check: (p) => (<svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke={p.c||'currentColor'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5 11-11"/></svg>),
  share: (p) => (<svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke={p.c||'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V3"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>),
  eye: (p) => (<svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke={p.c||'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.6"/></svg>),
  crown: (p) => (<svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill={p.c||'currentColor'}><path d="M3 7l4 4 5-7 5 7 4-4-1.5 12h-15z"/></svg>),
  bolt: (p) => (<svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill={p.c||'currentColor'}><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>),
  arrow: (p) => (<svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke={p.c||'currentColor'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>),
  back: (p) => (<svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke={p.c||'currentColor'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/></svg>),
  x: (p) => (<svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke={p.c||'currentColor'} strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>),
};

/* ───────────── avatar ───────────── */
function Avatar({ p, size = 52, ring, dim, glow }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${p.c1}, ${p.c2})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 800,
      fontSize: size * 0.4, color: '#0A0410',
      opacity: dim ? 0.4 : 1,
      boxShadow: ring ? `0 0 0 3px var(--bg), 0 0 0 5px ${ring}, 0 0 18px ${ring}`
        : glow ? `0 0 22px ${p.c1}88` : 'none',
      transition: 'all .25s ease',
    }}>{p.name[0]}</div>
  );
}

/* ───────────── equalizer ───────────── */
function Eq({ color = 'var(--cyan)', bars = 4, playing = true }) {
  return (
    <div className="eq">
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} style={{
          background: color,
          animationDelay: `${i * 0.13}s`,
          animationPlayState: playing ? 'running' : 'paused',
          opacity: playing ? 1 : 0.35,
        }} />
      ))}
    </div>
  );
}

/* ───────────── mini waveform (decorative) ───────────── */
function Wave({ color, w = 60, seed = 1, active }) {
  const bars = useRef(Array.from({ length: 22 }, (_, i) =>
    0.25 + Math.abs(Math.sin(seed * 9.3 + i * 1.7)) * 0.75)).current;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 26, width: w }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          flex: 1, height: `${h * 100}%`, borderRadius: 2,
          background: color, opacity: active ? (0.5 + h * 0.5) : 0.3,
        }} />
      ))}
    </div>
  );
}

/* ───────────── cover art (gradient + waveform) ───────────── */
function Cover({ t, size = 46 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 12, flexShrink: 0,
      background: `linear-gradient(135deg, ${t.c1}, ${t.c2})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 1.5, height: '46%' }}>
        {[0.4, 0.9, 0.55, 1, 0.7].map((h, i) => (
          <div key={i} style={{ width: 2.5, height: `${h*100}%`, background: 'rgba(10,4,16,0.55)', borderRadius: 2 }} />
        ))}
      </div>
    </div>
  );
}

/* section heading */
function SectionLabel({ children, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 4px 12px' }}>
      <span style={{ width: 7, height: 7, borderRadius: 2, background: accent || 'var(--violet)', boxShadow: `0 0 10px ${accent || 'var(--violet)'}` }} />
      <p className="eyebrow" style={{ letterSpacing: '0.2em' }}>{children}</p>
    </div>
  );
}

/* role tag — Playing vs Audience, used on scoreboards */
function RoleTag({ playing }) {
  const c = playing ? 'var(--lime)' : 'var(--violet)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2,
      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', color: c,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}` }} />
      {playing ? '🎧 Playing' : '👀 Audience'}
    </span>
  );
}

/* ───────────── modal ─────────────
   Centered dialog over a dimmed, blurred scrim. Tapping the scrim or the ✕
   cancels. `accent` tints the confirm button + glow. */
function Modal({ open, title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel', accent = 'var(--violet)', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'absolute', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22,
        background: 'rgba(5,4,9,0.66)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        animation: 'float-up .2s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width: '100%', maxWidth: 320, padding: 22, position: 'relative',
          background: 'var(--surface)',
          boxShadow: `0 0 0 1px var(--line) inset, 0 24px 60px rgba(0,0,0,.6), 0 0 40px ${accent}33`,
        }}
      >
        <button onClick={onCancel} aria-label="Close" style={{
          position: 'absolute', top: 12, right: 12, border: 'none', cursor: 'pointer',
          width: 30, height: 30, borderRadius: '50%', background: 'var(--surface-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 1px var(--line) inset',
        }}><Icon.x s={14} c="var(--muted)" /></button>

        {title && <h2 className="h-display" style={{ fontSize: 21, margin: '2px 36px 12px 0', lineHeight: 1.1 }}>{title}</h2>}
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 20 }}>
          {children}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn--ghost" style={{ flex: 1, padding: '14px 16px', fontSize: 15 }} onClick={onCancel}>{cancelLabel}</button>
          <button className="btn btn--primary" style={{ flex: 1, padding: '14px 16px', fontSize: 15, background: `linear-gradient(120deg, ${accent}, var(--violet))` }} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Icon, Avatar, Eq, Wave, Cover, SectionLabel, RoleTag, Modal });
