// Mock data for the operator prototype
window.IMP = window.IMP || {};

window.IMP.PLAYERS = [
  { id: 'p1', name: 'NOVA',   c1: '#FF2E9A', c2: '#9A6BFF', state: 'connected' },
  { id: 'p2', name: 'JETT',   c1: '#25E6FF', c2: '#9A6BFF', state: 'connected' },
  { id: 'p3', name: 'MILO',   c1: '#C6FF3D', c2: '#25E6FF', state: 'connected' },
  { id: 'p4', name: 'ZARA',   c1: '#FFB23E', c2: '#FF2E9A', state: 'connected' },
  { id: 'p5', name: 'KAI',    c1: '#9A6BFF', c2: '#25E6FF', state: 'connected' },
  { id: 'p6', name: 'RUE',    c1: '#FF2E9A', c2: '#FFB23E', state: 'pairing'   },
  { id: 'p7', name: 'ECHO',   c1: '#25E6FF', c2: '#C6FF3D', state: 'empty'     },
  { id: 'p8', name: 'BIRDIE', c1: '#9A6BFF', c2: '#FF2E9A', state: 'empty'     },
];

window.IMP.TRACKS = [
  { id: 't1', title: 'Neon Tide',      artist: 'VHS Dreams',    dur: '3:42', file: 'neon_tide_master.wav',     c1: '#25E6FF', c2: '#9A6BFF' },
  { id: 't2', title: 'Basement Hours', artist: 'Kort',          dur: '4:08', file: 'basement_hours_v3.mp3',    c1: '#FF2E9A', c2: '#9A6BFF' },
  { id: 't3', title: 'Afterglow',      artist: 'Mø Lights',     dur: '3:15', file: 'afterglow_final.mp3',      c1: '#C6FF3D', c2: '#25E6FF' },
  { id: 't4', title: 'Concrete Sky',   artist: 'Ravel',         dur: '5:01', file: 'concrete_sky.aiff',        c1: '#FFB23E', c2: '#FF2E9A' },
  { id: 't5', title: 'Pulse Theory',   artist: 'NULL / SET',    dur: '3:58', file: 'pulse_theory_mix2.mp3',    c1: '#9A6BFF', c2: '#25E6FF' },
  { id: 't6', title: 'Static Bloom',   artist: 'Hø',            dur: '2:54', file: 'static_bloom.wav',         c1: '#FF2E9A', c2: '#FFB23E' },
  { id: 't7', title: 'Velvet Static',  artist: 'Cassette Club', dur: '4:22', file: 'velvet_static_demo.mp3',   c1: '#25E6FF', c2: '#C6FF3D' },
  { id: 't8', title: 'Midnight Loop',  artist: 'Drty Ldn',      dur: '3:30', file: 'midnight_loop_2.mp3',      c1: '#9A6BFF', c2: '#FF2E9A' },
];

window.IMP.ROOM = 'PULSE-39';
