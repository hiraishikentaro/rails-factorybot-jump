/**
 * 正規表現パターンの一元管理
 */

import { SUPPORTED_FACTORY_METHODS } from "../constants/defaults";

// ファクトリ定義を検出する正規表現パターン
export const FACTORY_DEFINITION_PATTERN = /factory\s+:([a-zA-Z0-9_]+)\b/g;

// トレイト定義を検出する正規表現パターン
export const TRAIT_DEFINITION_PATTERN = /trait\s+:([a-zA-Z0-9_]+)\s+do/g;

// ファクトリブロック全体を検出する正規表現パターン
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
