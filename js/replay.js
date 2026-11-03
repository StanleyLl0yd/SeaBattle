"use strict";
const DAILY_FIRST_KEY = "seabattle.daily.first.v1";
const JOURNAL_KEY = "seabattle.journal.v1";
const JOURNAL_LIMIT = 120;
const JOURNAL_MODES = ["campaign","quick","series","daily","warrant","fleet"];
function readDailyFirst() {
  try {
    const raw=localStorage.getItem(DAILY_FIRST_KEY);
    if (!raw || raw.length>8192) return {};
    const value=JSON.parse(raw);
    if (!value || typeof value!=="object" || Array.isArray(value)) return {};
    const out={};
    for (const [date,score] of Object.entries(value)) {
      if (validChallengeDate(date) && (score===null ||
          Number.isInteger(score) && score>=20 && score<=100)) out[date]=score;
    }
    return Object.fromEntries(Object.entries(out).sort().slice(-90));
  } catch { return {}; }
}
function dailyFirstScore(date) {
  if (!validChallengeDate(date)) return undefined;
  return readDailyFirst()[date];
}
function beginDailyFirst(date) {
  if (!validChallengeDate(date) || dailyBest(date)!==null) return false;
  try {
    if (typeof localStorage==="undefined") return false;
    const saved=readDailyFirst();
    if (Object.prototype.hasOwnProperty.call(saved,date)) return false;
    saved[date]=null;
    const trimmed=Object.fromEntries(Object.entries(saved).sort().slice(-90));
    localStorage.setItem(DAILY_FIRST_KEY,JSON.stringify(trimmed));
    return true;
  } catch { return false; }
}
function completeDailyFirst(date,score) {
  if (!validChallengeDate(date) || !Number.isInteger(score) || score<20 || score>100) return false;
  try {
    const saved=readDailyFirst();
    if (!Object.prototype.hasOwnProperty.call(saved,date) || saved[date]!==null) return false;
    saved[date]=score;
    localStorage.setItem(DAILY_FIRST_KEY,JSON.stringify(saved));
    return true;
  } catch { return false; }
}
function freshJournal() { return {version:1,matches:[],seriesBest:{}}; }
function sanitizeJournal(value) {
  const out=freshJournal();
  if (!value || typeof value!=="object" || Array.isArray(value) || value.version!==1 ||
      !Array.isArray(value.matches) || value.matches.length>JOURNAL_LIMIT ||
      !value.seriesBest || typeof value.seriesBest!=="object" || Array.isArray(value.seriesBest))
    return out;
  for (const row of value.matches) {
    if (!row || typeof row!=="object" || Array.isArray(row) ||
        !validChallengeDate(row.date) || !JOURNAL_MODES.includes(row.mode) ||
        !["ru","us"].includes(row.nation) || !Number.isInteger(row.level) ||
        row.level<1 || row.level>19 || typeof row.win!=="boolean" ||
        !Number.isInteger(row.shots) || row.shots<1 || row.shots>100 ||
        !Number.isInteger(row.hits) || row.hits<0 || row.hits>Math.min(20,row.shots))
      return freshJournal();
    out.matches.push({date:row.date,mode:row.mode,nation:row.nation,
      level:row.level,win:row.win,shots:row.shots,hits:row.hits});
  }
  for (const [level,row] of Object.entries(value.seriesBest)) {
    if (!/^(?:[1-9]|1[0-9])$/.test(level) ||
        !row || typeof row!=="object" || Array.isArray(row) ||
        !Number.isInteger(row.wins) || row.wins<0 || row.wins>3 ||
        !Number.isInteger(row.shots) || row.shots<3 || row.shots>300)
      return freshJournal();
    out.seriesBest[level]={wins:row.wins,shots:row.shots};
  }
  return out;
}
function loadJournal() {
  try {
    if (typeof localStorage==="undefined") return freshJournal();
    const raw=localStorage.getItem(JOURNAL_KEY);
    return raw && raw.length<=32768 ? sanitizeJournal(JSON.parse(raw)) : freshJournal();
  } catch { return freshJournal(); }
}
let journal=loadJournal();
let seriesRun=null;
function saveJournal() {
  try {
    if (typeof localStorage!=="undefined") localStorage.setItem(JOURNAL_KEY,JSON.stringify(journal));
  } catch { /* In-memory session remains playable without persistent storage. */ }
}
function recordJournal(winner,mode,nation,level,shots,hits) {
  const value={date:utcChallengeDate(),mode,nation,level,win:winner==="player",shots,hits};
  const checked=sanitizeJournal({version:1,matches:[value],seriesBest:{}});
  if (!checked.matches.length || !["player","computer"].includes(winner)) return false;
  journal.matches.push(value);
  journal.matches=journal.matches.slice(-JOURNAL_LIMIT);
  saveJournal();
  return true;
}
function recentPerformance(today=utcChallengeDate()) {
  if (!validChallengeDate(today)) return null;
  const until=new Date(today+"T00:00:00Z").getTime();
  const within=days=>journal.matches.filter(m=>{
    const age=(until-new Date(m.date+"T00:00:00Z").getTime())/86400000;
    return age>=0 && age<days;
  });
  const current=journal.matches.slice(-10);
  const earlier=journal.matches.slice(-20,-10);
  const month=within(30),week=within(7);
  const summarized=items=>({games:items.length,wins:items.filter(x=>x.win).length});
  const victories=month.filter(x=>x.win).map(x=>x.shots);
  return {current:summarized(current),previous:summarized(earlier),
    days7:new Set(week.map(x=>x.date)).size,
    days30:new Set(month.map(x=>x.date)).size,
    monthBest:victories.length?Math.min(...victories):null};
}
function completeSeries(run) {
  if (!run || run.played!==3 || !Number.isInteger(run.level) ||
      run.level<1 || run.level>19 || !Number.isInteger(run.shots) ||
      run.shots<3 || run.shots>300 || !Number.isInteger(run.wins) ||
      run.wins<0 || run.wins>3) return null;
  const key=String(run.level),prior=journal.seriesBest[key];
  if (!prior || run.wins>prior.wins || run.wins===prior.wins && run.shots<prior.shots) {
    journal.seriesBest[key]={wins:run.wins,shots:run.shots};
    saveJournal();
  }
  return journal.seriesBest[key];
}

function loadFastTempo() {
  try { return typeof localStorage!=="undefined" && localStorage.getItem("seabattle.tempo.v1")==="fast"; }
  catch { return false; }
}
let fastTempo=loadFastTempo();
function setFastTempo(enabled) {
  fastTempo=enabled===true;
  try {
    if (typeof localStorage!=="undefined")
      localStorage.setItem("seabattle.tempo.v1",fastTempo?"fast":"normal");
  } catch { /* Tempo remains available for this session. */ }
}
