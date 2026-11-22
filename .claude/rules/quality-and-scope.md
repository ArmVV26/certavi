# Before saying a task is done

- `npm run lint && npm run typecheck && npm run test` pass.
- `npm run build` passes when the task touches build/PWA/functions.
- `npm run ports:check` is clean. No server left running. Updated docs if behaviour changed.
- Ask the `armando-base:context-keeper` agent to update context.md at the end of a phase.

# Comments

- A comment explains the **why**: a constraint, a decision that is not obvious, units, a
  reference to a spec or an issue, a workaround that is needed.
- A comment never narrates the change or its history ("// fixed", "// now uses X", "// was Y
  before"). That goes in the commit message.
- Do not repeat what the code already says, and do not leave commented-out code behind.
- Do not delete useful comments that already exist. If one has gone out of date, update it.
- Doc comments on public APIs follow the project's convention (CLAUDE.md §6).

# Scope

- Do only what the current phase/task asks. If you see something else worth doing,
  list it under "Suggestions" in your final message instead of doing it. Once the user agrees,
  it goes into `docs/backlog.md`, the only list of pending work (no other document keeps one).
- A phase is closed when its exit criteria (`context.md` §10) are met, not when ideas run out.
- Do not delete or rewrite tests to make them pass without explaining why.
