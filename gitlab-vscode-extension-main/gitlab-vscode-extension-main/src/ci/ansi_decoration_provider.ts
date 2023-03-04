/*---------------------------------------------------------------------------------------------
 * Adapted from ANSI Colors (https://github.com/iliazeus/vscode-ansi)
 *
 * Copyright (c) 2020 Ilia Pozdnyakov. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint-disable no-bitwise */

import * as vscode from 'vscode';
import * as ansi from './ansi';
import { JOB_LOG_URI_SCHEME } from '../constants';
import { fromJobLogUri } from './job_log_uri';
import { jobLogCache, JobTraceSection } from './job_log_cache';

function upsert<K, V>(map: Map<K, V>, key: K, value: V): V {
  return map.get(key) ?? (map.set(key, value), value);
}

const ansiThemeColors: Record<ansi.NamedColor, vscode.ThemeColor | undefined> = {
  [ansi.NamedColor.DefaultBackground]: undefined,
  [ansi.NamedColor.DefaultForeground]: undefined,

  [ansi.NamedColor.Black]: new vscode.ThemeColor('terminal.ansiBlack'),
  [ansi.NamedColor.BrightBlack]: new vscode.ThemeColor('terminal.ansiBrightBlack'),

  [ansi.NamedColor.White]: new vscode.ThemeColor('terminal.ansiWhite'),
  [ansi.NamedColor.BrightWhite]: new vscode.ThemeColor('terminal.ansiBrightWhite'),

  [ansi.NamedColor.Red]: new vscode.ThemeColor('terminal.ansiRed'),
  [ansi.NamedColor.BrightRed]: new vscode.ThemeColor('terminal.ansiBrightRed'),

  [ansi.NamedColor.Green]: new vscode.ThemeColor('terminal.ansiGreen'),
  [ansi.NamedColor.BrightGreen]: new vscode.ThemeColor('terminal.ansiBrightGreen'),

  [ansi.NamedColor.Yellow]: new vscode.ThemeColor('terminal.ansiYellow'),
  [ansi.NamedColor.BrightYellow]: new vscode.ThemeColor('terminal.ansiBrightYellow'),

  [ansi.NamedColor.Blue]: new vscode.ThemeColor('terminal.ansiBlue'),
  [ansi.NamedColor.BrightBlue]: new vscode.ThemeColor('terminal.ansiBrightBlue'),

  [ansi.NamedColor.Magenta]: new vscode.ThemeColor('terminal.ansiMagenta'),
  [ansi.NamedColor.BrightMagenta]: new vscode.ThemeColor('terminal.ansiBrightMagenta'),

  [ansi.NamedColor.Cyan]: new vscode.ThemeColor('terminal.ansiCyan'),
  [ansi.NamedColor.BrightCyan]: new vscode.ThemeColor('terminal.ansiBrightCyan'),
};

function convertColor(color: ansi.Color): vscode.ThemeColor | string | undefined {
  if (color & ansi.ColorFlags.Named) return ansiThemeColors[color];
  return `#${color.toString(16).padStart(6, '0')}`;
}

type SectionDirective = {
  time: number;
  key: string;
};

function parseSectionDirective(
  rawLine: string,
  dir: 'section_start' | 'section_end',
  crIndex: number,
): SectionDirective | null {
  const index = rawLine.indexOf(dir);
  if (index !== -1 && index < crIndex) {
    const tokens = rawLine.substring(index).split(':', 3);
    const key = tokens[2]?.split('\r', 2)[0];

    return { time: +tokens[1], key };
  }
  return null;
}

export class AnsiDecorationProvider {
  #context?: vscode.ExtensionContext;

  constructor(context?: vscode.ExtensionContext) {
    this.#context = context;
  }

