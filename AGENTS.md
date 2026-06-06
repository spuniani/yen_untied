# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Git & workflow

### Issues
- Create a GitHub issue for every work item before starting it, if one doesn't already exist.
- Every issue must include **acceptance criteria** (bullet list of what done looks like) and a **test plan** (steps to manually verify).
- Issue titles are plain descriptions — no ticket numbers, no prefixes. GitHub provides the number.
- Labels to use: `ui`, `api`, `infra`, `bug`, `blocked`. Apply at least one per issue.

### Branches
- Branch naming: `issue/N-short-description` where N is the GitHub issue number.
- Never push directly to `main` — always work on a branch first.
- Push the branch to GitHub so Vercel generates a preview URL.
- Recommend using the preview URL (rather than localhost) whenever the issue involves visual layout, mobile behaviour, or anything that benefits from testing on a real device.

### Commits
- Reference the issue number in every commit message: `#N` somewhere in the subject line.
- Commit freely on the branch; the squash merge is what lands on `main`.

### Merging
- Squash merge into `main` — one commit per issue, keeps git log readable.
- Squash commit message format: `<description> (closes #N)`
- GitHub will auto-close the issue when the squash commit lands on `main`.

### Tests
- Test framework: Vitest with jsdom. Run with `npm test -- --run`.
- Every `lib/` function gets unit tests in `__tests__/<module>.test.ts`.
- Tests must not require `ANTHROPIC_API_KEY` — mock or skip API calls.
- CI runs tests on every push to `main` and on every PR. A failing test blocks the merge.

### E2E testing
- Before raising a PR for any UI or API change, run the Playwright e2e suite locally: `npm run e2e`
- This requires `ANTHROPIC_API_KEY` set in `.env.local` — it makes real Claude calls
- E2E tests do not run in CI (cost + latency); the PR template checklist is the honour-code reminder
- If the Husky pre-push hook (issue #11) is installed, it enforces this automatically when the key is present

### Definition of done
An issue is closed only when:
1. Code is merged to `main`.
2. Vercel production deploy succeeded.
3. Every acceptance criterion has been manually verified.
4. For UI or API changes: e2e tests passed locally before the PR was raised.
