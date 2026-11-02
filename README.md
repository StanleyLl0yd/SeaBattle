# Sea Battle / Морской бой

[![CI](https://github.com/StanleyLl0yd/SeaBattle/actions/workflows/ci.yml/badge.svg)](https://github.com/StanleyLl0yd/SeaBattle/actions/workflows/ci.yml)

**[Play Sea Battle online](https://stanleyll0yd.github.io/SeaBattle/)** · No install, account, internet connection or server required.

A classic single-player Battleship game against the computer. The whole game, styling and AI run directly in your browser from one offline-capable `index.html` file.

## Language / Язык

**English is the default.** If your browser's primary language is Russian (`ru`, `ru-RU`), the game starts in Russian automatically. All other languages use English. Use the **EN/RU** selector at the top to switch instantly, even in the middle of a game. Switching changes board letters, status messages, headings, controls and accessible labels without resetting the match. The selected language lasts for the current page only; a reload detects your browser language again. Language selection does not require network requests.

## How to play

- Both sides have a **10 × 10** grid and 10 ships: **1 × 4, 2 × 3, 3 × 2, 4 × 1** (20 occupied cells).
- Ships can be horizontal or vertical and may not touch one another, even diagonally.
- Choose a random fleet or place your ships manually. Use **Rotate (R)** and **Undo** while placing.
- Select **Start battle**, then choose cells on the computer's grid to fire.
- A hit lets you fire again; a miss passes the turn. You fire first.
- Sinking a ship marks neighboring cells. Sink the entire enemy fleet to win.
- Select **New game** to start over.

The layout supports mobile screens and keyboard navigation. Game state is held only in the browser tab; reloading starts a new game.

## Development

The project intentionally has **no runtime dependencies or build step**. Open `index.html` locally or serve it statically. Automated tests require Node.js 22+:

```sh
npm test
```

CI runs game-engine and localization regression tests for pull requests and changes to `main`. GitHub Pages publishes `index.html` automatically only after successful `main` tests. See [AGENTS.md](AGENTS.md) for engineering, repository-wide audit/refactoring, and canonical artwork policies.

**Version:** 0.2.0. See [CHANGELOG.md](CHANGELOG.md). No open-source license has been selected; source availability does not grant reuse rights.

---

## Русский

**[Играть в «Морской бой»](https://stanleyll0yd.github.io/SeaBattle/)** — классическая браузерная игра против компьютера. Не нужны установка, регистрация, интернет или сервер.

### Выбор языка

**По умолчанию используется английский язык.** Если основной язык браузера русский (`ru`, `ru-RU`), игра автоматически открывается на русском. Для остальных локалей используется английский. Переключатель **EN/RU** вверху страницы позволяет мгновенно поменять язык, даже во время партии: переводятся кнопки, сообщения, подсказки, координаты поля и подписи доступности. Текущая партия не сбрасывается. После обновления страницы язык снова определяется по настройкам браузера; выбор не сохраняется и не отправляется в сеть.

### Правила

- Два поля **10 × 10**, флот из 10 кораблей: **1 × 4, 2 × 3, 3 × 2, 4 × 1** (20 палуб).
- Корабли располагаются горизонтально или вертикально, не касаясь друг друга даже углами.
- Выбери случайную расстановку либо поставь корабли вручную. **Повернуть (R)** меняет ориентацию, **Отменить** удаляет последний корабль.
- Нажми **«Начать бой»** и стреляй по правому полю. Первым ходит игрок.
- Попадание даёт повторный выстрел, промах передаёт ход компьютеру.
- Когда корабль потоплен, соседние клетки помечаются. Победит тот, кто первым потопит весь флот противника.
- **«Новая партия»** сбрасывает игру.

Игра адаптирована под телефон. Состояние партии хранится только в памяти вкладки — после перезагрузки страницы начнётся новая партия.

### Разработка

Игра, интерфейс и искусственный интеллект находятся в одном `index.html`, без сторонних библиотек и сборки. Тесты запускаются с Node.js 22+ командой `npm test`. Защищённая ветка `main`, CI и GitHub Pages обеспечивают проверку и публикацию изменений. Правила для агентов, полного аудита, рефакторинга и иконок: [AGENTS.md](AGENTS.md).

**Версия:** 0.2.0; история — [CHANGELOG.md](CHANGELOG.md). Лицензия на повторное использование исходного кода пока не выбрана.
