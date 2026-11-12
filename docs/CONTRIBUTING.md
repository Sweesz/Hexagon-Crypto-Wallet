# Contributing to Hexagon!

Thank you for contributing! This document will help you get started quickly and safely. Since we are building a crypto wallet, **security and code quality are non-negotiable**.

## Quick Start

1.  **Clone & Install:**
    ```bash
    git clone https://github.com/Sweesz/Hexagon-Crypto-Wallet.git
    cd Hexagon-Crypto-Wallet
    npm install
    ```
2.  **Run Dev Server:**
    ```bash
    npm run dev
    ```
3.  **Verify Setup:** Open [http://localhost:3000](http://localhost:3000).

> ⚠️ **Prerequisites:** Node.js v20+ LTS is required. Older versions may cause entropy issues during key generation.

## Security Guidelines (CRITICAL)

-   **NEVER commit private keys, mnemonics, or API keys.** Check `.gitignore` before committing.
-   **NEVER log sensitive data** (`secretKey`, `mnemonics`) to console, even in dev mode. Use masked logging if debugging is needed.
-   **Always encrypt before storage.** If adding new storage logic, use AES-GCM via Web Crypto API. Plaintext localStorage is forbidden.
-   **Validate all inputs.** Never trust user input or RPC responses. Validate addresses with `Address.parse()` and amounts before processing.

## Project Structure & Architecture

We use a domain-driven structure with strict separation of concerns:

-   **`src/wallet/` (Core Layer)** – Pure TypeScript crypto logic and business rules.
    -   Contains: `generateWallet`, `getBalance`, `sendTransaction`, `secureStorage`, types.
    -   Rule: NO imports from `components` or DOM APIs. Must be fully testable in Node.js environment.
-   **`src/components/` (UI Layer)** – React components and visual elements.
    -   Contains: Screens (`CreateWallet`, `CheckBalance`), modals, toasts, skeletons.
    -   Rule: Imports ONLY from `wallet/` or `utils/`. Never contains crypto logic directly.
-   **`src/utils/` (Infrastructure & Validation)** – Framework-agnostic helpers that enforce safety and reliability.
    -   `validateTransaction.ts` – Input validation gate (address format, amount bounds). Called BEFORE any core function.
    -   `asyncHandler.ts` / `errorHandler.ts` – Standardized error handling for all async operations.
    -   `retry.ts` – Resilience layer for transient network failures (TON RPC).
    -   `logger.ts` – Safe logging utility (NEVER logs sensitive data).
    -   `address.ts` – Shared address parsing/formatting utilities.
    -   Rule: Utils must be pure functions or side-effect-free. No UI dependencies.
-   **`tests/`** – Vitest unit tests for `wallet/` + @ton/sandbox integration tests.

> 💡 **Key Principle:**  
> Crypto/State → `wallet/`  
> Pixels/Clicks → `components/`  
> Safety/Reliability/Validation → `utils/`

> ⚠️ **Utils are NOT a dumping ground.**
If a function is specific to wallet logic → put it in src/wallet/.
If a function is specific to UI rendering → put it in src/components/.
utils/ is ONLY for cross-cutting concerns that serve multiple layers.

## Design System & Token Conventions (UI Layer)

All design values (colors, typography, spacing, border radii, shadows) are centralized in `src/styles/tokens.css` as CSS Custom Properties on `:root`.

> ⚠️ **Zero Hardcoded Values Rule:**
> Direct hardcoded `#hex` colors and fixed `font-size: <N>px` in component CSS are strictly forbidden. Always use `var(--color-...)`, `var(--font-size-...)`, `var(--space-...)`, and `var(--radius-...)`. Changing a single token in `tokens.css` must propagate visually across the entire application.

### 1. Token Naming Conventions

Tokens follow a predictable, hierarchical naming convention:

| Category | Pattern | Examples |
| :--- | :--- | :--- |
| **Brand Colors** | `--color-brand-[name]-[state]` | `--color-brand-primary`, `--color-brand-primary-hover`, `--color-brand-yellow` |
| **Surfaces & Backgrounds** | `--color-bg-[surface]` | `--color-bg-paper`, `--color-bg-paper-light`, `--color-bg-dark-card`, `--color-bg-app` |
| **Typography Colors** | `--color-text-[role]` | `--color-text-primary`, `--color-text-muted`, `--color-text-subtle`, `--color-text-inverse` |
| **Semantic Feedback** | `--color-[intent]-[element/state]` | `--color-success`, `--color-success-bg`, `--color-error-text`, `--color-warning-border` |
| **Borders** | `--color-border-[variant]` | `--color-border-default`, `--color-border-subtle`, `--color-border-dark` |
| **Font Families** | `--font-[family]` | `--font-sans`, `--font-display`, `--font-mono` |
| **Font Sizes** | `--font-size-[scale]` | `--font-size-2xs` (11px), `--font-size-xs` (12px), `--font-size-sm` (13px), `--font-size-md` (14px), `--font-size-lg` (16px), `--font-size-xl` (18px), `--font-size-2xl` (20px), `--font-size-3xl` (22px), `--font-size-display` (32px) |
| **Font Weights** | `--font-weight-[weight]` | `--font-weight-regular` (400), `--font-weight-medium` (500), `--font-weight-semibold` (600), `--font-weight-bold` (700), `--font-weight-black` (900) |
| **Border Radii** | `--radius-[scale]` | `--radius-none` (0px), `--radius-xs` (4px), `--radius-sm` (6px), `--radius-md` (8px), `--radius-lg` (10px), `--radius-xl` (12px), `--radius-3xl` (16px), `--radius-pill` (20px), `--radius-full` (50%), `--radius-max` (9999px) |
| **Spacing** | `--space-[step]` | `--space-1` (4px), `--space-2` (8px), `--space-3` (12px), `--space-4` (16px), `--space-5` (20px), `--space-6` (24px), `--space-8` (32px) |
| **Shadows & Offsets** | `--shadow-[variant]` | `--shadow-brutalist-md` (4px 4px 0 #f6542b), `--shadow-card-offset`, `--shadow-sm`, `--shadow-modal`, `--shadow-toast` |

### 2. Figma Text Style Classes

Reusable typographic classes mapped to the Figma design system are defined in `tokens.css`:
- `.text-display`: Ultra-bold brutalist display font for banners and hero elements.
- `.text-h1` / `.text-h2` / `.text-h3`: Standard headings with matched weights and line-heights.
- `.text-title`: Subheadings and card titles.
- `.text-body` / `.text-body-medium` / `.text-body-sm`: Standard interface body text.
- `.text-caption` / `.text-micro`: Small metadata, timestamps, and uppercase badges.
- `.text-mono` / `.text-mono-sm`: Monospace text for addresses, hashes, and raw data.

## Development Workflow

### 1. Branching
-   `main` – Stable demo-ready code.
-   `develop` – Integration branch. All PRs target this.
-   `feature/<name>` – Your work branch (e.g., `feature/add-jetton-support`).

### 2. Commit Messages
Use Conventional Commits:
```text
feat(core): add jetton balance fetching
fix(ui): prevent negative amount input
docs: update architecture diagram
test(sandbox): cover bad seqno scenario
..etc
```
### 3. Testing Requirements
- **Core changes:** Must include unit tests in `/tests`.
- **Transaction logic:** Must include `@ton/sandbox` tests.
- **UI changes:** Manual testing checklist in PR description.
- Run `npm test` before pushing. Green tests = mandatory.
## Code Review Checklist
Before requesting review, verify:
- No sensitive data in logs/storage
- All new core functions have tests
- TypeScript types are explicit (no `any`)
- Error messages are user-friendly (not raw RPC errors)
- PR description includes testing steps
## Getting Help
- Check `/docs/use-cases.md` for expected behavior.
- Ask in team Telegram chat with specific error/logs.
- For TON-specific questions, refer to [TON Docs](https://docs.ton.org/?spm=a2ty_o01.29997173.0.0.6ed7c921PiNiaL).

*By contributing, you agree to prioritize security over speed. When in doubt, ask!*
