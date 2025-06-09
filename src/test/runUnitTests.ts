/**
 * 単体テスト専用のテストランナー
 * 統合テストと分離して実行可能
 */

import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    // 拡張機能のマニフェスト（package.json）を含むフォルダ
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");

    // 単体テストのエントリーポイント
    const extensionTestsPath = path.resolve(__dirname, "./unit");

    console.log("Running unit tests...");
    console.log(`Extension path: ${extensionDevelopmentPath}`);
    console.log(`Unit tests path: ${extensionTestsPath}`);

    // VS Codeをダウンロードし、単体テストを実行
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        "--disable-extensions", // 他の拡張機能を無効化
        "--disable-workspace-trust", // ワークスペースの信頼確認を無効化
      ],
    });

    console.log("Unit tests completed successfully!");
  } catch (err) {
    console.error("Failed to run unit tests:", err);
    process.exit(1);
  }
}

main();
