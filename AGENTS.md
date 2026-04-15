# Repository Guidelines

## Project Structure & Module Organization
This repository currently contains planning documents only:

- `design-document.md`: product requirements, behavior rules, and MVP scope
- `tech.stack.md`: recommended stack and target architecture

Implementation should follow the structure proposed in `tech.stack.md`:

- `apps/bot-server/`: Fastify entrypoint and platform/webhook handlers
- `packages/core/`: shared types and utilities
- `packages/decision-engine/`: reply gating, cooldowns, keyword rules
- `packages/memory/`: user memory, summaries, persistence logic
- `packages/llm/`: model provider adapters and prompt handling
- `packages/sender/`: sentence splitting, delay scheduling, dispatch
- `infra/docker/`: local infrastructure definitions

## Build, Test, and Development Commands
No runnable app is checked in yet. When implementation starts, use the stack defined in `tech.stack.md`:

- `pnpm install`: install workspace dependencies
- `pnpm dev`: run the bot service locally
- `pnpm test`: run Vitest test suites
- `pnpm lint`: run ESLint checks
- `pnpm format`: apply Prettier formatting
- `docker compose up -d`: start PostgreSQL and Redis for local development

Keep command names consistent across packages so contributors can rely on standard workspace scripts.

## Coding Style & Naming Conventions
Use TypeScript on Node.js 22 LTS with `pnpm`. Prefer 2-space indentation, semicolons, and single-responsibility modules. Use:

- `camelCase` for variables and functions
- `PascalCase` for types, interfaces, and classes
- `kebab-case` for package and file names where practical

Validate external inputs with Zod. Keep business rules deterministic first, with LLM calls as a secondary layer.

## Testing Guidelines
Use Vitest for unit and integration tests. Place tests next to source files as `*.test.ts` or in package-level `tests/` folders. Prioritize coverage for reply decisions, cooldown logic, keyword matching, memory writes, and sentence splitting. Run `pnpm test` before opening a PR.

## Commit & Pull Request Guidelines
Local Git history is not available in this workspace, so follow a strict conventional style such as `feat: add reply cooldown logic` or `fix: prevent duplicate delayed sends`. Keep commits focused.

PRs should include:

- a short problem/solution summary
- linked issue or task reference when available
- test evidence (`pnpm test`, lint output, or manual verification)
- screenshots or logs for bot behavior changes when relevant

## Security & Configuration Tips
Do not commit API keys, bot tokens, or database credentials. Store secrets in environment files such as `.env.local`, and keep example values in `.env.example`. Log decision reasons and failures, but avoid storing sensitive message content unless required for debugging.

写任何代码前必须完整阅读 memory-bank/@architecture.md

写任何代码前必须完整阅读 memory-bank/@design-document.md

每完成一个重大功能或里程碑后，必须更新memory-bank/@architecture.md
