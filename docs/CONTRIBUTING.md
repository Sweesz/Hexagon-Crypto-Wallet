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
