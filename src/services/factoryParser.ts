/**
 * Rubyファイルからファクトリとトレイトの定義を解析するサービス
 */

import * as vscode from "vscode";
import { Factory } from "../models/factory";
import { Trait } from "../models/trait";
import { Location } from "../models/location";
import {
  FACTORY_DEFINITION_PATTERN,
  TRAIT_DEFINITION_PATTERN,
  FACTORY_BLOCK_PATTERN,
} from "../utils/regexPatterns";
import {
  ErrorNotificationService,
  ErrorLevel,
} from "./errorNotificationService";

/**
 * ファクトリ解析結果
 */
export interface ParseResult {
  factories: Factory[];
  traits: Trait[];
}

const BATCH_SIZE = 10;

/**
 * ファクトリ解析を担当するクラス
 */
export class FactoryParser {
  private errorNotificationService: ErrorNotificationService;
  private batchSize: number = BATCH_SIZE; // Default batch size

  constructor(
    errorNotificationService?: ErrorNotificationService,
    batchSize?: number
  ) {
    this.errorNotificationService =
      errorNotificationService || new ErrorNotificationService();
    if (batchSize) {
      this.batchSize = batchSize;
    }
  }

  /**
   * Set batch size for parallel processing
   */
  public setBatchSize(batchSize: number): void {
    this.batchSize = Math.min(Math.max(batchSize, 1), 50);
  }

  /**
   * ファイルからファクトリとトレイトを解析
   */
  public async parseFile(fileUri: vscode.Uri): Promise<ParseResult> {
    return await this.errorNotificationService.safeFileOperation(
      async () => {
        // ファイル内容を読み込み
        const content = await vscode.workspace.fs.readFile(fileUri);
        const text = new TextDecoder().decode(content);

        return this.parseText(text, fileUri);
      },
      { factories: [], traits: [] },
      "Factory File Parsing",
      fileUri.fsPath
    );
  }

  /**
   * テキストからファクトリとトレイトを解析
   */
  public parseText(text: string, fileUri: vscode.Uri): ParseResult {
    const factories: Factory[] = [];
    const traits: Trait[] = [];

    // ファクトリ定義を検索
    const factoryMatches = this.findFactoryDefinitions(text, fileUri);
    factories.push(...factoryMatches);

    // 各ファクトリ内のトレイトを検索
    const traitMatches = this.findTraitDefinitions(text, fileUri);
    traits.push(...traitMatches);

    // ファクトリとトレイトの関連付け
    this.linkTraitsToFactories(factories, traits);

    return { factories, traits };
  }

  /**
   * ファクトリ定義を検索
   */
  private findFactoryDefinitions(text: string, fileUri: vscode.Uri): Factory[] {
    const factories: Factory[] = [];

    try {
      const regex = new RegExp(
        FACTORY_DEFINITION_PATTERN.source,
        FACTORY_DEFINITION_PATTERN.flags
      );

      let match;
      while ((match = regex.exec(text)) !== null) {
        try {
          // マッチした内容の検証
          if (!match[2]) {
            continue; // ファクトリ名がない場合はスキップ
          }

          const factoryName = match[2];

          // 行番号を計算
          const lineNumber = this.calculateLineNumber(text, match.index);

          // Location オブジェクトを作成
          const location = new Location(fileUri, lineNumber);

          // Factory オブジェクトを作成
          const factory = new Factory(factoryName, location);
          factories.push(factory);
        } catch (error) {
          // 個別のファクトリ処理エラーをログに記録し、処理を継続
          this.errorNotificationService.logError({
            level: ErrorLevel.WARNING,
            context: "Factory Definition Parsing",
            message: `Failed to parse factory definition: ${match[0]}`,
            error: error as Error,
            showToUser: false,
            additionalInfo: {
              filePath: fileUri.fsPath,
              matchedText: match[0],
              matchIndex: match.index,
            },
          });
        }
      }
    } catch (error) {
      // 正規表現エラーの処理
      this.errorNotificationService.handleRegexError(
        FACTORY_DEFINITION_PATTERN.source,
        error as Error,
        `Factory Definition Search - ${fileUri.fsPath}`
      );
    }

    return factories;
  }

