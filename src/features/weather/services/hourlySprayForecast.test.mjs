import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHourlySprayPlan, formatForecastHour, localForecastDay, sprayWindowStartsSoon } from './hourlySprayForecast.ts';

const at = (hour) => Date.UTC(2026, 8, 12, hour - 3);
const forecast = (overrides = () => ({})) => ({
  timezone: 'Europe/Istanbul',
  updatedAt: at(6),
  hours: Array.from({ length: 15 }, (_, index) => {
    const hour = index + 6;
    return {
      time: at(hour), windKmh: 10, gustKmh: 14, rainChance: 5,
      rainMm: 0, temperatureC: 22, humidity: 65,
      isDay: hour >= 7 && hour < 19,
      ...overrides(hour),
    };
  }),
});

test('sabah bakıldığında bugün için iki saatlik uygun aralığın saatini gösterir', () => {
  const plan = buildHourlySprayPlan(forecast((hour) => ({
    windKmh: hour === 8 || hour === 9 ? 10 : 22,
  })), at(7));
  assert.equal(formatForecastHour(plan.windows[0].from, 'Europe/Istanbul'), '08:00');
  assert.equal(formatForecastHour(plan.windows[0].to, 'Europe/Istanbul'), '10:00');
  assert.equal(localForecastDay(plan.windows[0].from, 'Europe/Istanbul'), '2026-09-12');
  assert.match(plan.message, /değerlendirilebilecek saatler/);
});

test('sıcaklık eşiği aşılırsa sahte bir uygun saat üretmez ve nedeni gösterir', () => {
  const plan = buildHourlySprayPlan(forecast(() => ({ temperatureC: 32 })), at(7));
  assert.equal(plan.windows.length, 0);
  assert.match(plan.message, /07:00 civarı sıcaklık 32°C/);
});

test('gündüz saatleri geçtiyse ilaçlama saati önermez', () => {
  const plan = buildHourlySprayPlan(forecast(), at(19));
  assert.equal(plan.windows.length, 0);
  assert.match(plan.message, /gündüz aralığı kalmadı/);
});

test('yalnızca önümüzdeki iki saat içinde başlayacak gerçek pencere bildirilir', () => {
  const window = { from: at(9), to: at(11) };
  assert.equal(sprayWindowStartsSoon(window, at(6)), false);
  assert.equal(sprayWindowStartsSoon(window, at(7)), true);
  assert.equal(sprayWindowStartsSoon(window, at(8)), true);
  assert.equal(sprayWindowStartsSoon(window, at(9)), false);
  assert.equal(sprayWindowStartsSoon(null, at(8)), false);
});
