import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWispModel} from '../src/enemy-model.js';

test('wisp mesh is deterministic, finite and has normalized normals',()=>{
  const a=buildWispModel().parts[0].vertices;
  assert.deepEqual(a,buildWispModel().parts[0].vertices);
  assert.equal(a.length%30,0);
  assert.ok(a.length>3000);
  assert.ok(a.every(Number.isFinite));
  for(let i=0;i<a.length;i+=10) assert.ok(Math.abs(Math.hypot(a[i+3],a[i+4],a[i+5])-1)<1e-5);
});
