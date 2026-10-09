const assert = require('node:assert/strict');
const engine = require('./.engine-build/engine.js');
const layout = require('./.engine-build/layout.js');
const storage = require('./.engine-build/storage.js');
const { createState, makeFlower, releaseFlower, graphemes, step, petalCount, tendFlower } = engine;
const store = new Map();
global.localStorage = { setItem:(k,v) => store.set(k,v), getItem:k => store.get(k) ?? null, removeItem:k=>store.delete(k) };
const tests = [];
const test = (name, run) => { run(); tests.push(name); console.log('PASS:',name); };

test('Unicode graphemes are intact and counted as visible petals', () => {
  assert.equal(graphemes('a🌸b').length,3);
  assert.equal(graphemes('a👨‍👩‍👧‍👦b').length,3);
  assert.equal(petalCount('春 の 日 🌸'),4);
  assert.equal(makeFlower('a🌸b',0.5,0.82,100,1).letters.length,3);
  assert.throws(()=>makeFlower('a'.repeat(43),0.5,0.8,100,1), /42/);
});

test('petal geometry reproducible for same words and identity', ()=>{
  const a=makeFlower('A shared moment 🌸',.5,.8,80,7);
  const b=makeFlower('A shared moment 🌸',.5,.8,80,7);
  assert.deepEqual(a.letters,b.letters);
  assert.equal(a.seed,b.seed);
});

test('released flowers and gone petals persist across reload', ()=>{
  const s=createState(false), f=makeFlower('a morning in June',0.5,0.8,90,123);
  f.growth=1; f.state='alive'; s.flowers.push(f);
  f.letters[0].state='gone'; f.letters[0].vitality=0;
  releaseFlower(s,f,390,844,{});
  assert.equal(f.state,'released');
  assert.equal(storage.saveGarden(s.flowers),true);
  const loaded=storage.loadGarden();
  assert.equal(loaded.flowers.length,1);
  assert.equal(loaded.flowers[0].state,'released');
  assert.equal(loaded.flowers[0].letters[0].state,'gone');
  assert.ok(loaded.flowers[0].letters.some(l=>l.state==='drifting'));
});

test('faded flowers never resurrect', ()=>{
  const f=makeFlower('last October',0.5,.8,90,124);
  f.growth=1; f.state='faded'; f.letters.forEach(l=>{l.state='gone'; l.vitality=0;});
  storage.saveGarden([f]);
  const saved=storage.loadGarden().flowers[0];
  const s=createState(false);s.flowers=[saved];
  step(s,390,844,2,{});
  assert.equal(s.flowers[0].state,'faded');
  assert.ok(s.flowers[0].letters.every(l=>l.state==='gone'));
});

test('no care from inactive pointer; deliberate care works', ()=>{
  const f=makeFlower('Remember the rain',.5,.8,90,125);
  f.state='alive';f.growth=1;f.letters.forEach(l=>l.vitality=.5);
  const s=createState(false);s.flowers=[f];
  layout.layoutFlowers(s.flowers,390,844);
  const {hx,hy}=engine.flowerHead(f,390,844,0,false);
  s.pointer={x:hx,y:hy,down:false,active:false,downAt:0};
  const before=f.letters[0].vitality;
  step(s,390,844,.1,{});
  assert.ok(f.letters[0].vitality < before);
  assert.equal(tendFlower(s,f,390,844),true);
  assert.ok(f.letters[0].vitality > before);
});

test('nine-plant layout is separated and within visible content area', ()=>{
  for(const [w,h] of [[320,568],[320,844],[390,844],[768,1024],[1440,900]]){
    for (const n of [1,2,4,9]) {
      const flowers=Array.from({length:n},(_,i)=>{const f=makeFlower('a'.repeat(42),.5,.8,95,1000+i);f.state='alive';f.growth=1;f.bornAt=1000+i;return f;});
      layout.layoutFlowers(flowers,w,h);
      for (const f of flowers){
        const {hx,hy}=engine.flowerHead(f,w,h,0,true);
        const r=layout.flowerRadius(f);
        assert.ok(hx-r>0 && hx+r<w, `x clipped ${n} flowers at ${w}: ${hx} radius ${r}`);
        assert.ok(hy-r>115 && hy+r<h-115, `y clipped ${n} flowers at ${w}x${h}: ${hy} radius ${r}`);
      }
      for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
        const a=engine.flowerHead(flowers[i],w,h,0,true),b=engine.flowerHead(flowers[j],w,h,0,true);
        const dist=Math.hypot(a.hx-b.hx,a.hy-b.hy);
        assert.ok(dist>layout.flowerRadius(flowers[i])+layout.flowerRadius(flowers[j]),`collision ${n} @ ${w}x${h}`);
      }
    }
  }
});

test('v1 migration never resurrects a faded flower', ()=>{
  store.clear();
  store.set('mnemosyne.garden.v1',JSON.stringify([{text:'a faded song',rootX:.6,vitality:0,state:'faded'}]));
  const loaded=storage.loadGarden();
  assert.equal(loaded.migrated,true);
  assert.equal(loaded.flowers[0].state,'faded');
  assert.ok(loaded.flowers[0].letters.every(l=>l.state==='gone'));
});

test('clearing storage removes both versions', ()=>{
  storage.saveGarden([makeFlower('a',.5,.8,90,19)]);
  storage.clearGardenStorage();
  assert.equal(storage.loadGarden().flowers.length,0);
});
console.log(`\n${tests.length}/${tests.length} offline engine checks passed`);
