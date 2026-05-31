export const BRACKETED_PASTE_START = '\x1b[200~';
export const BRACKETED_PASTE_END = '\x1b[201~';
export const ENABLE_BRACKETED_PASTE = '\x1b[?2004h';
export const DISABLE_BRACKETED_PASTE = '\x1b[?2004l';

const LARGE_PASTE_LINE_THRESHOLD = 25;
const LARGE_PASTE_CHAR_THRESHOLD = 8_000;

export interface PromptBufferState {
  text: string;
  lineCount: number;
  isLarge: boolean;
}

export type TerminalInputEvent =
  | { type: 'text'; text: string; pasted: boolean }
  | { type: 'submit' }
  | { type: 'backspace' }
  | { type: 'up' }
  | { type: 'down' }
  | { type: 'pageup' }
  | { type: 'pagedown' }
  | { type: 'tab' }
  | { type: 'escape' }
  | { type: 'ctrl-c' }
  | { type: 'ctrl-k' };

export function createPromptBuffer(text: string): PromptBufferState {
  const lineCount = countLines(text);
  return {
    text,
    lineCount,
    isLarge: lineCount >= LARGE_PASTE_LINE_THRESHOLD || text.length >= LARGE_PASTE_CHAR_THRESHOLD,
  };
}

export function countLines(text: string): number {
  if (text.length === 0) return 0;
  const withoutTerminalNewline = text.replace(/(?:\r\n|\r|\n)+$/, '');
  if (withoutTerminalNewline.length === 0) return 1;
  return withoutTerminalNewline.split(/\r\n|\r|\n/).length;
}

export function isLargePaste(text: string): boolean {
  return createPromptBuffer(text).isLarge;
}

export class TerminalInputParser {
  private inBracketedPaste = false;
  private pasteBuffer = '';

  public parse(data: Buffer | string): TerminalInputEvent[] {
    const text = Buffer.isBuffer(data) ? data.toString('utf8') : data;
    if (!text) return [];

    const events: TerminalInputEvent[] = [];
    let remaining = text;

    if (this.inBracketedPaste) {
      const endIdx = remaining.indexOf(BRACKETED_PASTE_END);
      if (endIdx === -1) {
        // Still in bracketed paste, accumulate everything
        this.pasteBuffer += remaining;
        return [];
      } else {
        // Bracketed paste ends in this chunk
        this.pasteBuffer += remaining.slice(0, endIdx);
        events.push({
          type: 'text',
          text: this.pasteBuffer,
          pasted: true,
        });
        this.inBracketedPaste = false;
        this.pasteBuffer = '';
        remaining = remaining.slice(endIdx + BRACKETED_PASTE_END.length);
      }
    }

    while (remaining.length > 0) {
      const start = remaining.indexOf(BRACKETED_PASTE_START);
      if (start === -1) {
        events.push(...parseNonPasteInput(remaining));
        break;
      }

      if (start > 0) {
        events.push(...parseNonPasteInput(remaining.slice(0, start)));
      }

      const pasteContentStart = start + BRACKETED_PASTE_START.length;
      const end = remaining.indexOf(BRACKETED_PASTE_END, pasteContentStart);
      if (end === -1) {
        // Bracketed paste starts but doesn't end in this chunk
        this.inBracketedPaste = true;
        this.pasteBuffer = remaining.slice(pasteContentStart);
        break;
      }

      events.push({
        type: 'text',
        text: remaining.slice(pasteContentStart, end),
        pasted: true,
      });
      remaining = remaining.slice(end + BRACKETED_PASTE_END.length);
    }

    return events.filter((event) => event.type !== 'text' || event.text.length > 0);
  }

  public reset(): void {
    this.inBracketedPaste = false;
    this.pasteBuffer = '';
  }
}

export const globalParser = new TerminalInputParser();

export function parseTerminalInput(data: Buffer | string): TerminalInputEvent[] {
  return globalParser.parse(data);
}

// ─── Non-paste input parser ────────────────────────────────────────────────

function parseNonPasteInput(input: string): TerminalInputEvent[] {
  // Fast-path: multi-character chunk with no escape sequences is an unbracketed paste.
  if (input.length > 1 && !input.includes('\x1b')) {
    return [{ type: 'text', text: input, pasted: true }];
  }

  const events: TerminalInputEvent[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (char === '\x1b') {
      // Consume the FULL escape sequence so its tail bytes never bleed into text.
      const seq = consumeEscapeSequence(input, index);
      if (seq === '\x1b[A' || seq === '\x1bOA') {
        events.push({ type: 'up' });
      } else if (seq === '\x1b[B' || seq === '\x1bOB') {
        events.push({ type: 'down' });
      } else if (seq === '\x1b[5~') {
        events.push({ type: 'pageup' });
      } else if (seq === '\x1b[6~') {
        events.push({ type: 'pagedown' });
      } else if (seq === '\x1b') {
        // Bare ESC key (no following sequence) — intentional dismiss.
        events.push({ type: 'escape' });
      }
      // All other multi-char sequences (left/right arrow, Home, End, F-keys,
      // etc.) are silently consumed. Treating them as 'escape' was closing
      // overlays whenever the user pressed an unrecognised key.
      index += seq.length;
      continue;
    }

    switch (char) {
      case '\x03':
        events.push({ type: 'ctrl-c' });
        break;
      case '\x0b':
        events.push({ type: 'ctrl-k' });
        break;
      case '\r':
      case '\n':
        events.push({ type: 'submit' });
        break;
      case '\t':
        events.push({ type: 'tab' });
        break;
      case '\b':
      case '\x7f':
        events.push({ type: 'backspace' });
        break;
      default:
        if (char >= ' ') {
          events.push({ type: 'text', text: char, pasted: false });
        }
        break;
    }
    index++;
  }

  return events;
}

/**
 * Consume a complete ANSI/VT escape sequence starting at `start` and return
 * the full matched slice.  Handles:
 *   CSI  \x1b[  …params/intermediates…  final-byte
 *   SS3  \x1bO  single-char
 *   OSC  \x1b]  …  ST (\x07 or \x1b\\)
 *   Fe   \x1b   single-char (all other 2-char forms)
 */
function consumeEscapeSequence(input: string, start: number): string {
  let end = start + 1;

  if (end >= input.length) {
    return input.slice(start); // bare ESC at end of buffer
  }

  const next = input[end];

  if (next === '[') {
    // CSI: \x1b[ [param bytes 0x30-0x3F]* [intermediate bytes 0x20-0x2F]* [final 0x40-0x7E]
    end++;
    while (end < input.length && input.charCodeAt(end) >= 0x30 && input.charCodeAt(end) <= 0x3f) end++;
    while (end < input.length && input.charCodeAt(end) >= 0x20 && input.charCodeAt(end) <= 0x2f) end++;
    if (end < input.length && input.charCodeAt(end) >= 0x40 && input.charCodeAt(end) <= 0x7e) end++;
  } else if (next === 'O') {
    // SS3: \x1bO + one char (e.g. arrow keys on some terminals)
    end = Math.min(end + 2, input.length);
  } else if (next === ']') {
    // OSC: terminated by BEL (\x07) or ST (\x1b\\)
    end++;
    while (end < input.length) {
      if (input[end] === '\x07') { end++; break; }
      if (input[end] === '\x1b' && input[end + 1] === '\\') { end += 2; break; }
      end++;
    }
  } else {
    // Fe / 2-char escape sequence (e.g. \x1bM = reverse index)
    end++;
  }

  return input.slice(start, end);
}
