# Before saying a task is done

- `npm run lint && npm run typecheck && npm run test` pass.
- `npm run build` passes when the task touches build/PWA/functions.
- `npm run ports:check` is clean. No server left running. Updated docs if behaviour changed.
- Ask the context-keeper agent to update context.md at the end of a phase.

# Scope

- Do only what the current phase/task asks. If you see something else worth doing,
  list it under "Suggestions" in your final message instead of doing it. Once the user agrees,
  it goes into `docs/backlog.md`, the only list of pending work (no other document keeps one).
- A phase is closed when its exit criteria (`context.md` §10) are met, not when ideas run out.
- Do not delete or rewrite tests to make them pass without explaining why.
