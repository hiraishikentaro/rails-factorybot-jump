/**
 * 拡張機能の設定管理サービス
 */

import * as vscode from "vscode";
import { CONFIG_SECTION, DEFAULT_FACTORY_PATHS } from "../constants/defaults";

/**
 * 設定管理を担当するクラス
 */
export class ConfigurationManager {
  private disposables: vscode.Disposable[] = [];
  private onConfigurationChangeCallbacks: (() => void)[] = [];

  constructor() {
    // 設定変更の監視を開始
    this.startWatchingConfiguration();
  }

  /**
   * 設定変更の監視を開始
   */
  private startWatchingConfiguration(): void {
    const configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_SECTION)) {
        // 設定変更コールバックを実行
        this.onConfigurationChangeCallbacks.forEach((callback) => callback());
      }
    });

    this.disposables.push(configWatcher);
  }

  /**
   * ファクトリパスの設定を取得
   */
  public getFactoryPaths(): string[] {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const paths = config.get<string[]>("factoryPaths", DEFAULT_FACTORY_PATHS);

    // 設定値の検証
    return this.validateFactoryPaths(paths);
  }

  /**
   * ファクトリパスの設定値を検証
   */
  private validateFactoryPaths(paths: string[]): string[] {
    const validPaths = paths.filter((path) => {
      if (typeof path !== "string" || path.trim().length === 0) {
        console.warn(`Invalid factory path: ${path}`);
        return false;
      }
      return true;
    });

    // 有効なパスがない場合はデフォルトを使用
    return validPaths.length > 0 ? validPaths : DEFAULT_FACTORY_PATHS;
  }

  /**
   * デバッグモードの設定を取得
   */
  public isDebugMode(): boolean {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return config.get<boolean>("debugMode", false);
  }

  /**
   * 自動初期化の設定を取得
   */
  public isAutoInitializeEnabled(): boolean {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return config.get<boolean>("autoInitialize", true);
  }

  /**
   * キャッシュ有効期限の設定を取得（秒単位）
   */
  public getCacheTimeout(): number {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const timeout = config.get<number>("cacheTimeout", 60);

    // 最小値を設定（10秒）
    return Math.max(timeout, 10);
  }

  /**
   * 設定変更時のコールバックを登録
   */
  public onConfigurationChange(callback: () => void): void {
    this.onConfigurationChangeCallbacks.push(callback);
  }

  /**
   * リソースのクリーンアップ
   */
  public dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];
    this.onConfigurationChangeCallbacks = [];
  }
}
