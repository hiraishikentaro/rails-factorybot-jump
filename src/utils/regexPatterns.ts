/**
 * 正規表現パターンの一元管理
 */

import { SUPPORTED_FACTORY_METHODS } from "../constants/defaults";

// ファクトリ定義を検出する正規表現パターン
// 行の始まりから始まるfactory定義のみをマッチ（コメント行を除外）
export const FACTORY_DEFINITION_PATTERN =
  /^(\s*)factory\s+:([a-zA-Z0-9_]+)\b/gm;

// トレイト定義を検出する正規表現パターン
export const TRAIT_DEFINITION_PATTERN = /trait\s+:([a-zA-Z0-9_]+)\s+do/g;

/**
 * ファクトリブロックの抽出結果
 */
export interface FactoryBlock {
  /** ファクトリ名 */
  factoryName: string;
  /** do〜end の中身テキスト */
  blockContent: string;
  /** blockContent のテキスト全体における開始オフセット */
  blockContentStart: number;
}

// ファクトリ開始行を検出するシンプルなパターン（ReDoS安全）
const FACTORY_LINE_PATTERN = /^\s*factory\s+:([a-zA-Z0-9_]+).*\bdo\b/;

/**
 * テキストからファクトリブロックを行単位で抽出する（ReDoS安全）
 *
 * FACTORY_BLOCK_PATTERN の正規表現を置き換え、do/end の深度追跡で
 * ファクトリブロックの範囲を特定する。
 */
export function extractFactoryBlocks(text: string): FactoryBlock[] {
  const results: FactoryBlock[] = [];
  const lines = text.split("\n");

  // 各行の開始オフセットを事前計算
  const lineOffsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1; // +1 for \n
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const factoryMatch = FACTORY_LINE_PATTERN.exec(line);

    if (!factoryMatch) {
      i++;
      continue;
    }

    const factoryName = factoryMatch[1];
    // blockContent の開始位置 = この行の末尾（do の後）
    const blockContentStart = lineOffsets[i] + line.length + 1; // 次の行の先頭

    // do/end 深度追跡（factory行の do で depth=1）
    let depth = 1;
    // factory行内に追加の do があるか（trait :x do 等が同一行にある場合）
    // factory行自体の do は1つカウント済みなので、残りをカウント
    const afterFirstDo = line.substring(line.search(/\bdo\b/) + 2);
    depth += countWord(afterFirstDo, "do");
    depth -= countWord(afterFirstDo, "end");

    let j = i + 1;
    while (j < lines.length && depth > 0) {
      depth += countWord(lines[j], "do");
      depth -= countWord(lines[j], "end");
      j++;
    }

    // blockContent = factory行の次の行 〜 閉じendの行の前まで
    // j は depth が 0 になった行の次を指している
    const endLineIndex = j - 1; // 閉じ end がある行
    if (depth === 0 && endLineIndex > i) {
      // blockContent: factory開始行の do 以降〜end 行の直前まで
      const blockEnd = lineOffsets[endLineIndex]; // end行の開始位置
      const blockContent = text.substring(blockContentStart, blockEnd);
      results.push({ factoryName, blockContent, blockContentStart });
    }

    i = j; // 次のファクトリを探す
  }

  return results;
}

/**
 * 行内の単語境界付きキーワード出現数をカウント
 */
function countWord(line: string, word: string): number {
  const regex = new RegExp(`\\b${word}\\b`, "g");
  const matches = line.match(regex);
  return matches ? matches.length : 0;
}

/**
 * ファクトリ呼び出しを検出する正規表現パターンを生成
 * サポートするメソッド名を基に動的に生成
 */
export function getFactoryCallPattern(): RegExp {
  const methodsPattern = SUPPORTED_FACTORY_METHODS.join("|");
  return new RegExp(
    `(?:${methodsPattern})\\s*(?:\\(\\s*)?((:[a-zA-Z0-9_]+)(?:\\s*,\\s*(:[a-zA-Z0-9_]+))*)\\s*(?:,\\s*[^)]*)?(?:\\)|\\n|$)`,
    "g"
  );
}

// トレイト参照を検出する正規表現パターン
export const TRAIT_REFERENCE_PATTERN = /:([a-zA-Z0-9_]+)/g;

// ファクトリ名の検証パターン
export const VALID_FACTORY_NAME_PATTERN = /^[a-zA-Z0-9_]+$/;
