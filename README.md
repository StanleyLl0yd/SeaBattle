<p align="center">
  <img src="assets/readme-banner.svg" alt="Sea Battle / Морской бой — Battleship grid in navy, cyan and coral colors" width="100%">
</p>

<p align="center">
  <a href="README.md"><strong>EN English</strong></a> &nbsp;·&nbsp; <a href="README.ru.md">🇷🇺 Русский</a>
</p>

<p align="center">
  <a href="https://stanleyll0yd.github.io/SeaBattle/"><strong>▶ PLAY IN BROWSER</strong></a> &nbsp;·&nbsp; <a href="https://github.com/StanleyLl0yd/SeaBattle/actions/workflows/ci.yml">CI status</a> &nbsp;·&nbsp; <a href="CHANGELOG.md">Changelog</a>
</p>

---

**⚓ Sea Battle** is a classic single-player Battleship game against the computer. Two fleets, a 10 × 10 sea grid, and a simple goal: sink every enemy ship before yours are lost. Play online or open `index.html` directly — no account, server, installation, or network connection required.

## ⚓ 01 · Fleet & rules

| Ship length | Number of ships | Occupied cells |
| :---: | :---: | :---: |
| 4 | 1 | 4 |
| 3 | 2 | 6 |
| 2 | 3 | 6 |
| 1 | 4 | 4 |
| **Total** | **10** | **20** |

- Each player has a **10 × 10** grid. Ships are placed horizontally or vertically and **must not touch**, even diagonally.
- **You fire first.** A hit or a sunk ship gives you another shot; a miss passes the turn.
- When a ship is sunk, its surrounding empty cells are marked automatically.
- The first player to sink all ten opposing ships wins.

## 🎯 02 · Take command

1. Open the [game](https://stanleyll0yd.github.io/SeaBattle/) or your local `index.html`.
2. Keep the automatically arranged fleet, select **Random fleet** to shuffle it, or choose **Place manually**.
3. For manual placement, select a starting cell; use **Rotate (R)** to change orientation and **Undo** to remove the last ship.
4. Select **Start battle**, then fire by selecting cells on the computer's grid.
5. Use **New game** to begin again. The layout supports desktop, mobile, and keyboard navigation.

## 🌐 03 · Language & accessibility

- **English is the default language.** If the browser's primary language is Russian (`ru`, `ru-RU`, `ru_*`), the game starts in Russian; all other locales use English.
- The **EN/RU** selector changes language instantly, even during a battle, without resetting the match.
- Board coordinates, instructions, notifications, buttons, document title, and screen-reader labels all follow the selected language.
- Language selection is limited to the current page; a reload detects the browser language again. It does not send data over the network.
- These repository instructions are also available [in Russian](README.ru.md).

## 🛠 04 · Run & develop

This is an **offline-first, single-file** HTML/CSS/JavaScript game with **zero runtime dependencies** and no build step. All game rules, UI, and AI live in `index.html`.

Automated tests require **Node.js 22+**:

```sh
npm test
```

GitHub Actions verifies engine and localization tests on pull requests. The protected `main` branch automatically publishes to GitHub Pages **only after successful tests**. Read [AGENTS.md](AGENTS.md) for mandatory audit/refactoring, artwork, and repository standards.

## 🚢 05 · Release & project links

| | |
| :-- | :-- |
| **Current version** | `0.2.0` |
| **Play online** | [SeaBattle on GitHub Pages](https://stanleyll0yd.github.io/SeaBattle/) |
| **Source code** | [StanleyLl0yd/SeaBattle](https://github.com/StanleyLl0yd/SeaBattle) |
| **Release history** | [CHANGELOG.md](CHANGELOG.md) |
| **CI** | [GitHub Actions](https://github.com/StanleyLl0yd/SeaBattle/actions/workflows/ci.yml) |
| **License** | No reuse license has been granted yet. |

---

<p align="center">
  <a href="README.md"><strong>EN English</strong></a> &nbsp;·&nbsp; <a href="README.ru.md">🇷🇺 Русский</a>
</p>

<p align="center"><sub>⚓ SEA BATTLE · 10 × 10 · BUILT FOR THE OPEN WEB</sub></p>
