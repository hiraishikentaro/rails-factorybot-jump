/**
 * ファイル内の位置情報を表現するモデル
 */

import * as vscode from "vscode";
import * as path from "path";

/**
 * ファイル内の位置情報を表現するクラス
 */
export class Location {
  /**
   * ファイルURI
   */
  public readonly uri: vscode.Uri;

  /**
   * 行番号（0ベース）
   */
  public readonly line: number;

  /**
   * 列番号（0ベース）（オプション）
   */
  public readonly column?: number;

  /**
   * 定義の長さ（オプション）
   */
  public readonly length?: number;

  constructor(uri: vscode.Uri, line: number, column?: number, length?: number) {
    this.uri = uri;
    this.line = line;
    this.column = column;
    this.length = length;
  }

  /**
   * VSCode Position オブジェクトを取得
   */
  public getPosition(): vscode.Position {
    return new vscode.Position(this.line, this.column || 0);
  }

  /**
   * VSCode Range オブジェクトを取得
   */
  public getRange(): vscode.Range {
    const start = this.getPosition();
    const end = this.length
      ? new vscode.Position(this.line, (this.column || 0) + this.length)
      : start;
    return new vscode.Range(start, end);
  }

  /**
   * 位置情報の文字列表現を取得
   */
  public toString(): string {
    const fileName = path.basename(this.uri.fsPath);
    return `${fileName}:${this.line + 1}:${(this.column || 0) + 1}`;
  }

  /**
   * 位置情報が等しいかどうかを判定
   */
  public equals(other: Location): boolean {
    return (
      this.uri.toString() === other.uri.toString() &&
      this.line === other.line &&
      this.column === other.column &&
      this.length === other.length
    );
  }
}
