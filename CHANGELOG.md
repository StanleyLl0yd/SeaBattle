## [0.9.0] - 2026-11-02

- Added an opt-in Quick Battle tactical trainer with up to three unshot cells scored from public shot evidence and remaining ship sizes; scores are relative placement weights, not probabilities.
- Added pre-shot comparison for the previous shot, bilingual accessible Show/Hide controls, and match-local off-by-default state.
- No changes to fleets, turn rules, AI, careers, daily puzzle, storage keys, privacy, or runtime dependencies. Updated the PWA shell cache.

- Добавлен необязательный тактический тренажёр быстрого боя: до трёх необстрелянных клеток с оценкой по открытым выстрелам и размерам оставшихся кораблей; баллы не являются вероятностями.
- Добавлено сравнение последнего выстрела с альтернативой, оценённой до выстрела; поддержка RU/EN, доступное управление и выключенное по умолчанию состояние.
- Флоты, правила ходов, ИИ, карьеры, ежедневные испытания, формат сохранений, приватность и зависимости не изменены. Обновлён PWA-кеш.

## [0.8.0] - 2026-11-02

- Added a collapsible last-seven-UTC-days history to Daily Challenge using existing best-shot records only; unplayed and corrupted entries are handled safely.
- Kept the `seabattle.daily.v1` storage shape, 90-date retention, deterministic puzzles, local privacy and both campaigns unchanged.
- Added UTC-boundary and corruption regression coverage; bumped PWA cache with the new shell.

- Добавлена раскрывающаяся история ежедневных испытаний за последние семь дней UTC на основе существующих личных рекордов.
- Сохранены формат `seabattle.daily.v1`, хранение последних 90 дат, приватность, флот и обе кампании.
- Добавлены проверки границ дат UTC и повреждённых записей; обновлена версия PWA-кеша.

## [0.7.2] - 2026-11-02

- Added a localized, unobtrusive offline-readiness indicator. It reports readiness only after scoped service-worker activation, with honest failure and unsupported-browser states; the current match is never reloaded.
- Clarified macOS Safari's separate installed-web-app cache and the initial online launch requirement in both READMEs.
- Added readiness-lifecycle and RU/EN regression tests; versioned the PWA cache with the deployable shell update.

- Добавлен индикатор готовности игры к офлайн-запуску на двух языках. Готовность показывается после активации сервис-воркера; предусмотрены состояния ошибки и отсутствия поддержки, без перезапуска текущего боя.
- Уточнено, что установленное приложение Safari на macOS требует первого запуска с интернетом из самого приложения.
- Добавлены регрессионные тесты состояний и переводов; обновлена версия PWA-кеша.

## [0.7.1] - 2026-11-02

- Fixed tactical postgame hints to exclude geometrically impossible directions after aligned hits; recommendations still use only public evidence, remain approximate, and never inspect hidden ship cells.
- Made concrete tactical alternatives wrap onto a separate line, including on mobile screens.
- Bumped the PWA cache version so the updated game shell replaces the previous offline resources.

- Исправлены послематчевые подсказки: невозможные направления продолжения подбитого корабля исключаются по открытым попаданиям и правилам расстановки, без чтения скрытых клеток.
- Примеры альтернативных выстрелов выводятся с новой строки, в том числе на узких экранах.
- Обновлена версия кеша PWA для загрузки исправленных локальных ресурсов.

## [0.7.0] - 2026-11-02

- Split browser logic into ordered local scripts: localization/config, independent naval careers, UI state, game engine, fair AI, daily challenges, tactical assessment and UI handlers; no frameworks or bundler.
- Added a deterministic UTC daily solo puzzle with identical fleet per date and release, shot-count best scores, privacy-safe result sharing and no career impact.
- Added postgame, public-evidence-only tactical review (search/target, hits, misses and approximate placement heatmap opportunities), avoiding claims of proven optimality.
- Added an installable offline PWA (scoped service worker, cache versioning, project-relative manifest and PNG 192/512 icons), with complete GitHub Pages asset packaging.
- Extended unit, campaign and offline asset verification. Existing career saves and both national ladders are preserved.

- Логика разделена на локальные JS-файлы без фреймворка и сборщика; существующие кампании и их сохранения не меняются.
- Ежедневное испытание с общим флотом на дату UTC, личным рекордом по количеству выстрелов и безопасным текстовым результатом.
- Послематчевый разбор поиска, добивания и приблизительных оценок решений только по открытой информации.
- Устанавливаемое PWA с локальным офлайн-кешем и иконками PNG 192/512; опубликованы все необходимые ресурсы.
- Расширены проверки игровой логики, локализации и состава GitHub Pages.

