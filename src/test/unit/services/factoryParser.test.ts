/**
 * FactoryParserサービスの単体テスト
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { FactoryParser } from "../../../services/factoryParser";

suite("FactoryParser Service Tests", () => {
  let factoryParser: FactoryParser;
  let testUri: vscode.Uri;

  setup(() => {
    factoryParser = new FactoryParser();
    testUri = vscode.Uri.file("/test/path/to/factory.rb");
  });

  suite("Factory Definition Parsing", () => {
    test("should parse simple factory definition", () => {
      const text = `factory :user do
  name { 'John' }
  email { 'john@example.com' }
end`;

      const result = factoryParser.parseText(text, testUri);

      assert.strictEqual(result.factories.length, 1);
      assert.strictEqual(result.factories[0].name, "user");
      assert.strictEqual(result.factories[0].location.line, 0);
    });

    test("should parse multiple factory definitions", () => {
      const text = `factory :user do
  name { 'John' }
end

factory :post do
  title { 'Test Post' }
end

factory :comment do
  content { 'Test Comment' }
end`;

      const result = factoryParser.parseText(text, testUri);

      assert.strictEqual(result.factories.length, 3);
      assert.strictEqual(result.factories[0].name, "user");
      assert.strictEqual(result.factories[1].name, "post");
      assert.strictEqual(result.factories[2].name, "comment");
    });

    test("should parse factory with underscores and numbers", () => {
      const text = `factory :user_profile_v2 do
  name { 'John' }
end`;

      const result = factoryParser.parseText(text, testUri);

      assert.strictEqual(result.factories.length, 1);
      assert.strictEqual(result.factories[0].name, "user_profile_v2");
    });

    test("should calculate correct line numbers", () => {
      const text = `# Comment line 1
# Comment line 2
factory :user do
  name { 'John' }
end

# Another comment
factory :post do
  title { 'Test' }
end`;

      const result = factoryParser.parseText(text, testUri);

      assert.strictEqual(result.factories.length, 2);
      assert.strictEqual(result.factories[0].name, "user");
      assert.strictEqual(result.factories[0].location.line, 2); // 0-based
      assert.strictEqual(result.factories[1].name, "post");
      assert.strictEqual(result.factories[1].location.line, 7); // 0-based
    });

    test("should handle factory with no content", () => {
      const text = `factory :empty do
end`;

      const result = factoryParser.parseText(text, testUri);

      assert.strictEqual(result.factories.length, 1);
      assert.strictEqual(result.factories[0].name, "empty");
    });
  });

  suite("Trait Definition Parsing", () => {
    test("should parse simple trait definition", () => {
      const text = `factory :user do
  name { 'John' }
  
  trait :admin do
    role { 'admin' }
  end
end`;

      const result = factoryParser.parseText(text, testUri);

      assert.strictEqual(result.traits.length, 1);
      assert.strictEqual(result.traits[0].name, "admin");
      assert.strictEqual(result.traits[0].factoryName, "user");
    });

    test("should parse multiple traits in one factory", () => {
      const text = `factory :user do
  name { 'John' }
  
  trait :admin do
    role { 'admin' }
  end
  
  trait :guest do
    role { 'guest' }
  end
  
  trait :active do
    status { 'active' }
  end
end`;

      const result = factoryParser.parseText(text, testUri);

      assert.strictEqual(result.traits.length, 3);
      assert.strictEqual(result.traits[0].name, "admin");
      assert.strictEqual(result.traits[0].factoryName, "user");
      assert.strictEqual(result.traits[1].name, "guest");
      assert.strictEqual(result.traits[1].factoryName, "user");
      assert.strictEqual(result.traits[2].name, "active");
      assert.strictEqual(result.traits[2].factoryName, "user");
    });

    test("should parse traits in multiple factories", () => {
      const text = `factory :user do
  name { 'John' }
  
  trait :admin do
    role { 'admin' }
  end
end

factory :post do
  title { 'Test' }
  
  trait :published do
    status { 'published' }
  end
  
  trait :draft do
    status { 'draft' }
  end
end`;

      const result = factoryParser.parseText(text, testUri);

      assert.strictEqual(result.traits.length, 3);
      assert.strictEqual(result.traits[0].name, "admin");
      assert.strictEqual(result.traits[0].factoryName, "user");
      assert.strictEqual(result.traits[1].name, "published");
      assert.strictEqual(result.traits[1].factoryName, "post");
      assert.strictEqual(result.traits[2].name, "draft");
      assert.strictEqual(result.traits[2].factoryName, "post");
    });

    test("should calculate correct trait line numbers", () => {
      const text = `factory :user do
  name { 'John' }
  
  trait :admin do
    role { 'admin' }
  end
  
  # Comment
  trait :guest do
    role { 'guest' }
  end
end`;

      const result = factoryParser.parseText(text, testUri);

      assert.strictEqual(result.traits.length, 2);
      assert.strictEqual(result.traits[0].name, "admin");

      // デバッグ出力に基づいて期待値を修正
      // Admin trait は実際には line 3 にある
      assert.strictEqual(result.traits[0].location.line, 3); // 0-based
      assert.strictEqual(result.traits[1].name, "guest");
      // Guest trait は実際には line 8 にある
      assert.strictEqual(result.traits[1].location.line, 8); // 0-based
    });
  });

  suite("Factory-Trait Linking", () => {
    test("should link traits to their factories", () => {
      const text = `factory :user do
  name { 'John' }
  
  trait :admin do
    role { 'admin' }
  end
  
  trait :guest do
    role { 'guest' }
  end
end`;

      const result = factoryParser.parseText(text, testUri);

      assert.strictEqual(result.factories.length, 1);
      assert.strictEqual(result.traits.length, 2);

      const factory = result.factories[0];
      assert.strictEqual(factory.getTraitCount(), 2);
      assert.ok(factory.hasTrait("admin"));
      assert.ok(factory.hasTrait("guest"));

      const adminTrait = factory.getTrait("admin");
      const guestTrait = factory.getTrait("guest");

      assert.ok(adminTrait);
      assert.ok(guestTrait);
      assert.strictEqual(adminTrait.factoryName, "user");
      assert.strictEqual(guestTrait.factoryName, "user");
    });

    test("should handle factory without traits", () => {
      const text = `factory :user do
  name { 'John' }
  email { 'john@example.com' }
end`;

      const result = factoryParser.parseText(text, testUri);

      assert.strictEqual(result.factories.length, 1);
      assert.strictEqual(result.traits.length, 0);

      const factory = result.factories[0];
      assert.strictEqual(factory.getTraitCount(), 0);
    });
  });

  suite("Edge Cases", () => {
    test("should handle empty text", () => {
      const result = factoryParser.parseText("", testUri);

      assert.strictEqual(result.factories.length, 0);
      assert.strictEqual(result.traits.length, 0);
    });

    test("should handle text with no factories", () => {
      const text = `# This is just a comment
class User
  def initialize
    # Some Ruby code
  end
end`;

      const result = factoryParser.parseText(text, testUri);

      assert.strictEqual(result.factories.length, 0);
      assert.strictEqual(result.traits.length, 0);
    });

    test("should handle malformed factory definitions", () => {
      const text = `factory user do  # Missing colon
  name { 'John' }
end

factory :post do
  title { 'Test' }
end`;

      const result = factoryParser.parseText(text, testUri);

      // Should only find the valid factory
      assert.strictEqual(result.factories.length, 1);
      assert.strictEqual(result.factories[0].name, "post");
    });

    test("should handle nested factory-like structures", () => {
      const text = `factory :user do
  name { 'John' }
  
  trait :admin do
    role { 'admin' }
    # This should not be parsed as a separate factory
    # factory :nested do
    # end
  end
end`;

      const result = factoryParser.parseText(text, testUri);

      // コメント行内のfactory定義は無視されるべき

      assert.strictEqual(result.factories.length, 1);
      assert.strictEqual(result.traits.length, 1);
      assert.strictEqual(result.factories[0].name, "user");
      assert.strictEqual(result.traits[0].name, "admin");
    });
  });

  suite("Utility Methods", () => {
    test("should detect factory definition existence", () => {
      const textWithFactory = `factory :user do
  name { 'John' }
end`;

      const textWithoutFactory = `class User
  def initialize
    # Some code
  end
end`;

      assert.strictEqual(
        factoryParser.hasFactoryDefinition(textWithFactory),
        true
      );
      assert.strictEqual(
        factoryParser.hasFactoryDefinition(textWithoutFactory),
        false
      );
    });

    test("should extract factory names", () => {
      const text = `factory :user do
  name { 'John' }
end

factory :post do
  title { 'Test' }
end

factory :comment do
  content { 'Comment' }
end`;

      const names = factoryParser.extractFactoryNames(text);

      assert.strictEqual(names.length, 3);
      assert.ok(names.includes("user"));
      assert.ok(names.includes("post"));
      assert.ok(names.includes("comment"));
    });

    test("should extract factory names from text with no factories", () => {
      const text = `class User
  def initialize
  end
end`;

      const names = factoryParser.extractFactoryNames(text);
      assert.strictEqual(names.length, 0);
    });
  });

  suite("Multiple File Processing", () => {
    test("should handle multiple files parsing", async () => {
      // parseTextメソッドを直接テストして、ファイル読み込みのモックを回避
      const file1Content = `factory :user do
  name { 'John' }
end`;

      const file2Content = `factory :post do
  title { 'Test' }
  
  trait :published do
    status { 'published' }
  end
end`;

      const uri1 = vscode.Uri.file("/test/file1.rb");
      const uri2 = vscode.Uri.file("/test/file2.rb");

      // 各ファイルを個別に解析
      const result1 = factoryParser.parseText(file1Content, uri1);
      const result2 = factoryParser.parseText(file2Content, uri2);

      // 結果をマージ
      const allFactories = [...result1.factories, ...result2.factories];
      const allTraits = [...result1.traits, ...result2.traits];

      assert.strictEqual(allFactories.length, 2);
      assert.strictEqual(allTraits.length, 1);

      const factoryNames = allFactories.map((f) => f.name);
      assert.ok(factoryNames.includes("user"));
      assert.ok(factoryNames.includes("post"));

      assert.strictEqual(allTraits[0].name, "published");
      assert.strictEqual(allTraits[0].factoryName, "post");
    });
  });
});
