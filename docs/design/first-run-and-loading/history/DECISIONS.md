# Retired decisions

## D18

Retired in part 2026-11-17: Try again moved from R to Enter; the rest holds in [D18](../DECISIONS.md#d18).

**"Try again" on an empty state takes the key R, as it already does where settings saving stopped; "Open on GitHub"
keeps O.** (2026-11-06, the build plan the owner approved)

**Why.** One key for one action across the app; R is the one already in use (`packages/app/settings/SavingStopped.vue`,
`RETRY_KEY`).
