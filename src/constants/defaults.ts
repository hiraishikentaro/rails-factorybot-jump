/**
 * 拡張機能のデフォルト値を定義
 */

// デフォルトのファクトリファイルパス
export const DEFAULT_FACTORY_PATHS = ["spec/factories/**/*.rb"];

// キャッシュのタイムアウト値（ミリ秒）
export const CACHE_TIMEOUT = 60000; // 1分

// サポートするFactoryBotのメソッド名
export const SUPPORTED_FACTORY_METHODS = [
  "create",
  "create_list",
  "build",
  "build_list",
  "build_stubbed",
  "build_stubbed_list",
];

// 設定のセクション名
export const CONFIG_SECTION = "rails-factorybot-jump";

// ファクトリファイルの優先順位（最初に見つかったものを優先）
export const FACTORY_FILE_PRIORITY_ORDER = [
  "spec/factories",
  "test/factories",
  "factories",
];
