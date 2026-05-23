import typescript from '@rollup/plugin-typescript';
import terser     from '@rollup/plugin-terser';

const banner = `/*!
 * omm-core — ultra-lightweight 3D canvas engine
 * License MIT | Author NelikKKL
 */`;

/** @type {import('rollup').RollupOptions[]} */
export default [
  // ── IIFE (browser <script src>) ────────────────────────────────────────────
  {
    input: 'src/index.ts',
    output: [
      {
        file:   'dist/omm-core.js',
        format: 'iife',
        name:   'OMM',
        banner,
        sourcemap: false,
      },
      {
        file:    'dist/omm-core.min.js',
        format:  'iife',
        name:    'OMM',
        banner,
        sourcemap: false,
        plugins: [terser()],
      },
    ],
    plugins: [
      typescript({ tsconfig: './tsconfig.json', declaration: false }),
    ],
  },

  // ── ESM (bundler / npm import) ─────────────────────────────────────────────
  {
    input: 'src/index.ts',
    output: {
      file:      'dist/omm-core.esm.js',
      format:    'esm',
      banner,
      sourcemap: false,
    },
    plugins: [
      typescript({ tsconfig: './tsconfig.json' }),
    ],
  },
];
