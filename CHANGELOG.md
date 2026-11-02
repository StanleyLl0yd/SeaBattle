# Changelog / История изменений

## [0.3.1] - 2026-11-02

- Manual ship rotation now responds to the physical R-position key regardless of keyboard layout, while respecting modifiers and focused editable controls.
- The game and both READMEs direct players to the browser site rather than local HTML-file play; retained the existing lightweight architecture without mandating a single file.
- Clarified that static CSS/JavaScript modules can be introduced when their maintenance or performance value justifies the migration.

- Поворот кораблей работает физической клавишей на месте R при любой раскладке, без перехвата ввода в текстовые поля и с учётом модификаторов.
- Убраны предложения открывать локальный HTML-файл: играть предлагается через браузерный сайт. Требование единого файла снято.
- Разделение на CSS/JavaScript-модули разрешено, когда оно действительно улучшит поддержку, тестирование или производительность.

## [0.3.0] - 2026-11-02

- Replaced local-only hunt heuristics with bounded approximate inference over complete legal fleets, informed by public shot history and non-touching constraints.
- Improved tactical targeting and mid-game adaptation to edge-heavy defenses, with a deterministic work budget and a fast fallback.
- Added AI fairness, target-selection, boundedness and adversarial perimeter regression tests; no dependencies or new network features.

- Компьютер теперь оценивает вероятные целые флоты, учитывая открытые выстрелы и запрет касания кораблей.
- Улучшены добивание повреждённых кораблей и адаптация к расстановке у краёв; есть ограничение вычислений и резервная тактика.
- Добавлены тесты честности ИИ, поиска целей и сложной периметральной расстановки. Новых зависимостей нет.

## [0.2.0] - 2026-11-02

- English is the default language; Russian is selected automatically for Russian browser locales.
- Added a manual EN/RU switch that preserves the current game and translates all labels, statuses, coordinates, and accessibility names.
- Added bilingual documentation and locale regression tests. Offline single-file deployment retained.

- Английский язык по умолчанию; русский выбирается автоматически при русской локали браузера.
- Ручное переключение EN/RU без сброса партии: переведены надписи, сообщения, координаты и подписи для скринридеров.
- Добавлены двуязычная документация и тесты локализации. Игра по-прежнему работает автономно.

## [0.1.0] - 2026-11-02

- Initial classic Battleship game against the computer.
- Automatic and manual ship placement, with rotation and undo.
- Classic 10×10 fleets and hit-again rules.
- Computer opponent using visible-shot targeting and a search heuristic.
- Responsive Russian-language interface with game statistics.
- Offline single-file distribution; automated engine tests and Pages deployment workflow.