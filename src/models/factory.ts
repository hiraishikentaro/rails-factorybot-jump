/**
 * ファクトリ定義のデータ構造を表現するモデル
 */

import { Location } from "./location";
import { Trait } from "./trait";

/**
 * ファクトリ定義を表現するクラス
 */
export class Factory {
  /**
   * ファクトリ名
   */
  public readonly name: string;

  /**
   * ファクトリの定義位置
   */
  public readonly location: Location;

  /**
   * 継承元ファクトリ（オプション）
   */
  public readonly parentFactory?: string;

  /**
   * 関連するトレイトのリスト
   */
  private traits: Map<string, Trait>;

  constructor(name: string, location: Location, parentFactory?: string) {
    this.name = name;
    this.location = location;
    this.parentFactory = parentFactory;
    this.traits = new Map();
  }

  /**
   * トレイトを追加
   */
  public addTrait(trait: Trait): void {
    this.traits.set(trait.name, trait);
  }

  /**
   * トレイトを取得
   */
  public getTrait(traitName: string): Trait | undefined {
    return this.traits.get(traitName);
  }

  /**
   * すべてのトレイトを取得
   */
  public getAllTraits(): Trait[] {
    return Array.from(this.traits.values());
  }

  /**
   * トレイトが存在するかどうかを確認
   */
  public hasTrait(traitName: string): boolean {
    return this.traits.has(traitName);
  }

  /**
   * トレイト数を取得
   */
  public getTraitCount(): number {
    return this.traits.size;
  }

  /**
   * ファクトリの文字列表現を取得
   */
  public toString(): string {
    const parent = this.parentFactory ? ` extends ${this.parentFactory}` : "";
    const traitCount = this.getTraitCount();
    const traitInfo = traitCount > 0 ? ` (${traitCount} traits)` : "";
    return `Factory: ${
      this.name
    }${parent} at ${this.location.toString()}${traitInfo}`;
  }

  /**
   * ファクトリが等しいかどうかを判定
   */
  public equals(other: Factory): boolean {
    return (
      this.name === other.name &&
      this.location.equals(other.location) &&
      this.parentFactory === other.parentFactory
    );
  }
}
