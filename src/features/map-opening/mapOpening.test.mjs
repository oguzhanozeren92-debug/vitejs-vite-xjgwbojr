import { test } from 'node:test';
import assert from 'node:assert/strict';

function browser(reduce = false, values = new Map()) {
  globalThis.window = { matchMedia: () => ({ matches: reduce }) };
  globalThis.sessionStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  return values;
}
async function fresh() {
  return import(`./mapOpening.ts?test=${Math.random()}`);
}
function mapDouble() {
  const calls = [];
  return {
    calls,
    cameraForBounds: bounds => ({ center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2], zoom: 16 }),
    flyTo: options => calls.push(['fly', options]),
    jumpTo: options => calls.push(['jump', options]),
  };
}
test('ilk açılış doğru tarlaya gider; tarla değişiminde ve aynı sekmede tekrar oynamaz', async () => {
  const values = browser();
  const opening = await fresh();
  assert.equal(opening.shouldPlayMapOpening(), true);
  const map = mapDouble();
  opening.openMapAtField(map, [35, 39], [34, 38, 36, 40], true);
  assert.equal(map.calls[0][0], 'fly');
  assert.deepEqual(map.calls[0][1].center, [35, 39]);
  assert.equal(map.calls[0][1].pitch, 0);
  assert.equal(opening.shouldPlayMapOpening(), false);
  browser(false, values);
  assert.equal((await fresh()).shouldPlayMapOpening(), false);
});
test('azaltılmış harekette ve parsel sınırı olmayan tarlada doğru konum gösterilir', async () => {
  browser(true);
  const opening = await fresh();
  assert.equal(opening.shouldPlayMapOpening(), false);
  const map = mapDouble();
  opening.openMapAtField(map, [32, 41], null, true);
  assert.equal(map.calls[0][0], 'jump');
  assert.deepEqual(map.calls[0][1].center, [32, 41]);
});
test('depolama kapalıyken açılış çalışır ve aynı sayfada tekrarlanmaz', async () => {
  browser();
  globalThis.sessionStorage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const opening = await fresh();
  assert.equal(opening.shouldPlayMapOpening(), true);
  opening.openMapAtField(mapDouble(), [35, 39], null, true);
  assert.equal(opening.shouldPlayMapOpening(), false);
});
