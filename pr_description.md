🎯 **What:** The vulnerability fixed
The `newStepId` function in `src/lib/git/ciPipelineLogic.ts` previously used `Math.random().toString(36)` to generate step IDs. `Math.random` is not a cryptographically secure pseudo-random number generator (CSPRNG), making the generated IDs theoretically predictable.

⚠️ **Risk:** The potential impact if left unfixed
While step IDs in a CI pipeline might not immediately seem like high-value targets, predictable IDs can lead to step collisions or allow malicious actors to guess and potentially manipulate expected pipeline steps or execution paths if IDs are used to reference state, secrets, or temporary artifacts. This is a low-to-medium risk depending on the exact usage, but violates security best practices regarding randomness.

🛡️ **Solution:** How the fix addresses the vulnerability
Replaced `Math.random` with the globally available `crypto.randomUUID()`. The UUID is stripped of its hyphens and sliced to 8 characters to maintain backward compatibility with the existing Zod validation schema (`/^[a-z0-9]{4,16}$/`).
