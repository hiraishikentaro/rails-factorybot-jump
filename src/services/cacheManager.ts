/**
 * ファクトリとトレイトの位置情報のキャッシュ管理サービス
 */

import * as vscode from "vscode";
import { Factory } from "../models/factory";
import { Trait } from "../models/trait";

/**
 * キャッシュされたファクトリ情報
 */
interface CachedFactoryInfo {
  factory: Factory;
  timestamp: number;
}

/**
 * キャッシュされたトレイト情報
 */
interface CachedTraitInfo {
  trait: Trait;
  timestamp: number;
}

/**
 * File-based cache tracking for optimized updates
 */
interface FileCacheInfo {
  uri: string;
  lastModified: number;
  factories: string[];
  traits: string[];
}

/**
 * キャッシュ管理を担当するクラス
 */
export class CacheManager {
  private factoryCache: Map<string, CachedFactoryInfo> = new Map();
  private traitCache: Map<string, CachedTraitInfo> = new Map();
  private fileCache: Map<string, FileCacheInfo> = new Map(); // File-based cache tracking
  private isInitialized = false;
  private cacheTimeout: number = 60000; // デフォルト1分

  constructor(cacheTimeoutMs?: number) {
    if (cacheTimeoutMs) {
      this.cacheTimeout = cacheTimeoutMs;
    }
  }

  /**
   * Cache factory with file tracking
   */
  public cacheFactory(factory: Factory): void {
    this.factoryCache.set(factory.name, {
      factory,
      timestamp: Date.now(),
    });

    // Track factory in file cache
    const fileUri = factory.location.uri.toString();
    this.addToFileCache(fileUri, factory.name, null);
  }

  /**
   * Cache trait with file tracking
   */
  public cacheTrait(trait: Trait): void {
    const key = trait.getKey();
    this.traitCache.set(key, {
      trait,
      timestamp: Date.now(),
    });

    // Track trait in file cache
    const fileUri = trait.location.uri.toString();
    this.addToFileCache(fileUri, null, key);
  }

  /**
   * Add factory or trait to file cache tracking
   */
  private addToFileCache(
    fileUri: string,
    factoryName: string | null,
    traitKey: string | null
  ): void {
    let fileInfo = this.fileCache.get(fileUri);
    if (!fileInfo) {
      fileInfo = {
        uri: fileUri,
        lastModified: Date.now(),
        factories: [],
        traits: [],
      };
      this.fileCache.set(fileUri, fileInfo);
    }

    if (factoryName && !fileInfo.factories.includes(factoryName)) {
      fileInfo.factories.push(factoryName);
    }
    if (traitKey && !fileInfo.traits.includes(traitKey)) {
      fileInfo.traits.push(traitKey);
    }
    fileInfo.lastModified = Date.now();
  }

  /**
   * Remove all cache entries for a specific file
   */
  public removeFileFromCache(fileUri: vscode.Uri): void {
    const uriString = fileUri.toString();
    const fileInfo = this.fileCache.get(uriString);

    if (fileInfo) {
      // Remove all factories from this file
      fileInfo.factories.forEach((factoryName) => {
        this.factoryCache.delete(factoryName);
      });

      // Remove all traits from this file
      fileInfo.traits.forEach((traitKey) => {
        this.traitCache.delete(traitKey);
      });

      // Remove file cache entry
      this.fileCache.delete(uriString);
    }
  }

  /**
   * Check if file needs to be updated based on modification time
   */
  public async shouldUpdateFile(fileUri: vscode.Uri): Promise<boolean> {
    const uriString = fileUri.toString();
    const fileInfo = this.fileCache.get(uriString);

    if (!fileInfo) {
      return true; // File not in cache, needs to be processed
    }

    try {
      const stat = await vscode.workspace.fs.stat(fileUri);
      return stat.mtime > fileInfo.lastModified;
    } catch (error) {
      // File might have been deleted, remove from cache
      this.removeFileFromCache(fileUri);
      return false;
    }
  }

  /**
   * Update cache for a specific file (optimized for individual file changes)
   */
  public updateFileCache(
    fileUri: vscode.Uri,
    factories: Factory[],
    traits: Trait[]
  ): void {
    // First remove existing cache entries for this file
    this.removeFileFromCache(fileUri);

    // Then add new entries
    factories.forEach((factory) => this.cacheFactory(factory));
    traits.forEach((trait) => this.cacheTrait(trait));
  }

  /**
   * Get cache statistics including file tracking
   */
  public getCacheStats(): {
    factoryCount: number;
    traitCount: number;
    fileCount: number;
    isInitialized: boolean;
    cacheTimeout: number;
  } {
    return {
      factoryCount: this.factoryCache.size,
      traitCount: this.traitCache.size,
      fileCount: this.fileCache.size,
      isInitialized: this.isInitialized,
      cacheTimeout: this.cacheTimeout,
    };
  }

