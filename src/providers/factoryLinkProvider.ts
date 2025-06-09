import * as vscode from "vscode";
import { ConfigurationManager } from "../services/configurationManager";
import { FileSearcher } from "../services/fileSearcher";
import { FactoryParser } from "../services/factoryParser";
import { CacheManager } from "../services/cacheManager";
import {
  getFactoryCallPattern,
  TRAIT_REFERENCE_PATTERN,
} from "../utils/regexPatterns";
import { FACTORY_FILE_PRIORITY_ORDER } from "../constants/defaults";

/**
 * VSCode DocumentLinkProvider の実装
 * 新しいアーキテクチャに基づいて各サービスを利用してリンクを生成
 */
class FactoryLinkProvider implements vscode.DocumentLinkProvider {
  private configurationManager: ConfigurationManager;
  private fileSearcher: FileSearcher;
  private factoryParser: FactoryParser;
  private cacheManager: CacheManager;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // 各サービスを初期化
    this.configurationManager = new ConfigurationManager();
    this.fileSearcher = new FileSearcher();
    this.factoryParser = new FactoryParser();
    this.cacheManager = new CacheManager();

    // 設定変更時の処理を登録
    this.configurationManager.onConfigurationChange(() => {
      this.handleConfigurationChange();
    });

    // ファイル変更時の処理を登録
    this.fileSearcher.onFileChange((uri) => {
      this.handleFileChange(uri);
    });

    // 自動初期化が有効な場合は初期化を実行
    if (this.configurationManager.isAutoInitializeEnabled()) {
      this.initializeFactoryFiles();
    }
  }

  /**
   * ファクトリファイルの初期化
   */
  async initializeFactoryFiles(): Promise<void> {
    if (this.cacheManager.getIsInitialized()) {
      return;
    }

    try {
      // 設定からファクトリパスを取得
      const factoryPaths = this.configurationManager.getFactoryPaths();

      // ファクトリファイルを検索
      const factoryFiles = await this.fileSearcher.searchFactoryFiles(
        factoryPaths
      );

      // 優先順位でソート
      const sortedFiles = this.fileSearcher.sortFilesByPriority(
        factoryFiles,
        FACTORY_FILE_PRIORITY_ORDER
      );

      // すべてのキャッシュをクリア
      this.cacheManager.clearAll();

      // ファイルを解析してキャッシュに追加
      await this.parseAndCacheFiles(sortedFiles);

      // 初期化完了を設定
      this.cacheManager.setInitialized(true);

      if (this.configurationManager.isDebugMode()) {
        const stats = this.cacheManager.getCacheStats();
        console.log(
          `Factory initialization completed: ${stats.factoryCount} factories, ${stats.traitCount} traits`
        );
      }
    } catch (error) {
      console.error("Failed to initialize factory files:", error);
    }
  }

  /**
   * ファイルを解析してキャッシュに追加
   */
  private async parseAndCacheFiles(files: vscode.Uri[]): Promise<void> {
    // 解析結果を取得
    const parseResult = await this.factoryParser.parseMultipleFiles(files);

    // キャッシュに追加（先に見つかったファクトリが優先される）
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
  }

  /**
   * 設定変更時の処理
   */
  private handleConfigurationChange(): void {
    if (this.configurationManager.isDebugMode()) {
      console.log("Configuration changed, reinitializing factory files");
    }

    // キャッシュタイムアウトを更新
    const cacheTimeout = this.configurationManager.getCacheTimeout() * 1000; // 秒をミリ秒に変換
    this.cacheManager.setCacheTimeout(cacheTimeout);

    // 再初期化
    this.cacheManager.setInitialized(false);
    this.initializeFactoryFiles();
  }

  /**
   * ファイル変更時の処理
   */
  private async handleFileChange(uri: vscode.Uri): Promise<void> {
    if (this.configurationManager.isDebugMode()) {
      console.log(`Factory file changed: ${uri.fsPath}`);
    }

    // 変更されたファイルを再解析
    const parseResult = await this.factoryParser.parseFile(uri);

    // 既存のキャッシュから該当ファクトリを削除して再キャッシュ
    parseResult.factories.forEach((factory) => {
      this.cacheManager.removeFactory(factory.name);
      this.cacheManager.cacheFactory(factory);
    });

    parseResult.traits.forEach((trait) => {
      this.cacheManager.cacheTrait(trait);
    });
  }

  /**
   * VSCode DocumentLinkProvider のメイン実装
   */
  async provideDocumentLinks(
    document: vscode.TextDocument
  ): Promise<vscode.DocumentLink[]> {
    // 初期化されていない場合は空配列を返す
    if (!this.cacheManager.getIsInitialized()) {
      return [];
    }

    const links: vscode.DocumentLink[] = [];
    const text = document.getText();

    // ファクトリ呼び出しを検出
    const factoryCallRegex = getFactoryCallPattern();
    let match;

    while ((match = factoryCallRegex.exec(text)) !== null) {
      const fullMatch = match[1]; // ファクトリ名とトレイトの部分
      const factoryName = match[2].substring(1); // :プレフィックスを除去

      // ファクトリ名のリンクを作成
      const factoryNameMatch = match[2];
      const factoryNameStart = match.index + match[0].indexOf(factoryNameMatch);
      const factoryNameEnd = factoryNameStart + factoryNameMatch.length;
      const factoryRange = new vscode.Range(
        document.positionAt(factoryNameStart),
        document.positionAt(factoryNameEnd)
      );

      // キャッシュからファクトリ情報を取得
      const factoryInfo = this.cacheManager.getFactoryFileLocation(factoryName);
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
      const traitRegex = new RegExp(
        TRAIT_REFERENCE_PATTERN.source,
        TRAIT_REFERENCE_PATTERN.flags
      );
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
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];
  }
}

export { FactoryLinkProvider };
