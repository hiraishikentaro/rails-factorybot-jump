/**
 * トレイト定義のデータ構造を表現するモデル
 */

import { Location } from "./location";

/**
 * トレイト定義を表現するクラス
 */
export class Trait {
  /**
   * トレイト名
   */
  public readonly name: string;

  /**
   * トレイトの定義位置
   */
  public readonly location: Location;

  /**
   * 所属するファクトリ名
   */
  public readonly factoryName: string;

  constructor(name: string, location: Location, factoryName: string) {
    this.name = name;
    this.location = location;
    this.factoryName = factoryName;
  }

  /**
   * トレイトのユニークキーを取得
   * ファクトリ名とトレイト名の組み合わせ
   */
  public getKey(): string {
    return `${this.factoryName}:${this.name}`;
  }

  /**
   * トレイトの文字列表現を取得
   */
  public toString(): string {
    return `Trait: ${this.name} in factory ${
      this.factoryName
    } at ${this.location.toString()}`;
  }

  /**
   * トレイトが等しいかどうかを判定
   */
  public equals(other: Trait): boolean {
    return (
      this.name === other.name &&
      this.factoryName === other.factoryName &&
      this.location.equals(other.location)
    );
  }
}
