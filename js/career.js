function freshCareer(nation = "ru") {
      const result = {wins:0, losses:0, streak:0, bestStreak:0, achievements:[]};
      if (nation === "us") Object.assign(result, {
        warrantWins:0, warrantLosses:0, fleetStreak:0, fleetAdmiral:false
      });
      return result;
    }
    function validScore(value) { return Number.isSafeInteger(value) && value >= 0 && value <= 1000000; }
    function rankForWins(wins) {
      let rank = 1;
      while (rank < 19 && wins >= PROMOTION_WINS[rank - 1]) rank++;
      return rank;
    }
    function warrantRankForWins(wins) {
      let rank = 0;
      while (rank < 5 && wins >= WARRANT_WINS[rank]) rank++;
      return rank;
    }
    function sanitizeCareer(value, nation = "ru") {
      if (!value || typeof value !== "object" || Array.isArray(value) ||
          ![value.wins,value.losses,value.streak,value.bestStreak].every(validScore) ||
          value.streak > value.wins || value.bestStreak < value.streak ||
          value.bestStreak > value.wins || !Array.isArray(value.achievements)) return null;
      const result = {wins:value.wins, losses:value.losses, streak:value.streak,
        bestStreak:value.bestStreak,
        achievements:[...new Set(value.achievements.filter(a => ACHIEVEMENTS.includes(a)))].slice(0,3)};
      if (nation === "us") {
        if (![value.warrantWins,value.warrantLosses,value.fleetStreak].every(validScore) ||
            value.fleetStreak > 5 || typeof value.fleetAdmiral !== "boolean") return null;
        Object.assign(result, {warrantWins:value.warrantWins,warrantLosses:value.warrantLosses,
          fleetStreak:Math.min(3,value.fleetStreak),fleetAdmiral:value.fleetAdmiral || value.fleetStreak >= 3});
      }
      return result;
    }
    function loadCareers() {
      const fallback = {ru:freshCareer("ru"),us:freshCareer("us")};
      if (typeof localStorage === "undefined") return fallback;
      try {
        const old = localStorage.getItem(LEGACY_CAREER_KEY);
        if (old !== null) fallback.ru = sanitizeCareer(JSON.parse(old),"ru") || fallback.ru;
      } catch { /* Keep a fresh RU profile when legacy storage is invalid. */ }
      try {
        const stored = localStorage.getItem(CAREER_KEY);
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.version === 2)
            return {ru:sanitizeCareer(parsed.ru,"ru") || fallback.ru,
              us:sanitizeCareer(parsed.us,"us") || fallback.us};
        }
      } catch { /* Corrupt new data cannot destroy valid legacy progress. */ }
      return fallback;
    }
    function saveCareers() {
      try {
        if (typeof localStorage !== "undefined")
          localStorage.setItem(CAREER_KEY, JSON.stringify({version:2,ru:careers.ru,us:careers.us}));
      } catch { /* Career continues in memory if storage is unavailable. */ }
    }
    function loadSelectedNavy() {
      const fallback = /^ru(?:[-_]|$)/i.test(browserLocale) ? "ru" : "us";
      try {
        if (typeof localStorage === "undefined") return fallback;
        const stored = localStorage.getItem(NAVY_KEY);
        return stored === "ru" || stored === "us" ? stored : fallback;
      } catch { return fallback; }
    }
    function saveSelectedNavy() {
      try {
        if (typeof localStorage !== "undefined") localStorage.setItem(NAVY_KEY, navy);
      } catch { /* Saving a preference is best-effort. */ }
    }
    function rankLabel(nation, index) {
      if (nation === "ru") return RANK_NAMES[language][index];
      return US_RANKS[language][index] + " (" + US_CODES[index] + ")" +
        (language === "ru" ? " · " + US_RANKS.en[index] : "");
    }
    function warrantLabel(index) {
      return WARRANT_RANKS[language][index] + " (" + WARRANT_CODES[index] + ")" +
        (language === "ru" ? " · " + WARRANT_RANKS.en[index] : "");
    }
    function grantAchievement(key) {
      if (!career.achievements.includes(key)) {
        career.achievements.push(key);
        saveCareers();
      }
    }
    function recordCareerResult(winner, misses) {
      const before = rankForWins(career.wins);
      if (winner === "player") {
        career.wins = Math.min(1000000, career.wins + 1);
        career.streak = Math.min(1000000, career.streak + 1);
        career.bestStreak = Math.max(career.bestStreak, career.streak);
        if (career.streak >= 3) grantAchievement("achievementStreak");
        if (misses <= 10) grantAchievement("achievementPrecision");
      } else {
        career.losses = Math.min(1000000, career.losses + 1);
        career.streak = 0;
      }
      saveCareers();
      return rankForWins(career.wins) > before ? rankForWins(career.wins) : 0;
    }
    function recordSpecialResult(winner) {
      if (navy !== "us") return 0;
      if (game.mode === "warrant") {
        const before = warrantRankForWins(career.warrantWins);
        if (winner === "player") career.warrantWins = Math.min(1000000, career.warrantWins + 1);
        else career.warrantLosses = Math.min(1000000, career.warrantLosses + 1);
        saveCareers();
        const after = warrantRankForWins(career.warrantWins);
        return after > before ? after : 0;
      }
      if (game.mode === "fleet") {
        if (winner === "player") {
          career.fleetStreak = Math.min(3, career.fleetStreak + 1);
          if (career.fleetStreak === 3 && !career.fleetAdmiral) {
            career.fleetAdmiral = true;
            saveCareers();
            return 6;
          }
        } else career.fleetStreak = 0;
        saveCareers();
      }
      return 0;
    }
    function availableMode(mode) {
      if (mode === "quick") return "quick";
      if (navy === "us" && mode === "warrant" && rankForWins(career.wins) >= 7) return "warrant";
      if (navy === "us" && mode === "fleet" && rankForWins(career.wins) === 19) return "fleet";
      return "campaign";
    }
    function selectedLevel() {
      const mode = availableMode(ui.mode.value);
      if (mode === "quick") return Math.max(1, Math.min(19, Number(ui.quickLevel.value) || 1));
      if (mode === "fleet") return 19;
      if (mode === "warrant") return [9,11,13,15,17,19][warrantRankForWins(career.warrantWins)];
      return rankForWins(career.wins);
    }
    function fillRankOptions() {
      const selected = ui.quickLevel.value || "1";
      ui.quickLevel.innerHTML = Array.from({length:19},(_,i) =>
        '<option value="' + (i+1) + '">' + (i+1) + '. ' + rankLabel(navy,i) + '</option>').join("");
      ui.quickLevel.value = selected;
    }
    function formatWinCount(count) {
      if (language !== "ru") return count + " " + t(count === 1 ? "winCountOne" : "winCountMany");
      const lastTwo = Math.abs(count) % 100;
      const last = lastTwo % 10;
      const form = lastTwo >= 11 && lastTwo <= 14 ? "winCountMany" :
        last === 1 ? "winCountOne" : last >= 2 && last <= 4 ? "winCountFew" : "winCountMany";
      return count + " " + t(form);
    }
    function renderCareer() {
      const rank = rankForWins(career.wins);
      const setup = game.phase === "setup";
      if (setup) ui.mode.value = availableMode(ui.mode.value);
      const current = setup ? selectedLevel() : game.level;
      ui.navy.disabled = !setup;
      ui.mode.disabled = !setup;
      ui.quickLevel.disabled = !setup || ui.mode.value !== "quick";
      ui.quickBox.hidden = ui.mode.value !== "quick";
      ui.warrantOption.disabled = navy !== "us" || rank < 7;
      ui.fleetOption.disabled = navy !== "us" || rank < 19;
      ui.careerReset.disabled = game.phase === "playing";
      ui.careerRank.textContent = t(navy === "ru" ? "navyRussia" : "navyUS") + " · " +
        t("careerRank") + " " + rank + " / 19 · " + rankLabel(navy,rank-1);
      if (rank < 19) {
        const previous = rank === 1 ? 0 : PROMOTION_WINS[rank-2];
        const required = PROMOTION_WINS[rank-1] - previous;
        const progress = career.wins - previous;
        ui.careerProgress.max = required;
        ui.careerProgress.value = progress;
        ui.careerProgressText.textContent = t("careerProgress") + ": " + (required-progress) +
          " (" + progress + " / " + required + ")";
      } else {
        ui.careerProgress.max=1;
        ui.careerProgress.value=1;
        ui.careerProgressText.textContent=t("careerMax");
      }
      const notice=ui.mode.value==="quick" ? "quickModeNotice" :
        ui.mode.value==="warrant" ? "warrantModeNotice" :
        ui.mode.value==="fleet" ? "fleetModeNotice" : "careerModeNotice";
      ui.careerStats.textContent = t("careerVictories") + ": " + career.wins + " · " +
        t("careerDefeats") + ": " + career.losses + " · " + t("careerStreak") + ": " + career.streak +
        " · " + t("rankLevel") + ": " + current + "/19 · " + t(notice);
      ui.careerAchievements.innerHTML = career.achievements.length ?
        career.achievements.map(a=>"<span>"+t(a)+"</span>").join("") :
        "<span>"+t("achievementNone")+"</span>";
      const extra=game.specialPromotion===6 ? t("legendPromotion") :
        game.specialPromotion>0 ? t("specialPromotion")+" "+warrantLabel(game.specialPromotion-1) : "";
      ui.promotion.hidden = !game.promotion && !extra;
      ui.promotion.textContent = game.promotion ?
        t("promotion")+" "+rankLabel(game.navy,game.promotion-1) : extra;
      ui.rankList.innerHTML = Array.from({length:19},(_,i)=>
        "<li>"+rankLabel(navy,i)+(i+1<=rank ? " ✓" :
          " · "+formatWinCount(PROMOTION_WINS[i-1]))+"</li>").join("");
      ui.careerSpecial.hidden = navy !== "us";
      if (navy === "us") {
        const grade = warrantRankForWins(career.warrantWins);
        const specialist = grade ? warrantLabel(grade-1) : t("warrantCandidate");
        const next = grade < 5 ? t("warrantNext")+": "+warrantLabel(grade)+" · "+
          formatWinCount(WARRANT_WINS[grade]-career.warrantWins) :
          t("warrantFinished");
        const trial = rank < 7 ? t("warrantLock") : t("warrantStatus")+": "+career.warrantWins+
          " · "+t("warrantLosses")+": "+career.warrantLosses;
        const fleet = career.fleetAdmiral ? t("fleetAwarded") :
          rank < 19 ? t("fleetLock") : t("fleetStatus")+": "+Math.min(3, career.fleetStreak)+" / 3";
        ui.careerSpecial.textContent=t("warrantHeading")+" · "+specialist+"\n"+trial+"\n"+next+
          "\n"+WARRANT_RANKS[language].map((_,i)=>warrantLabel(i)+(i<grade ? " ✓" : "")).join(" · ")+
          "\n"+t("fleetHeading")+"\n"+fleet+"\n"+t("fleetNote");
      }
    }
