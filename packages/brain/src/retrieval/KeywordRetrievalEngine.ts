import path from 'node:path';
import type { BrainStore, SymbolRecord, FileRecord } from '../persistence/BrainStore.js';

export interface RetrievedContext {
  files: FileRecord[];
  symbols: SymbolRecord[];
  markdown: string;
}

export class KeywordRetrievalEngine {
  private stopWords = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent',
    'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
    'cant', 'cannot', 'could', 'couldnt', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down',
    'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadnt', 'has', 'hasnt', 'have', 'havent',
    'having', 'he', 'hed', 'hell', 'hes', 'her', 'here', 'heres', 'hers', 'herself', 'him', 'himself',
    'his', 'how', 'hows', 'i', 'id', 'ill', 'im', 'ive', 'if', 'in', 'into', 'is', 'isnt', 'it', 'its',
    'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off',
    'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
    'same', 'shant', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt', 'so', 'some', 'such', 'than',
    'that', 'thats', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'theres', 'these',
    'they', 'theyd', 'theyll', 'theyre', 'theyve', 'this', 'those', 'through', 'to', 'too', 'under',
    'until', 'up', 'very', 'was', 'wasnt', 'we', 'wed', 'well', 'were', 'weve', 'werent', 'what', 'whats',
    'when', 'whens', 'where', 'wheres', 'which', 'while', 'who', 'whos', 'whom', 'why', 'whys', 'with',
    'wont', 'would', 'wouldnt', 'you', 'youd', 'youll', 'youre', 'youve', 'your', 'yours', 'yourself',
    'yourselves', 'how', 'fix', 'add', 'build', 'create', 'setup', 'write', 'implement', 'change',
    'make', 'test', 'run', 'code', 'file', 'symbol', 'bug', 'error', 'issue', 'problem',
  ]);

  constructor(
    private store: BrainStore,
    private projectRoot: string,
  ) {}

  /**
   * Retrieve codebase context matching the given prompt.
   */
  retrieveContext(prompt: string): RetrievedContext {
    const keywords = this.extractKeywords(prompt);
    
    if (keywords.length === 0) {
      return { files: [], symbols: [], markdown: '' };
    }

    const matchedSymbolsMap = new Map<string, SymbolRecord>();
    const matchedFilesMap = new Map<string, FileRecord>();

    // 1. Search symbols and files for each keyword
    for (const keyword of keywords) {
      const syms = this.store.searchSymbols(keyword);
      for (const s of syms) {
        matchedSymbolsMap.set(`${s.filePath}:${s.name}`, s);
      }

      const files = this.store.searchFiles(keyword);
      for (const f of files) {
        matchedFilesMap.set(f.path, f);
      }
    }

    const matchedSymbols = Array.from(matchedSymbolsMap.values());
    
    // Ensure all files that contain matched symbols are also added to matched files
    for (const sym of matchedSymbols) {
      if (!matchedFilesMap.has(sym.filePath)) {
        const fileRecord = this.store.getFile(sym.filePath);
        if (fileRecord) {
          matchedFilesMap.set(sym.filePath, fileRecord);
        }
      }
    }

    const matchedFiles = Array.from(matchedFilesMap.values());

    // 2. Sort files by importance score descending to prioritize highly coupled modules
    matchedFiles.sort((a, b) => b.importance - a.importance);

    // 3. Format into a clean Markdown block
    const markdown = this.formatContextMarkdown(matchedFiles, matchedSymbols);

    return {
      files: matchedFiles,
      symbols: matchedSymbols,
      markdown,
    };
  }

  // ─── Private Methods ─────────────────────────────────────────

  /**
   * Tokenize prompt, remove punctuation, stop words, and duplicates.
   */
  private extractKeywords(prompt: string): string[] {
    const cleaned = prompt
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ') // replace punctuation with space
      .split(/\s+/);

    const keywords = new Set<string>();
    for (const word of cleaned) {
      if (word.length > 2 && !this.stopWords.has(word)) {
        keywords.add(word);
      }
    }

    return Array.from(keywords);
  }

  /**
   * Format context into clickable markdown links matching the guidelines.
   */
  private formatContextMarkdown(files: FileRecord[], symbols: SymbolRecord[]): string {
    if (files.length === 0) return '';

    let md = `> [!NOTE]\n> ### 🧠 MetaCLI Codebase Context\n> The following symbols and files matched your query from the local Project Brain index:\n\n`;

    // Group symbols by file path
    const symbolsByFile = new Map<string, SymbolRecord[]>();
    for (const sym of symbols) {
      if (!symbolsByFile.has(sym.filePath)) {
        symbolsByFile.set(sym.filePath, []);
      }
      symbolsByFile.get(sym.filePath)!.push(sym);
    }

    for (const file of files) {
      const fileAbsolute = path.join(this.projectRoot, file.path);
      const fileBasename = path.basename(file.path);
      const fileSymbols = symbolsByFile.get(file.path) ?? [];
      
      md += `#### 📄 [${fileBasename}](file://${fileAbsolute}) *(Importance: ${file.importance})*\n`;
      md += `- Path: \`${file.path}\` (${(file.size / 1024).toFixed(1)} KB)\n`;
      
      if (fileSymbols.length > 0) {
        md += `- **Matching Symbols:**\n`;
        for (const sym of fileSymbols) {
          const typeEmoji = this.getSymbolEmoji(sym.type);
          md += `  - ${typeEmoji} [\`${sym.name}\`](file://${fileAbsolute}#L${sym.startLine}-L${sym.endLine}) (${sym.type}, lines ${sym.startLine}-${sym.endLine})\n`;
        }
      }
      
      md += `\n`;
    }

    return md;
  }

  private getSymbolEmoji(type: string): string {
    switch (type) {
      case 'class': return '🗂️';
      case 'interface': return '📐';
      case 'function': return '🧩';
      case 'variable': return '📦';
      case 'type': return '🏷️';
      default: return '💎';
    }
  }
}
