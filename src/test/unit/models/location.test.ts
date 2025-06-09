/**
 * Locationモデルの単体テスト
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { Location } from "../../../models/location";

suite("Location Model Tests", () => {
  let testUri: vscode.Uri;

  setup(() => {
    testUri = vscode.Uri.file("/test/path/to/factory.rb");
  });

  test("should create Location with all parameters", () => {
    const location = new Location(testUri, 10, 5, 20);

    assert.strictEqual(location.uri, testUri);
    assert.strictEqual(location.line, 10);
    assert.strictEqual(location.column, 5);
    assert.strictEqual(location.length, 20);
  });

  test("should create Location with optional parameters", () => {
    const location = new Location(testUri, 10);

    assert.strictEqual(location.uri, testUri);
    assert.strictEqual(location.line, 10);
    assert.strictEqual(location.column, undefined);
    assert.strictEqual(location.length, undefined);
  });

  test("should return correct Position", () => {
    const location = new Location(testUri, 10, 5);
    const position = location.getPosition();

    assert.strictEqual(position.line, 10);
    assert.strictEqual(position.character, 5);
  });

  test("should return correct Position with default column", () => {
    const location = new Location(testUri, 10);
    const position = location.getPosition();

    assert.strictEqual(position.line, 10);
    assert.strictEqual(position.character, 0);
  });

  test("should return correct Range with length", () => {
    const location = new Location(testUri, 10, 5, 10);
    const range = location.getRange();

    assert.strictEqual(range.start.line, 10);
    assert.strictEqual(range.start.character, 5);
    assert.strictEqual(range.end.line, 10);
    assert.strictEqual(range.end.character, 15);
  });

  test("should return correct Range without length", () => {
    const location = new Location(testUri, 10, 5);
    const range = location.getRange();

    assert.strictEqual(range.start.line, 10);
    assert.strictEqual(range.start.character, 5);
    assert.strictEqual(range.end.line, 10);
    assert.strictEqual(range.end.character, 5);
  });

  test("should return correct string representation", () => {
    const location = new Location(testUri, 10, 5);
    const str = location.toString();

    assert.strictEqual(str, "factory.rb:11:6"); // 1-based indexing
  });

  test("should correctly compare equal locations", () => {
    const location1 = new Location(testUri, 10, 5, 20);
    const location2 = new Location(testUri, 10, 5, 20);

    assert.strictEqual(location1.equals(location2), true);
  });

  test("should correctly compare different locations", () => {
    const location1 = new Location(testUri, 10, 5, 20);
    const location2 = new Location(testUri, 11, 5, 20);

    assert.strictEqual(location1.equals(location2), false);
  });

  test("should correctly compare locations with different URIs", () => {
    const uri2 = vscode.Uri.file("/different/path/factory.rb");
    const location1 = new Location(testUri, 10, 5, 20);
    const location2 = new Location(uri2, 10, 5, 20);

    assert.strictEqual(location1.equals(location2), false);
  });
});
