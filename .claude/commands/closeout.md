---
description: Close out the current phase: test, check it against the roadmap, archive it, update the status, commit
argument-hint: "[phase name, optional: defaults to the one in progress in docs/roadmap.md]"
---

Close out a finished phase. Phase: $ARGUMENTS (if blank, the phase "In progress" in the Current status section of
`docs/roadmap.md`). Do these steps in order; stop where a step says to.

1. **Tests.** Run `npm test` and `npm run lint`. Report the test count and the result. If anything fails, STOP: show
   the failures and do nothing else.

2. **Check the phase against the roadmap.** Find the last closeout tag (`git tag --list "phase-*" --sort=-creatordate`,
   the first one). Summarize `git log --oneline <tag>..HEAD` and `git diff --stat <tag>..HEAD` in a few lines,
   grouped by what changed. Read the phase's section in `docs/roadmap.md` and check each item against the diff: its
   steps, its **Done when:** and **Tests:** lines, and its Docs article (a file in `articles/`, listed in
   `src/lib/docs.js`). Give a short table: item · done / missing / partly. If anything is missing, ask whether to go
   on with the closeout anyway, and wait for the answer.

3. **Rewrite the Current status section** of `docs/roadmap.md`. Replace it, don't append. Keep it about 25 lines:
   Done (one line for round 2 so far plus this phase), In progress, Next (the next phase and its first step), Known gaps
   and open items, Decisions later phases build on (one line each; add any decision from this phase that later work
   depends on, drop any that no longer matters). Update the "Last:" date, the tag name and the test count.

4. **Archive the phase.** Move its whole section from `docs/roadmap.md` to the end of `docs/roadmap-archive.md` word for
   word, with its status filled in (date, test count). Add a row to the archive's Phase log table (newest first).
   Remove its row from the roadmap's "Phases left" table. Move any decision tables or "Before phase" lists that are now
   settled the same way. Unscheduled ideas found along the way go to `docs/ideas.md`.

5. **CLAUDE.md:** change it only if a convention, constraint or command actually changed (the test count in Commands
   counts as one). Keep it to about one screen; put details in `docs/` with a one-line pointer.

6. **Commit and tag.** Run `git status` and make sure only the doc files from steps 3 to 5 are staged. Commit them
   with the message `Closeout: <phase name>` and a body of two or three lines (what was done, the test count), ending
   with the Co-Authored-By line. Then create the tag `phase-<short-name>-done` (e.g. `phase-3-done`) on that commit.

7. **Report and ask.** Show: the test result, the check table from step 2, what changed in the Current status, and
   the number of unpushed commits (`git log --oneline origin/main..HEAD`). Ask whether to push. Mention that a push to
   `main` that changes site files costs one Netlify build (15 credits); doc-only pushes are skipped for free. If the
   user says yes, run `git push origin main --follow-tags`.
