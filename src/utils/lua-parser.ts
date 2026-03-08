// ─── Lightweight Lua Table Parser ─────────────────────────────────────────────
// Parses the subset of Lua used in Warframe wiki data modules:
//   - Tables: { key = value, ... } and { value, value, ... } (array-style)
//   - Strings: "..." with \" escapes
//   - Numbers: integers and decimals (including negative)
//   - Booleans: true / false
//   - nil
//   - Nested tables
//   - ["quoted keys"] for keys with special characters
//   - Line comments: -- ...

export type LuaValue =
  | string
  | number
  | boolean
  | null
  | LuaTable
  | LuaValue[];

export interface LuaTable {
  [key: string]: LuaValue;
}

class LuaParser {
  private src: string;
  private pos: number;

  constructor(src: string) {
    this.src = src;
    this.pos = 0;
  }

  parse(): LuaValue {
    this.skipWhitespace();
    // Skip "return" keyword at the top
    if (this.src.startsWith("return", this.pos)) {
      this.pos += 6;
      this.skipWhitespace();
    }
    return this.parseValue();
  }

  private parseValue(): LuaValue {
    this.skipWhitespace();
    const ch = this.src[this.pos];

    if (ch === "{") return this.parseTable();
    if (ch === '"') return this.parseString();
    if (ch === "-" && this.src[this.pos + 1] !== "-") return this.parseNumber();
    if (ch >= "0" && ch <= "9") return this.parseNumber();
    if (ch === ".") return this.parseNumber();

    // Keywords
    if (this.src.startsWith("true", this.pos)) {
      this.pos += 4;
      return true;
    }
    if (this.src.startsWith("false", this.pos)) {
      this.pos += 5;
      return false;
    }
    if (this.src.startsWith("nil", this.pos)) {
      this.pos += 3;
      return null;
    }

    throw new Error(
      `Unexpected character '${ch}' at position ${this.pos}: "${this.src.substring(this.pos, this.pos + 30)}"`
    );
  }

  private parseTable(): LuaValue {
    this.pos++; // skip '{'
    this.skipWhitespace();

    const obj: LuaTable = {};
    let arrayIndex = 1;
    let isArray = true; // assume array until we see a named key

    while (this.pos < this.src.length && this.src[this.pos] !== "}") {
      this.skipWhitespace();
      if (this.src[this.pos] === "}") break;

      // Check if this is a keyed entry
      const saved = this.pos;
      let key: string | null = null;

      if (this.src[this.pos] === "[") {
        // ["quoted key"] = value
        this.pos++; // skip '['
        this.skipWhitespace();
        if (this.src[this.pos] === '"') {
          key = this.parseString();
          this.skipWhitespace();
          if (this.src[this.pos] === "]") {
            this.pos++; // skip ']'
            this.skipWhitespace();
            if (this.src[this.pos] === "=") {
              this.pos++; // skip '='
              isArray = false;
            } else {
              // Not a keyed entry, rollback
              this.pos = saved;
              key = null;
            }
          } else {
            this.pos = saved;
            key = null;
          }
        } else {
          this.pos = saved;
          key = null;
        }
      } else if (this.isIdentStart(this.src[this.pos])) {
        // Identifier = value ?
        const identStart = this.pos;
        while (this.pos < this.src.length && this.isIdentChar(this.src[this.pos])) {
          this.pos++;
        }
        const ident = this.src.substring(identStart, this.pos);
        this.skipWhitespace();
        if (this.src[this.pos] === "=") {
          this.pos++; // skip '='
          key = ident;
          isArray = false;
        } else {
          // Not a keyed entry — rollback and parse as value
          this.pos = saved;
        }
      }

      this.skipWhitespace();
      const value = this.parseValue();

      if (key !== null) {
        obj[key] = value;
      } else {
        obj[arrayIndex] = value;
        arrayIndex++;
      }

      this.skipWhitespace();
      // Skip comma or semicolon separator
      if (this.src[this.pos] === "," || this.src[this.pos] === ";") {
        this.pos++;
      }
      this.skipWhitespace();
    }

    if (this.src[this.pos] === "}") this.pos++; // skip '}'

    // Convert to array if all keys are sequential integers starting from 1
    if (isArray && arrayIndex > 1) {
      const arr: LuaValue[] = [];
      for (let i = 1; i < arrayIndex; i++) {
        arr.push(obj[i]);
      }
      return arr;
    }

    return obj;
  }

  private parseString(): string {
    this.pos++; // skip opening '"'
    let result = "";
    while (this.pos < this.src.length && this.src[this.pos] !== '"') {
      if (this.src[this.pos] === "\\") {
        this.pos++;
        const esc = this.src[this.pos];
        if (esc === "n") result += "\n";
        else if (esc === "t") result += "\t";
        else if (esc === "\\") result += "\\";
        else if (esc === '"') result += '"';
        else result += esc;
      } else {
        result += this.src[this.pos];
      }
      this.pos++;
    }
    if (this.src[this.pos] === '"') this.pos++; // skip closing '"'
    return result;
  }

  private parseNumber(): number {
    const start = this.pos;
    if (this.src[this.pos] === "-") this.pos++;
    while (this.pos < this.src.length && this.src[this.pos] >= "0" && this.src[this.pos] <= "9") {
      this.pos++;
    }
    if (this.src[this.pos] === ".") {
      this.pos++;
      while (this.pos < this.src.length && this.src[this.pos] >= "0" && this.src[this.pos] <= "9") {
        this.pos++;
      }
    }
    // Scientific notation
    if (this.src[this.pos] === "e" || this.src[this.pos] === "E") {
      this.pos++;
      if (this.src[this.pos] === "+" || this.src[this.pos] === "-") this.pos++;
      while (this.pos < this.src.length && this.src[this.pos] >= "0" && this.src[this.pos] <= "9") {
        this.pos++;
      }
    }
    return Number(this.src.substring(start, this.pos));
  }

  private skipWhitespace(): void {
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos];
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
        this.pos++;
      } else if (ch === "-" && this.src[this.pos + 1] === "-") {
        // Line comment
        this.pos += 2;
        while (this.pos < this.src.length && this.src[this.pos] !== "\n") {
          this.pos++;
        }
      } else {
        break;
      }
    }
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
  }

  private isIdentChar(ch: string): boolean {
    return this.isIdentStart(ch) || (ch >= "0" && ch <= "9");
  }
}

/** Parse a Lua table string into a JS object/array. */
export function parseLuaTable(src: string): LuaValue {
  const parser = new LuaParser(src);
  return parser.parse();
}
