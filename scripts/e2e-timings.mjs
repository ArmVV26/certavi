// Lists the slowest end-to-end tests of a Playwright run, per project, from its JSON report.
//
// Why: `reportSlowTests` only names slow FILES, and the `dot` reporter prints no times, so a test
// drifting towards the time limit (30 s; 60 s in WebKit) was invisible until CI failed.
//
// How:
//   1. Run the suite as usual in your own terminal (a full `npm run e2e:all` takes 10-15 min,
//      longer than Claude's shell allows). `playwright.config.ts` writes the JSON report to
//      e2e-timings/last-run.json. For times close to CI's (one worker): `npm run e2e:all -- --workers=1`.
//   2. npm run e2e:timings                      (reads e2e-timings/last-run.json)
//      npm run e2e:timings -- a.json b.json     (several reports, e.g. the four CI jobs)
//      npm run e2e:timings -- --top=30          (how many tests per project; default 15)
//
// A test is "slow" from half of its time limit and "near" from three quarters. A test that needed
// a retry is marked: in CI it passed only the second time.

import { readFileSync } from 'node:fs';

const DEFAULT_REPORT = 'e2e-timings/last-run.json';
/** The per-test time limit of each project (playwright.config.ts). */
const LIMIT_MS = { webkit: 60_000 };
const DEFAULT_LIMIT_MS = 30_000;

const args = process.argv.slice(2);
const topArg = args.find((arg) => arg.startsWith('--top='));
const top = topArg ? Number(topArg.slice('--top='.length)) : 15;
const files = args.filter((arg) => !arg.startsWith('--'));
if (files.length === 0) files.push(DEFAULT_REPORT);

/** Every test of a report's suite tree, with its file, titles, project and timings. */
function* tests(suite, titles = []) {
  const here = suite.title && suite.title !== suite.file ? [...titles, suite.title] : titles;
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const results = test.results ?? [];
      const last = results[results.length - 1];
      yield {
        project: test.projectName ?? 'unknown',
        file: spec.file ?? suite.file ?? '',
        title: [...here, spec.title].join(' › '),
        ms: last?.duration ?? 0,
        retries: Math.max(0, results.length - 1),
        status: test.status ?? last?.status ?? 'unknown',
      };
    }
  }
  for (const child of suite.suites ?? []) yield* tests(child, here);
}

const all = [];
for (const file of files) {
  let report;
  try {
    report = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Run the suite first (npm run e2e or npm run e2e:all) so it writes the report.');
    process.exit(1);
  }
  for (const suite of report.suites ?? []) all.push(...tests(suite));
}

const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`;
const byProject = Map.groupBy(all, (test) => test.project);

for (const [project, list] of [...byProject].sort(([a], [b]) => a.localeCompare(b))) {
  const limit = LIMIT_MS[project] ?? DEFAULT_LIMIT_MS;
  const total = list.reduce((sum, test) => sum + test.ms, 0);
  console.log(
    `\n${project}: ${list.length} tests, ${seconds(total)} of test time (limit per test ${seconds(limit)})`,
  );
  const sorted = [...list].sort((a, b) => b.ms - a.ms);
  for (const test of sorted.slice(0, top)) {
    const flag = test.ms >= limit * 0.75 ? 'NEAR' : test.ms >= limit * 0.5 ? 'slow' : '    ';
    const extra = [
      test.retries > 0 ? `retried ${String(test.retries)}x` : '',
      test.status !== 'expected' ? test.status : '',
    ]
      .filter(Boolean)
      .join(', ');
    console.log(
      `  ${flag}  ${seconds(test.ms).padStart(8)}  ${test.file}  ${test.title}${extra ? `  [${extra}]` : ''}`,
    );
  }
  const slow = sorted.filter((test) => test.ms >= limit * 0.5).length;
  console.log(
    slow > 0
      ? `  → ${String(slow)} test(s) at half the limit or more: split them by acceptance criterion.`
      : '  → none at half the limit or more.',
  );
}