## [0.6.2] - 2026-11-02

- Installed the approved high-contrast ship-and-hit favicon as a local SVG and a compact ICO fallback, including 16×16 and 32×32 sizes.
- Published favicon assets in the GitHub Pages artifact without adding scripts or services; all other icon studies and PNG exports remain archived separately.
- Added tests that verify HTML references, icon sizes and self-contained SVG assets.

- Добавлена фирменная иконка SeaBattle: SVG для современных браузеров и ICO с размерами 16×16 и 32×32 для совместимости.
- GitHub Pages публикует необходимые файлы, без внешних зависимостей; остальные рисунки и варианты PNG сохранены отдельно.
- Тесты проверяют ссылки, размеры и отсутствие внешних ресурсов в SVG.

## [0.6.1] - 2026-11-02

- Fixed Russian victory-count inflection for rank milestones and Warrant Officer trial targets (including 11–14 and 21–24), and English singular/plural win counts.
- Added an obvious, accessible New battle button immediately below the final result after either side wins; restarting preserves the selected career and difficulty.
- Added regression tests for all victory forms, a real computer finishing turn, player victory, mode preservation and bilingual UI.

- Исправлено склонение слова «победа» в порогах званий и целях испытаний уорент-офицеров, а также единственное/множественное число по-английски.
- После победы и поражения появляется отдельная кнопка «Новая партия» под результатом; звание и выбранный режим не сбрасываются.
- Добавлены проверки окончаний числительных, фактического последнего хода ИИ, победы игрока и повторного запуска.

## [0.6.0] - 2026-11-02

- Smoothed progression of fair, public-information-only AI inference across ranks 3–19, replacing the abrupt level-9 activation of fleet sampling and gradually increasing positional adaptation, search budget and decision quality.
- Rebalanced optional Fleet Admiral challenge to three consecutive level-19 victories (was five); existing streaks of three or more in stored profiles now count as earned without resetting main career.
- Added automated difficulty regression benchmarks for perimeter fleets, ordinary random fleets and complete alternating-turn games with original fleet and shot rules.

- Сложность ИИ растёт более плавно на уровнях 3–19: нет резкого включения моделирования на девятом уровне, адаптация к расстановкам и точность выбора выстрела усиливаются постепенно.
- Историческая награда Fleet Admiral теперь выдаётся за три победы подряд на 19-й сложности; ранее накопленные серии не теряются.
- Добавлены регрессионные проверки баланса на случайных и периметральных флотах и полных партиях с чередованием ходов.

## [0.4.0] - 2026-11-02

- Added a 19-rank Russian Navy campaign from Seaman to Admiral of the Fleet, with 18 promotions requiring 45 cumulative campaign wins. Losses never demote.
- Added six fair computer-search tiers and 19 tuned difficulties; quick battle permits any difficulty without changing career progress.
- Added optional browser-local career save (wins, losses, streak and honors), confirmation for reset, promotion messages, bilingual rank list and progress indicator.
- Added comprehensive campaign, fairness, persistence and difficulty regression tests. No external services or runtime packages.

- Добавлена кампания с 19 корабельными званиями ВМФ России: от матроса до адмирала флота за 45 побед. Поражения не понижают в звании.
- Шесть ступеней честного ИИ и 19 настроек сложности; быстрый бой не влияет на карьеру.
- Локальное сохранение карьеры, серии побед, награды, подтверждение сброса, экран повышения и двуязычный список званий.
- Добавлены проверки кампании, честности ИИ, сохранения и разных сложностей; внешние сервисы не нужны.

# Changelog / История изменений

## [0.5.0] - 2026-11-02

- Introduced separate 19-rank RU Navy and US Navy main campaigns, each requiring 45 victories; locale chooses a default navy but players can switch language and fleet independently.
- Added US E-1–E-9 and O-1–O-10 grades, an optional five-grade Warrant Officer trial (W-1–W-5) and a historical Fleet Admiral five-star achievement after five consecutive maximum-difficulty victories.
- Migrated existing Russian career safely from `seabattle.career.v1` into versioned dual profiles without deleting the legacy record. New data validation, nation-scoped reset and mode guards are tested.

- Две независимые кампании ВМФ России и ВМС США по 19 уровням и 45 победам, с отдельным выбором флота и языка.
- Американские звания E-1–E-9 и O-1–O-10, дополнительная ветка Warrant Officer (W-1–W-5) и историческая награда Fleet Admiral за пять побед подряд против сильнейшего ИИ.
- Безопасный перенос российской карьеры из `seabattle.career.v1`, проверка сохраняемых данных, раздельный сброс и защита специальных режимов.

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