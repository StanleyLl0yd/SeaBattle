"use strict";
const STATS_KEY = "seabattle.stats.v1";
const STATS_MODES = ["ru","us","quick","daily","warrant","fleet"];
const STATS_LIMIT = 1000000;
function freshPersonalStats() {
  return Object.fromEntries(STATS_MODES.map(mode=>[mode,{games:0,wins:0,shots:0,hits:0,best:null}]));
}
function sanitizePersonalStats(data) {
  const result=freshPersonalStats();
  if (!data || typeof data!=="object" || Array.isArray(data) || data.version!==1 ||
      !data.modes || typeof data.modes!=="object" || Array.isArray(data.modes)) return result;
  for (const mode of STATS_MODES) {
    const row=data.modes[mode];
    if (!row || typeof row!=="object" || Array.isArray(row)) continue;
    const {games,wins,shots,hits,best}=row;
    if (![games,wins,shots,hits].every(Number.isSafeInteger) ||
        games<0 || games>STATS_LIMIT || wins<0 || wins>games ||
        shots<0 || shots>100*games || hits<0 || hits>Math.min(shots,20*games) ||
        (wins===0 ? best!==null : !Number.isSafeInteger(best) || best<1 || best>100)) continue;
    result[mode]={games,wins,shots,hits,best};
  }
  return result;
}
function loadPersonalStats() {
  try {
    return typeof localStorage==="undefined" ? freshPersonalStats() :
      sanitizePersonalStats(JSON.parse(localStorage.getItem(STATS_KEY)||"null"));
  } catch { return freshPersonalStats(); }
}
function savePersonalStats() {
  try {
    if (typeof localStorage!=="undefined")
      localStorage.setItem(STATS_KEY,JSON.stringify({version:1,modes:personalStats}));
  } catch { /* Keep in-memory totals when storage is blocked. */ }
}
function personalStatsMode(mode,nation) {
  if (mode==="campaign") return nation==="ru" || nation==="us" ? nation : null;
  return STATS_MODES.includes(mode) && mode!=="ru" && mode!=="us" ? mode : null;
}
function recordPersonalResult(winner,mode,nation,shots,hits) {
  const key=personalStatsMode(mode,nation);
  if (!key || (winner!=="player" && winner!=="computer") ||
      !Number.isSafeInteger(shots) || shots<1 || shots>100 ||
      !Number.isSafeInteger(hits) || hits<0 || hits>Math.min(20,shots)) return false;
  const row=personalStats[key],victory=winner==="player";
  if (row.games>=STATS_LIMIT) return false;
  personalStats[key]={games:row.games+1,wins:row.wins+(victory?1:0),
    shots:row.shots+shots,hits:row.hits+hits,
    best:victory ? (row.best===null ? shots : Math.min(row.best,shots)) : row.best};
  savePersonalStats();
  return true;
}
