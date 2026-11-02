# SeaBattle — Agent Instructions

These instructions apply to all automated contributors and repository maintenance work. Preserve the existing lightweight classic Battleship product; do not borrow unrelated architecture from other projects.

## Product invariants

- SeaBattle is an English-first, English/Russian bilingual single-player classic Battleship game against a computer. The GitHub Pages game must run in the browser without an account, downloads, installation, application server or third-party runtime dependencies. Internet access to load the hosted page is expected; do not present a downloadable HTML file as a user-facing play option.
- Preserve two 10×10 grids, the fleet [4, 3, 3, 2, 2, 2, 1, 1, 1, 1] (10 ships; 20 occupied cells per side), straight horizontal/vertical ships, and the no-touch rule including diagonals.
- Preserve automatic and manual placement, rotate, undo, first turn by the player, repeated turn after a hit/sink, transfer on a miss, sinking and adjacent-cell blocking, win detection, and restarting a fresh match.
- The computer must base targeting only on publicly revealed shots, hits, sunk ships, remaining legal ship lengths, and derived public information; it must not inspect hidden player ship positions to pick a shot. Use the same authoritative shot resolution and game rules for both players.
- AI search must remain bounded on slower mobile devices. Sample only whole non-touching fleet placements compatible with public evidence; use a safe fallback if sampling is too constrained, and prioritize finishing visible hits. Do not turn the approximate posterior into a claim of proven optimality, introduce hidden-state lookups, or persist opponent profiles without owner approval.
- `index.html` currently hosts the browser implementation, but a single-file architecture is **not mandatory**. Keep tests exercising the authoritative game engine; if moving code into modules/assets, update test harnesses and the Pages artifact workflow without weakening coverage or changing gameplay.
- Preserve responsive layout, keyboard input, readable contrast, touch controls, accessibility semantics, and game-state feedback. Manual-setup rotation uses physical `KeyboardEvent.code === "KeyR"` so it works with Cyrillic and other keyboard layouts; maintain legacy Latin `event.key` fallback and do not hijack editable fields, modifiers or active IME composition.
- English is the default language. Select Russian automatically only when the primary browser language is Russian (`ru`, `ru-*`, or `ru_*`); unknown and other locales fall back to English. Allow instant manual EN/RU switching without resetting a game. All visible text, statuses, coordinates, document title and accessibility labels must follow the active language.
- Keep user-facing README and gameplay instructions available in both English and Russian, using `README.md` and `README.ru.md` respectively. The code-facing `AGENTS.md` remains in English for unambiguous agent instructions. Avoid external translation services, runtime localization dependencies and persistent language tracking. Do not change gameplay or appearance merely for refactoring.
- Keep two independent 19-level campaigns: ВМФ России has the approved 19 Russian shipboard ranks, US Navy has nine E-1–E-9 enlisted ranks followed by ten O-1–O-10 officer ranks. Both use exactly 18 promotion thresholds [1,2,3,5,7,9,11,13,15,17,20,23,26,29,32,36,40,45]. Match all US codes and bilingual names; do not claim game stages are real-world seniority equivalences. Russian locale defaults to Russian Navy, other locales to US Navy; display language and navy preference remain independent. Only campaign victories advance their own navy; quick battles never do, losses never demote, and six fair AI tiers are shared.
- US Navy specialist trials are an **optional**, separately scored W-1–W-5 branch unlocked after main level 7 (E-7), with 2/4/7/10/14 specialist wins. US Fleet Admiral is a **historical five-star honor**, not an active 20th main rank, awarded after five consecutive max-difficulty wins in an optional challenge unlocked after US Admiral (45 campaign wins). Never merge specialist or legend wins into main campaign progress.
- Owner-approved persistence exception: use `seabattle.careers.v2` for separately validated RU and US aggregate careers, including US specialist victories and Fleet Admiral achievement, and `seabattle.navy.v1` for the selected navy. **Migrate** legacy `seabattle.career.v1` to the RU profile; never delete or overwrite this legacy record as a side effect. Reset only the explicitly selected nation's career after confirmation. Handle malformed or unavailable storage without breaking gameplay. Never store unfinished matches, board layouts or opponent profiles. No analytics, tracking, ads, external API calls, telemetry, accounts or online multiplayer without approval.
- Prefer built-in browser APIs, JavaScript, HTML and CSS. Avoid framework rewrites, bundlers, runtime libraries, backend infrastructure or extra layers without a concrete necessity approved by the owner.

## README language and visual identity (mandatory)

