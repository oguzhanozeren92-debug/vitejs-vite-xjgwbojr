import {
  assert,
  assertEquals,
  assertGreater,
  assertLess,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  THREATS,
} from './catalog.ts';
import {
  aggregateDaily,
  classifyRisk,
  computeFuzzyTimeline,
  computePowderyMildewTimeline,
  leafWetnessCartHour,
  leafWetnessRh,
  normalizeCrop,
  phenologyMembership,
  type HourlyRow,
} from './risk-engine.ts';

Deno.test('normalizeCrop supports Turkish field crop labels', () => {
  assertEquals(normalizeCrop('Elma'), 'apple');
  assertEquals(normalizeCrop('Üzüm Bağı'), 'grape');
  assertEquals(normalizeCrop('Zeytinlik'), 'olive');
  assertEquals(normalizeCrop('Badem'), null);
});

Deno.test('risk classification thresholds stay bounded and stable', () => {
  assertEquals(classifyRisk(0), 'low');
  assertEquals(classifyRisk(29.99), 'low');
  assertEquals(classifyRisk(30), 'moderate');
  assertEquals(classifyRisk(65), 'high');
  assertEquals(classifyRisk(88), 'critical');
  assertEquals(classifyRisk(100), 'critical');
});

Deno.test('leaf wetness models react to humidity, rain and dew point', () => {
  assertGreater(leafWetnessRh(96, 6), leafWetnessRh(55, 0));
  assertEquals(leafWetnessRh(96, 6), 24);
  assertEquals(
    leafWetnessCartHour(20, 19, 90, 4),
    1,
  );
  assertEquals(
    leafWetnessCartHour(28, 15, 45, 20),
    0,
  );
});

Deno.test('phenology membership suppresses out-of-window threats', () => {
  assertEquals(phenologyMembership(0, 200, 800), 0);
  assertEquals(phenologyMembership(400, 200, 800), 1);
  assertEquals(phenologyMembership(1000, 200, 800), 0);
});

function makeHourlyDay(
  date: string,
  tempC: number,
  humidity: number,
  rainMm: number,
): HourlyRow[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    time: `${date}T${String(hour).padStart(2, '0')}:00`,
    temperature: tempC,
    humidity,
    precipitation: hour === 5 ? rainMm : 0,
    vpd: humidity >= 85 ? 0.4 : 1.5,
    dewPoint: humidity >= 85 ? tempC - 1 : tempC - 8,
    windSpeed: 5,
  }));
}

Deno.test('fuzzy disease model gives higher score in favorable conditions', () => {
  const threat = THREATS.find(
    (item) => item.scientificName === 'Venturia inaequalis',
  );
  assert(threat);

  const favorable = aggregateDaily([
    ...makeHourlyDay('2026-04-10', 19, 95, 5),
    ...makeHourlyDay('2026-04-11', 19, 95, 5),
    ...makeHourlyDay('2026-04-12', 19, 95, 5),
    ...makeHourlyDay('2026-04-13', 19, 95, 5),
  ]);

  const dry = aggregateDaily([
    ...makeHourlyDay('2026-04-10', 30, 45, 0),
    ...makeHourlyDay('2026-04-11', 30, 45, 0),
    ...makeHourlyDay('2026-04-12', 30, 45, 0),
    ...makeHourlyDay('2026-04-13', 30, 45, 0),
  ]);

  const favorableTimeline = computeFuzzyTimeline(
    threat,
    favorable,
    400,
  );
  const dryTimeline = computeFuzzyTimeline(
    threat,
    dry,
    400,
  );

  const wetScore = favorableTimeline.at(-1)?.score ?? 0;
  const dryScore = dryTimeline.at(-1)?.score ?? 0;

  assertGreater(wetScore, dryScore);
  assert(wetScore >= 0 && wetScore <= 100);
  assert(dryScore >= 0 && dryScore <= 100);
});

Deno.test('grape powdery mildew score is reduced outside phenology window', () => {
  const threat = THREATS.find(
    (item) => item.scientificName === 'Uncinula necator',
  );
  assert(threat);

  const daily = aggregateDaily([
    ...makeHourlyDay('2026-05-01', 24, 65, 0),
    ...makeHourlyDay('2026-05-02', 24, 65, 0),
    ...makeHourlyDay('2026-05-03', 24, 65, 0),
    ...makeHourlyDay('2026-05-04', 24, 65, 0),
  ]);

  const inWindow = computePowderyMildewTimeline(
    threat,
    daily,
    800,
  );
  const outOfWindow = computePowderyMildewTimeline(
    threat,
    daily,
    0,
  );

  const inWindowScore = inWindow.at(-1)?.score ?? 0;
  const outOfWindowScore = outOfWindow.at(-1)?.score ?? 0;

  assertGreater(inWindowScore, outOfWindowScore);
  assertLess(outOfWindowScore, 30);
});
