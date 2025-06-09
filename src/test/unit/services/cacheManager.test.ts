/**
 * CacheManagerサービスの単体テスト
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { CacheManager } from "../../../services/cacheManager";
import { Factory } from "../../../models/factory";
import { Trait } from "../../../models/trait";
import { Location } from "../../../models/location";

suite("CacheManager Service Tests", () => {
  let cacheManager: CacheManager;
  let testUri: vscode.Uri;
  let testLocation: Location;

  setup(() => {
    cacheManager = new CacheManager();
    testUri = vscode.Uri.file("/test/path/to/factory.rb");
    testLocation = new Location(testUri, 10, 5);
  });

  teardown(() => {
    cacheManager.clearAll();
  });

  suite("Factory Caching", () => {
    test("should cache and retrieve factory", () => {
      const factory = new Factory("user", testLocation);

      cacheManager.cacheFactory(factory);
      const retrieved = cacheManager.getFactory("user");

      assert.strictEqual(retrieved, factory);
    });

    test("should return undefined for non-existent factory", () => {
      const retrieved = cacheManager.getFactory("nonexistent");
      assert.strictEqual(retrieved, undefined);
    });

    test("should cache multiple factories", () => {
      const userFactory = new Factory("user", testLocation);
      const postFactory = new Factory("post", new Location(testUri, 20, 10));

      cacheManager.cacheFactory(userFactory);
      cacheManager.cacheFactory(postFactory);

      assert.strictEqual(cacheManager.getFactory("user"), userFactory);
      assert.strictEqual(cacheManager.getFactory("post"), postFactory);
    });

    test("should override factory with same name", () => {
      const factory1 = new Factory("user", testLocation);
      const factory2 = new Factory("user", new Location(testUri, 20, 10));

      cacheManager.cacheFactory(factory1);
      cacheManager.cacheFactory(factory2);

      assert.strictEqual(cacheManager.getFactory("user"), factory2);
    });

    test("should remove factory from cache", () => {
      const factory = new Factory("user", testLocation);

      cacheManager.cacheFactory(factory);
      assert.ok(cacheManager.getFactory("user"));

      cacheManager.removeFactory("user");
      assert.strictEqual(cacheManager.getFactory("user"), undefined);
    });

    test("should cache multiple factories at once", () => {
      const factories = [
        new Factory("user", testLocation),
        new Factory("post", new Location(testUri, 20, 10)),
        new Factory("comment", new Location(testUri, 30, 15)),
      ];

      cacheManager.cacheFactories(factories);

      assert.ok(cacheManager.getFactory("user"));
      assert.ok(cacheManager.getFactory("post"));
      assert.ok(cacheManager.getFactory("comment"));
    });
  });

  suite("Trait Caching", () => {
    test("should cache and retrieve trait", () => {
      const trait = new Trait("admin", testLocation, "user");

      cacheManager.cacheTrait(trait);
      const retrieved = cacheManager.getTrait("user", "admin");

      assert.strictEqual(retrieved, trait);
    });

    test("should return undefined for non-existent trait", () => {
      const retrieved = cacheManager.getTrait("user", "nonexistent");
      assert.strictEqual(retrieved, undefined);
    });

    test("should cache multiple traits", () => {
      const adminTrait = new Trait("admin", testLocation, "user");
      const guestTrait = new Trait(
        "guest",
        new Location(testUri, 20, 10),
        "user"
      );

      cacheManager.cacheTrait(adminTrait);
      cacheManager.cacheTrait(guestTrait);

      assert.strictEqual(cacheManager.getTrait("user", "admin"), adminTrait);
      assert.strictEqual(cacheManager.getTrait("user", "guest"), guestTrait);
    });

    test("should remove traits when factory is removed", () => {
      const factory = new Factory("user", testLocation);
      const trait1 = new Trait("admin", testLocation, "user");
      const trait2 = new Trait("guest", new Location(testUri, 20, 10), "user");

      cacheManager.cacheFactory(factory);
      cacheManager.cacheTrait(trait1);
      cacheManager.cacheTrait(trait2);

      assert.ok(cacheManager.getTrait("user", "admin"));
      assert.ok(cacheManager.getTrait("user", "guest"));

      cacheManager.removeFactory("user");

      assert.strictEqual(cacheManager.getTrait("user", "admin"), undefined);
      assert.strictEqual(cacheManager.getTrait("user", "guest"), undefined);
    });

    test("should cache multiple traits at once", () => {
      const traits = [
        new Trait("admin", testLocation, "user"),
        new Trait("guest", new Location(testUri, 20, 10), "user"),
        new Trait("moderator", new Location(testUri, 30, 15), "user"),
      ];

      cacheManager.cacheTraits(traits);

      assert.ok(cacheManager.getTrait("user", "admin"));
      assert.ok(cacheManager.getTrait("user", "guest"));
      assert.ok(cacheManager.getTrait("user", "moderator"));
    });
  });

  suite("Legacy API Compatibility", () => {
    test("should return factory file location in legacy format", () => {
      const factory = new Factory("user", testLocation);
      cacheManager.cacheFactory(factory);

      const location = cacheManager.getFactoryFileLocation("user");

      assert.ok(location);
      assert.strictEqual(location.uri, testUri);
      assert.strictEqual(location.lineNumber, 10);
    });

    test("should return trait location in legacy format", () => {
      const trait = new Trait("admin", testLocation, "user");
      cacheManager.cacheTrait(trait);

      const location = cacheManager.getTraitLocation("user", "admin");

      assert.ok(location);
      assert.strictEqual(location.uri, testUri);
      assert.strictEqual(location.lineNumber, 10);
      assert.strictEqual(location.factoryName, "user");
    });

    test("should return undefined for non-existent factory in legacy format", () => {
      const location = cacheManager.getFactoryFileLocation("nonexistent");
      assert.strictEqual(location, undefined);
    });

    test("should return undefined for non-existent trait in legacy format", () => {
      const location = cacheManager.getTraitLocation("user", "nonexistent");
      assert.strictEqual(location, undefined);
    });
  });

  suite("Cache Management", () => {
    test("should clear factory cache", () => {
      const factory = new Factory("user", testLocation);
      cacheManager.cacheFactory(factory);

      assert.ok(cacheManager.getFactory("user"));
      cacheManager.clearFactoryCache();
      assert.strictEqual(cacheManager.getFactory("user"), undefined);
    });

    test("should clear trait cache", () => {
      const trait = new Trait("admin", testLocation, "user");
      cacheManager.cacheTrait(trait);

      assert.ok(cacheManager.getTrait("user", "admin"));
      cacheManager.clearTraitCache();
      assert.strictEqual(cacheManager.getTrait("user", "admin"), undefined);
    });

    test("should clear all caches", () => {
      const factory = new Factory("user", testLocation);
      const trait = new Trait("admin", testLocation, "user");

      cacheManager.cacheFactory(factory);
      cacheManager.cacheTrait(trait);
      cacheManager.setInitialized(true);

      assert.ok(cacheManager.getFactory("user"));
      assert.ok(cacheManager.getTrait("user", "admin"));
      assert.strictEqual(cacheManager.getIsInitialized(), true);

      cacheManager.clearAll();

      assert.strictEqual(cacheManager.getFactory("user"), undefined);
      assert.strictEqual(cacheManager.getTrait("user", "admin"), undefined);
      assert.strictEqual(cacheManager.getIsInitialized(), false);
    });

    test("should return correct cache stats", () => {
      const factory = new Factory("user", testLocation);
      const trait = new Trait("admin", testLocation, "user");

      cacheManager.cacheFactory(factory);
      cacheManager.cacheTrait(trait);
      cacheManager.setInitialized(true);

      const stats = cacheManager.getCacheStats();

      assert.strictEqual(stats.factoryCount, 1);
      assert.strictEqual(stats.traitCount, 1);
      assert.strictEqual(stats.isInitialized, true);
      assert.ok(stats.cacheTimeout > 0);
    });

    test("should handle initialization state", () => {
      assert.strictEqual(cacheManager.getIsInitialized(), false);

      cacheManager.setInitialized(true);
      assert.strictEqual(cacheManager.getIsInitialized(), true);

      cacheManager.setInitialized(false);
      assert.strictEqual(cacheManager.getIsInitialized(), false);
    });

    test("should set cache timeout", () => {
      const newTimeout = 30000; // 30秒
      cacheManager.setCacheTimeout(newTimeout);

      const stats = cacheManager.getCacheStats();
      assert.strictEqual(stats.cacheTimeout, newTimeout);
    });

    test("should enforce minimum cache timeout", () => {
      cacheManager.setCacheTimeout(500); // 0.5秒（最小値以下）

      const stats = cacheManager.getCacheStats();
      assert.strictEqual(stats.cacheTimeout, 1000); // 最小値1秒
    });
  });

  suite("Cache Expiration", () => {
    test("should expire cache entries after timeout", async () => {
      const shortTimeoutCache = new CacheManager(100); // 100ms
      const factory = new Factory("user", testLocation);

      shortTimeoutCache.cacheFactory(factory);
      assert.ok(shortTimeoutCache.getFactory("user"));

      // 短い待機
      await new Promise((resolve) => setTimeout(resolve, 150));

      assert.strictEqual(shortTimeoutCache.getFactory("user"), undefined);
    });

    test("should clean up expired entries", async () => {
      const shortTimeoutCache = new CacheManager(50); // 50ms
      const factory = new Factory("user", testLocation);
      const trait = new Trait("admin", testLocation, "user");

      shortTimeoutCache.cacheFactory(factory);
      shortTimeoutCache.cacheTrait(trait);

      let stats = shortTimeoutCache.getCacheStats();
      assert.strictEqual(stats.factoryCount, 1);
      assert.strictEqual(stats.traitCount, 1);

      // 期限切れを待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      shortTimeoutCache.cleanupExpiredEntries();

      stats = shortTimeoutCache.getCacheStats();
      assert.strictEqual(stats.factoryCount, 0);
      assert.strictEqual(stats.traitCount, 0);
    });

    test("should not expire fresh cache entries", async () => {
      const longTimeoutCache = new CacheManager(10000); // 10秒
      const factory = new Factory("user", testLocation);

      longTimeoutCache.cacheFactory(factory);

      // 短い待機（期限内）
      await new Promise((resolve) => setTimeout(resolve, 50));

      assert.ok(longTimeoutCache.getFactory("user"));
    });
  });
});
