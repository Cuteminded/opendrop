# Interface review

Reviewed and implemented on 2026-09-22.

## Scope and coverage

Scope: the OpenDrop installation flow, including build selection and review,
headset setup, the link dialog and install queue, plus Library and Activity.
The review used source inspection and a running Electron app with temporary
application data. It was a screen review, not a branch or diff review.

Stack: Electron, React, TypeScript, Tailwind CSS 4, daisyUI 5, Lucide icons and
component-specific CSS. The existing light and dark lizzy.nu theme colors remain
in `src/renderer/src/styles/theme.css`. Changes use these colors and the existing
semantic tokens. Shared text sizes now live in `tokens.css`.

Convention documents: `README.md` and the AGENTS instructions supplied with the
request. No project AGENTS.md, CLAUDE.md, CONTRIBUTING.md, CODING_STANDARDS.md,
design-system document, Storybook documentation or interface ADR was found.
The desktop window has a 900px minimum width. Smaller effective viewports still
occur under zoom; the renderer was also tested at 320px directly.

`better-interface` and its reporting format were available. Its six owning
skills were absent from the local skill directories and plugin cache. Their
rule sets were not reconstructed. This report separates that missing domain
coverage from the concrete behavior inspected and repaired for the user's
implementation request.

| Domain        | Evidence inspected independently                                                                                 | Result                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Accessibility | Native dialog behavior, initial focus, Tab, Shift+Tab, Escape, focus restoration, form errors and reduced motion | Not reviewed with `better-accessibility`: owning skill unavailable             |
| Layout        | Install, Library and Activity at 320, 600, 900 and 1180px; install at 200% zoom; narrow build review and dialog  | Not reviewed with `better-layout`: owning skill unavailable                    |
| Writing       | Install instructions, search results, simulated connection labels and disabled-launch explanations               | Not reviewed with `better-writing`: owning skill unavailable. `unslop` applied |
| Typography    | Rendered text sizes and desktop/narrow screenshots; existing 7-10px supporting text                              | Not reviewed with `better-typography`: owning skill unavailable                |
| Colors        | Rendered foreground/background measurements for counters, secondary text and job errors in both themes           | Not reviewed with `better-colors`: owning skill unavailable                    |
| UI            | Empty, populated, error and busy states; install, launch and cancellation in the simulator                       | Not reviewed with `better-ui`: owning skill unavailable                        |

The checks do not cover physical headset pairing or uploads, native file-picker
interaction, screen-reader output, Windows/Linux rendering or every possible
text/background pair. Loading and empty Activity states were injected through
Electron IPC in the isolated test instance. Normal installation and cancellation
used the application's simulator.

## Findings

All rows below are implemented. Severity reflects the observed task impact.
Domain names categorize the behavior, without claiming that the missing owning
skills reviewed it. Source locations refer to the updated files.

