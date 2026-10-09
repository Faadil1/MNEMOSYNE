import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Flower, GardenState } from './garden/types';
import { createState, makeFlower, step, releaseFlower, flowerHead, petalCount, tendFlower } from './garden/engine';
import { layoutFlowers, flowerRadius } from './garden/layout';
import { render } from './garden/renderer';
import { GardenAudio } from './garden/audio';
import { saveGarden, loadGarden, clearGardenStorage, exportGarden } from './garden/storage';
import './App.css';

const MAX_FLOWERS = 9;
const RELEASE_MS = 1200;
const undoMs = 10000;
const isLiving = (f: Flower) => f.state === 'alive' || f.state === 'growing';
const describe = (f: Flower) => f.state === 'faded' ? 'weathered away' : f.state === 'released' ? 'released' : f.state === 'growing' ? 'blooming' : 'growing';

type Undo = { flower: Flower; until: number };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GardenState | null>(null);
  const audioRef = useRef(new GardenAudio());
  const pressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{x: number; y: number; pointerId: number} | null>(null);
  const undoTimer = useRef<number | null>(null);
  const undoRef = useRef<Undo | null>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const [muted, setMuted] = useState(true); // opt-in audio, especially for private reflections
  const [selected, setSelected] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('The garden is quiet. Plant a memory when you are ready.');
  const [gustNow, setGustNow] = useState(false);
  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [failed, setFailed] = useState(false);
  const [charge, setCharge] = useState<{x: number; y: number; amount: number} | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState<number | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [notice, setNotice] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const living = flowers.filter(isLiving);
  const petals = petalCount(input);
  const tooLong = petals > 42;
  const full = living.length >= MAX_FLOWERS;
  const selectedFlower = flowers.find(f => f.id === selected) ?? null;
  const activeNotice = notice || (full ? 'Nine memories are growing. A release can make space for another.' : '');

  const refresh = useCallback(() => {
    const s = stateRef.current;
    if (s) setFlowers([...s.flowers]);
  }, []);

  const relayout = useCallback(() => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!s || !canvas) return;
    layoutFlowers(s.flowers, canvas.clientWidth, canvas.clientHeight);
  }, []);

  const persist = useCallback(() => {
    const s = stateRef.current;
    if (s && !saveGarden(s.flowers)) setNotice('Private storage is unavailable. Export your garden before leaving.');
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    const s = createState(reduced);
    stateRef.current = s;
    audioRef.current.setMuted(true);
    const restored = loadGarden();
    s.flowers = restored.flowers;
    if (restored.migrated) {
      saveGarden(s.flowers);
      setNotice('Your earlier garden was brought forward. Older versions saved only average vitality.');
    }
    if (s.flowers.length) {
      const away = Date.now() - restored.savedAt;
      setAnnounce(`Welcome back. Your garden remembers ${s.flowers.length} memories.`);
      if (away > 5 * 60 * 1000) setNotice('Welcome back. Time away did not make your memories fade.');
    }
    // Preview is explicitly seeded only when requested, never written on initial load.
    if (new URLSearchParams(location.search).has('demo') && !s.flowers.length) {
      ['the smell of rain on her coat', 'his laugh in the kitchen'].forEach((text, i) => {
        const f = makeFlower(text, 0.5, 0.8, 140, Date.now() + i);
        f.growth = 1; f.state = 'alive';
        if (i === 0) f.letters.forEach((l, n) => { l.vitality = n % 3 ? 0.91 : 0.37; });
        s.flowers.push(f);
      });
    }
    refresh();
    const onBlur = () => {
      s.pointer.active = false;
      s.pointer.down = false;
      if (pressTimer.current != null) window.clearInterval(pressTimer.current);
      pressTimer.current = null;
      pressOrigin.current = null;
      setCharge(null);
    };
    const onVisibility = () => {
      if (document.hidden) {
        onBlur();
        audioRef.current.suspend();
        saveGarden(s.flowers);
      }
    };
    const onPageHide = () => saveGarden(s.flowers);
    const onMotion = (e: MediaQueryListEvent) => { s.reducedMotion = e.matches; };
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    motion?.addEventListener?.('change', onMotion);
    return () => {
      saveGarden(s.flowers);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      motion?.removeEventListener?.('change', onMotion);
      audioRef.current.suspend();
    };
  }, [refresh]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setFailed(true); return; }
    let raf = 0;
    let last = performance.now();
    let saveTick = 0, viewTick = 0;
    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      relayout();
    };
    resize();
    window.addEventListener('resize', resize);
    const loop = (now: number) => {
      const s = stateRef.current;
      if (s && !document.hidden) {
        const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
        try {
          step(s, canvas.clientWidth, canvas.clientHeight, dt, {
            onDetach: () => audioRef.current.detach(),
            onTend: () => audioRef.current.tend(),
            onGust: started => { setGustNow(started); if (started) setAnnounce('A gust passes over the garden.'); },
          });
          render(s, ctx, canvas.clientWidth, canvas.clientHeight);
          audioRef.current.setWind(s.wind, s.gust);
          saveTick += dt; viewTick += dt;
          if (saveTick > 3) { saveTick = 0; saveGarden(s.flowers); }
          if (viewTick > 1.5) { viewTick = 0; refresh(); }
        } catch (err) { console.error('Garden render failure', err); setFailed(true); }
      }
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [refresh, relayout]);

  const toLocal = (e: ReactPointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const flowerAt = (x: number, y: number): Flower | null => {
    const s = stateRef.current, canvas = canvasRef.current;
    if (!s || !canvas) return null;
    let best: Flower | null = null, distance = Infinity;
    for (const f of s.flowers.filter(isLiving)) {
      const head = flowerHead(f, canvas.clientWidth, canvas.clientHeight, s.time, s.reducedMotion);
      const d = Math.hypot(x - head.hx, y - head.hy);
      if (d < Math.max(44, flowerRadius(f)) && d < distance) { distance = d; best = f; }
    }
    return best;
  };

  const cancelPress = useCallback(() => {
    if (pressTimer.current != null) window.clearInterval(pressTimer.current);
    pressTimer.current = null;
    pressOrigin.current = null;
    setCharge(null);
  }, []);

  const beginRelease = useCallback((f: Flower) => {
    const s = stateRef.current, canvas = canvasRef.current;
    if (!s || !canvas || !isLiving(f)) return;
    if (undoRef.current) {
      setNotice('Finish or undo the previous release before letting another memory go.');
      return;
    }
    if (undoTimer.current != null) window.clearTimeout(undoTimer.current);
    undoTimer.current = null;
    undoRef.current = null;
    setUndo(null);
    const old = structuredClone(f) as Flower;
    releaseFlower(s, f, canvas.clientWidth, canvas.clientHeight, {});
    audioRef.current.release();
    const next = { flower: old, until: Date.now() + undoMs };
    undoRef.current = next;
    setUndo(next);
    undoTimer.current = window.setTimeout(() => { undoRef.current = null; setUndo(null); }, undoMs);
    setAnnounce(`Released “${f.text}”. You can undo for ten seconds. The memorial stays in this browser.`);
    setSelected(null);
    setConfirmRelease(null);
    relayout(); refresh(); persist();
  }, [persist, refresh, relayout]);

  const undoRelease = () => {
    const s = stateRef.current;
    const pending = undoRef.current;
    if (!s || !pending || Date.now() >= pending.until) return;
    const index = s.flowers.findIndex(f => f.id === pending.flower.id);
    if (index === -1) return;
    s.flowers[index] = pending.flower;
    if (undoTimer.current != null) window.clearTimeout(undoTimer.current);
    undoRef.current = null;
    setUndo(null);
    setAnnounce('The flower has returned.');
    relayout(); refresh(); persist();
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s || !e.isPrimary) return;
    const p = toLocal(e);
    s.pointer = { x: p.x, y: p.y, down: true, active: true, downAt: performance.now() };
    const f = flowerAt(p.x, p.y);
    setSelected(f?.id ?? null);
    cancelPress();
    if (f) {
      pressOrigin.current = { ...p, pointerId: e.pointerId };
      const start = performance.now();
      pressTimer.current = window.setInterval(() => {
        const amount = Math.min(1, (performance.now() - start) / RELEASE_MS);
        setCharge({ x: p.x, y: p.y, amount });
        if (amount >= 1) {
          cancelPress();
          // Long press is explicitly signaled with a progressive ring. Moving away cancels.
          beginRelease(f);
        }
      }, 33);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s) return;
    const p = toLocal(e);
    s.pointer.x = p.x;
    s.pointer.y = p.y;
    // Touch only tends while touching, unlike deliberate mouse proximity.
    s.pointer.active = e.pointerType === 'mouse' || s.pointer.down;
    if (pressOrigin.current && Math.hypot(p.x - pressOrigin.current.x, p.y - pressOrigin.current.y) > 15) cancelPress();
  };
  const pointerStop = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (s) { s.pointer.down = false; s.pointer.active = e.pointerType === 'mouse' && e.type === 'pointerup'; }
    cancelPress();
  };
  const pointerLeave = () => {
    const s = stateRef.current;
    if (s) { s.pointer.active = false; s.pointer.down = false; }
    cancelPress();
  };

  const plant = () => {
    const s = stateRef.current;
    const text = input.trim();
    if (!s || !text || tooLong || full) return;
    const f = makeFlower(text, 0.5, 0.8, 120, Date.now() + Math.floor(Math.random() * 1000));
    s.flowers.push(f);
    relayout(); refresh(); persist();
    audioRef.current.bloom();
    setInput(''); setNotice('');
    setAnnounce(`Planted: “${text}”. Your letters have become petals.`);
  };

  const tendByButton = (f: Flower) => {
    const s = stateRef.current, canvas = canvasRef.current;
    if (!s || !canvas) return;
    if (tendFlower(s, f, canvas.clientWidth, canvas.clientHeight)) {
      audioRef.current.tend();
      refresh(); persist();
      setAnnounce(`You tended “${f.text}”.`);
    }
  };

  const exportMemories = () => {
    const data = exportGarden(stateRef.current?.flowers ?? []);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'mnemosyne-garden.json';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setAnnounce('Your garden was exported as a private JSON file.');
  };

  const clearMemories = () => {
    if (!window.confirm('Erase every flower and memorial from this browser? This cannot be undone. Export first if you wish to keep a copy.')) return;
    const s = stateRef.current;
    if (!s) return;
    s.flowers = [];
    clearGardenStorage();
    setSelected(null); setUndo(null); undoRef.current = null;
    if (undoTimer.current != null) window.clearTimeout(undoTimer.current);
    setJournalOpen(false); refresh();
    setAnnounce('Your garden is empty. All locally saved memories have been erased.');
  };

  useEffect(() => {
    if (confirmRelease != null) confirmCancelRef.current?.focus();
  }, [confirmRelease]);

  const trapDialogKeys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const buttons = [...dialogRef.current.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    if (!buttons.length) return;
    if (e.shiftKey && document.activeElement === buttons[0]) {
      e.preventDefault(); buttons[buttons.length - 1].focus();
    } else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
      e.preventDefault(); buttons[0].focus();
    }
  };
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setConfirmRelease(null); setJournalOpen(false); cancelPress(); }
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [cancelPress]);
  useEffect(() => () => {
    if (undoTimer.current != null) window.clearTimeout(undoTimer.current);
    if (pressTimer.current != null) window.clearInterval(pressTimer.current);
    audioRef.current.suspend();
  }, []);

  return (
    <div className="garden-root fixed inset-0 overflow-hidden bg-[#060b12] text-[#f5ebda]" style={{fontFamily:"Georgia, 'Times New Roman', 'Songti SC', serif"}}>
      {failed ? <div className="absolute inset-0 flex items-center justify-center p-8 text-center" role="alert">
        <div><h1 className="text-3xl mb-4">Your memories remain.</h1><p className="max-w-md text-[#b6c7bb]">Canvas is unavailable in this browser. Your written memories remain accessible in the journal.</p>
        <button className="control mt-5" onClick={() => setJournalOpen(true)}>Open the memory journal</button></div>
      </div> : <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none" aria-hidden="true"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={pointerStop}
          onPointerCancel={pointerLeave} onPointerLeave={pointerLeave} />}
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>

      <header className="topbar absolute left-0 right-0 top-0 z-10 flex items-start justify-between px-5 sm:px-10 pt-6 sm:pt-9 pointer-events-none">
        <div className="pointer-events-auto">
          <div className="text-[10px] tracking-[0.35em] text-[#bda985] uppercase mb-1">An atlas of impermanence / 022</div>
          <h1 className="text-[19px] sm:text-[25px] tracking-[0.22em] uppercase font-normal leading-tight">Mnemosyne</h1>
          <p className="text-[11px] sm:text-xs text-[#a5b4b5] mt-1 max-w-[240px] sm:max-w-none">a garden of things you don’t want to forget</p>
        </div>
        <div className="flex gap-2 pointer-events-auto items-center">
          <button className="control" onClick={() => setHelpOpen(x => !x)} aria-expanded={helpOpen} aria-label="How the garden works">?</button>
          <button className="control" onClick={() => { const m = !muted; if (!m) audioRef.current.ensure(); audioRef.current.setMuted(m); setMuted(m); }} aria-label={muted ? 'Enable sound' : 'Mute sound'}>{muted ? 'Sound off' : 'Sound on'}</button>
          <button className="control" onClick={() => setJournalOpen(x => !x)} aria-expanded={journalOpen} aria-controls="garden-journal">Journal <span className="text-[#d4b47b]">{flowers.length}</span></button>
        </div>
      </header>

      {helpOpen && <aside className="help-card absolute z-20 right-5 top-24 max-w-[320px] p-5 rounded-xl text-sm bg-[#111a23]/95 border border-[#6b655a]/40 shadow-2xl">
        <h2 className="tracking-widest uppercase text-xs text-[#ebd6ab] mb-2">Three gestures</h2>
        <p className="mb-2"><strong>Plant</strong> one sentence. Its visible characters become petals.</p>
        <p className="mb-2"><strong>Tend</strong> by drawing near, touching a bloom, or using its journal button.</p>
        <p><strong>Let go</strong> with a deliberate long press or the journal confirmation. Undo is offered for ten seconds.</p>
        <button className="mt-4 underline text-[#e7d7b9] min-h-[44px]" onClick={() => setHelpOpen(false)}>Close instructions</button>
      </aside>}

      {!flowers.length && <section className="empty-poem absolute z-[1] inset-x-6 top-[27%] sm:top-[31%] text-center pointer-events-none" aria-hidden="true">
        <div className="text-[10px] uppercase tracking-[0.45em] text-[#bf9c64] mb-6">Nothing has taken root. Yet.</div>
        <p className="empty-display text-[#f0e2c5]">Some things stay<br /><em>because we return.</em></p>
        <p className="mt-5 text-xs text-[#91a7ac] tracking-wide">Give one fleeting moment a place to grow.</p>
      </section>}

      {flowers.length > 0 && <div className="status-strip absolute top-[132px] sm:top-[141px] left-0 right-0 text-center pointer-events-none z-[1]">
        <span>{living.length} growing</span><span className="mx-3 text-[#806e54]">·</span><span>{flowers.length - living.length} remembered in absence</span>
        {gustNow && <span className="ml-3 text-[#e2c69b]">· The wind is rising</span>}
      </div>}

      {selectedFlower && isLiving(selectedFlower) && !journalOpen && <div className="selection-pop absolute z-10 left-1/2 -translate-x-1/2 bottom-[140px] sm:bottom-[125px] max-w-[92vw] text-center">
        <p className="text-[#eee1c8] italic text-sm line-clamp-2 max-w-md mb-3">“{selectedFlower.text}”</p>
        <div className="flex items-center justify-center gap-2">
          <button className="control action" onClick={() => tendByButton(selectedFlower)}>Tend</button>
          <button className="control action" onClick={() => setConfirmRelease(selectedFlower.id)}>Let go…</button>
        </div>
      </div>}

      {charge && <div className="press-ring absolute pointer-events-none z-10" style={{left:charge.x,top:charge.y,transform:'translate(-50%,-50%)'}}>
        <svg width="106" height="106" viewBox="0 0 106 106" aria-hidden="true">
          <circle cx="53" cy="53" r="43" stroke="#7e755e" strokeWidth="1" fill="rgba(7,11,17,.42)" />
          <circle cx="53" cy="53" r="43" stroke="#f3d6a0" strokeWidth="2" fill="none" pathLength="100" strokeDasharray={`${charge.amount * 100} 100`} transform="rotate(-90 53 53)" />
          <text x="53" y="56" textAnchor="middle" fontFamily="Georgia,serif" fontSize="10" fill="#f4e0c0">letting go</text>
        </svg>
      </div>}

      {undo && <div role="status" className="undo-banner absolute bottom-[145px] sm:bottom-[130px] left-1/2 -translate-x-1/2 z-30 p-3 sm:p-4 rounded-2xl bg-[#20221e] border border-[#8a7457]/60 flex items-center gap-4 max-w-[94vw] shadow-xl">
        <span className="text-xs sm:text-sm text-[#f1dfc7]">The letters are leaving.</span>
        <button className="control font-bold" onClick={undoRelease}>Undo release</button>
      </div>}

      <form onSubmit={e => {e.preventDefault();plant();}} className="plant-bar absolute bottom-0 z-10 w-full px-4 sm:px-7 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-3 mb-2 px-2"><label htmlFor="memory" className="text-[10px] text-[#c9b998] tracking-[0.22em] uppercase">A memory to keep</label><span className={`text-[11px] ${tooLong ? 'text-[#ffc6a7]' : 'text-[#a3b0b2]'}`}>{petals} / 42 petals</span></div>
          <div className="flex gap-2 items-stretch">
            <input id="memory" value={input} onChange={e => setInput(e.target.value)} autoComplete="off" maxLength={150} aria-invalid={tooLong}
              aria-describedby="input-hint" placeholder="the smell of rain on her coat…"
              className="memory-input min-w-0 flex-1 rounded-full min-h-[54px] px-6 bg-[#111a23]/95 border border-[#6a6454] text-[#f5ead8] text-base placeholder-[#9eaaa9] outline-none focus-visible:ring-2 focus-visible:ring-[#d3ac6e]" />
            <button type="submit" disabled={!input.trim() || tooLong || full} className="plant-button min-h-[54px] min-w-[94px] rounded-full px-6 text-xs uppercase tracking-[0.2em] bg-[#e7d5b8] text-[#101820] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">Plant</button>
          </div>
          <p id="input-hint" className="text-[11px] text-[#b0b8b1] text-center mt-2 leading-relaxed">
            {tooLong ? 'Your sentence has more than 42 visible letters. Shorten it to plant without losing any petals.' : activeNotice || 'Draw near to care · Hold to release · Your words stay on this device only'}
          </p>
        </div>
      </form>

      {journalOpen && <><div className="journal-scrim absolute inset-0 z-20 bg-black/50" onClick={() => setJournalOpen(false)} aria-hidden="true" />
        <aside id="garden-journal" aria-label="Memory journal" className="journal-panel absolute z-30 top-0 bottom-0 right-0 w-full sm:max-w-[430px] bg-[#111923] border-l border-[#746650]/50 shadow-2xl flex flex-col">
          <div className="flex justify-between items-center px-6 pt-7 pb-5 border-b border-[#776c5b]/30"><div><div className="text-[10px] tracking-[0.3em] uppercase text-[#c4a878]">Private archive</div><h2 className="text-2xl mt-1">The garden remembers</h2></div><button className="control" onClick={() => setJournalOpen(false)}>Close</button></div>
          <div className="overflow-y-auto px-6 py-4 flex-1">
            {!flowers.length && <p className="text-[#b5c2c2] text-sm mt-10">No memories yet. A sentence is enough to begin.</p>}
            {flowers.slice().sort((a,b)=>b.bornAt-a.bornAt).map(f => <article key={f.id} className="py-5 border-b border-[#776c5b]/25">
              <div className="flex items-start gap-3"><div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${isLiving(f) ? 'bg-[#d3bd8f]' : 'border border-[#90785b]'}`} />
              <div className="min-w-0 flex-1"><p className="text-[#eee1d0] italic break-words leading-relaxed">“{f.text}”</p><p className="text-[11px] mt-2 text-[#9fb0af]">{describe(f)} · {new Date(f.bornAt).toLocaleDateString()}</p>
                {isLiving(f) && <div className="flex flex-wrap gap-2 mt-4"><button className="control" onClick={() => tendByButton(f)}>Tend this memory</button><button className="control" onClick={() => setConfirmRelease(f.id)}>Let go…</button></div>}
              </div></div>
            </article>)}
          </div>
          <div className="px-6 py-5 border-t border-[#776c5b]/30 text-xs text-[#b1bfbb] leading-relaxed">
            <p>Your words are stored only in this browser. Clearing site data can erase them. Time away never accelerates decay.</p>
            <div className="flex gap-3 mt-4"><button className="control" onClick={exportMemories}>Export JSON</button><button className="control" onClick={clearMemories}>Erase garden…</button></div>
          </div>
        </aside></>}

      {confirmRelease != null && <div className="absolute inset-0 z-40 grid place-items-center px-5 bg-[#020407]/80">
        <div ref={dialogRef} onKeyDown={trapDialogKeys} role="dialog" aria-modal="true" aria-labelledby="release-title" aria-describedby="release-description" className="w-full max-w-[430px] rounded-2xl border border-[#a38862]/50 bg-[#121c23] p-7 shadow-2xl">
          <div className="text-[10px] tracking-[0.32em] uppercase text-[#d3b486] mb-3">A choice, not a loss</div>
          <h2 id="release-title" className="text-3xl text-[#f3e2c9]">Let this memory go?</h2>
          <p id="release-description" className="mt-3 text-sm leading-relaxed text-[#afc0be]">Its petals will scatter on the wind. A trace will stay in your journal. You can undo for ten seconds after releasing.</p>
          <div className="flex justify-end gap-2 mt-7"><button ref={confirmCancelRef} className="control" onClick={() => setConfirmRelease(null)}>Keep it</button><button className="control action" onClick={() => { const f=stateRef.current?.flowers.find(x => x.id === confirmRelease); if(f) beginRelease(f); }}>Release intentionally</button></div>
        </div>
      </div>}
    </div>
  );
}