- Keep **two independent, complete README documents**: root `README.md` in English (GitHub's default repository landing page) and `README.ru.md` in Russian. Do not combine both languages into one long README or replace either document with a stub.
- The English README language link must display **🇺🇸 English**, and the Russian link **🇷🇺 Русский**, at both the top and bottom of both documents; these are flag icons, not literal `EN` or `RU` text prefixes.
- Both README files must use the **same maritime visual system** as the actual game: shared `assets/readme-banner.svg`, dark navy `#081522` / `#102338`, cyan `#58d9e8`, ship blue `#49768e`, coral `#ff777e` and warm accent `#f3bd72`. This banner is README artwork, **not** a canonical app icon.
- Maintain the established matching layout: centered common banner, centered clickable `English | Русский` links in both documents at **top and bottom**, centered play/CI/changelog links, divider, five numbered maritime-themed sections (`01`–`05`), matching fleet tables, project links, and compact centered footer. Adapt visible prose naturally to each language while preserving corresponding structure and facts.
- Keep the README copy friendly and **lightly playful in nautical language** in both English and Russian (e.g., a captain's greeting, friendly shipboard phrases and a wink about the computer opponent). Match the level of humor across both versions, keep prose clear for newcomers, and never let a joke obscure rules, setup instructions, accessibility, security or licensing facts. Avoid forced slang, excessive jokes or unrelated pirate tropes.
- GitHub README Markdown does not support custom page CSS or browser-locale scripts. The language switch is **a pair of standard relative Markdown/HTML links** to the two files, not JavaScript, and must work within GitHub's file viewer.
- When game behavior, setup instructions, supported locales, version, links or project policies change, **update both READMEs in the same PR**. Keep translated rules, steps, version, URLs, fleet numbers and commands consistent. Do not silently introduce an English-only or Russian-only update.
- Preserve the brand colors, layout, shared banner and clickable language navigation unless the owner explicitly requests redesign. Do not substitute arbitrary badges, screenshots, stock imagery or an app icon in place of the README hero.
- Keep `tests/readme.test.cjs` passing as the automated structure/translation-parity guard. If a deliberate owner-approved redesign changes the structure, update both READMEs, this specification and the test together.
## Normal change workflow

1. Inspect the relevant files, current tests, README and actual CI before changing code.
2. Start a short-lived branch from current `main`; do not write directly to protected `main` or bypass its rules.
3. Keep changes focused; avoid unrelated style churn. Add a regression test first for an important bug or behavior change when feasible.
4. Run relevant tests (`npm test`) and any additional browser or accessibility checks appropriate to the change; never claim unexecuted checks passed.
5. Open a pull request; require the strict `Game tests` check, resolved review threads and the existing squash-only merge policy. Merge the exact verified head, then confirm the post-merge `main` and GitHub Pages deployment.
6. Keep README, CHANGELOG, version numbers and release metadata synchronized when behavior or a release changes. Do not create, rewrite, move, or delete immutable `v*` release tags as a workaround.
7. Keep source comments sparse and purposeful; comments in code must be in English. Remove obsolete comments.

## Security and CI hygiene

- Treat DOM events, URLs and any future browser storage or imported files as untrusted. Validate bounds and state transitions before updating the game, and keep computation bounded to avoid freezing the UI.
- Do not commit credentials, tokens, private keys, access logs, personal data or `.env` secrets. The static game must not require secrets at build time or in the browser.
- Keep GitHub Actions pinned to audited full 40-character commit SHAs, with a nearby upstream action-version comment; upgrade deliberately and verify the new target.
- Use least-privilege GitHub Actions permissions. Do not run untrusted PR code using secrets or write-capable credentials; do not use `pull_request_target` for ordinary CI.
- Deploy the complete static site (HTML and any required local CSS, JavaScript and assets) to GitHub Pages only from verified `main` after tests pass. Do not weaken CI or protection rules to force a release.
- Avoid unnecessary external images, fonts, scripts and remote resources that create runtime tracking, privacy, availability or supply-chain dependencies.
## Mandatory repository-wide audit and deep-refactoring protocol

When the owner explicitly requests a **full audit, security audit, code review, full cleanup, optimization, simplification, or full/deep refactoring of the project/repository**, these rules are mandatory. This means a complete repository-wide pass, never just the diff or recently modified modules. A narrowly scoped change or review remains scoped unless the owner asks for full coverage.

A repository-wide audit is an implementation task, not merely a request for recommendations.

### Objective

Audit the entire repository and reduce the codebase to the minimum necessary complexity while preserving 100% of its current functionality and externally observable behavior.

The refactored project must preserve, unless an explicitly requested bug fix requires otherwise:

- user-facing functionality;
- application behavior;
- UI/UX;
- business or game logic;
- public APIs and contracts;
- persisted and exchanged data formats;
- platform-specific behavior;
- documented capabilities;
- edge-case semantics.

The goal is minimum **necessary complexity**, not minimum line count.

Do not perform code golf.

A change is justified only when it objectively reduces one or more of:

- code volume;
- duplication;
- conceptual complexity;
- branching or state;
- coupling;
- maintenance burden;
- dependency surface;
- runtime cost;
- regression risk.

If a change merely makes the implementation different without making it demonstrably smaller, simpler, safer, clearer, or more efficient, leave the code unchanged.

Default decision rule:

- if code is proven unnecessary, delete it;
- if code can be objectively simplified, simplify it;
- if duplicate responsibilities can be safely consolidated, consolidate them;
- if an abstraction no longer provides value, remove it;
- if the benefit is uncertain, preserve the existing working behavior.

### Required audit scope

Before making repository-wide refactoring changes, inspect the complete repository rather than only recently changed files or obvious hotspots.

Review all relevant areas, including:

- production source code;
- tests and test utilities;
- resources and assets;
- configuration files;
- build scripts and build configuration;
- CI/CD workflows;
- release tooling;
- dependencies and development dependencies;
- static-analysis and security configuration;
- documentation;
- platform-specific integration;
- generated-code integration points;
- directory and module structure.

First establish:

1. the actual architecture;
2. authoritative sources of state and business logic;
3. all current user-visible functionality;
4. important internal behavior and contracts;
5. persistence and compatibility requirements;
6. framework-, build-, platform-, or convention-driven entry points.

Only then begin removing or consolidating code.

### Required removal candidates

Actively search for and remove, when proven safe:

- dead code;
- unreachable code;
- unused functions;
- unused classes;
- unused methods;
- unused variables;
- unused constants;
- unused types;
- unused interfaces;
- unused imports and exports;
- unused files;
- unused resources and assets;
- obsolete legacy code that no longer participates in current behavior;
- temporary workarounds whose original constraint no longer exists;
- duplicate or near-duplicate implementations;
- unnecessary abstraction layers;
- unnecessary wrappers;
- unnecessary helper functions;
- adapter chains that add no meaningful semantics;
- redundant data conversions;
- redundant intermediate objects;
- redundant intermediate state;
- redundant copies and transformations;
- defensive checks for states already guaranteed by types, architecture, invariants, or earlier validation;
- repeated validation of already validated data;
- repeated checks of the same condition;
- redundant fallbacks;
- obsolete compatibility branches;
- unused feature flags;
- obsolete configuration options;
- unused dependencies;
- unused development dependencies;
- duplicate-purpose dependencies;
- commented-out historical code;
- stale TODO/FIXME items;
- leftovers from previous migrations or refactors.

Pay particular attention to patterns such as:

- repeated null/state/bounds checks;
- nested checks of the same condition;
- repeated validation across adjacent layers;
- unnecessary `try/catch` blocks;
- wrapper -> wrapper -> wrapper call chains;
- DTO/model conversion chains;
- multiple representations of the same authoritative state;
- temporary states that duplicate existing state;
- compatibility paths left behind after migrations;
- helpers with only one trivial caller;
- abstractions created for future scenarios that never materialized.

### Proving code is unused

Do not classify code as unused solely because a textual search finds no direct call.

Before removing anything, check for indirect or convention-driven use through:

- callbacks;
- events;
- observers;
- dependency injection;
- reflection;
- dynamic loading;
- serialization/deserialization;
- framework conventions;
- lifecycle hooks;
- manifests;
- resources;
- routing;
- configuration;
- generated code;
- build scripts;
- CI/CD;
- release tooling;
- plugins;
- native/platform integration;
- test or debug tooling;
- external/public contracts.

When uncertainty remains, preserve the code until its lack of use can be demonstrated.

### Required simplification review

Look for opportunities to safely:

- shorten code without reducing readability;
- simplify control flow;
- reduce nesting;
- reduce mutable state;
- reduce the number of branches;
- merge equivalent paths;
- merge components with the same responsibility;
- remove unnecessary temporary values;
- remove unnecessary objects and allocations;
- remove redundant copies;
- remove repeated transformations;
- remove redundant loops or passes over the same data;
- compute invariant values once instead of repeatedly;
- replace custom code with standard language, platform, framework, or library facilities when clearly simpler;
- eliminate repeated business logic;
- centralize genuinely shared logic when doing so reduces total code and conceptual complexity;
- reduce coupling;
- remove premature generalization;
- remove architecture that exists only for hypothetical future requirements.

Do not introduce an abstraction merely to satisfy DRY.

Similar-looking code should only be unified when the resulting abstraction reduces real duplication and overall complexity.

### Architecture review

Explicitly determine whether:

- historical layers are still necessary;
- historical components are still necessary;
- abstractions are disproportionate to the actual problem;
- interfaces exist with only one implementation and no meaningful boundary benefit;
- classes or modules can be safely merged;
- classes or modules can be safely deleted;
- responsibilities are unnecessarily fragmented;
- there is premature generalization;
- there is speculative extensibility;
- infrastructure exists only for hypothetical future features;
- current architecture reflects requirements that no longer exist;
- duplicated state or business logic creates unnecessary coupling;
- implementation complexity is proportional to actual product complexity.

Prefer the simplest architecture that fully supports the current product.

Do not perform a large rewrite merely because another architecture appears cleaner, newer, or more fashionable.

### Performance review

Review performance only where there is practical value.

Look for:

- repeated calculations;
- repeated queries;
- repeated reads;
- unnecessary parsing;
- repeated transformations of unchanged data;
- avoidable allocations;
- unnecessary copies;
- redundant loops;
- multiple passes that can safely become one;
- unnecessary render/re-render/rebuild/recompute work;
- inappropriate data structures for actual access patterns;
- invariant operations performed repeatedly instead of once;
- unnecessary work in frequently executed paths.

Do not introduce micro-optimizations that reduce readability or maintainability without an obvious or measurable benefit.

### Dependency review

Review every production and development dependency.

For each dependency:

- verify that it is actually used;
- verify that its purpose is still required;
- remove unused dependencies;
- remove obsolete dependencies;
- identify multiple libraries serving the same purpose;
- consolidate overlapping dependencies where safe;
- prefer standard language/platform/framework functionality when it clearly replaces a dependency with less total complexity.

A dependency may be replaced by a small local implementation only when doing so clearly reduces overall complexity, risk, maintenance cost, or artifact size.

Do not replace a mature, well-maintained library with custom code merely to reduce the dependency count.

### Non-negotiable behavior-preservation rules

Unless explicitly requested, a repository-wide cleanup or refactor must not intentionally:

- remove user-facing functionality;
- change existing UX;
- change visual behavior;
- change business logic;
- change game rules;
- change public APIs;
- change public contracts;
- change persisted data formats;
- change exchanged data formats;
- change edge-case behavior;
- change platform behavior;
- weaken compatibility;
- weaken accessibility;
- weaken security or privacy controls;
- reduce functionality merely to reduce code size;
- add unrelated functionality;
- introduce new architectural layers only to satisfy generic best practices;
- perform a broad rewrite without a demonstrated need.

Repository-specific invariants defined elsewhere in this file remain mandatory throughout the refactor.

### Required execution workflow

For a repository-wide audit or deep refactor:

1. Inspect the entire repository.

2. Establish the current:
   - architecture;
   - feature set;
   - user-visible behavior;
   - internal contracts;
   - authoritative state;
   - persistence behavior;
   - platform constraints.

3. Collect reliable baseline statistics where practical.

4. Build an internal candidate list grouped into:
   - deletion;
   - consolidation;
   - simplification;
   - architecture reduction;
   - dependency cleanup;
   - practical performance optimization.

5. Validate every removal against both direct and indirect usage.

6. Rank candidates by:
   - confidence;
   - regression risk;
   - complexity reduction;
   - maintenance benefit.

7. Apply changes in small, logically coherent groups rather than as one uncontrolled rewrite.

8. After every meaningful group, run the relevant available checks, such as:
   - unit tests;
   - integration tests;
   - regression tests;
   - lint;
   - formatting checks;
   - type checking;
   - compilation;
   - build;
   - static analysis;
   - dependency/security checks;
   - project-specific validation.

9. If critical behavior lacks sufficient test coverage for a contemplated risky change, first add the minimum regression test required to capture the existing behavior.

10. Keep behavior-preserving refactoring separate from unrelated feature development.

11. When a candidate cannot be proven safe, leave it unchanged and record the reason.

12. Complete the first refactoring pass.

13. Perform a mandatory second full pass over the already-refactored repository.

14. During the second pass, look again for:
   - newly exposed simplification opportunities;
   - remaining dead code;
   - residual duplication;
   - unnecessary abstractions;
   - unnecessary wrappers;
   - redundant checks;
   - unused dependencies;
   - residual legacy;
   - temporary structures made obsolete by the first pass.

15. Finish with the complete available project verification suite.

### Validation requirements

The final verification should include every applicable repository check.

Examples include:

- clean build;
- complete unit-test suite;
- integration tests;
- regression tests;
- lint;
- formatting verification;
- type checking;
- static analysis;
- dependency audit;
- security checks;
- platform-specific builds;
- production build;
- project-specific verification scripts.

Do not claim a check passed unless it was actually executed successfully.

If a check cannot be run because of environment, credentials, hardware, platform, unavailable tooling, or another external limitation, state that explicitly.

### Comments during refactoring

Preserve the repository's comment policy.

As a default:

- keep comments to the minimum necessary;
- keep source-code comments in English;
- remove stale comments;
- remove misleading comments;
- remove redundant comments;
- do not add comments that merely narrate obvious code;
- retain comments that explain a non-obvious reason, constraint, workaround, invariant, compatibility requirement, or important contract.

Do not replace clear code with explanatory comments when the code itself can be made self-explanatory.

### Completion standard

A repository-wide audit/refactoring task is not complete merely because:

- code was formatted;
- static analysis was run;
- recommendations were listed;
- potential improvements were described;
- only recently modified files were reviewed.

Safe and justified improvements must be implemented directly.

The final codebase should be objectively smaller, simpler, less duplicated, less coupled, easier to reason about, or easier to maintain while preserving behavior.

### Required final report

At completion, report:

1. **Removed**
   - dead code;
   - unused files/resources;
   - obsolete compatibility code;
   - unnecessary abstractions;
   - other removed components.

2. **Consolidated**
   - duplicated logic;
   - equivalent components;
   - repeated validation;
   - shared responsibilities.

3. **Simplified**
   - control flow;
   - state;
   - architecture;
   - transformations;
   - hot paths.

4. **Dependencies**
   - dependencies removed;
   - duplicate-purpose dependencies consolidated;
   - dependency changes intentionally not made and why.

5. **Legacy**
   - legacy components found;
   - which were removed;
   - which remain and why.

6. **Intentionally unchanged**
   - candidates reviewed but preserved;
   - reason removal or simplification could not be proven safe.

7. **Verification**
   - tests run;
   - builds run;
   - lint/typecheck/static-analysis/security checks run;
   - their results.

8. **Limitations**
   - areas that could not be safely optimized;
   - missing coverage;
   - unavailable environment/tooling;
   - external constraints.

9. **Before/after statistics**, when they can be measured reliably:
   - file count;
   - source line count;
   - dependency count;
   - test count;
   - production/build artifact size;
   - other project-relevant metrics.

Never invent statistics.

Use the same counting method for before and after values.

### Final principle

When choosing between:

- preserving working code whose necessity is uncertain;
- deleting code because it appears unnecessary;

preserve the working behavior until the code is proven unnecessary.

The final goal is a codebase containing only the complexity required to implement the project's current functionality: as small, clean, understandable, maintainable, and efficient as reasonably possible, without functional regressions.

## App icon and canonical artwork

- No canonical SeaBattle app-icon artwork has been designated by the project owner yet. Do not invent one by treating a UI emoji, screenshot, mockup, or arbitrary generated image as canonical.
- If the owner provides a PNG and explicitly designates it as the app icon, store that exact original PNG as the canonical raster artwork (prefer `artwork/app-icon.png` unless the owner specifies another path). Keep the source bytes unchanged.
- Do not redraw, trace, vectorize, restyle, regenerate, convert to SVG/vector PDF, overwrite, recompress, or optimize the canonical PNG in place without explicit owner approval.
- Only create separately named platform/browser-required raster derivatives (such as favicon PNG sizes, PNG thumbnails or ICO). Preserve the icon's composition, colors, proportions and details; do not crop, pad, recolor or otherwise change the visible design unless required and approved.
- If an existing icon becomes canonical, preserve it until the owner explicitly approves replacement. A new icon design is separate work and requires an explicit request; normal code cleanup never changes brand assets.
- Keep all HTML icon references, documentation, release assets and derivative files consistent with the selected canonical artwork once one exists. Verify assets load correctly from the GitHub Pages project subpath without third-party runtime services.

## Completion and transparency

- When the owner says "continue", proceed from the current branch/PR, CI findings, roadmap and outstanding tasks; do not redo completed work without a technical reason.
- Report which files changed, what checks actually ran, their exact outcomes, remaining risks, blockers and follow-up steps. Never claim a GitHub Pages deploy, browser test, audit or merge succeeded without verifying it.
- For a full audit/review/refactor, deliver the entire required scope; if blocked, identify precisely what was checked, what remains unchecked, and whether repository-wide final verification is still required.
