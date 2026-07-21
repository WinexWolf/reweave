# Contributing to reweave

Thanks for your interest! reweave is small on purpose — a focused core with
strong guarantees. Contributions that keep it that way are very welcome.

## Development

```bash
npm install
npm test          # run the suite (unit + property-based)
npm run typecheck # tsc, no emit
npm run build     # emit dist/
```

The playground lives in `playground/`:

```bash
cd playground
npm install
npm run dev
```

## Ground rules

- **Every lens obeys the round-trip laws.** If you add a lens, add property
  tests proving `GetPut` and `PutGet` hold over generated inputs (see
  `test/lens.test.ts`). A lens that can lose or silently rewrite data is a bug,
  not a feature.
- **Preserve the unrepresentable.** Anything a projection cannot model must be
  carried through verbatim. New grammar for the expression lens should shrink
  the set of `raw` leaves — never drop them.
- **Keep the diff minimal.** New `diff` behaviour needs a property test against
  `apply(a, diff(a, b)) === b`.
- **No runtime dependencies** in the core library.

## Commit style

Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`).
