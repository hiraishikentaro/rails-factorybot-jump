/**
 * RegexPatternsユーティリティの単体テスト
 */

import * as assert from "assert";
import {
  FACTORY_DEFINITION_PATTERN,
  TRAIT_DEFINITION_PATTERN,
  FACTORY_BLOCK_PATTERN,
  getFactoryCallPattern,
  TRAIT_REFERENCE_PATTERN,
  VALID_FACTORY_NAME_PATTERN,
} from "../../../utils/regexPatterns";

suite("RegexPatterns Utility Tests", () => {
  suite("FACTORY_DEFINITION_PATTERN", () => {
    test("should match basic factory definition", () => {
      const text = "factory :user do";
      const regex = new RegExp(
        FACTORY_DEFINITION_PATTERN.source,
        FACTORY_DEFINITION_PATTERN.flags
      );
      const match = regex.exec(text);

      assert.ok(match);
      assert.strictEqual(match[2], "user"); // インデックスを修正
    });

    test("should match factory with underscores", () => {
      const text = "factory :user_profile do";
      const regex = new RegExp(
        FACTORY_DEFINITION_PATTERN.source,
        FACTORY_DEFINITION_PATTERN.flags
      );
      const match = regex.exec(text);

      assert.ok(match);
      assert.strictEqual(match[2], "user_profile"); // インデックスを修正
    });

    test("should match factory with numbers", () => {
      const text = "factory :user_v2 do";
      const regex = new RegExp(
        FACTORY_DEFINITION_PATTERN.source,
        FACTORY_DEFINITION_PATTERN.flags
      );
      const match = regex.exec(text);

      assert.ok(match);
      assert.strictEqual(match[2], "user_v2"); // インデックスを修正
    });

    test("should not match incomplete factory definition", () => {
      const text = "factory user do";
      const regex = new RegExp(
        FACTORY_DEFINITION_PATTERN.source,
        FACTORY_DEFINITION_PATTERN.flags
      );
      const match = regex.exec(text);

      assert.strictEqual(match, null);
    });
  });

  suite("TRAIT_DEFINITION_PATTERN", () => {
    test("should match basic trait definition", () => {
      const text = "trait :admin do";
      const regex = new RegExp(
        TRAIT_DEFINITION_PATTERN.source,
        TRAIT_DEFINITION_PATTERN.flags
      );
      const match = regex.exec(text);

      assert.ok(match);
      assert.strictEqual(match[1], "admin");
    });

    test("should match trait with underscores", () => {
      const text = "trait :super_admin do";
      const regex = new RegExp(
        TRAIT_DEFINITION_PATTERN.source,
        TRAIT_DEFINITION_PATTERN.flags
      );
      const match = regex.exec(text);

      assert.ok(match);
      assert.strictEqual(match[1], "super_admin");
    });

    test("should not match without colon", () => {
      const text = "trait admin do";
      const regex = new RegExp(
        TRAIT_DEFINITION_PATTERN.source,
        TRAIT_DEFINITION_PATTERN.flags
      );
      const match = regex.exec(text);

      assert.strictEqual(match, null);
    });
  });

  suite("FACTORY_BLOCK_PATTERN", () => {
    test("should match complete factory block", () => {
      const text = `factory :user do
  name { 'John' }
  email { 'john@example.com' }
end`;
      const regex = new RegExp(
        FACTORY_BLOCK_PATTERN.source,
        FACTORY_BLOCK_PATTERN.flags
      );
      const match = regex.exec(text);

      assert.ok(match);
      assert.strictEqual(match[1], "user"); // インデックスを1に修正
      assert.ok(match[2].includes("name { 'John' }")); // インデックスを2に修正
    });

    test("should match factory block with traits", () => {
      const text = `factory :user do
  name { 'John' }
  
  trait :admin do
    role { 'admin' }
  end
end`;
      const regex = new RegExp(
        FACTORY_BLOCK_PATTERN.source,
        FACTORY_BLOCK_PATTERN.flags
      );
      const match = regex.exec(text);

      assert.ok(match);
      assert.strictEqual(match[1], "user"); // インデックスを1に修正
      assert.ok(match[2].includes("trait :admin do")); // インデックスを2に修正
    });
  });

  suite("getFactoryCallPattern", () => {
    test("should match create call", () => {
      const text = "create(:user)";
      const regex = getFactoryCallPattern();
      const match = regex.exec(text);

      assert.ok(match);
      assert.strictEqual(match[2], ":user");
    });

    test("should match build call", () => {
      const text = "build(:post)";
      const regex = getFactoryCallPattern();
      const match = regex.exec(text);

      assert.ok(match);
      assert.strictEqual(match[2], ":post");
    });

    test("should match create_list call", () => {
      const text = "create_list(:users, 5)";
      const regex = getFactoryCallPattern();
      const match = regex.exec(text);

      assert.ok(match);
      assert.strictEqual(match[2], ":users");
    });

    test("should match build_stubbed call", () => {
      const text = "build_stubbed(:user)";
      const regex = getFactoryCallPattern();
      const match = regex.exec(text);

      assert.ok(match);
      assert.strictEqual(match[2], ":user");
    });

    test("should match call with traits", () => {
      const text = "create(:user, :admin, :active)";
      const regex = getFactoryCallPattern();
      const match = regex.exec(text);

      assert.ok(match);
      assert.strictEqual(match[2], ":user");
      assert.ok(match[1].includes(":admin"));
      assert.ok(match[1].includes(":active"));
    });

    test("should not match unsupported methods", () => {
      const text = "destroy(:user)";
      const regex = getFactoryCallPattern();
      const match = regex.exec(text);

      assert.strictEqual(match, null);
    });
  });

  suite("TRAIT_REFERENCE_PATTERN", () => {
    test("should match trait reference", () => {
      const text = ":admin";
      const regex = new RegExp(
        TRAIT_REFERENCE_PATTERN.source,
        TRAIT_REFERENCE_PATTERN.flags
      );
      const match = regex.exec(text);

      assert.ok(match);
      assert.strictEqual(match[1], "admin");
    });

    test("should match multiple trait references", () => {
      const text = ":admin, :active, :verified";
      const regex = new RegExp(
        TRAIT_REFERENCE_PATTERN.source,
        TRAIT_REFERENCE_PATTERN.flags
      );
      const matches = [];
      let match;

      while ((match = regex.exec(text)) !== null) {
        matches.push(match[1]);
      }

      assert.strictEqual(matches.length, 3);
      assert.strictEqual(matches[0], "admin");
      assert.strictEqual(matches[1], "active");
      assert.strictEqual(matches[2], "verified");
    });
  });

  suite("VALID_FACTORY_NAME_PATTERN", () => {
    test("should match valid factory names", () => {
      const validNames = [
        "user",
        "user_profile",
        "user123",
        "User",
        "USER",
        "user_profile_v2",
      ];

      validNames.forEach((name) => {
        assert.ok(
          VALID_FACTORY_NAME_PATTERN.test(name),
          `Should match: ${name}`
        );
      });
    });

    test("should not match invalid factory names", () => {
      const invalidNames = [
        "user-profile",
        "user.profile",
        "user profile",
        "user@profile",
        "",
      ];

      invalidNames.forEach((name) => {
        assert.ok(
          !VALID_FACTORY_NAME_PATTERN.test(name),
          `Should not match: ${name}`
        );
      });
    });
  });

  suite("Pattern Reset", () => {
    test("should handle global regex patterns correctly", () => {
      const text = "factory :user do\nfactory :post do";
      const regex = new RegExp(
        FACTORY_DEFINITION_PATTERN.source,
        FACTORY_DEFINITION_PATTERN.flags
      );

      // 最初の実行
      const match1 = regex.exec(text);
      assert.ok(match1);
      assert.strictEqual(match1[2], "user"); // インデックスを修正

      // 二番目の実行
      const match2 = regex.exec(text);
      assert.ok(match2);
      assert.strictEqual(match2[2], "post"); // インデックスを修正

      // 三番目の実行（何も見つからない）
      const match3 = regex.exec(text);
      assert.strictEqual(match3, null);
    });

    test("should reset pattern for fresh searches", () => {
      const text = "factory :user do";
      const regex1 = new RegExp(
        FACTORY_DEFINITION_PATTERN.source,
        FACTORY_DEFINITION_PATTERN.flags
      );
      const regex2 = new RegExp(
        FACTORY_DEFINITION_PATTERN.source,
        FACTORY_DEFINITION_PATTERN.flags
      );

      const match1 = regex1.exec(text);
      const match2 = regex2.exec(text);

      assert.ok(match1);
      assert.ok(match2);
      assert.strictEqual(match1[2], match2[2]); // インデックスを修正
    });
  });
});
