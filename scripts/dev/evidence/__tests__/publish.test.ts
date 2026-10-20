import { describe, expect, it } from 'vitest';
import { evidencePath, imageMarkdown, imagesIn } from '../publish.mjs';

describe('evidencePath', () => {
  it('groups uploads by branch and short commit', () => {
    expect(
      evidencePath('feat/x', 'abcdef1234567', '/tmp/out/en-logging-phone.png')
    ).toBe('feat/x/abcdef1/en-logging-phone.png');
  });
});

describe('imageMarkdown', () => {
  it('pins the image to the upload commit', () => {
    expect(imageMarkdown('o/r', 'c0ffee', 'feat/x/abcdef1/a.png')).toBe(
      '![a.png](https://github.com/o/r/blob/c0ffee/feat/x/abcdef1/a.png?raw=true)'
    );
  });
});

describe('imagesIn', () => {
  it('expands folders and keeps only images', () => {
    const dirs: Record<string, string[]> = {
      out: ['a.png', 'report.md', 'b.JPG', 'report.json'],
    };
    const files = imagesIn(
      ['out', 'shot.webp', 'notes.txt'],
      (dir: string) => dirs[dir] ?? [],
      (path: string) => path in dirs
    );
    expect(files).toEqual(['out/a.png', 'out/b.JPG', 'shot.webp']);
  });
});
