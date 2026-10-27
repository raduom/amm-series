# Project instructions

**Planning is the default.** Treat every conversation as planning unless the user explicitly says to implement. While planning, read, research, discuss and propose, but do not change files or state. Implement only after the user says so, and only what they approved. When that work is done, go back to planning. An implementation task delegated by an agent acting on the user's approval counts as the user's instruction.

**No code without permission.** Do not write or change code — Haskell, Solidity, Rust, scripts or configuration — unless the user explicitly asks for it or approves a proposal that includes it. Approval covers only the code it names; anything beyond that goes back to planning. Sketches in conversation are fine when they help a discussion.

## Skills

Project skills live in `.agents/skills/`, where any agent can find them; `.claude/skills/` links to the same
folders. `flashcards`: how to write a flashcard deck for a chapter's page.

## Commits

Descriptive message: one tag line followed by a list of changes, each introduced by `- `. No empty-line spacing. Show the user the message and wait for approval before committing.

Never add a co-author or attribution trailer (no `Co-Authored-By:` line, no "Generated with" line). The message ends with the last change bullet.
