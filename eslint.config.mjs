import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      // Aturan ini khusus Pages Router (pages/_document.js); proyek ini memakai
      // App Router, font Google dimuat di app/layout.js dan berlaku untuk semua halaman.
      '@next/next/no-page-custom-font': 'off'
    }
  },
  { ignores: ['.next/**', 'node_modules/**'] }
];

export default eslintConfig;
