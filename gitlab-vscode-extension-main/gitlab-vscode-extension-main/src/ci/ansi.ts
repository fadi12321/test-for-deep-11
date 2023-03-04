/*---------------------------------------------------------------------------------------------
 * Adapted from ANSI Colors (https://github.com/iliazeus/vscode-ansi)
 *
 * Copyright (c) 2020 Ilia Pozdnyakov. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint-disable no-param-reassign */
/* eslint-disable no-continue */
/* eslint-disable no-shadow */
/* eslint-disable no-bitwise */

export enum ColorFlags {
  Named = 1 << 24,
  Bright = 1 << 25,
}

export enum NamedColor {
  DefaultBackground = ColorFlags.Named | 0xf0,
  DefaultForeground = ColorFlags.Named | 0xf1,

  Black = ColorFlags.Named | 0,
  Red = ColorFlags.Named | 1,
  Green = ColorFlags.Named | 2,
  Yellow = ColorFlags.Named | 3,
  Blue = ColorFlags.Named | 4,
  Magenta = ColorFlags.Named | 5,
  Cyan = ColorFlags.Named | 6,
  White = ColorFlags.Named | 7,

  BrightBlack = ColorFlags.Named | ColorFlags.Bright | NamedColor.Black,
  BrightRed = ColorFlags.Named | ColorFlags.Bright | NamedColor.Red,
  BrightGreen = ColorFlags.Named | ColorFlags.Bright | NamedColor.Green,
  BrightYellow = ColorFlags.Named | ColorFlags.Bright | NamedColor.Yellow,
  BrightBlue = ColorFlags.Named | ColorFlags.Bright | NamedColor.Blue,
  BrightMagenta = ColorFlags.Named | ColorFlags.Bright | NamedColor.Magenta,
  BrightCyan = ColorFlags.Named | ColorFlags.Bright | NamedColor.Cyan,
  BrightWhite = ColorFlags.Named | ColorFlags.Bright | NamedColor.White,
}

export type RgbColor = number;

export type Color = NamedColor | RgbColor;

export enum AttributeFlags {
  Bold = 1 << 0,
  Faint = 1 << 1,
  Italic = 1 << 2,
  Underline = 1 << 3,
  SlowBlink = 1 << 4,
  RapidBlink = 1 << 5,
  Inverse = 1 << 6,
  Conceal = 1 << 7,
  CrossedOut = 1 << 8,
  Fraktur = 1 << 9,
  DoubleUnderline = 1 << 10,
  Proportional = 1 << 11,
  Framed = 1 << 12,
  Encircled = 1 << 13,
  Overlined = 1 << 14,
  Superscript = 1 << 15,
  Subscript = 1 << 16,

  EscapeSequence = 1 << 31,
}

export interface Style {
  backgroundColor: Color;
  foregroundColor: Color;
  attributeFlags: AttributeFlags;
  fontIndex: number;
}

export const DefaultStyle: Style = {
  backgroundColor: NamedColor.DefaultBackground,
  foregroundColor: NamedColor.DefaultForeground,
  attributeFlags: 0,
  fontIndex: 0,
};

function indexOf(input: string, delimeters: string[], position = 0): number {
  const indices = delimeters.map(d => input.indexOf(d, position)).filter(x => x !== -1);
  return Math.min(...indices);
}
export interface Span extends Style {
  offset: number;
  length: number;
}

export interface ParserOptions {
  doubleUnderline?: boolean;
}

export class Parser {
  #options: ParserOptions;

  public constructor(options: ParserOptions = { doubleUnderline: false }) {
    this.#options = options;
  }

  #finalStyle: Style = { ...DefaultStyle };

  public appendLine(text: string): Span[] {
    return this.#parseLine(text, this.#finalStyle);
  }

  #parseLine(text: string, style: Style): Span[] {
    const spans: Span[] = [];

    let textOffset = 0;
    let index = 0;

