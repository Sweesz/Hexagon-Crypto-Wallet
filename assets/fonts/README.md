# Hexagon Wallet — Brand Typography

This directory stores web font files for Hexagon's brutalist brand identity.

### 1. Accent Font: `Tupo Vyaz`
- **Family**: `Tupo Vyaz` / `tupo vyaz` / `Тупо Вязь`
- **Token**: `var(--font-accent)` / `var(--font-display)`
- **Role**: Hero banners, brutalist headlines, ticker ribbon (`.editorial-ribbon`), card titles.
- **Expected files**:
  - `TupoVyaz.woff2` / `TupoVyaz-Bold.woff2` (recommended)
  - `TupoVyaz.otf` / `TupoVyaz.ttf`

### 2. Standard Font: `Manrope`
- **Family**: `Manrope`
- **Token**: `var(--font-standard)` / `var(--font-sans)`
- **Role**: Interface labels, body text, buttons, modals, cards.
- **Features**: Highly stylized semi-geometric neo-grotesque with distinct cuts and full native Cyrillic support, pairs with expressive brutalist display typography.
- **Expected files**:
  - Loaded via Google Fonts (`index.html`), local system font, or optional offline bundle in `assets/fonts/Manrope.woff2`.

> Note: `@font-face` definitions in `src/styles/tokens.css` first attempt to resolve locally installed system fonts via `local('Tupo Vyaz')` / `local('tupo vyaz')` / `local('Тупо Вязь')` / `local('Manrope')`, then fallback to web font assets, and finally to system UI fallbacks.
