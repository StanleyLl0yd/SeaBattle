function createBoard() {
      return { cells: Array(100).fill(-1), shots: Array(100).fill(null), ships: [] };
    }
    function xy(i) { return [i % SIZE, Math.floor(i / SIZE)]; }
    function index(x, y) { return y * SIZE + x; }
    function neighbors(i, diagonals = true) {
      const [x, y] = xy(i);
      const result = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy || !diagonals && Math.abs(dx) + Math.abs(dy) !== 1) continue;
        const a = x + dx, b = y + dy;
        if (a >= 0 && a < SIZE && b >= 0 && b < SIZE) result.push(index(a, b));
      }
      return result;
    }
    function candidate(board, size, at, horizontal) {
      const [x, y] = xy(at);
      const cells = [];
      let valid = true;
      for (let offset = 0; offset < size; offset++) {
        const a = x + (horizontal ? offset : 0), b = y + (horizontal ? 0 : offset);
        if (a >= SIZE || b >= SIZE) { valid = false; continue; }
        const i = index(a, b);
        cells.push(i);
        if (board.cells[i] !== -1 || neighbors(i).some(n => board.cells[n] !== -1)) valid = false;
      }
      return { cells, valid: valid && cells.length === size };
    }
    function placeShip(board, cells) {
      const id = board.ships.length;
      board.ships.push({ id, size: cells.length, cells: [...cells], hits: 0, sunk: false });
      for (const i of cells) board.cells[i] = id;
    }
    function randomFleet(random = Math.random) {
      for (let attempt = 0; attempt < 100; attempt++) {
        const board = createBoard();
        let failed = false;
        for (const size of FLEET) {
          const available = [];
          for (let i = 0; i < 100; i++) for (const horizontal of [true, false]) {
            if (size === 1 && !horizontal) continue;
            const pick = candidate(board, size, i, horizontal);
            if (pick.valid) available.push(pick.cells);
          }
          if (!available.length) { failed = true; break; }
          placeShip(board, available[Math.floor(random() * available.length)]);
        }
        if (!failed) return board;
      }
      throw new Error("Не удалось расставить корабли");
    }
    function fireAt(board, i) {
      if (i < 0 || i >= 100 || board.shots[i] !== null) return { kind: "already" };
      const shipId = board.cells[i];
      if (shipId === -1) {
        board.shots[i] = "miss";
        return { kind: "miss" };
      }
      const ship = board.ships[shipId];
      board.shots[i] = "hit";
      ship.hits++;
      if (ship.hits !== ship.size) return { kind: "hit" };
      ship.sunk = true;
      for (const part of ship.cells) {
        board.shots[part] = "sunk";
        for (const n of neighbors(part)) {
          if (board.cells[n] === -1 && board.shots[n] === null) board.shots[n] = "blocked";
        }
      }
      return { kind: "sunk", size: ship.size };
    }
    function remaining(board) { return board.ships.filter(s => !s.sunk).length; }
    function shotCount(board) { return board.shots.filter(s => s === "hit" || s === "sunk" || s === "miss").length; }
    function hitCount(board) { return board.ships.reduce((sum, ship) => sum + ship.hits, 0); }
    function nameAt(i) { return `${LETTERS[language][i % SIZE]}${Math.floor(i / SIZE) + 1}`; }
    function randomFrom(values) { return values[Math.floor(Math.random() * values.length)]; }
