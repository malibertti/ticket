import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/test-output',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'name:infra',
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: 'name:contracts',
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: 'name:shared',
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: 'name:admin',
              onlyDependOnLibsWithTags: ['name:contracts'],
            },
            {
              sourceTag: 'name:web',
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: 'name:catalog',
              onlyDependOnLibsWithTags: ['name:shared', 'name:contracts'],
            },
            {
              sourceTag: 'name:inventory',
              onlyDependOnLibsWithTags: ['name:shared'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
