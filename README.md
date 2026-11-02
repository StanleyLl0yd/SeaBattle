<p align="center">
  <img src="assets/readme-banner.svg" alt="Sea Battle / Морской бой — Battleship grid in navy, cyan and coral colors" width="100%">
</p>

<p align="center">
  <a href="README.md"><strong>🇺🇸 English</strong></a> &nbsp;·&nbsp; <a href="README.ru.md">🇷🇺 Русский</a>
</p>

<p align="center">
  <a href="https://stanleyll0yd.github.io/SeaBattle/"><strong>▶ PLAY IN BROWSER</strong></a> &nbsp;·&nbsp; <a href="https://github.com/StanleyLl0yd/SeaBattle/actions/workflows/ci.yml">CI status</a> &nbsp;·&nbsp; <a href="CHANGELOG.md">Changelog</a>
</p>

---

Ahoy, Captain! **⚓ Sea Battle** is a classic single-player Battleship game against the computer. Two fleets, a 10 × 10 sea grid, and one mission: send the enemy fleet to the bottom before yours follows it. The computer has put on its sternest captain's face — don't be intimidated. Play in your browser — no account or installation required.

## ⚓ 01 · Fleet & rules

| Ship length | Number of ships | Occupied cells |
| :---: | :---: | :---: |
| 4 | 1 | 4 |
| 3 | 2 | 6 |
| 2 | 3 | 6 |
| 1 | 4 | 4 |
| **Total** | **10** | **20** |

- Each player has a **10 × 10** grid. Ships are placed horizontally or vertically and **must not touch**, even diagonally. No friendly rafting up — not even corner-to-corner.
- **You fire first.** A hit or a sunk ship gives you another shot; a miss passes the turn. Missed the target? Hand the helm to the computer.
- When a ship is sunk, its surrounding empty cells are marked automatically.
- The first player to sink all ten opposing ships wins. No medals for second place in this fleet.

## 🎯 02 · Take command

1. Open the [game](https://stanleyll0yd.github.io/SeaBattle/) in your browser.
2. Your ships are already on station. Keep the automatically arranged fleet, select **Random fleet** to shuffle it, or choose **Place manually** if your inner admiral insists.
3. For manual placement, select a starting cell; use **Rotate (R)** or the physical **R-position key** (works with any keyboard layout) to change orientation. **Undo** removes the last ship.
4. Select **Start battle**, take aim, then fire by selecting cells on the computer's grid. Periscope optional.
5. Use **New game** to begin again — even seasoned sea dogs deserve a rematch. The layout supports desktop, mobile, and keyboard navigation.

## 🌐 03 · Language & accessibility

- **English is the default language.** If the browser's primary language is Russian (`ru`, `ru-RU`, `ru_*`), the game starts in Russian; all other locales use English.
- The **EN/RU** selector changes language instantly, even during a battle, without resetting the match. New orders, same battle.
- Board coordinates, instructions, notifications, buttons, document title, and screen-reader labels all follow the selected language.
- Language selection is limited to the current page; a reload detects the browser language again. It does not send data over the network.
- These repository instructions are also available [in Russian](README.ru.md).

## 🛠 04 · Run & develop

No need to launch an entire shipyard: this is a lightweight **browser-based** HTML/CSS/JavaScript game with **zero runtime dependencies** and currently no build step. Its HTML, CSS, game rules and AI are presently housed in `index.html`, but a single-file distribution is **not** a project requirement. Separate modules/assets when there is a demonstrable maintenance, testing or performance benefit. The computer now uses a **bounded, approximate fleet-probability search**: it samples whole legal fleets consistent with revealed shots, adapts to patterns seen during the match, finishes damaged ships first, and falls back to a fast placement heatmap when needed. No peeking at hidden ship positions — even admirals must play fair.

Automated tests require **Node.js 22+**:

```sh
npm test
```

GitHub Actions verifies engine and localization tests on pull requests. The protected `main` branch automatically publishes to GitHub Pages **only after successful tests**. Read [AGENTS.md](AGENTS.md) for mandatory audit/refactoring, artwork, and repository standards.

## 🚢 05 · Release & project links

| | |
| :-- | :-- |
| **Current version** | `0.3.1` |
| **Play online** | [SeaBattle on GitHub Pages](https://stanleyll0yd.github.io/SeaBattle/) |
| **Source code** | [StanleyLl0yd/SeaBattle](https://github.com/StanleyLl0yd/SeaBattle) |
| **Release history** | [CHANGELOG.md](CHANGELOG.md) |
| **CI** | [GitHub Actions](https://github.com/StanleyLl0yd/SeaBattle/actions/workflows/ci.yml) |
| **License** | No reuse license has been granted yet. |

---

<p align="center">
  <a href="README.md"><strong>🇺🇸 English</strong></a> &nbsp;·&nbsp; <a href="README.ru.md">🇷🇺 Русский</a>
</p>

<p align="center"><sub>⚓ SEA BATTLE · 10 × 10 · FAIR WINDS & ACCURATE SALVOS</sub></p>
