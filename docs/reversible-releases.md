# Reversible feature releases

Each increment uses an isolated checkout, a recorded baseline, feature-scoped
commits with tests, and a release record naming those exact commits. Never mix
news generation, personal data or unrelated user edits into a feature commit.

`config/features.json` controls scenario library and comparison independently.
Comparison also requires the library. Changes require a build and Pages release;
this is not an instant remote switch. Switching off features must never delete
IndexedDB or touch existing bookmarks. Re-enabling reuses the same database.

`release.json` in the build publishes only commit, build time, calculator source
fingerprint and effective flags. No machine paths or environment dumps are used.
The calculator fingerprint hashes its transitive local code/model dependencies,
not news data or the clock. Stored results are never authoritative calculations.

To roll back, inspect the release record and revert only the listed feature
commits in reverse dependency order on an isolated branch based on current main.
Use explicit SHAs, never a broad commit range, reset, force push, or replacement
of main with an old checkout. Stop on conflicts and preserve the checkout.
Keep intervening news and other unrelated changes. Validate, publish the revert,
then verify Pages and the public release revision. Do not bypass failed gates.

Before first publication rehearse rollback, disable/re-enable and data retention
using a temporary branch, synthetic browser data and an intervening news fixture.
Record results and exact commands. Production data must not be used as fixtures.
Restoring the automation prompt is a separate operation: retain its prior local
configuration privately and use the app automation tool, not Git or manual TOML
edits. The backup and thread identifiers must never enter the public repository.
