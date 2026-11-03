"use strict";
const BACKUP_LIMIT = 32768;
const BACKUP_STORAGE_KEYS = [CAREER_KEY,NAVY_KEY,DAILY_STORAGE_KEY,STATS_KEY,DAILY_FIRST_KEY,JOURNAL_KEY];

function backupHasKeys(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every(key => Object.prototype.hasOwnProperty.call(value,key));
}
function backupCareer(value, nation) {
  const keys=["wins","losses","streak","bestStreak","achievements"];
  if (nation==="us") keys.push("warrantWins","warrantLosses","fleetStreak","fleetAdmiral");
  if (!backupHasKeys(value,keys)) return null;
  const cleaned=sanitizeCareer(value,nation);
  if (!cleaned || keys.some(key=>JSON.stringify(cleaned[key])!==JSON.stringify(value[key]))) return null;
  return cleaned;
}
function backupDaily(value) {
  if (value===null || typeof value!=="object" || Array.isArray(value)) return null;
  const dates=Object.keys(value);
  if (dates.length>90) return null;
  for (const date of dates) {
    if (!validChallengeDate(date)) return null;
    if (!Number.isSafeInteger(value[date]) || value[date]<20 || value[date]>100) return null;
  }
  return Object.fromEntries(dates.sort().map(date=>[date,value[date]]));
}
function backupStats(value) {
  if (!backupHasKeys(value,["version","modes"]) || value.version!==1 ||
      !backupHasKeys(value.modes,STATS_MODES)) return null;
  const cleaned=sanitizePersonalStats(value);
  for (const mode of STATS_MODES) {
    const row=value.modes[mode];
    if (!backupHasKeys(row,["games","wins","shots","hits","best"])) return null;
    for (const key of ["games","wins","shots","hits","best"])
      if (row[key]!==cleaned[mode][key]) return null;
  }
  return {version:1,modes:cleaned};
}
function backupFirst(value) {
  if (!value || typeof value!=="object" || Array.isArray(value) ||
      Object.keys(value).length>90) return null;
  for (const [date,score] of Object.entries(value))
    if (!validChallengeDate(date) || !(score===null ||
      Number.isSafeInteger(score) && score>=20 && score<=100)) return null;
  return Object.fromEntries(Object.entries(value).sort());
}
function backupJournal(value) {
  if (!backupHasKeys(value,["version","matches","seriesBest"]) || value.version!==1 ||
      !Array.isArray(value.matches) || value.matches.length>JOURNAL_LIMIT ||
      !value.seriesBest || typeof value.seriesBest!=="object" || Array.isArray(value.seriesBest) ||
      Object.keys(value.seriesBest).length>19) return null;
  for (const row of value.matches)
    if (!backupHasKeys(row,["date","mode","nation","level","win","shots","hits"])) return null;
  for (const [level,row] of Object.entries(value.seriesBest))
    if (!/^(?:[1-9]|1[0-9])$/.test(level) ||
        !backupHasKeys(row,["wins","shots"])) return null;
  const clean=sanitizeJournal(value);
  if (clean.matches.length!==value.matches.length ||
      Object.keys(clean.seriesBest).length!==Object.keys(value.seriesBest).length) return null;
  for (let i=0;i<value.matches.length;i++) for (const key of
    ["date","mode","nation","level","win","shots","hits"])
    if (clean.matches[i][key]!==value.matches[i][key]) return null;
  for (const [key,row] of Object.entries(value.seriesBest))
    if (clean.seriesBest[key]?.wins!==row.wins ||
        clean.seriesBest[key]?.shots!==row.shots) return null;
  return clean;
}
function parseProgressBackup(text) {
  if (typeof text!=="string" || text.length>BACKUP_LIMIT || text.length===0) return null;
  try {
    const value=JSON.parse(text);
    if (![1,2].includes(value?.version) ||
        !backupHasKeys(value,value.version===1 ?
          ["version","careers","navy","daily","stats"] :
          ["version","careers","navy","daily","stats","first","journal"]) ||
        !backupHasKeys(value.careers,["ru","us"]) ||
        (value.navy!=="ru" && value.navy!=="us")) return null;
    const ru=backupCareer(value.careers.ru,"ru");
    const us=backupCareer(value.careers.us,"us");
    const daily=backupDaily(value.daily);
    const stats=backupStats(value.stats);
    const first=value.version===1 ? {} : backupFirst(value.first);
    const history=value.version===1 ? freshJournal() : backupJournal(value.journal);
    return ru && us && daily && stats && first && history ?
      {version:2,careers:{ru,us},navy:value.navy,daily,stats,first,journal:history} : null;
  } catch { return null; }
}
function createProgressBackup() {
  try {
    if (typeof localStorage==="undefined") return null;
    const raw=localStorage.getItem(DAILY_STORAGE_KEY);
    if (raw!==null && raw.length>BACKUP_LIMIT) return null;
    const daily=raw===null ? {} : backupDaily(JSON.parse(raw));
    if (!daily) return null;
    const text=JSON.stringify({
      version:2,careers:{ru:careers.ru,us:careers.us},navy,daily,
      stats:{version:1,modes:personalStats},first:readDailyFirst(),journal
    });
    return parseProgressBackup(text) ? text : null;
  } catch { return null; }
}
function restoreProgressBackup(text) {
  if (game.phase==="playing") return "backupPlaying";
  const value=parseProgressBackup(text);
  if (!value) return "backupInvalid";
  if (typeof localStorage==="undefined") return "backupStorageError";
  const replacement=[
    JSON.stringify({version:2,ru:value.careers.ru,us:value.careers.us}),
    value.navy,
    JSON.stringify(value.daily),
    JSON.stringify(value.stats),
    JSON.stringify(value.first),
    JSON.stringify(value.journal)
  ];
  let original=null;
  try {
    original=BACKUP_STORAGE_KEYS.map(key=>localStorage.getItem(key));
    for (let i=0;i<BACKUP_STORAGE_KEYS.length;i++)
      localStorage.setItem(BACKUP_STORAGE_KEYS[i],replacement[i]);
  } catch {
    if (original) {
      for (let i=BACKUP_STORAGE_KEYS.length-1;i>=0;i--) {
        try {
          if (original[i]===null) localStorage.removeItem(BACKUP_STORAGE_KEYS[i]);
          else localStorage.setItem(BACKUP_STORAGE_KEYS[i],original[i]);
        } catch { /* A blocked store may also reject rollback. */ }
      }
    }
    return "backupStorageError";
  }
  careers=value.careers;
  navy=value.navy;
  career=careers[navy];
  personalStats=value.stats.modes;
  journal=value.journal;
  seriesRun=null;
  ui.mode.value="campaign";
  setUpGame();
  return "backupImported";
}
