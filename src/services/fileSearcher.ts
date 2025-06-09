/**
 * ワークスペース内のファクトリファイルの検索サービス
 */

import * as vscode from "vscode";
import { normalizePath } from "../utils/pathUtils";

/**
 * ファイル検索を担当するクラス
 */
export class FileSearcher {
  private disposables: vscode.Disposable[] = [];
  private onFileChangeCallbacks: ((uri: vscode.Uri) => void)[] = [];
  private fileWatcher?: vscode.FileSystemWatcher;

  constructor() {
    // ファイル監視を開始
    this.startWatchingFiles();
  }

  /**
   * ファイル監視を開始
   */
  private startWatchingFiles(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    // Ruby ファイルの変更を監視
    this.fileWatcher = vscode.workspace.createFileSystemWatcher("**/*.rb");

    // ファイル作成・変更・削除のイベントを監視
    this.fileWatcher.onDidCreate(this.handleFileChange.bind(this));
    this.fileWatcher.onDidChange(this.handleFileChange.bind(this));
    this.fileWatcher.onDidDelete(this.handleFileChange.bind(this));

    this.disposables.push(this.fileWatcher);
  }

  /**
   * ファイル変更時の処理
   */
  private handleFileChange(uri: vscode.Uri): void {
    // ファクトリファイルかどうかを簡易判定
    if (this.isLikelyFactoryFile(uri)) {
      this.onFileChangeCallbacks.forEach((callback) => callback(uri));
    }
  }

  /**
   * ファクトリファイルらしいかどうかを判定
   */
  private isLikelyFactoryFile(uri: vscode.Uri): boolean {
    const path = uri.fsPath.toLowerCase();
    return (
      path.includes("factor") || path.includes("spec") || path.includes("test")
    );
  }

  /**
   * 指定されたパスパターンでファクトリファイルを検索
   */
  public async searchFactoryFiles(
    factoryPaths: string[]
  ): Promise<vscode.Uri[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const allFiles: vscode.Uri[] = [];

    // 各パスパターンを処理
    for (const pathPattern of factoryPaths) {
      const normalizedPattern = normalizePath(pathPattern);

      // パターンごとにファイル検索
      const pattern = new vscode.RelativePattern(
        workspaceFolders[0],
        normalizedPattern
      );

      try {
        const files = await vscode.workspace.findFiles(pattern);
        allFiles.push(...files);
      } catch (error) {
        console.warn(
          `Failed to search files with pattern: ${normalizedPattern}`,
          error
        );
      }
    }

    // 重複を除去
    return this.removeDuplicateFiles(allFiles);
  }

  /**
   * ファイルの重複を除去
   */
  private removeDuplicateFiles(files: vscode.Uri[]): vscode.Uri[] {
    const uniqueFiles = new Map<string, vscode.Uri>();

    files.forEach((file) => {
      const key = file.toString();
      if (!uniqueFiles.has(key)) {
        uniqueFiles.set(key, file);
      }
    });

    return Array.from(uniqueFiles.values());
  }

  /**
   * 指定されたファイルを優先順位でソート
   */
  public sortFilesByPriority(
    files: vscode.Uri[],
    priorityPatterns: string[]
  ): vscode.Uri[] {
    return files.sort((a, b) => {
      const aPriority = this.getFilePriority(a, priorityPatterns);
      const bPriority = this.getFilePriority(b, priorityPatterns);

      // 優先度が高いほど小さい値なので、昇順ソート
      return aPriority - bPriority;
    });
  }

  /**
   * ファイルの優先度を計算
   */
  private getFilePriority(
    file: vscode.Uri,
    priorityPatterns: string[]
  ): number {
    const filePath = normalizePath(file.fsPath);

    for (let i = 0; i < priorityPatterns.length; i++) {
      if (filePath.includes(priorityPatterns[i])) {
        return i; // インデックスが小さいほど高優先度
      }
    }

    return priorityPatterns.length; // どのパターンにも一致しない場合は最低優先度
  }

  /**
   * ファイル変更時のコールバックを登録
   */
  public onFileChange(callback: (uri: vscode.Uri) => void): void {
    this.onFileChangeCallbacks.push(callback);
  }

  /**
   * リソースのクリーンアップ
   */
  public dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];
    this.onFileChangeCallbacks = [];
  }
}
