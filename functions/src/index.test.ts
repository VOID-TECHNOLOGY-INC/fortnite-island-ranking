import { describe, it, expect } from 'vitest';
import { buildPerplexityPrompts } from './index.js';

describe('buildPerplexityPrompts', () => {
  it('ja prompt contains required headings and prefers sources', () => {
    const { system, user } = buildPerplexityPrompts('ja', 'Sample (0000-0000-0000)');
    expect(system).toMatch(/出典|公式/);
    expect(user).toMatch(/## Island Status/);
    expect(user).toMatch(/### 状況/);
    expect(user).toMatch(/### 概要/);
    expect(user).toMatch(/### 特徴/);
    expect(user).toMatch(/### 話題/);
    expect(user).toMatch(/## 出典/);
    expect(user).toMatch(/YouTube|Reddit|Epic/);
  });

  it('en prompt contains required headings and prefers sources', () => {
    const { system, user } = buildPerplexityPrompts('en', 'Sample (0000-0000-0000)');
    expect(system).toMatch(/official|sources|Markdown/);
    expect(user).toMatch(/## Island Status/);
    expect(user).toMatch(/### Status/);
    expect(user).toMatch(/### Overview/);
    expect(user).toMatch(/### Features/);
    expect(user).toMatch(/### Discussion/);
    expect(user).toMatch(/## Sources/);
    expect(user).toMatch(/YouTube|Reddit|official/);
  });
});