    while (index < text.length) {
      if (text.codePointAt(index) !== 0x1b) {
        let escOffset = text.indexOf('\x1b', index);
        if (escOffset === -1) escOffset = text.length;

        spans.push({ ...style, offset: textOffset, length: escOffset - textOffset });

        textOffset = escOffset;
        index = escOffset;
        continue;
      }

      if (index === text.length - 1) {
        break;
      }

      if (text[index + 1] !== '[') {
        index += 1;
        continue;
      }

      const commandOffset = indexOf(text, ['K', 'm'], index + 2);

      if (commandOffset === -1) {
        index += 1;
        continue;
      }

      const argString = text.substring(index + 2, commandOffset);
      if (!/^[0-9;]*$/.test(argString)) {
        index = commandOffset;
        continue;
      }

      spans.push({
        ...style,
        offset: index,
        length: commandOffset - index + 1,
        attributeFlags: style.attributeFlags | AttributeFlags.EscapeSequence,
      });

      if (text[commandOffset] === 'm') {
        const args = argString
          .split(';')
          .filter(arg => arg !== '')
          .map(arg => parseInt(arg, 10));
        if (args.length === 0) args.push(0);

        this.#applyCodes(args, style);
      }

      textOffset = commandOffset + 1;
      index = commandOffset + 1;
    }

    spans.push({ ...style, offset: textOffset, length: index - textOffset });