| Severity | Domain        | Location                                                                                                         | Before                                                                                                                                                                                               | After                                                                                                                                                      | Why                                                                                                                                                              |
| -------- | ------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIGH     | Layout        | `src/renderer/src/styles/responsive.css:31`, `src/renderer/src/styles/layout.css:4`                              | Fixed sidebar and two-column content at every width. At 320px, content extended to 509px and the device panel overlapped the build area. At 200% zoom, sidebar controls extended below its viewport. | Navigation and settings enter document flow at narrow widths; installation cards stack; controls, logs and job rows wrap.                                  | Essential controls were overlapped or unreachable. Verified at 320px and 200% zoom after repair.                                                                 |
| HIGH     | Layout        | `src/renderer/src/App.tsx:226`                                                                                   | `currentJobs.slice(0, 6)` rendered six rows while the count reported eight. The eighth failed job had no visible path from the queue.                                                                | Render every job in the current mode in normal document flow.                                                                                              | Users could miss failures or lose access to cancellation. The test checks an eighth failed job and an eighth active job with its cancel button.                  |
| HIGH     | Colors        | `src/renderer/src/tokens.css:9`, `src/renderer/src/styles/layout.css:65`, `src/renderer/src/styles/queue.css:13` | Light-theme counter contrast measured 1.21:1 and 1.32:1. Secondary text measured 2.81:1 and 2.83:1. Neutral backgrounds used base-content ink.                                                       | Counters use `--color-neutral-content`; shared muted and subtle text use stronger opacity.                                                                 | Counts and supporting text were difficult to distinguish. Counters now measure 6.59:1 in both themes; the sampled light secondary text measures at least 4.61:1. |
| MEDIUM   | Accessibility | `src/renderer/src/InstallLinkDialog.tsx:19`, `src/renderer/src/App.tsx:125`                                      | Custom dialog markup and a manual Tab loop; Escape returned focus to `body`. Download errors appeared inside and behind the dialog.                                                                  | Native `dialog.showModal()`, explicit URL-input focus, focus restoration, field-associated errors and one visible error message.                           | Keyboard users retain their place. Busy downloads keep the dialog open; background content is inert through the native modal behavior.                           |
| MEDIUM   | Writing       | `src/renderer/src/components/Library.tsx:70`                                                                     | A search with no results displayed "Your library is waiting" and instructions for a first install, even with seven installed apps.                                                                   | Separate "No matching apps" state, result count and "Clear filters" action. Clearing filters focuses the search field.                                     | A failed search no longer implies an empty library. Existing filters survive navigation between pages.                                                           |
| MEDIUM   | Typography    | `src/renderer/src/tokens.css:2`, `src/renderer/src/App.tsx:148`, `src/renderer/src/styles.css:65`                | A two-line 43px promotional heading preceded 7-10px workflow and help text; button text was 11px.                                                                                                    | A 32px task heading, shared 11-14px text sizes, 13px button text and 36px button targets. Remove the redundant workflow strip and desktop-platform label.  | The installation controls appear higher on the screen and supporting instructions are easier to read. Existing colors and overall structure are retained.        |
| MEDIUM   | Writing       | `src/renderer/src/components/JobList.tsx:37`                                                                     | Disabled launch icons gave no explanation when the app belonged to another mode or device.                                                                                                           | Visible explanations identify the required mode, device connection or pending installation. The button references the explanation with `aria-describedby`. | Users can tell how to make Launch available.                                                                                                                     |

Related refinements include explicit simulator connection labels, current-page
navigation semantics, a visible full selected start-file path, a native disclosure
for the complete build location, and an empty Activity state. Build metadata uses
its own two-column layout at narrow widths so a platform badge cannot squeeze
the file name into a few characters per line.

## Verification

Passed:

- `npm run build`: TypeScript and all Electron/renderer bundles pass.
- `npm test`: all 59 tests pass. Protocol tests required permission to bind
  local loopback ports after the sandbox initially returned `EPERM`.
- `npm run test:ui`: simulated install, launch, library search, URL validation,
  cancellation and mode isolation pass, with no renderer exceptions.
- `npm run test:interface`: both themes at 320, 600, 900 and 1180px; install at
  200% zoom; queue items beyond six; 50% progress and cancellation control;
  search/filter recovery and filter persistence; dialog initial focus, Tab,
  Shift+Tab, Escape, focus restoration and busy behavior; reduced motion;
  empty states; narrow build review, warnings, device setup and service port.
- `npm run format:check`: all files pass Prettier.
- Visual inspection of before/after desktop, light/dark, zoomed and narrow
  screenshots. The final build-review screenshot confirms readable file
  metadata after the narrow-layout refinement.

Contrast results from the rendered Chromium colors, including transparent
foregrounds composited against their ancestor backgrounds:

| Pair                       | Dark   | Light   |
| -------------------------- | ------ | ------- |
| Queue and Library counters | 6.59:1 | 6.59:1  |
| Sidebar version text       | 8.12:1 | 4.67:1  |
| Supporting install note    | 8.43:1 | 4.61:1  |
| Job error text             | 5.29:1 | 17.16:1 |

These are targeted measurements of solid-background text, not a complete
contrast audit. Automated layout assertions inspect element bounds; screenshots
provide the separate visual check.

Screenshots are in `test-results/interface/`, including `device-dark.png`,
`device-light.png`, `review-narrow.png`, `dialog-error-narrow.png`,
`queue-active-narrow.png` and the `*-zoom-200.png` captures. The UI test data
is temporary and removed after each run.

Not verified: the six missing domain-skill reviews, physical hardware operations,
native file dialogs, screen-reader announcements and other operating systems.
The packaged app in `release/` was not rebuilt; source and `dist/` were rebuilt.

## Verdict

Approve for the implemented fixes and the explicitly tested scope. No observed
HIGH finding remains in that scope. This is not approval of the six unavailable
domain reviews; full `better-interface` coverage remains incomplete.
