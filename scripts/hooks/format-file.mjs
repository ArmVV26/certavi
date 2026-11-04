// PostToolUse hook (Edit|Write): formats the file Claude just wrote with the project's Prettier.
// Reads the hook event from stdin, always exits 0 and prints nothing.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.md',
  '.html',
  '.yml',
  '.yaml',
]);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

try {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;

  const filePath = /** @type {{ tool_input?: { file_path?: unknown } }} */ (JSON.parse(raw))
    .tool_input?.file_path;

  if (typeof filePath === 'string') {
    const absolute = path.resolve(filePath);
    const relative = path.relative(repoRoot, absolute);
    const insideRepo = relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);

    if (insideRepo && EXTENSIONS.has(path.extname(absolute).toLowerCase())) {
      const prettier = await import('prettier');
      const info = await prettier.getFileInfo(absolute, {
        ignorePath: path.join(repoRoot, '.prettierignore'),
        resolveConfig: true,
      });

      if (!info.ignored && info.inferredParser) {
        const source = await readFile(absolute, 'utf8');
        const options = (await prettier.resolveConfig(absolute)) ?? {};
        const formatted = await prettier.format(source, { ...options, filepath: absolute });
        if (formatted !== source) await writeFile(absolute, formatted, 'utf8');
      }
    }
  }
} catch {
  // A formatting hook must never break the edit that triggered it.
}
process.exit(0);