  /**
   * トレイト定義を検索
   */
  private findTraitDefinitions(text: string, fileUri: vscode.Uri): Trait[] {
    const traits: Trait[] = [];

    try {
      // ファクトリブロック内のトレイトを検索
      const factoryBlockRegex = new RegExp(
        FACTORY_BLOCK_PATTERN.source,
        FACTORY_BLOCK_PATTERN.flags
      );

      let factoryMatch;
      while ((factoryMatch = factoryBlockRegex.exec(text)) !== null) {
        const factoryName = factoryMatch[1]; // インデックスを1に修正
        const factoryBlock = factoryMatch[2]; // インデックスを2に修正
        const factoryStartIndex = factoryMatch.index;

        // このファクトリブロック内のトレイトを検索
        const traitRegex = new RegExp(
          TRAIT_DEFINITION_PATTERN.source,
          TRAIT_DEFINITION_PATTERN.flags
        );

        let traitMatch;
        while ((traitMatch = traitRegex.exec(factoryBlock)) !== null) {
          const traitName = traitMatch[1];

          // 絶対位置を計算
          // ファクトリブロック開始位置 + factoryMatch[0]の長さから実際のブロック開始を取得
          const factoryHeaderLength = factoryMatch[0].indexOf(factoryMatch[2]);
          const traitIndex =
            factoryStartIndex + factoryHeaderLength + traitMatch.index;
          const lineNumber = this.calculateLineNumber(text, traitIndex);

          // Location オブジェクトを作成
          const location = new Location(fileUri, lineNumber);

          // Trait オブジェクトを作成
          const trait = new Trait(traitName, location, factoryName);
          traits.push(trait);
        }
      }
    } catch (error) {
      // 正規表現エラーの処理
      this.errorNotificationService.handleRegexError(
        TRAIT_DEFINITION_PATTERN.source,
        error as Error,
        `Trait Definition Search - ${fileUri.fsPath}`
      );
    }

    return traits;
  }

  /**
   * テキスト内の位置から行番号を計算
   */
  private calculateLineNumber(text: string, index: number): number {
    const textUntilIndex = text.substring(0, index);
    const lines = textUntilIndex.split("\n");
    return lines.length - 1; // 0ベースの行番号
  }

  /**
   * トレイトをファクトリに関連付け
   */
  private linkTraitsToFactories(factories: Factory[], traits: Trait[]): void {
    // ファクトリ名でマップを作成
    const factoryMap = new Map<string, Factory>();
    factories.forEach((factory) => {
      factoryMap.set(factory.name, factory);
    });

    // 各トレイトを対応するファクトリに追加
    traits.forEach((trait) => {
      const factory = factoryMap.get(trait.factoryName);
      if (factory) {
        factory.addTrait(trait);
      }
    });
  }

  /**
   * Parse multiple files in parallel with optimized batch processing
   */
  public async parseMultipleFiles(
    fileUris: vscode.Uri[]
  ): Promise<ParseResult> {
    const allFactories: Factory[] = [];
    const allTraits: Trait[] = [];

    if (fileUris.length === 0) {
      return { factories: allFactories, traits: allTraits };
    }

    // Process files in batches to avoid overwhelming the system
    const batches = this.createBatches(fileUris, this.batchSize);

    for (const batch of batches) {
      try {
        // Parallel processing within each batch
        const parsePromises = batch.map((uri) => this.safeParseFile(uri));
        const results = await Promise.all(parsePromises);

        // Merge successful results
        results.forEach((result) => {
          if (result) {
            allFactories.push(...result.factories);
            allTraits.push(...result.traits);
          }
        });
      } catch (error) {
        // Log batch processing error but continue with other batches
        this.errorNotificationService.logError({
          level: ErrorLevel.WARNING,
          context: "Batch File Parsing",
          message: `Failed to process file batch`,
          error: error as Error,
          showToUser: false,
          additionalInfo: {
            batchSize: batch.length,
            fileNames: batch.map((uri) => uri.fsPath),
          },
        });
      }
    }

    return { factories: allFactories, traits: allTraits };
  }

  /**
   * Create batches from file URIs for optimized processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Safely parse a file with error handling
   */
  private async safeParseFile(
    fileUri: vscode.Uri
  ): Promise<ParseResult | null> {
    try {
      return await this.parseFile(fileUri);
    } catch (error) {
      // Log individual file parsing error
      this.errorNotificationService.logError({
        level: ErrorLevel.WARNING,
        context: "Individual File Parsing",
        message: `Failed to parse file: ${fileUri.fsPath}`,
        error: error as Error,
        showToUser: false,
        additionalInfo: {
          filePath: fileUri.fsPath,
        },
      });
      return null;
    }
  }

  /**
   * ファクトリ定義の存在確認
   */
  public hasFactoryDefinition(text: string): boolean {
    const regex = new RegExp(
      FACTORY_DEFINITION_PATTERN.source,
      FACTORY_DEFINITION_PATTERN.flags
    );
    return regex.test(text);
  }

  /**
   * ファクトリ名の一覧を取得
   */
  public extractFactoryNames(text: string): string[] {
    const names: string[] = [];
    const regex = new RegExp(
      FACTORY_DEFINITION_PATTERN.source,
      FACTORY_DEFINITION_PATTERN.flags
    );

    let match;
    while ((match = regex.exec(text)) !== null) {
      names.push(match[2]); // インデックスを修正
    }

    return names;
  }
}
