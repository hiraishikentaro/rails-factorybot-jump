/**
 * パス操作のユーティリティ関数
 */

import * as path from "path";
import * as vscode from "vscode";

/**
 * クロスプラットフォーム対応のパス正規化
 * Windowsのバックスラッシュをスラッシュに統一
 */
export function normalizePath(inputPath: string): string {
  return inputPath.replace(/\\/g, "/");
}

/**
 * ワークスペースルートからの相対パスを計算
 */
export function getRelativePathFromWorkspace(
  workspaceFolder: vscode.WorkspaceFolder,
  targetUri: vscode.Uri
): string {
  const workspacePath = workspaceFolder.uri.fsPath;
  const targetPath = targetUri.fsPath;
  const relativePath = path.relative(workspacePath, targetPath);
  return normalizePath(relativePath);
}

/**
 * 相対パスと絶対パスの変換
 */
export function resolvePathFromWorkspace(
  workspaceFolder: vscode.WorkspaceFolder,
  relativePath: string
): vscode.Uri {
  const normalizedPath = normalizePath(relativePath);
  const absolutePath = path.resolve(workspaceFolder.uri.fsPath, normalizedPath);
  return vscode.Uri.file(absolutePath);
}

/**
 * ファイルパスからファイル名（拡張子なし）を取得
 */
export function getFileNameWithoutExtension(filePath: string): string {
  const fileName = path.basename(filePath);
  return fileName.replace(path.extname(fileName), "");
}

/**
 * ファクトリファイルかどうかを判定
 */
export function isFactoryFile(filePath: string): boolean {
  const fileName = path.basename(filePath).toLowerCase();
  return (
    fileName.endsWith(".rb") &&
    (fileName.includes("factor") ||
      fileName.includes("spec") ||
      fileName.includes("test"))
  );
}
