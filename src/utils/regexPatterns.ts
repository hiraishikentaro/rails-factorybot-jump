/**
 * 正規表現パターンの一元管理
 */

import { SUPPORTED_FACTORY_METHODS } from "../constants/defaults";

// ファクトリ定義を検出する正規表現パターン
// 行の始まりから始まるfactory定義のみをマッチ（コメント行を除外）
export const FACTORY_DEFINITION_PATTERN =
  /^(\s*)factory\s+:([a-zA-Z0-9_]+)\b/gm;

// トレイト定義を検出する正規表現パターン（do と { の両方に対応）
export const TRAIT_DEFINITION_PATTERN = /trait\s+:([a-zA-Z0-9_]+)\s+(?:do|\{)/g;

// ファクトリブロック全体を検出する正規表現パターン
// 通常のfactory定義を検出（ネストについては別途処理）
export const FACTORY_BLOCK_PATTERN =
  /factory\s+:([a-zA-Z0-9_]+)\s+do([\s\S]*?)(?=\n\s*(?:factory|end\s*$))/g;

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

/**
 * 指定位置がRubyコメント行内にあるかどうかを判定
 * コメント行とは、最初の非空白文字が '#' である行のこと
 */
export function isCommentLine(text: string, matchIndex: number): boolean {
  let lineStart = matchIndex;
  while (lineStart > 0 && text[lineStart - 1] !== "\n") {
    lineStart--;
  }
  const linePrefix = text.substring(lineStart, matchIndex);
  return /^\s*#/.test(linePrefix);
}
