const LETTERS = { en: ["A","B","C","D","E","F","G","H","I","J"], ru: ["А","Б","В","Г","Д","Е","Ж","З","И","К"] };
    const browserLocale = typeof navigator === "undefined" ? "" : (navigator.languages?.[0] || navigator.language || "");
    let language = /^ru(?:[-_]|$)/i.test(browserLocale) ? "ru" : "en";
    function t(key, args = {}) {
      const template = I18N[language][key];
      if (template === undefined) throw new Error(`Missing translation: ${language}.${key}`);
      return template.replace(/\{(at|size|count|direction)\}/g, (_, part) => part === "at" ? nameAt(args.at) : String(args[part]));
    }
    const $ = id => document.getElementById(id);
    const ui = {
      player: $("player-board"), enemy: $("enemy-board"), status: $("status-text"), dot: $("status-dot"), offlineNote: $("offline-note"),
      setup: $("setup"), hint: $("setup-hint"), progress: $("setup-progress"),
      auto: $("auto"), manual: $("manual"), rotate: $("rotate"), undo: $("undo"), start: $("start"), again: $("new-game"), language: $("language"),
      resultActions: $("result-actions"), playAgain: $("play-again"),
      dailyPanel: $("daily-panel"), dailyDetails: $("daily-details"), dailyHistory: $("daily-history"), dailyShare: $("daily-share"),
      tacticalPanel: $("tactical-panel"), tacticalDetails: $("tactical-details"),
      trainerPanel: $("trainer-panel"), trainerToggle: $("trainer-toggle"), trainerAdvice: $("trainer-advice"),
      trainerSuggestions: $("trainer-suggestions"), trainerComparison: $("trainer-comparison"),
      navy: $("navy-select"), mode: $("game-mode"), quickLevel: $("quick-level"), quickBox: $("quick-controls"),
      warrantOption: $("mode-warrant"), fleetOption: $("mode-fleet"), careerSpecial: $("career-special"),
      careerRank: $("career-rank"), careerProgress: $("career-progress"), careerProgressText: $("career-progress-text"),
      careerStats: $("career-stats"), careerAchievements: $("career-achievements"),
      statsSummary: $("stats-summary"), statsList: $("stats-list"), statsTrend: $("stats-trend"),
      seriesPanel: $("series-panel"), seriesDetails: $("series-details"), tempo: $("fast-tempo"), rematch: $("rematch"),
      backupExport: $("backup-export"), backupRestore: $("backup-restore"),
      backupText: $("backup-text"), backupStatus: $("backup-status"),
      careerReset: $("career-reset"), rankList: $("rank-list"), promotion: $("promotion")
    };
    let epoch = 0;
    let navy = loadSelectedNavy();
    let careers = loadCareers();
    let personalStats = loadPersonalStats();
    let career = careers[navy];
    let game;
    let offlineStatus = "offlinePreparing";
    let backupStatusKey = "";
