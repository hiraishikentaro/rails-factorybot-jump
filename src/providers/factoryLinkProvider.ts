import * as vscode from "vscode";
import { ConfigurationManager } from "../services/configurationManager";
import { FileSearcher } from "../services/fileSearcher";
import { FactoryParser } from "../services/factoryParser";
import { CacheManager } from "../services/cacheManager";
import {
  ErrorNotificationService,
  ErrorLevel,
} from "../services/errorNotificationService";
import {
  getFactoryCallPattern,
  TRAIT_REFERENCE_PATTERN,
} from "../utils/regexPatterns";
import { FACTORY_FILE_PRIORITY_ORDER } from "../constants/defaults";

class FactoryLinkProvider implements vscode.DocumentLinkProvider {
  private configurationManager: ConfigurationManager;
  private fileSearcher: FileSearcher;
  private factoryParser: FactoryParser;
  private cacheManager: CacheManager;
  private errorNotificationService: ErrorNotificationService;
  private disposables: vscode.Disposable[] = [];

  // Initialization state management
  private isInitializing = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    // エラー通知サービスを最初に初期化
    this.errorNotificationService = new ErrorNotificationService();

    // 各サービスを初期化（エラー通知サービスを依存注入）
    this.configurationManager = new ConfigurationManager();
    this.fileSearcher = new FileSearcher(this.errorNotificationService);
    this.factoryParser = new FactoryParser(
      this.errorNotificationService,
      this.configurationManager.getParallelBatchSize()
    );
    this.cacheManager = new CacheManager();

    // 設定変更時の処理を登録
    this.configurationManager.onConfigurationChange(() => {
      this.handleConfigurationChange();
    });

    // デバッグモードの初期設定
    this.errorNotificationService.setDebugMode(
      this.configurationManager.isDebugMode()
    );

    // ファイル変更時の処理を登録
    this.fileSearcher.onFileChange((uri) => {
      this.handleFileChange(uri);
    });