    return spans;
  }

  #applyCodes(args: number[], style: Style): void {
    for (let argIndex = 0; argIndex < args.length; argIndex += 1) {
      const code = args[argIndex];

      switch (code) {
        case 0:
          Object.assign(style, DefaultStyle);
          break;

        case 1:
          style.attributeFlags |= AttributeFlags.Bold;
          style.attributeFlags &= ~AttributeFlags.Faint;
          break;

        case 2:
          style.attributeFlags |= AttributeFlags.Faint;
          style.attributeFlags &= ~AttributeFlags.Bold;
          break;

        case 3:
          style.attributeFlags |= AttributeFlags.Italic;
          style.attributeFlags &= ~AttributeFlags.Fraktur;
          break;

        case 4:
          style.attributeFlags |= AttributeFlags.Underline;
          style.attributeFlags &= ~AttributeFlags.DoubleUnderline;
          break;

        case 5:
          style.attributeFlags |= AttributeFlags.SlowBlink;
          style.attributeFlags &= ~AttributeFlags.RapidBlink;
          break;

        case 6:
          style.attributeFlags |= AttributeFlags.RapidBlink;
          style.attributeFlags &= ~AttributeFlags.SlowBlink;
          break;

        case 7:
          style.attributeFlags |= AttributeFlags.Inverse;
          break;

        case 8:
          style.attributeFlags |= AttributeFlags.Conceal;
          break;

        case 9:
          style.attributeFlags |= AttributeFlags.CrossedOut;
          break;

        case 10:
        case 11:
        case 12:
        case 13:
        case 14:
        case 15:
        case 16:
        case 17:
        case 18:
        case 19:
          style.fontIndex = code - 10;
          break;

        case 20:
          style.attributeFlags |= AttributeFlags.Fraktur;
          style.attributeFlags &= ~AttributeFlags.Italic;
          break;

        case 21:
          if (this.#options.doubleUnderline) {
            style.attributeFlags |= AttributeFlags.DoubleUnderline;
            style.attributeFlags &= ~AttributeFlags.Underline;
            break;
          }

          style.attributeFlags &= ~AttributeFlags.Bold;
          break;

        case 22:
          style.attributeFlags &= ~AttributeFlags.Bold;
          style.attributeFlags &= ~AttributeFlags.Faint;
          break;

        case 23:
          style.attributeFlags &= ~AttributeFlags.Italic;
          style.attributeFlags &= ~AttributeFlags.Fraktur;
          break;

        case 24:
          style.attributeFlags &= ~AttributeFlags.Underline;
          style.attributeFlags &= ~AttributeFlags.DoubleUnderline;
          break;

        case 25:
          style.attributeFlags &= ~AttributeFlags.SlowBlink;
          style.attributeFlags &= ~AttributeFlags.RapidBlink;
          break;

        case 26:
          style.attributeFlags |= AttributeFlags.Proportional;
          break;

        case 27:
          style.attributeFlags &= ~AttributeFlags.Inverse;
          break;

        case 28:
          style.attributeFlags &= ~AttributeFlags.Conceal;
          break;

        case 29:
          style.attributeFlags &= ~AttributeFlags.CrossedOut;
          break;

        case 30:
        case 31:
        case 32:
        case 33:
        case 34:
        case 35:
        case 36:
        case 37:
          style.foregroundColor = ColorFlags.Named | (code - 30);
          break;

        case 38: {
          const colorType = args[argIndex + 1];

          if (colorType === 5) {
            const color = args[argIndex + 2];
            argIndex += 2;

            if (color >= 0 && color <= 255) {
              style.foregroundColor = this.#convert8BitColor(color);
            }
          }

          if (colorType === 2) {
            const r = args[argIndex + 2];
            const g = args[argIndex + 3];
            const b = args[argIndex + 4];
            argIndex += 4;

            if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
              style.foregroundColor = (r << 16) | (g << 8) | b;
            }
          }

          break;
        }

        case 39:
          style.foregroundColor = DefaultStyle.foregroundColor;
          break;

        case 40:
        case 41:
        case 42:
        case 43:
        case 44:
        case 45:
        case 46:
        case 47:
          style.backgroundColor = ColorFlags.Named | (code - 40);
          break;

        case 48: {
          const colorType = args[argIndex + 1];

          if (colorType === 5) {
            const color = args[argIndex + 2];
            argIndex += 2;

            if (color >= 0 && color <= 255) {
              style.backgroundColor = this.#convert8BitColor(color);
            }
          }

          if (colorType === 2) {
            const r = args[argIndex + 2];
            const g = args[argIndex + 3];
            const b = args[argIndex + 4];
            argIndex += 4;

            if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
              style.backgroundColor = (r << 16) | (g << 8) | b;
            }
          }

          break;
        }

        case 49:
          style.backgroundColor = DefaultStyle.backgroundColor;
          break;

        case 50:
          style.attributeFlags &= ~AttributeFlags.Proportional;
          break;

        case 51:
          style.attributeFlags |= AttributeFlags.Framed;
          style.attributeFlags &= ~AttributeFlags.Encircled;
          break;

        case 52:
          style.attributeFlags |= AttributeFlags.Encircled;
          style.attributeFlags &= ~AttributeFlags.Framed;
          break;

        case 53:
          style.attributeFlags |= AttributeFlags.Overlined;
          break;

        case 54:
          style.attributeFlags &= ~AttributeFlags.Framed;
          style.attributeFlags &= ~AttributeFlags.Encircled;
          break;

        case 55:
          style.attributeFlags &= ~AttributeFlags.Overlined;
          break;

        case 58:
          // TODO: underline colors
          break;

        case 59:
          // TODO: underline colors
          break;

        case 73:
          style.attributeFlags |= AttributeFlags.Superscript;
          style.attributeFlags &= ~AttributeFlags.Subscript;
          break;

        case 74:
          style.attributeFlags |= AttributeFlags.Subscript;
          style.attributeFlags &= ~AttributeFlags.Superscript;
          break;

        case 90:
        case 91:
        case 92:
        case 93:
        case 94:
        case 95:
        case 96:
        case 97:
          style.foregroundColor = ColorFlags.Named | ColorFlags.Bright | (code - 90);
          break;

        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
          style.backgroundColor = ColorFlags.Named | ColorFlags.Bright | (code - 100);
          break;

        default:
          break;
      }
    }
  }

  // eslint-disable-next-line class-methods-use-this
  #convert8BitColor(color: number): Color {
    if (color >= 0 && color <= 7) {
      return ColorFlags.Named | color;
    }

    if (color >= 8 && color <= 15) {
      return ColorFlags.Named | ColorFlags.Bright | (color - 8);
    }

    if (color >= 232 && color <= 255) {
      const intensity = ((255 * (color - 232)) / 23) | 0;
      return (intensity << 16) | (intensity << 8) | intensity;
    }

    let color6 = color - 16;

    const b6 = color6 % 6;
    color6 = (color6 / 6) | 0;

    const g6 = color6 % 6;
    color6 = (color6 / 6) | 0;

    const r6 = color6;

    const r = ((255 * r6) / 5) | 0;
    const g = ((255 * g6) / 5) | 0;
    const b = ((255 * b6) / 5) | 0;

    return (r << 16) | (g << 8) | b;
  }
}
