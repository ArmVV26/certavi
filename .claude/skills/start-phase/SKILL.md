---
name: start-phase
description: Start a Certavi phase or branch — read only what is needed and present a plan (in Spanish) for approval.
argument-hint: <phase number>
disable-model-invocation: true
---

We are starting **Phase $ARGUMENTS** of Certavi. Write the plan in **Spanish**.

1. **Read little.** Never read `context.md` whole. Use Grep and offset/limit to read only:
   the index of `context.md`, the "Fase $ARGUMENTS" section of §10 (roadmap), the «Decisiones
   vigentes» of §2 that apply and the relevant items of `docs/backlog.md`, and the relevant spec
   in `docs/spec/`. Read from `CLAUDE.md` only what the
   phase needs (it is already in context).
2. Check the branch and working tree with `git status` and `git branch --show-current`
   (read-only git only).
3. Present a **plan** (this replaces any earlier confirmation step; the user approves the plan):
   - **Objetivo** of the phase/branch in one or two sentences.
   - **Entregables** and **criterios de aceptación** as checklists.
   - **Preguntas abiertas** from `context.md` that block the work (ask them now).
   - **Paquetes** needed (name, exact version, dev/runtime, why) and the exact `npm install`
     command for the user. Do not install anything yourself.
   - **Rama(s)**: exact commands, for example
     `git switch dev && git pull && git switch -c feature/<topic>`. If the phase is large,
     propose how to split it into several `feature/*` branches.
   - **Sesiones**: how to split the branch into short sessions (one per sub-task, each ending
     with a clean working tree state and a one-line note of what is left), so no session needs
     more than ~150k tokens.
4. Do not write code until the plan is approved and the branch exists.
