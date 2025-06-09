/**
 * Traitモデルの単体テスト
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { Trait } from "../../../models/trait";
import { Location } from "../../../models/location";

suite("Trait Model Tests", () => {
  let testUri: vscode.Uri;
  let testLocation: Location;

  setup(() => {
    testUri = vscode.Uri.file("/test/path/to/factory.rb");
    testLocation = new Location(testUri, 5, 10);
  });

  test("should create Trait with all parameters", () => {
    const trait = new Trait("admin", testLocation, "user");

    assert.strictEqual(trait.name, "admin");
    assert.strictEqual(trait.location, testLocation);
    assert.strictEqual(trait.factoryName, "user");
  });

  test("should return correct trait key", () => {
    const trait = new Trait("admin", testLocation, "user");
    const key = trait.getKey();

    assert.strictEqual(key, "user:admin");
  });

  test("should return correct string representation", () => {
    const trait = new Trait("admin", testLocation, "user");
    const str = trait.toString();

    assert.strictEqual(str, "Trait: admin in factory user at factory.rb:6:11");
  });

  test("should correctly compare equal traits", () => {
    const trait1 = new Trait("admin", testLocation, "user");
    const trait2 = new Trait("admin", testLocation, "user");

    assert.strictEqual(trait1.equals(trait2), true);
  });

  test("should correctly compare traits with different names", () => {
    const trait1 = new Trait("admin", testLocation, "user");
    const trait2 = new Trait("guest", testLocation, "user");

    assert.strictEqual(trait1.equals(trait2), false);
  });

  test("should correctly compare traits with different factory names", () => {
    const trait1 = new Trait("admin", testLocation, "user");
    const trait2 = new Trait("admin", testLocation, "post");

    assert.strictEqual(trait1.equals(trait2), false);
  });

  test("should correctly compare traits with different locations", () => {
    const location2 = new Location(testUri, 10, 20);
    const trait1 = new Trait("admin", testLocation, "user");
    const trait2 = new Trait("admin", location2, "user");

    assert.strictEqual(trait1.equals(trait2), false);
  });

  test("should handle trait names with underscores", () => {
    const trait = new Trait("super_admin", testLocation, "user_account");

    assert.strictEqual(trait.name, "super_admin");
    assert.strictEqual(trait.factoryName, "user_account");
    assert.strictEqual(trait.getKey(), "user_account:super_admin");
  });

  test("should handle trait names with numbers", () => {
    const trait = new Trait("level_1", testLocation, "game_user");

    assert.strictEqual(trait.name, "level_1");
    assert.strictEqual(trait.factoryName, "game_user");
    assert.strictEqual(trait.getKey(), "game_user:level_1");
  });
});
