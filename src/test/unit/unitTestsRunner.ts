/**
 * 単体テスト用のMochaランナー
 * 単体テストファイルを動的に検索して実行
 */

import Mocha from "mocha";
import * as path from "path";
import * as fs from "fs";

/**
 * 指定ディレクトリから.test.jsファイルを再帰的に検索
 */
function findTestFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // ディレクトリの場合は再帰的に検索
      findTestFiles(filePath, fileList);
    } else if (file.endsWith(".test.js")) {
      // .test.jsファイルの場合はリストに追加
      fileList.push(filePath);
    }
  });

  return fileList;
}

export function run(): Promise<void> {
  // Mochaテストランナーを作成
  const mocha = new Mocha({
    ui: "tdd", // Test Driven Development UI
    color: true,
    timeout: 10000, // 10秒のタイムアウト
  });

  // テストディレクトリのパス
  const testsRoot = path.resolve(__dirname);

  return new Promise((resolve, reject) => {
    try {
      // .test.jsファイルを再帰的に検索
      const testFiles: string[] = findTestFiles(testsRoot);

      // 各テストファイルをMochaに追加
      testFiles.forEach((file: string) => {
        mocha.addFile(file);
      });

      console.log(`Found ${testFiles.length} unit test files:`);
      testFiles.forEach((file: string) => {
        const relativePath = path.relative(testsRoot, file);
        console.log(`  - ${relativePath}`);
      });

      // テストを実行
      mocha.run((failures: number) => {
        if (failures > 0) {
          reject(new Error(`${failures} unit tests failed.`));
        } else {
          console.log("All unit tests passed!");
          resolve();
        }
      });
    } catch (err) {
      console.error("Error setting up unit tests:", err);
      reject(err);
    }
  });
}