  /**
   * ファクトリ名からファクトリ情報を取得
   */
  public getFactory(factoryName: string): Factory | undefined {
    const cached = this.factoryCache.get(factoryName);

    if (!cached) {
      return undefined;
    }

    // キャッシュの有効期限をチェック
    if (this.isCacheExpired(cached.timestamp)) {
      this.factoryCache.delete(factoryName);
      return undefined;
    }

    return cached.factory;
  }

  /**
   * トレイト名からトレイト情報を取得
   */
  public getTrait(factoryName: string, traitName: string): Trait | undefined {
    const key = `${factoryName}:${traitName}`;
    const cached = this.traitCache.get(key);

    if (!cached) {
      return undefined;
    }

    // キャッシュの有効期限をチェック
    if (this.isCacheExpired(cached.timestamp)) {
      this.traitCache.delete(key);
      return undefined;
    }

    return cached.trait;
  }

  /**
   * ファクトリファイルの位置情報を取得（旧形式との互換性）
   */
  public getFactoryFileLocation(
    factoryName: string
  ): { uri: vscode.Uri; lineNumber: number } | undefined {
    const factory = this.getFactory(factoryName);
    if (!factory) {
      return undefined;
    }

    return {
      uri: factory.location.uri,
      lineNumber: factory.location.line,
    };
  }

  /**
   * トレイトの位置情報を取得（旧形式との互換性）
   */
  public getTraitLocation(
    factoryName: string,
    traitName: string
  ): { uri: vscode.Uri; lineNumber: number; factoryName: string } | undefined {
    const trait = this.getTrait(factoryName, traitName);
    if (!trait) {
      return undefined;
    }

    return {
      uri: trait.location.uri,
      lineNumber: trait.location.line,
      factoryName: trait.factoryName,
    };
  }

  /**
   * すべてのファクトリをキャッシュに追加
   */
  public cacheFactories(factories: Factory[]): void {
    factories.forEach((factory) => this.cacheFactory(factory));
  }

  /**
   * すべてのトレイトをキャッシュに追加
   */
  public cacheTraits(traits: Trait[]): void {
    traits.forEach((trait) => this.cacheTrait(trait));
  }

  /**
   * 特定のファクトリをキャッシュから削除
   */
  public removeFactory(factoryName: string): void {
    this.factoryCache.delete(factoryName);

    // 関連するトレイトも削除
    const traitsToRemove: string[] = [];
    this.traitCache.forEach((cached, key) => {
      if (cached.trait.factoryName === factoryName) {
        traitsToRemove.push(key);
      }
    });

    traitsToRemove.forEach((key) => this.traitCache.delete(key));
  }

  /**
   * ファクトリキャッシュをクリア
   */
  public clearFactoryCache(): void {
    this.factoryCache.clear();
  }

  /**
   * トレイトキャッシュをクリア
   */
  public clearTraitCache(): void {
    this.traitCache.clear();
  }

  /**
   * すべてのキャッシュをクリア
   */
  public clearAll(): void {
    this.clearFactoryCache();
    this.clearTraitCache();
    this.fileCache.clear(); // Clear file cache as well
    this.isInitialized = false;
  }

  /**
   * 期限切れのキャッシュエントリを削除
   */
  public cleanupExpiredEntries(): void {
    const now = Date.now();

    // 期限切れファクトリの削除
    const factoriesToRemove: string[] = [];
    this.factoryCache.forEach((cached, key) => {
      if (this.isCacheExpired(cached.timestamp, now)) {
        factoriesToRemove.push(key);
      }
    });
    factoriesToRemove.forEach((key) => this.factoryCache.delete(key));

    // 期限切れトレイトの削除
    const traitsToRemove: string[] = [];
    this.traitCache.forEach((cached, key) => {
      if (this.isCacheExpired(cached.timestamp, now)) {
        traitsToRemove.push(key);
      }
    });
    traitsToRemove.forEach((key) => this.traitCache.delete(key));
  }

  /**
   * キャッシュが期限切れかどうかを判定
   */
  private isCacheExpired(timestamp: number, currentTime?: number): boolean {
    const now = currentTime || Date.now();
    return now - timestamp > this.cacheTimeout;
  }

  /**
   * 初期化状態を設定
   */
  public setInitialized(initialized: boolean): void {
    this.isInitialized = initialized;
  }

  /**
   * 初期化状態を取得
   */
  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * キャッシュタイムアウトを設定
   */
  public setCacheTimeout(timeoutMs: number): void {
    this.cacheTimeout = Math.max(timeoutMs, 1000); // 最小1秒
  }
}
