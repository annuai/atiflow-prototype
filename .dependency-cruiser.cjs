/**
 * Import rules (dependency-cruiser). The layers are described in CLAUDE.md section 4 and docs/architecture/foundations.md.
 * Violations that already existed when the rules were introduced are listed in .dependency-cruiser-known-violations.json and tolerated; a NEW violation fails `npm run check:imports`.
 * To fix an old one: change the code, then regenerate the baseline with `npm run check:imports:baseline` (it only ever shrinks).
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-is-pure',
      severity: 'error',
      comment: 'core/ is plain TypeScript: no React, no Three.js, and nothing from the layers above it.',
      from: { path: '^src/core/' },
      to: {
        path: ['^src/(engine|ui|features|shell|app|components|adapters)/', '^node_modules/(react|react-dom|three)/'],
      },
    },
    {
      name: 'adapters-use-core-only',
      severity: 'error',
      comment: 'adapters/ (telemetry sources) depend on core/ and data/ only.',
      from: { path: '^src/adapters/' },
      to: { path: '^src/(engine|ui|features|shell|app|components)/' },
    },
    {
      name: 'engine-knows-no-ui',
      severity: 'error',
      comment: 'The 3D engine never imports React screens, features or the shell.',
      from: { path: '^src/engine/' },
      to: {
        path: [
          '^src/(ui|features|shell|app|components)/',
          '^node_modules/(react|react-dom|react-aria|react-aria-components)/',
        ],
      },
    },
    {
      name: 'data-is-below-features',
      severity: 'error',
      comment: 'The shared data layer does not import features (features import it).',
      from: { path: '^src/data/' },
      to: { path: '^src/(features|shell|app|ui|components)/' },
    },
    {
      name: 'shared-ui-is-below-features',
      severity: 'error',
      comment: 'Shared components (src/components, src/ui, src/hooks, src/utils) do not import features.',
      from: { path: '^src/(components|ui|hooks|utils)/' },
      to: { path: '^src/(features|shell|app)/' },
    },
    {
      name: 'features-do-not-import-the-app-shell',
      severity: 'error',
      comment: 'Features do not import the route table or the guards (app/); the shell hosts them.',
      from: { path: '^src/features/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'no-feature-internals',
      severity: 'error',
      comment: 'A feature uses another feature through its public entry (index.ts), not its internal files.',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/', pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.ts$'] },
    },
    { name: 'no-circular', severity: 'error', comment: 'No import cycles.', from: {}, to: { circular: true } },
    {
      name: 'src-does-not-use-dev-dependencies',
      severity: 'error',
      from: { path: '^src/', pathNot: '\\.(test|spec)\\.' },
      to: { dependencyTypes: ['npm-dev'] },
    },
    { name: 'not-to-unresolvable', severity: 'error', from: {}, to: { couldNotResolve: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '^src/components/(base|application|foundations|shared-assets)/' }, // vendored Untitled UI code
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
