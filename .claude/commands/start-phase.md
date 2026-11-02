---
description: Start a Certavi phase — summarize goals, deliverables and acceptance criteria, then wait for confirmation.
argument-hint: <phase number>
---

We are starting **Phase $ARGUMENTS** of Certavi.

1. Read `context.md` in full, paying special attention to the "Phase $ARGUMENTS" section of
   §10 (roadmap) and to §12 (progress log and open questions). Read `CLAUDE.md`.
2. Check the current branch and working tree with `git status` and `git branch --show-current`
   (read-only git only).
3. Reply with:
   - **Goal** of the phase in one or two sentences.
   - **Deliverables** as a checklist.
   - **Acceptance criteria** as a checklist.
   - **Open questions** from context.md that block this phase (ask them now).
   - **Packages** that will be needed (name, exact version, dev/runtime, why) and the exact
     `npm install` command for the user to run. Do not install anything yourself.
   - **Branch(es)** the user must create, with the exact commands, for example:
     `git switch dev && git pull && git switch -c feature/<topic>`.
     If the phase is large, propose how to split it into several `feature/*` branches.
4. **Stop and wait** for the user to confirm (and to create the branch) before writing any code.
