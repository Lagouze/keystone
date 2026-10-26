# React Bits components

Copied from [React Bits](https://reactbits.dev) (registry entries `<Name>-TS-TW`, fetched on 25 October 2026) and used as part of the Keystone dashboard.

Copyright (c) 2026 David Haz. Licensed under "MIT + Commons Clause License Condition v1.0": free to use, copy and modify as part of an application, website or product; the components themselves may not be sold, sublicensed or redistributed on their own. Full text: [LICENSE.md](LICENSE.md) (copied from the React Bits repository).

Keystone changes:

- `SplitFlapText.tsx`: type-only imports (`verbatimModuleSyntax`).
- `Stepper.tsx`, `SwipeToast.tsx`: hugeicons glyphs replaced by the inline SVGs in `icons.tsx`, so no `@hugeicons/*` dependency.
- `Counter.tsx`: no `will-change-transform` on the numerals (ten per digit, about 180 compositor layers on the dashboard at rest).

Everything else is unchanged; configure the components through their props rather than editing them.
