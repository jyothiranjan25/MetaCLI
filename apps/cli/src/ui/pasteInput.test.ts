import { describe, expect, it } from 'vitest';
import {
  BRACKETED_PASTE_END,
  BRACKETED_PASTE_START,
  createPromptBuffer,
  parseTerminalInput,
} from './pasteInput.js';

describe('paste input parsing', () => {
  it('parses bracketed paste as a single paste event', () => {
    const content = ['# Architecture', '', '```ts', 'const ok = true;', '```'].join('\n');
    expect(parseTerminalInput(`${BRACKETED_PASTE_START}${content}${BRACKETED_PASTE_END}`)).toEqual([
      { type: 'text', text: content, pasted: true },
    ]);
  });

  it('treats unbracketed multiline chunks as paste instead of submit events', () => {
    const content = 'line 1\nline 2\nline 3';
    expect(parseTerminalInput(content)).toEqual([
      { type: 'text', text: content, pasted: true },
    ]);
  });

  it('treats large unbracketed single-line chunks as one paste event', () => {
    const content = 'x'.repeat(10_000);
    expect(parseTerminalInput(content)).toEqual([
      { type: 'text', text: content, pasted: true },
    ]);
  });

  it('detects large prompts without requiring renderable input text', () => {
    const content = Array.from({ length: 10_001 }, (_, index) => `line ${index + 1}`).join('\n');
    const buffer = createPromptBuffer(content);

    expect(buffer.isLarge).toBe(true);
    expect(buffer.lineCount).toBe(10_001);
    expect(buffer.text).toBe(content);
  });

  it('does not count a terminal newline as an extra prompt line', () => {
    const content = Array.from({ length: 511 }, (_, index) => `line ${index + 1}`).join('\n');
    expect(createPromptBuffer(`${content}\n`).lineCount).toBe(511);
  });

  it('does not let unknown CSI escape sequence tail bleed into text (the [0~ bug)', () => {
    // \x1b[0~ is a terminal escape (e.g. focus event). The [0~ bytes must NOT
    // appear as text in the prompt buffer.
    const events = parseTerminalInput('\x1b[0~');
    const textEvents = events.filter((e) => e.type === 'text');
    expect(textEvents).toHaveLength(0);
    expect(events).toEqual([]);
  });

  it('silently absorbs arbitrary CSI sequences between regular keystrokes', () => {
    // Terminal sends \x1b[?2004h (bracketed-paste enabled ack) then user types "hi"
    const events = parseTerminalInput('\x1b[?2004hhi');
    expect(events).toEqual([
      { type: 'text', text: 'h', pasted: false },
      { type: 'text', text: 'i', pasted: false },
    ]);
  });

  it('correctly identifies up/down arrows after the full-sequence change', () => {
    expect(parseTerminalInput('\x1b[A')).toEqual([{ type: 'up' }]);
    expect(parseTerminalInput('\x1b[B')).toEqual([{ type: 'down' }]);
  });
});
