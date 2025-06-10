/**
 * エラー通知とログ管理サービス
 * ユーザーフレンドリーなエラー通知とデバッグ用ログを提供
 */

import * as vscode from "vscode";

/**
 * エラーの重要度レベル
 */
export enum ErrorLevel {
  /** デバッグ情報 - 開発者のみ */
  DEBUG = "debug",
  /** 情報 - 通常の動作ログ */
  INFO = "info",
  /** 警告 - 機能の一部に問題があるが継続可能 */
  WARNING = "warning",
  /** エラー - 機能に問題があるがアプリケーションは継続 */
  ERROR = "error",
  /** 致命的エラー - アプリケーションの継続が困難 */
  FATAL = "fatal",
}

/**
 * エラー情報インターフェース
 */
export interface ErrorInfo {
  level: ErrorLevel;
  context: string;
  message: string;
  error?: Error;
  additionalInfo?: Record<string, unknown>;
  userMessage?: string;
  showToUser?: boolean;
  retry?: () => Promise<void>;
}

/**
 * エラー通知とログ管理を担当するクラス
 */
export class ErrorNotificationService {
  private outputChannel: vscode.OutputChannel;
  private isDebugMode: boolean = false;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel(
      "Rails FactoryBot Jump"
    );
  }

  /**
   * デバッグモードの設定
   */
  public setDebugMode(enabled: boolean): void {
    this.isDebugMode = enabled;
  }

  /**
   * エラー情報をログに記録し、必要に応じてユーザーに通知
   */
  public async logError(errorInfo: ErrorInfo): Promise<void> {
    // コンソールとアウトプットチャンネルにログ
    this.writeToLog(errorInfo);

    // ユーザーへの通知が必要な場合
    if (errorInfo.showToUser !== false) {
      await this.notifyUser(errorInfo);
    }
  }

  /**
   * ファイル読み込みエラーの処理
   */
  public async handleFileReadError(
    filePath: string,
    error: Error,
    context: string = "File Reading"
  ): Promise<void> {
    const errorInfo: ErrorInfo = {
      level: ErrorLevel.WARNING,
      context,
      message: `Failed to read file: ${filePath}`,
      error,
      userMessage: `Failed to read factory file "${this.getFileDisplayName(
        filePath
      )}". Please ensure the file exists and you have access permissions.`,
      showToUser: true,
    };

    await this.logError(errorInfo);
  }

  /**
   * 正規表現エラーの処理
   */
  public async handleRegexError(
    pattern: string,
    error: Error,
    context: string = "Regex Processing"
  ): Promise<void> {
    const errorInfo: ErrorInfo = {
      level: ErrorLevel.ERROR,
      context,
      message: `Regex processing error occurred: ${pattern}`,
      error,
      userMessage: `An error occurred while parsing factory definitions. Some factories may not be recognized correctly.`,
      showToUser: true,
    };

    await this.logError(errorInfo);
  }

  /**
   * 設定エラーの処理
   */
  public async handleConfigurationError(
    configKey: string,
    error: Error,
    context: string = "Configuration Loading"
  ): Promise<void> {
    const errorInfo: ErrorInfo = {
      level: ErrorLevel.WARNING,
      context,
      message: `Failed to load configuration: ${configKey}`,
      error,
      userMessage: `Failed to load configuration "${configKey}". Using default values. Please check your settings.`,
      showToUser: true,
    };

    await this.logError(errorInfo);
  }

  /**
   * キャッシュエラーの処理
   */
  public async handleCacheError(
    operation: string,
    error: Error,
    context: string = "Cache Operation"
  ): Promise<void> {
    const errorInfo: ErrorInfo = {
      level: ErrorLevel.WARNING,
      context,
      message: `Cache operation failed: ${operation}`,
      error,
      userMessage: `Failed to update factory cache. Some factory links may not display correctly.`,
      showToUser: false, // キャッシュエラーは通常ユーザーに表示しない
    };

    await this.logError(errorInfo);
  }

  /**
   * 安全なファイル操作ラッパー
   */
  public async safeFileOperation<T>(
    operation: () => Promise<T>,
    fallback: T,
    context: string,
    filePath?: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const errorInfo: ErrorInfo = {
        level: ErrorLevel.WARNING,
        context,
        message: `File operation failed${filePath ? `: ${filePath}` : ""}`,
        error: error as Error,
        showToUser: false,
      };

      await this.logError(errorInfo);
      return fallback;
    }
  }

  /**
   * 再試行付きの操作実行
   */
  public async retryOperation<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 1000,
    context: string = "Operation"
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        const errorInfo: ErrorInfo = {
          level: attempt === maxAttempts ? ErrorLevel.ERROR : ErrorLevel.DEBUG,
          context,
          message: `${context} attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`,
          error: lastError,
          showToUser: false,
        };

        await this.logError(errorInfo);

        if (attempt === maxAttempts) {
          break;
        }

        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `${context} failed after ${maxAttempts} attempts: ${lastError?.message}`
    );
  }

  /**
   * ログの書き込み
   */
  private writeToLog(errorInfo: ErrorInfo): void {
    const timestamp = new Date().toISOString();
    const levelIcon = this.getLevelIcon(errorInfo.level);
    const logMessage = `[${timestamp}] ${levelIcon} ${errorInfo.context}: ${errorInfo.message}`;

    // コンソールログ
    this.writeToConsole(errorInfo);

    // アウトプットチャンネルログ
    this.outputChannel.appendLine(logMessage);

    if (errorInfo.error) {
      this.outputChannel.appendLine(
        `  Error Details: ${errorInfo.error.message}`
      );
      if (errorInfo.error.stack) {
        this.outputChannel.appendLine(
          `  Stack Trace: ${errorInfo.error.stack}`
        );
      }
    }

    if (errorInfo.additionalInfo) {
      this.outputChannel.appendLine(
        `  Additional Info: ${JSON.stringify(
          errorInfo.additionalInfo,
          null,
          2
        )}`
      );
    }
  }

  /**
   * コンソールログの書き込み
   */
  private writeToConsole(errorInfo: ErrorInfo): void {
    const logArgs = [
      `${this.getLevelIcon(errorInfo.level)} ${errorInfo.context}: ${
        errorInfo.message
      }`,
    ];

    if (errorInfo.additionalInfo) {
      logArgs.push(JSON.stringify(errorInfo.additionalInfo));
    }

    switch (errorInfo.level) {
      case ErrorLevel.DEBUG:
        if (this.isDebugMode) {
          console.debug(...logArgs);
        }
        break;
      case ErrorLevel.INFO:
        console.info(...logArgs);
        break;
      case ErrorLevel.WARNING:
        console.warn(...logArgs);
        break;
      case ErrorLevel.ERROR:
      case ErrorLevel.FATAL:
        console.error(...logArgs);
        if (errorInfo.error) {
          console.error(errorInfo.error);
        }
        break;
    }
  }

  /**
   * ユーザーへの通知
   */
  private async notifyUser(errorInfo: ErrorInfo): Promise<void> {
    if (!errorInfo.userMessage) {
      return;
    }

    let action: string | undefined;

    switch (errorInfo.level) {
      case ErrorLevel.WARNING: {
        action = await vscode.window.showWarningMessage(
          errorInfo.userMessage,
          "Show Details",
          "Ignore"
        );
        break;
      }
      case ErrorLevel.ERROR:
      case ErrorLevel.FATAL: {
        const actions = ["Show Details"];
        if (errorInfo.retry) {
          actions.unshift("Retry");
        }

        action = await vscode.window.showErrorMessage(
          errorInfo.userMessage,
          ...actions
        );
        break;
      }
    }

    // ユーザーアクションの処理
    if (action === "Show Details") {
      this.outputChannel.show();
    } else if (action === "Retry" && errorInfo.retry) {
      try {
        await errorInfo.retry();
      } catch (error) {
        await this.logError({
          level: ErrorLevel.ERROR,
          context: "Retry",
          message: "Retry also failed",
          error: error as Error,
          userMessage: "Retry was attempted but the same error occurred.",
          showToUser: true,
        });
      }
    }
  }

  /**
   * エラーレベルのアイコンを取得
   */
  private getLevelIcon(level: ErrorLevel): string {
    switch (level) {
      case ErrorLevel.DEBUG:
        return "🐛";
      case ErrorLevel.INFO:
        return "ℹ️";
      case ErrorLevel.WARNING:
        return "⚠️";
      case ErrorLevel.ERROR:
        return "❌";
      case ErrorLevel.FATAL:
        return "💥";
      default:
        return "📝";
    }
  }

  /**
   * ファイル表示名を取得（フルパスではなく相対パス）
   */
  private getFileDisplayName(filePath: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return filePath;
    }

    for (const folder of workspaceFolders) {
      const folderPath = folder.uri.fsPath;
      if (filePath.startsWith(folderPath)) {
        return filePath.substring(folderPath.length + 1);
      }
    }

    return filePath;
  }

  /**
   * リソースのクリーンアップ
   */
  public dispose(): void {
    this.outputChannel.dispose();
  }
}
