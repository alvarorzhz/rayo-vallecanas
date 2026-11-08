import { test } from "node:test";
import assert from "node:assert/strict";
import { pickWeather, roundHour, skyOf, weatherLabel, weatherTip, type OpenMeteo } from "../weather.ts";

const data: OpenMeteo = {
  hourly: {
    time: ["2026-11-09T17:00", "2026-11-09T18:00", "2026-11-09T19:00"],
    temperature_2m: [11.4, 10.6, 9.2],
    precipitation_probability: [20, 45, null],
    weather_code: [3, 61, 80],
    wind_speed_10m: [8.4, 12.6, 15],
  },
  daily: { time: ["2026-11-09"], temperature_2m_max: [14.6], temperature_2m_min: [4.2], precipitation_probability_max: [55], weather_code: [61] },
};

test("la hora del partido se redondea a la hora en punto más cercana sin cambiar de día", () => {
  assert.equal(roundHour("18:00:00"), "18:00");
  assert.equal(roundHour("18:29"), "18:00");
  assert.equal(roundHour("18:30"), "19:00");
  assert.equal(roundHour("09:45"), "10:00");
  assert.equal(roundHour("23:50"), "23:00");
});

test("coge el tiempo de la hora del partido", () => {
  assert.deepEqual(pickWeather(data, "2026-11-09", "17:40:00"), { hour: "2026-11-09T18:00", temp: 11, min: null, max: null, rain: 45, wind: 13, code: 61 });
  // Sin probabilidad de lluvia en esa hora → 0
  assert.equal(pickWeather(data, "2026-11-09", "19:00")?.rain, 0);
});

test("sin hora del partido (o fuera de la previsión horaria) da el resumen del día", () => {
  assert.deepEqual(pickWeather(data, "2026-11-09", null), { hour: null, temp: 15, min: 4, max: 15, rain: 55, wind: null, code: 61 });
  assert.equal(pickWeather(data, "2026-11-09", "12:00")?.hour, null);
  assert.equal(pickWeather(data, "2026-11-10", "18:00"), null);
  assert.equal(pickWeather({}, "2026-11-09", "18:00"), null);
});

test("textos del tiempo y consejo para el vestuario", () => {
  assert.equal(weatherLabel(0).text, "Despejado");
  assert.equal(weatherLabel(63).text, "Lluvia");
  assert.equal(weatherLabel(95).icon, "⛈️");
  const w = { hour: null, temp: 12, min: null, max: null, rain: 10, wind: 5, code: 1 };
  assert.equal(weatherTip(w), null);
  assert.match(weatherTip({ ...w, rain: 70 })!, /llueva/);
  assert.match(weatherTip({ ...w, rain: 35 })!, /chubasquero/);
  assert.match(weatherTip({ ...w, temp: 2 })!, /frío/);
  assert.match(weatherTip({ ...w, code: 73 })!, /nevar/);
});

test("si el código dice lluvia pero la probabilidad es baja, sale nublado", () => {
  assert.equal(skyOf({ code: 61, rain: 8 }).text, "Nublado");
  assert.equal(skyOf({ code: 61, rain: 40 }).text, "Lluvia");
  assert.equal(skyOf({ code: 0, rain: 0 }).text, "Despejado");
});
