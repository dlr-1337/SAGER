import { readFileSync, writeFileSync } from 'node:fs';

const path = 'dist/frontend/browser/index.html';
const source = readFileSync(path, 'utf8');
const marker = /(<meta\s+name="sager-environment"\s+content=")local("\s*\/?>)/;
if (!marker.test(source)) throw new Error('Missing explicit SAGER environment marker.');
writeFileSync(path, source.replace(marker, '$1production$2'));