  async provideDecorations(
    document: vscode.TextDocument,
  ): Promise<undefined | Map<string, vscode.DecorationOptions[]>> {
    if (document.uri.scheme === JOB_LOG_URI_SCHEME) {
      const { job: id } = fromJobLogUri(document.uri);
      const cacheItem = jobLogCache.get(id);
      if (!cacheItem) return undefined;

      if (!cacheItem.decorations) {
        const { rawTrace, eTag } = cacheItem;
        const { sections, decorations, filtered } = await this.provideDecorationsForPrettifiedAnsi(
          rawTrace,
          eTag !== null,
        );

        jobLogCache.addDecorations(id, sections, decorations, filtered);
        return decorations;
      }
      return cacheItem.decorations;
    }

    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  async provideDecorationsForPrettifiedAnsi(
    rawJobTrace: string,
    isRunning: boolean,
  ): Promise<{
    sections: Map<string, JobTraceSection>;
    decorations: Map<string, vscode.DecorationOptions[]>;
    filtered: string;
  }> {
    const actualDocument = rawJobTrace.split('\n');
    const lineCount = actualDocument.length;

    const decorations = new Map<string, vscode.DecorationOptions[]>();
    const sections = new Map<string, JobTraceSection>();

    const parser = new ansi.Parser();
    const textChunks: string[] = [];

    for (let lineNumber = 0; lineNumber < lineCount; lineNumber += 1) {
      let totalEscapeLength = 0;

      const rawLine = actualDocument[lineNumber];
      const crIndex = rawLine.lastIndexOf('\r', rawLine.length - 2);
      const lineEndIndex =
        rawLine[rawLine.length - 1] === '\r' ? rawLine.length - 1 : rawLine.length;

      if (crIndex !== -1) {
        const startTag = parseSectionDirective(rawLine, 'section_start', crIndex);
        if (startTag) {
          sections.set(startTag.key, {
            startLine: lineNumber,
            startTime: startTag.time,
          });
        }

        const endTag = parseSectionDirective(rawLine, 'section_end', crIndex);
        if (endTag) {
          const sectionStart = sections.get(endTag.key);
          if (sectionStart) {
            sections.set(endTag.key, {
              ...sectionStart,
              endLine: lineNumber - 1,
              endTime: endTag.time,
            });
          }
        }
      }

      const line = rawLine.substring(crIndex + 1, lineEndIndex);

      const spans = parser.appendLine(line);

      spans.forEach(span => {
        const { offset, length, ...style } = span;

        if (style.attributeFlags & ansi.AttributeFlags.EscapeSequence) {
          totalEscapeLength += length;
          return;
        }

        const range = new vscode.Range(
          lineNumber,
          offset - totalEscapeLength,
          lineNumber,
          offset + length - totalEscapeLength,
        );

        const key = JSON.stringify(style);

        upsert(decorations, key, []).push({ range });
        textChunks.push(line.substr(offset, length));
      });

      // Each file must end with at least one newline, to avoid the decoration
      // containing the running animation from overlapping other text.
      if (lineNumber < lineCount - 1 || line.length > 0) {
        textChunks.push('\n');
      }
    }

    if (isRunning) {
      const eolRange =
        actualDocument[lineCount - 1].length > 0
          ? new vscode.Range(lineCount, 0, lineCount, 0)
          : new vscode.Range(lineCount - 1, 0, lineCount - 1, 0);
      decorations.set('running', [{ range: eolRange }]);
    } else {
      decorations.set('running', []);
    }

    return { sections, decorations, filtered: textChunks.join('') };
  }

  #decorationTypes = new Map<string, vscode.TextEditorDecorationType>();

  resolveDecoration(key: string): vscode.TextEditorDecorationType {
    let decorationType = this.#decorationTypes.get(key);

    if (decorationType) {
      return decorationType;
    }

    if (key === 'running') {
      decorationType = vscode.window.createTextEditorDecorationType({
        light: {
          after: {
            contentIconPath: this.#context?.asAbsolutePath(
              'src/assets/images/light/running-job.svg',
            ),
          },
        },
        dark: {
          after: {
            contentIconPath: this.#context?.asAbsolutePath(
              'src/assets/images/dark/running-job.svg',
            ),
          },
        },
      });
    } else {
      const style: ansi.Style = JSON.parse(key);

      decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: convertColor(style.backgroundColor),
        color: convertColor(style.foregroundColor),

        fontWeight: style.attributeFlags & ansi.AttributeFlags.Bold ? 'bold' : undefined,
        fontStyle: style.attributeFlags & ansi.AttributeFlags.Italic ? 'italic' : undefined,
        textDecoration:
          style.attributeFlags & ansi.AttributeFlags.Underline ? 'underline' : undefined,
        opacity: style.attributeFlags & ansi.AttributeFlags.Faint ? '50%' : undefined,
      });
    }

    this.#decorationTypes.set(key, decorationType);

    return decorationType;
  }

  #isDisposed = false;

  dispose(): void {
    if (this.#isDisposed) {
      return;
    }

    this.#isDisposed = true;

    vscode.Disposable.from(...this.#decorationTypes.values()).dispose();

    this.#decorationTypes.clear();
  }
}
