/**
 * Factoryモデルの単体テスト
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { Factory } from "../../../models/factory";
import { Trait } from "../../../models/trait";
import { Location } from "../../../models/location";

suite("Factory Model Tests", () => {
  let testUri: vscode.Uri;
  let testLocation: Location;
  let testFactory: Factory;

  setup(() => {
    testUri = vscode.Uri.file("/test/path/to/factory.rb");
    testLocation = new Location(testUri, 5, 10);
    testFactory = new Factory("user", testLocation);
  });

  test("should create Factory with required parameters", () => {
    const factory = new Factory("user", testLocation);

    assert.strictEqual(factory.name, "user");
    assert.strictEqual(factory.location, testLocation);
    assert.strictEqual(factory.parentFactory, undefined);
    assert.strictEqual(factory.getTraitCount(), 0);
  });

  test("should create Factory with parent factory", () => {
    const factory = new Factory("admin_user", testLocation, "user");

    assert.strictEqual(factory.name, "admin_user");
    assert.strictEqual(factory.location, testLocation);
    assert.strictEqual(factory.parentFactory, "user");
  });

  test("should add traits to factory", () => {
    const traitLocation = new Location(testUri, 10, 15);
    const trait = new Trait("admin", traitLocation, "user");

    testFactory.addTrait(trait);

    assert.strictEqual(testFactory.getTraitCount(), 1);
    assert.strictEqual(testFactory.hasTrait("admin"), true);
    assert.strictEqual(testFactory.getTrait("admin"), trait);
  });

  test("should handle multiple traits", () => {
    const trait1 = new Trait("admin", new Location(testUri, 10, 15), "user");
    const trait2 = new Trait("guest", new Location(testUri, 15, 20), "user");

    testFactory.addTrait(trait1);
    testFactory.addTrait(trait2);

    assert.strictEqual(testFactory.getTraitCount(), 2);
    assert.strictEqual(testFactory.hasTrait("admin"), true);
    assert.strictEqual(testFactory.hasTrait("guest"), true);
    assert.strictEqual(testFactory.hasTrait("nonexistent"), false);
  });

  test("should return all traits", () => {
    const trait1 = new Trait("admin", new Location(testUri, 10, 15), "user");
    const trait2 = new Trait("guest", new Location(testUri, 15, 20), "user");

    testFactory.addTrait(trait1);
    testFactory.addTrait(trait2);

    const allTraits = testFactory.getAllTraits();
    assert.strictEqual(allTraits.length, 2);
    assert.ok(allTraits.includes(trait1));
    assert.ok(allTraits.includes(trait2));
  });

  test("should replace trait with same name", () => {
    const trait1 = new Trait("admin", new Location(testUri, 10, 15), "user");
    const trait2 = new Trait("admin", new Location(testUri, 20, 25), "user");

    testFactory.addTrait(trait1);
    testFactory.addTrait(trait2);

    assert.strictEqual(testFactory.getTraitCount(), 1);
    assert.strictEqual(testFactory.getTrait("admin"), trait2);
  });

  test("should return undefined for non-existent trait", () => {
    assert.strictEqual(testFactory.getTrait("nonexistent"), undefined);
  });

  test("should return correct string representation without parent", () => {
    const str = testFactory.toString();
    assert.strictEqual(str, "Factory: user at factory.rb:6:11");
  });

  test("should return correct string representation with parent", () => {
    const factory = new Factory("admin_user", testLocation, "user");
    const str = factory.toString();
    assert.strictEqual(
      str,
      "Factory: admin_user extends user at factory.rb:6:11"
    );
  });

  test("should return correct string representation with traits", () => {
    const trait = new Trait("admin", new Location(testUri, 10, 15), "user");
    testFactory.addTrait(trait);

    const str = testFactory.toString();
    assert.strictEqual(str, "Factory: user at factory.rb:6:11 (1 traits)");
  });

  test("should correctly compare equal factories", () => {
    const factory1 = new Factory("user", testLocation);
    const factory2 = new Factory("user", testLocation);

    assert.strictEqual(factory1.equals(factory2), true);
  });

  test("should correctly compare factories with different names", () => {
    const factory1 = new Factory("user", testLocation);
    const factory2 = new Factory("post", testLocation);

    assert.strictEqual(factory1.equals(factory2), false);
  });

  test("should correctly compare factories with different locations", () => {
    const location2 = new Location(testUri, 10, 20);
    const factory1 = new Factory("user", testLocation);
    const factory2 = new Factory("user", location2);

    assert.strictEqual(factory1.equals(factory2), false);
  });

  test("should correctly compare factories with different parent factories", () => {
    const factory1 = new Factory("admin_user", testLocation, "user");
    const factory2 = new Factory("admin_user", testLocation, "person");

    assert.strictEqual(factory1.equals(factory2), false);
  });

  test("should handle factory names with underscores and numbers", () => {
    const factory = new Factory("user_profile_v2", testLocation);

    assert.strictEqual(factory.name, "user_profile_v2");
  });
});
