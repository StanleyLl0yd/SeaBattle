function updateStatus(key, args = {}) { game.message = { key, args }; }
    function setLanguage(next) {
      language = next === "ru" ? "ru" : "en";
      document.documentElement.lang = language;
      document.title = t("pageTitle");
      document.querySelectorAll("[data-i18n]").forEach(node => { node.textContent = t(node.dataset.i18n); });
      document.querySelectorAll("[data-i18n-aria-label]").forEach(node => { node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel)); });
      document.querySelectorAll(".cols").forEach(node => {
        node.replaceChildren(...LETTERS[language].map(letter => {
          const span = document.createElement("span");
          span.textContent = letter;
          return span;
        }));
      });
      ui.language.value = language;
      ui.navy.value = navy;
      fillRankOptions();
      if (game) render();
    }
    function setUpGame() {
      epoch++;
      ui.mode.value = availableMode(ui.mode.value);
      const day = utcChallengeDate();
      game = { player: randomFleet(), enemy: ui.mode.value === "daily" ? dailyFleet(day) : randomFleet(),
        manual: false, horizontal: true, hover: -1,
        phase: "setup", turn: "player", navy, mode: ui.mode.value, level: selectedLevel(), promotion:0, specialPromotion:0,
        dailyDate: day, dailyResult: null, trace: [],
        message: { key: "ready", args: {} } };
      render();
    }
    function paintPreview() {
      ui.player.querySelectorAll(".preview-good,.preview-bad").forEach(c => c.classList.remove("preview-good", "preview-bad"));
      if (!game.manual || game.phase !== "setup" || game.hover === -1) return;
      const length = FLEET[game.player.ships.length];
      if (!length) return;
      const pick = candidate(game.player, length, game.hover, game.horizontal);
      for (const i of pick.cells) ui.player.children[i].classList.add(pick.valid ? "preview-good" : "preview-bad");
    }
    function renderBoard(board, hidden, target) {
      const reveal = !hidden || game.phase === "finished";
      const canShoot = hidden && game.phase === "playing" && game.turn === "player";
      target.classList.toggle("playing", canShoot);
      let html = "";
      for (let i = 0; i < 100; i++) {
        const shot = board.shots[i];
        const ship = board.cells[i] !== -1;
        const classes = ["cell", hidden ? "enemy-cell" : "own-cell"];
        if (ship && reveal && shot === null) classes.push("ship");
        if (shot) classes.push(shot, "fired");
        const description = shot === "miss" || shot === "blocked" ? t("miss") : shot === "hit" ? t("hit") : shot === "sunk" ? t("sunk") : ship && reveal ? t("ship") : t("unknown");
        html += `<button type="button" class="${classes.join(" ")}" data-i="${i}" aria-label="${nameAt(i)}: ${description}" ${hidden && (!canShoot || shot !== null) ? "disabled" : ""}></button>`;
      }
      target.innerHTML = html;
    }
    function render() {
      renderBoard(game.player, false, ui.player);
      renderBoard(game.enemy, true, ui.enemy);
      ui.setup.hidden = game.phase !== "setup";
      // Explicit display is required because the CSS class has its own display rules.
      ui.setup.style.display = game.phase === "setup" ? "" : "none";
      ui.resultActions.hidden = game.phase !== "finished";
      ui.dailyPanel.hidden = game.mode !== "daily";
      ui.dailyShare.hidden = game.mode !== "daily" || game.phase !== "finished" || game.turn !== "player";
      if (game.mode === "daily") {
        const best = dailyBest(game.dailyDate);
        ui.dailyDetails.textContent = t("dailyWhen") + ": " + game.dailyDate + " · " +
          t("dailyBest") + ": " + (best === null ? t("dailyUnplayed") : best) + ". " + t("dailyRules");
      }
      ui.tacticalPanel.hidden = game.phase !== "finished" || !game.trace?.length;
      if (!ui.tacticalPanel.hidden) {
        const report = summarizeTactics(game.trace);
        ui.tacticalDetails.textContent = t("tacticalSummary") + ": " + report.shots +
          " · " + t("tacticalHunt") + ": " + report.huntShots +
          " (" + t("tacticalHits") + ": " + report.huntHits + ")" +
          " · " + t("tacticalFinish") + ": " + report.targetShots +
          " (" + t("tacticalHits") + ": " + report.targetHits + ")" +
          " · " + t("tacticalMisses") + ": " + report.misses +
          " · " + t("tacticalPromising") + ": " + report.promising +
          " · " + t("tacticalAlternatives") + ": " + report.alternatives;
        const examples = game.trace.map((step,i)=>({...step,number:i+1}))
          .filter(step=>step.bestCell !== null && step.bestCell !== undefined && step.max>step.selected)
          .slice(0,3);
        if (examples.length) ui.tacticalDetails.textContent += "\n" + t("tacticalExamples") + ": " +
          examples.map(step=>"#"+step.number+" "+nameAt(step.chosen)+" → "+nameAt(step.bestCell)).join(" · ");
      }
      ui.status.textContent = t(game.message.key, game.message.args);
      ui.dot.className = "statusdot" + (game.phase === "finished" ? " ended" : game.turn === "computer" ? " waiting" : "");
      $("player-alive").textContent = `${remaining(game.player)} / 10`;
      $("enemy-alive").textContent = `${remaining(game.enemy)} / 10`;
      $("player-hits").textContent = hitCount(game.enemy);
      $("computer-hits").textContent = hitCount(game.player);
      $("player-shots").textContent = shotCount(game.enemy);
      $("computer-shots").textContent = shotCount(game.player);
      ui.progress.textContent = `${game.player.ships.length} / 10`;
      if (game.manual) {
        const size = FLEET[game.player.ships.length];
        ui.hint.textContent = size ? t("hintManual", { size, direction: t(game.horizontal ? "horizontal" : "vertical") }) : t("hintComplete");
      } else ui.hint.textContent = t("hintAuto");
      ui.rotate.disabled = !game.manual || game.phase !== "setup" || game.player.ships.length === FLEET.length;
      ui.undo.disabled = !game.manual || game.phase !== "setup" || !game.player.ships.length;
      ui.start.disabled = game.phase !== "setup" || game.player.ships.length !== FLEET.length;
      renderCareer();
      paintPreview();
    }
    function startBattle() {
      if (game.phase !== "setup" || game.player.ships.length !== 10) return;
      game.phase = "playing";
      game.turn = "player";
      ui.mode.value = availableMode(ui.mode.value);
      game.level = selectedLevel();
      game.mode = ui.mode.value;
      game.navy = navy;
      updateStatus(game.mode === "daily" ? "dailyRules" : "turn");
      render();
    }
    function finish(winner) {
      if (game.phase !== "playing") return;
      game.phase = "finished";
      game.turn = winner;
      if (game.mode === "campaign") {
        const misses = shotCount(game.enemy) - hitCount(game.enemy);
        game.promotion = recordCareerResult(winner, misses);
      } else if (game.mode === "daily") {
        if (winner === "player") {
          const shots = shotCount(game.enemy);
          game.dailyResult = { date:game.dailyDate, shots, best:saveDailyScore(game.dailyDate, shots) };
        }
      } else if (game.mode === "warrant" || game.mode === "fleet") {
        game.specialPromotion = recordSpecialResult(winner);
      }
      const keys = game.mode === "daily" ? ["dailyWin","careerLoss"] :
        game.mode === "campaign" ? ["campaignWin","careerLoss"] :
        game.mode === "warrant" ? ["warrantWin","warrantLoss"] :
        game.mode === "fleet" ? ["fleetWin","fleetLoss"] : ["quickWin","lose"];
      updateStatus(keys[winner === "player" ? 0 : 1]);
    }
    function playerFire(i) {
      if (game.phase !== "playing" || game.turn !== "player") return;
      const snapshot = tacticalSnapshot(game.enemy, i);
      const outcome = fireAt(game.enemy, i);
      if (outcome.kind === "already") return;
      game.trace.push({...snapshot, outcome:outcome.kind});
      if (game.mode === "campaign" && shotCount(game.enemy) === 1 && outcome.kind !== "miss")
        grantAchievement("achievementFirst");
      if (remaining(game.enemy) === 0) finish("player");
      else if (outcome.kind === "miss") {
        if (game.mode === "daily") {
          game.turn = "player";
          updateStatus("dailyMiss");
        } else {
          game.turn = "computer";
          updateStatus("playerMiss", { at: i });
          const current = epoch;
          setTimeout(() => computerFire(current), 650);
        }
      } else if (outcome.kind === "sunk") updateStatus("playerSunk", { at: i, size: outcome.size });
      else updateStatus("playerHit", { at: i });
      render();
    }
    function computerFire(current) {
      if (epoch !== current || game.phase !== "playing" || game.turn !== "computer") return;
      const i = aiChooseShot(game.player, game.level);
      if (i === null) return;
      const outcome = fireAt(game.player, i);
      if (remaining(game.player) === 0) finish("computer");
      else if (outcome.kind === "miss") {
        game.turn = "player";
        updateStatus("computerMiss", { at: i });
      } else if (outcome.kind === "sunk") updateStatus("computerSunk", { at: i, size: outcome.size });
      else updateStatus("computerHit", { at: i });
      render();
      if (game.phase === "playing" && game.turn === "computer") setTimeout(() => computerFire(current), 620);
    }
    ui.player.addEventListener("click", event => {
      const cell = event.target.closest(".cell");
      if (!cell || !game.manual || game.phase !== "setup") return;
      const size = FLEET[game.player.ships.length];
      if (!size) return;
      const pick = candidate(game.player, size, Number(cell.dataset.i), game.horizontal);
      if (!pick.valid) { updateStatus("placementInvalid"); render(); return; }
      placeShip(game.player, pick.cells);
      updateStatus(game.player.ships.length === 10 ? "placementComplete" : "placementNext", { count: 10 - game.player.ships.length });
      render();
    });
    ui.player.addEventListener("pointerover", event => {
      const cell = event.target.closest(".cell");
      if (!cell || !game.manual || game.phase !== "setup") return;
      const i = Number(cell.dataset.i);
      if (game.hover !== i) { game.hover = i; paintPreview(); }
    });
    ui.player.addEventListener("pointerleave", () => { game.hover = -1; paintPreview(); });
    ui.enemy.addEventListener("click", event => {
      const cell = event.target.closest(".cell");
      if (cell) playerFire(Number(cell.dataset.i));
    });
    ui.again.addEventListener("click", setUpGame);
    ui.dailyShare.addEventListener("click", async () => {
      if (game.mode !== "daily" || game.phase !== "finished" ||
          game.turn !== "player" || !game.dailyResult) return;
      const {date,shots,best} = game.dailyResult;
      const text = dailyShareText(date,shots,best,language);
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard not available");
        await navigator.clipboard.writeText(text);
        ui.dailyShare.textContent = t("dailyCopied");
      } catch {
        if (typeof window !== "undefined" && typeof window.prompt === "function")
          window.prompt(t("dailyCopyFallback"),text);
      }
    });
    ui.playAgain.addEventListener("click", () => {
      if (game.phase === "finished") setUpGame();
    });
    ui.navy.addEventListener("change", () => {
      if (game.phase !== "setup") { ui.navy.value = navy; return; }
      const choice = ui.navy.value;
      if (choice !== "ru" && choice !== "us") { ui.navy.value = navy; return; }
      navy = choice;
      career = careers[navy];
      saveSelectedNavy();
      ui.mode.value = "campaign";
      fillRankOptions();
      game.navy = navy;
      game.mode = "campaign";
      game.level = selectedLevel();
      game.promotion = 0;
      game.specialPromotion = 0;
      render();
    });
    ui.mode.addEventListener("change", () => {
      if (game.phase !== "setup") return;
      ui.mode.value = availableMode(ui.mode.value);
      game.mode = ui.mode.value;
      game.level = selectedLevel();
      game.dailyDate = utcChallengeDate();
      game.enemy = game.mode === "daily" ? dailyFleet(game.dailyDate) : randomFleet();
      game.trace = [];
      game.dailyResult = null;
      render();
    });
    ui.quickLevel.addEventListener("change", () => {
      if (game.phase !== "setup") return;
      game.level = selectedLevel();
      render();
    });
    ui.careerReset.addEventListener("click", () => {
      if (game.phase === "playing") return;
      if (typeof confirm !== "function" ||
          !confirm(t("resetConfirm") + " " + t(navy === "ru" ? "navyRussia" : "navyUS") +
            ". " + t("navyResetScope"))) return;
      careers[navy] = freshCareer(navy);
      career = careers[navy];
      saveCareers();
      ui.mode.value = "campaign";
      setUpGame();
    });
    ui.auto.addEventListener("click", () => {
      if (game.phase !== "setup") return;
      game.player = randomFleet();
      game.manual = false;
      game.hover = -1;
      updateStatus("autoReady");
      render();
    });
    ui.manual.addEventListener("click", () => {
      if (game.phase !== "setup") return;
      game.player = createBoard();
      game.manual = true;
      game.horizontal = true;
      game.hover = -1;
      updateStatus("manualStart");
      render();
    });
    ui.rotate.addEventListener("click", () => {
      if (!game.manual || game.phase !== "setup") return;
      game.horizontal = !game.horizontal;
      render();
    });
    ui.undo.addEventListener("click", () => {
      if (!game.manual || game.phase !== "setup" || !game.player.ships.length) return;
      const last = game.player.ships.pop();
      for (const i of last.cells) game.player.cells[i] = -1;
      updateStatus("undoReady");
      render();
    });
    ui.start.addEventListener("click", startBattle);
    document.addEventListener("keydown", event => {
      const rotateKey = event.code === "KeyR" || event.key?.toLowerCase() === "r";
      const editing = event.target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName);
      if (rotateKey && !editing && !event.repeat && !event.isComposing &&
          !event.ctrlKey && !event.altKey && !event.metaKey &&
          game.phase === "setup" && game.manual && !ui.rotate.disabled) {
        event.preventDefault();
        ui.rotate.click();
      }
    });
    ui.language.addEventListener("change", () => setLanguage(ui.language.value));
    ui.navy.value = navy;
    ui.mode.value = "campaign";
    ui.quickLevel.value = "1";
    setLanguage(language);
    setUpGame();

// Scope the offline shell to this project and do not reload an unfinished game.
if (typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof window !== "undefined") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", {scope:"./"}).catch(() => {});
  });
}