    // 自動初期化が有効な場合は初期化を実行
    if (this.configurationManager.isAutoInitializeEnabled()) {
      this.initializeFactoryFilesAsync();
    }
  }

  /**
   * Start factory file initialization asynchronously
   */
  private initializeFactoryFilesAsync(): void {
    if (!this.initializationPromise && !this.cacheManager.getIsInitialized()) {
      this.initializationPromise = this.initializeFactoryFiles();
    }
  }

  /**
   * Initialize factory files with progress indicator
   */
  async initializeFactoryFiles(): Promise<void> {
    if (this.cacheManager.getIsInitialized() || this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Initializing Factory Bot files...",
          cancellable: false,
        },
        async (progress) => {
          progress.report({
            increment: 0,
            message: "Loading configuration...",
          });

          // 設定からファクトリパスを取得
          const factoryPaths = this.configurationManager.getFactoryPaths();

          progress.report({
            increment: 20,
            message: "Searching factory files...",
          });

          // ファクトリファイルを検索
          const factoryFiles = await this.fileSearcher.searchFactoryFiles(
            factoryPaths
          );

          progress.report({
            increment: 40,
            message: "Sorting files by priority...",
          });

          // 優先順位でソート
          const sortedFiles = this.fileSearcher.sortFilesByPriority(
            factoryFiles,
            FACTORY_FILE_PRIORITY_ORDER
          );

          progress.report({
            increment: 50,
            message: "Clearing cache...",
          });

          // すべてのキャッシュをクリア
          this.cacheManager.clearAll();

          progress.report({ increment: 60, message: "Parsing files..." });

          // ファイルを解析してキャッシュに追加（プログレス付き）
          await this.parseAndCacheFilesWithProgress(sortedFiles, progress);

          progress.report({
            increment: 90,
            message: "Finalizing initialization...",
          });

          // 初期化完了を設定
          this.cacheManager.setInitialized(true);

          progress.report({
            increment: 100,
            message: "Initialization complete",
          });

          if (this.configurationManager.isDebugMode()) {
            const stats = this.cacheManager.getCacheStats();
            console.log(
              `Factory initialization completed: ${stats.factoryCount} factories, ${stats.traitCount} traits`
            );
          }
        }
      );
    } catch (error) {
      await this.errorNotificationService.logError({
        level: ErrorLevel.ERROR,
        context: "Factory Initialization",
        message: "Failed to initialize factory files",
        error: error as Error,
        userMessage:
          "Failed to initialize factory files. Some factory links may not work correctly.",
        showToUser: true,
        retry: () => this.initializeFactoryFiles(),
      });
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  /**
   * Parse and cache files with progress reporting
   */
  private async parseAndCacheFilesWithProgress(
    files: vscode.Uri[],
    progress: vscode.Progress<{ increment?: number; message?: string }>
  ): Promise<void> {
    if (files.length === 0) {
      return;
    }

    // Report initial parsing progress
    progress.report({
      increment: 0,
      message: `Parsing ${files.length} factory files...`,
    });

    // Parse files with enhanced parallel processing
    const parseResult = await this.factoryParser.parseMultipleFiles(files);

    // Report caching progress
    progress.report({
      increment: 15,
      message: "Caching parsed factories...",
    });

    // Cache results with priority handling
    parseResult.factories.forEach((factory) => {
      if (!this.cacheManager.getFactory(factory.name)) {
        this.cacheManager.cacheFactory(factory);
      }
    });

    parseResult.traits.forEach((trait) => {
      if (!this.cacheManager.getTrait(trait.factoryName, trait.name)) {
        this.cacheManager.cacheTrait(trait);
      }
    });

    progress.report({
      increment: 15,
      message: `Cached ${parseResult.factories.length} factories and ${parseResult.traits.length} traits`,
    });
  }

  /**
   * Parse and cache files (legacy method for backward compatibility)
   */
  private async parseAndCacheFiles(files: vscode.Uri[]): Promise<void> {
    // Use the new method without progress reporting
    const dummyProgress: vscode.Progress<{
      increment?: number;
      message?: string;
    }> = {
      report: () => {}, // No-op progress reporter
    };
    await this.parseAndCacheFilesWithProgress(files, dummyProgress);
  }

  /**
   * 設定変更時の処理
   */
  private handleConfigurationChange(): void {
    // デバッグモードの同期
    this.errorNotificationService.setDebugMode(
      this.configurationManager.isDebugMode()
    );

    if (this.configurationManager.isDebugMode()) {
      console.log("Configuration changed, reinitializing factory files");
    }

    // キャッシュタイムアウトを更新
    const cacheTimeout = this.configurationManager.getCacheTimeout() * 1000; // 秒をミリ秒に変換
    this.cacheManager.setCacheTimeout(cacheTimeout);

    // Update parallel batch size
    this.factoryParser.setBatchSize(
      this.configurationManager.getParallelBatchSize()
    );

    // 再初期化
    this.cacheManager.setInitialized(false);
    this.isInitializing = false;
    this.initializationPromise = null;
    this.initializeFactoryFilesAsync();
  }

  /**
   * Handle file changes with optimized cache updates
   */
  private async handleFileChange(uri: vscode.Uri): Promise<void> {
    if (this.configurationManager.isDebugMode()) {
      console.log(`Factory file changed: ${uri.fsPath}`);
    }

    try {
      // Check if file actually needs to be updated
      const shouldUpdate = await this.cacheManager.shouldUpdateFile(uri);
      if (!shouldUpdate) {
        if (this.configurationManager.isDebugMode()) {
          console.log(`File ${uri.fsPath} is up to date, skipping update`);
        }
        return;
      }

      // Parse the changed file
      const parseResult = await this.factoryParser.parseFile(uri);

      // Update cache for this specific file (removes old entries and adds new ones)
      this.cacheManager.updateFileCache(
        uri,
        parseResult.factories,
        parseResult.traits
      );

      if (this.configurationManager.isDebugMode()) {
        console.log(
          `Updated cache for file: ${uri.fsPath} - ${parseResult.factories.length} factories, ${parseResult.traits.length} traits`
        );
      }
    } catch (error) {
      await this.errorNotificationService.logError({
        level: ErrorLevel.WARNING,
        context: "File Change Handling",
        message: `Failed to handle file change: ${uri.fsPath}`,
        error: error as Error,
        showToUser: false,
        additionalInfo: {
          filePath: uri.fsPath,
        },
      });
    }
  }

  /**
   * VSCode DocumentLinkProvider のメイン実装
   */
  async provideDocumentLinks(
    document: vscode.TextDocument
  ): Promise<vscode.DocumentLink[]> {
    // 初期化が完了していない場合の処理
    if (!this.cacheManager.getIsInitialized()) {
      // 初期化が開始されていない場合、非同期で開始
      if (!this.initializationPromise && !this.isInitializing) {
        this.initializeFactoryFilesAsync();
      }

      // 初期化中の場合、プログレスメッセージを表示してから空配列を返す
      if (this.isInitializing) {
        // Show initialization status in status bar
        vscode.window.setStatusBarMessage(
          "$(sync~spin) Initializing Factory Bot...",
          3000
        );
      }

      return [];
    }

    try {
      const links: vscode.DocumentLink[] = [];
      const text = document.getText();

      // ファクトリ呼び出しを検出
      let factoryCallRegex;
      try {
        factoryCallRegex = getFactoryCallPattern();
      } catch (error) {
        await this.errorNotificationService.handleRegexError(
          "factory call pattern",
          error as Error,
          `Factory Call Pattern - ${document.uri.fsPath}`
        );
        return [];
      }

      let match;
      while ((match = factoryCallRegex.exec(text)) !== null) {
        const fullMatch = match[1]; // ファクトリ名とトレイトの部分
        const factoryName = match[2].substring(1); // :プレフィックスを除去

        // ファクトリ名のリンクを作成
        const factoryNameMatch = match[2];
        const factoryNameStart =
          match.index + match[0].indexOf(factoryNameMatch);
        const factoryNameEnd = factoryNameStart + factoryNameMatch.length;
        const factoryRange = new vscode.Range(
          document.positionAt(factoryNameStart),
          document.positionAt(factoryNameEnd)
        );

        // キャッシュからファクトリ情報を取得
        const factoryInfo =
          this.cacheManager.getFactoryFileLocation(factoryName);
        if (factoryInfo) {
          const factoryLink = new vscode.DocumentLink(
            factoryRange,
            vscode.Uri.parse(
              `command:rails-factorybot-jump.gotoLine?${encodeURIComponent(
                JSON.stringify({
                  uri: factoryInfo.uri.toString(),
                  lineNumber: factoryInfo.lineNumber,
                })
              )}`
            )
          );
          factoryLink.tooltip = `Hold Cmd (Mac) or Ctrl (Windows) and click to jump to factory definition: ${factoryName}`;
          links.push(factoryLink);
        }

        // トレイトのリンクを検索・作成
        let traitRegex;
        try {
          traitRegex = new RegExp(
            TRAIT_REFERENCE_PATTERN.source,
            TRAIT_REFERENCE_PATTERN.flags
          );
        } catch (error) {
          await this.errorNotificationService.handleRegexError(
            TRAIT_REFERENCE_PATTERN.source,
            error as Error,
            `Trait Reference Pattern - ${document.uri.fsPath}`
          );
          continue; // この factory の処理をスキップして次へ
        }
        let traitMatch;
        traitRegex.lastIndex = 0; // リセット

        // 最初のマッチ（ファクトリ名）をスキップ
        traitRegex.exec(fullMatch);

        while ((traitMatch = traitRegex.exec(fullMatch)) !== null) {
          const traitName = traitMatch[1];

          // トレイトシンボルの絶対位置を計算
          const traitSymbolStart =
            match.index + match[0].indexOf(fullMatch) + traitMatch.index;
          const traitSymbolEnd = traitSymbolStart + traitMatch[0].length;
          const traitRange = new vscode.Range(
            document.positionAt(traitSymbolStart),
            document.positionAt(traitSymbolEnd)
          );

          // キャッシュからトレイト情報を取得
          const traitInfo = this.cacheManager.getTraitLocation(
            factoryName,
            traitName
          );
          if (traitInfo) {
            const traitLink = new vscode.DocumentLink(
              traitRange,
              vscode.Uri.parse(
                `command:rails-factorybot-jump.gotoLine?${encodeURIComponent(
                  JSON.stringify({
                    uri: traitInfo.uri.toString(),
                    lineNumber: traitInfo.lineNumber,
                  })
                )}`
              )
            );
            traitLink.tooltip = `Hold Cmd (Mac) or Ctrl (Windows) and click to jump to trait definition: ${traitName} in factory ${factoryName}`;
            links.push(traitLink);
          }
        }
      }

      return links;
    } catch (error) {
      await this.errorNotificationService.logError({
        level: ErrorLevel.ERROR,
        context: "Document Link Generation",
        message: "Failed to generate document links",
        error: error as Error,
        showToUser: false,
        additionalInfo: {
          documentUri: document.uri.toString(),
          languageId: document.languageId,
        },
      });

      // エラーが発生した場合は空配列を返す
      return [];
    }
  }

  /**
   * 指定されたファクトリ名のファイルを検索（後方互換性のため）
   */
  async findFactoryFile(factoryName: string): Promise<vscode.Uri | undefined> {
    // 初期化されていない場合は初期化を待つ
    if (!this.cacheManager.getIsInitialized()) {
      await this.initializeFactoryFiles();
    }

    // キャッシュからファクトリファイルを取得
    const factoryInfo = this.cacheManager.getFactoryFileLocation(factoryName);
    return factoryInfo?.uri;
  }

  /**
   * リソースのクリーンアップ
   */
  public dispose(): void {
    this.configurationManager.dispose();
    this.fileSearcher.dispose();
    this.errorNotificationService.dispose();
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];
  }
}

export { FactoryLinkProvider };
