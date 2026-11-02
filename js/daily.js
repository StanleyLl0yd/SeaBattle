"use strict";
// A published deterministic puzzle, not a secret commitment: client code can be inspected.
const DAILY_STORAGE_KEY = "seabattle.daily.v1";
function utcChallengeDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
function challengeSeed(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + "T00:00:00Z").toISOString().slice(0,10) !== date)
    throw new Error("Invalid UTC challenge date");
  let hash = 2166136261;
  for (const ch of "seabattle-daily-v1:" + date) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash,16777619);
  }
  return hash >>> 0;
}
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let n = Math.imul(seed ^ seed >>> 15, seed | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
function dailyFleet(date) {
  return randomFleet(seededRandom(challengeSeed(date)));
}
function dailyBest(date) {
  try {
    const record = JSON.parse(localStorage.getItem(DAILY_STORAGE_KEY) || "{}");
    const score = record?.[date];
    return Number.isInteger(score) && score >= 20 && score <= 100 ? score : null;
  } catch { return null; }
}
function saveDailyScore(date, shots) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(shots) || shots < 20 || shots > 100) return null;
  try {
    const stored = JSON.parse(localStorage.getItem(DAILY_STORAGE_KEY) || "{}");
    const scores = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    const best = dailyBest(date);
    scores[date] = best === null ? shots : Math.min(best, shots);
    const dates = Object.keys(scores).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort().slice(-90);
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(Object.fromEntries(dates.map(key=>[key,scores[key]]))));
    return scores[date];
  } catch { return null; }
}
function dailyShareText(date, shots, best, locale) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(shots) || shots < 20 || shots > 100)
    return "";
  const prefix = locale === "ru" ? "⚓ Морской бой · испытание" : "⚓ SeaBattle · Daily challenge";
  const count = locale === "ru" ? "Выстрелов" : "Shots";
  const record = locale === "ru" ? "Лучший результат" : "Personal best";
  return prefix + " " + date + "\n" + count + ": " + shots +
    (best === null ? "" : "\n" + record + ": " + best) + "\n#SeaBattle";
}
