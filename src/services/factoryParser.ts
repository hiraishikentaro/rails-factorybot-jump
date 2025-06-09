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

/**
 * ファクトリ解析結果
 */
export interface ParseResult {
  factories: Factory[];
  traits: Trait[];
}

/**
 * ファクトリ解析を担当するクラス
 */
export class FactoryParser {
  /**
   * ファイルからファクトリとトレイトを解析
   */
  public async parseFile(fileUri: vscode.Uri): Promise<ParseResult> {
    try {
      // ファイル内容を読み込み
      const content = await vscode.workspace.fs.readFile(fileUri);
      const text = new TextDecoder().decode(content);

      return this.parseText(text, fileUri);
    } catch (error) {
      console.warn(`Failed to parse factory file: ${fileUri.fsPath}`, error);
      return { factories: [], traits: [] };
    }
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
    const regex = new RegExp(
      FACTORY_DEFINITION_PATTERN.source,
      FACTORY_DEFINITION_PATTERN.flags
    );

    let match;
    while ((match = regex.exec(text)) !== null) {
      const factoryName = match[1];

      // 行番号を計算
      const lineNumber = this.calculateLineNumber(text, match.index);

      // Location オブジェクトを作成
      const location = new Location(fileUri, lineNumber);

      // Factory オブジェクトを作成
      const factory = new Factory(factoryName, location);
      factories.push(factory);
    }

    return factories;
  }

  /**
   * トレイト定義を検索
   */
  private findTraitDefinitions(text: string, fileUri: vscode.Uri): Trait[] {
    const traits: Trait[] = [];

    // ファクトリブロック内のトレイトを検索
    const factoryBlockRegex = new RegExp(
      FACTORY_BLOCK_PATTERN.source,
      FACTORY_BLOCK_PATTERN.flags
    );

    let factoryMatch;
    while ((factoryMatch = factoryBlockRegex.exec(text)) !== null) {
      const factoryName = factoryMatch[1];
      const factoryBlock = factoryMatch[2];
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
        const traitIndex = factoryStartIndex + traitMatch.index;
        const lineNumber = this.calculateLineNumber(text, traitIndex);

        // Location オブジェクトを作成
        const location = new Location(fileUri, lineNumber);

        // Trait オブジェクトを作成
        const trait = new Trait(traitName, location, factoryName);
        traits.push(trait);
      }
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
   * 複数のファイルを一括解析
   */
  public async parseMultipleFiles(
    fileUris: vscode.Uri[]
  ): Promise<ParseResult> {
    const allFactories: Factory[] = [];
    const allTraits: Trait[] = [];

    // 並列処理で高速化
    const parsePromises = fileUris.map((uri) => this.parseFile(uri));
    const results = await Promise.all(parsePromises);

    // 結果をマージ
    results.forEach((result) => {
      allFactories.push(...result.factories);
      allTraits.push(...result.traits);
    });

    return { factories: allFactories, traits: allTraits };
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
      names.push(match[1]);
    }

    return names;
  }
}
