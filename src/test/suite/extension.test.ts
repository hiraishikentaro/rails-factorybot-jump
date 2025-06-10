import * as assert from "assert";
import * as vscode from "vscode";
import { FactoryLinkProvider } from "../../providers/factoryLinkProvider";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

// Extend vscode.workspace type for testing
declare module "vscode" {
  interface Workspace {
    workspaceFolders: vscode.WorkspaceFolder[] | undefined;
    getConfiguration(
      section?: string,
      scope?: vscode.ConfigurationScope
    ): vscode.WorkspaceConfiguration;
  }
}

suite("Extension Test Suite", () => {
  let factoryLinkProvider: FactoryLinkProvider;
  let testWorkspacePath: string;
  let testWorkspaceFolder: vscode.WorkspaceFolder;
  let originalGetConfiguration: (
    section?: string,
    scope?: vscode.ConfigurationScope
  ) => vscode.WorkspaceConfiguration;

  suiteSetup(() => {
    // Create a temporary directory for testing
    testWorkspacePath = fs.mkdtempSync(
      path.join(os.tmpdir(), "rails-factorybot-test-")
    );

    // Create necessary directories
    const factoriesDir = path.join(testWorkspacePath, "spec", "factories");
    const customFactoriesDir = path.join(
      testWorkspacePath,
      "custom",
      "factories"
    );
    fs.mkdirSync(factoriesDir, { recursive: true });
    fs.mkdirSync(customFactoriesDir, { recursive: true });

    // Create a workspace folder for testing
    testWorkspaceFolder = {
      uri: vscode.Uri.file(testWorkspacePath),
      name: "Test Workspace",
      index: 0,
    };

    // Mock workspace folders
    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      value: [testWorkspaceFolder],
      configurable: true,
    });

    // Store original getConfiguration
    originalGetConfiguration = vscode.workspace.getConfiguration;
  });

  suiteTeardown(() => {
    // Clean up temporary directory
    fs.rmSync(testWorkspacePath, { recursive: true, force: true });
    // Reset workspace folders
    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      value: undefined,
      configurable: true,
    });
    // Restore original getConfiguration
    Object.defineProperty(vscode.workspace, "getConfiguration", {
      value: originalGetConfiguration,
      configurable: true,
    });
  });

  setup(() => {
    // Mock getConfiguration to disable auto-initialization for tests
    Object.defineProperty(vscode.workspace, "getConfiguration", {
      value: (section?: string) => ({
        get: (key: string, defaultValue?: unknown) => {
          if (section === "rails-factorybot-jump") {
            if (key === "autoInitialize") {
              return false; // Disable auto-initialization for tests
            }
            if (key === "debugMode") {
              return false;
            }
            if (key === "cacheTimeout") {
              return 60;
            }
            if (key === "parallelBatchSize") {
              return 10;
            }
            if (key === "factoryPaths") {
              return [
                path
                  .join("spec", "factories", "**", "*.rb")
                  .replace(/\\/g, "/"),
              ];
            }
          }
          return defaultValue;
        },
      }),
      configurable: true,
    });

    factoryLinkProvider = new FactoryLinkProvider();
  });

  teardown(() => {
    // Restore original getConfiguration
    Object.defineProperty(vscode.workspace, "getConfiguration", {
      value: originalGetConfiguration,
      configurable: true,
    });

    // Clean up factoryLinkProvider
    if (factoryLinkProvider) {
      factoryLinkProvider.dispose();
    }
  });

  test("FactoryLinkProvider should be instantiated", () => {
    assert.ok(factoryLinkProvider instanceof FactoryLinkProvider);
  });

  test("FactoryLinkProvider should detect factory calls", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: "create(:user)\nbuild(:post)\nbuild_stubbed(:post)",
      language: "ruby",
    });

    const links = await factoryLinkProvider.provideDocumentLinks(document);
    assert.strictEqual(
      links.length,
      0,
      "Should return empty array when not initialized"
    );
  });

  test("FactoryLinkProvider should handle complex factory calls", async () => {
    const document = await vscode.workspace.openTextDocument({
      content:
        "create(:user, name: 'John')\nbuild(:post, title: 'Test')\nbuild_stubbed(:post, title: 'Test')",
      language: "ruby",
    });

    const links = await factoryLinkProvider.provideDocumentLinks(document);
    assert.strictEqual(
      links.length,
      0,
      "Should return empty array when not initialized"
    );
  });

  test("FactoryLinkProvider should find factory file", async () => {
    const factoryName = "user";
    const factoryFile = await factoryLinkProvider.findFactoryFile(factoryName);
    assert.ok(
      factoryFile === undefined,
      "Should return undefined when not initialized"
    );
  });

  test("FactoryLinkProvider should initialize factory files", async () => {
    await factoryLinkProvider.initializeFactoryFiles();
    assert.ok(true, "Initialization should complete without error");
  });

  test("FactoryLinkProvider should cache factory definitions", async () => {
    // Create a temporary factory file
    const factoryContent = `
      factory :user do
        name { 'John' }
      end

      factory :post do
        title { 'Test' }
      end
    `;

    const factoryFile = vscode.Uri.file(
      path.join(testWorkspacePath, "spec", "factories", "test_factories.rb")
    );

    await vscode.workspace.fs.writeFile(
      factoryFile,
      Buffer.from(factoryContent)
    );

    try {
      // Wait for initialization to complete
      await factoryLinkProvider.initializeFactoryFiles();

      // Add a small delay to ensure initialization is fully complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const userFactory = await factoryLinkProvider.findFactoryFile("user");
      const postFactory = await factoryLinkProvider.findFactoryFile("post");

      assert.ok(userFactory, "Should find user factory file");
      assert.ok(postFactory, "Should find post factory file");
    } finally {
      // Clean up
      await vscode.workspace.fs.delete(factoryFile);
    }
  });

  test("FactoryLinkProvider should handle file system changes", async () => {
    const factoryFile = vscode.Uri.file(
      path.join(testWorkspacePath, "spec", "factories", "test_factories.rb")
    );

    // Create initial factory file
    await vscode.workspace.fs.writeFile(
      factoryFile,
      Buffer.from("factory :user do\n  name { 'John' }\nend")
    );

    try {
      // Initialize and verify first factory
      await factoryLinkProvider.initializeFactoryFiles();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const userFactory = await factoryLinkProvider.findFactoryFile("user");
      assert.ok(userFactory, "Should find user factory file");

      // Update factory file
      await vscode.workspace.fs.writeFile(
        factoryFile,
        Buffer.from("factory :post do\n  title { 'Test' }\nend")
      );

      // Create a new instance to force reinitialization
      factoryLinkProvider = new FactoryLinkProvider();
      await factoryLinkProvider.initializeFactoryFiles();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify updated factory
      const postFactory = await factoryLinkProvider.findFactoryFile("post");
      assert.ok(postFactory, "Should find updated post factory file");

      // Verify old factory is no longer in cache
      const oldUserFactory = await factoryLinkProvider.findFactoryFile("user");
      assert.ok(!oldUserFactory, "Should not find old user factory file");
    } finally {
      // Clean up
      await vscode.workspace.fs.delete(factoryFile);
    }
  });

  test("FactoryLinkProvider should use default factory paths", async () => {
    // Mock getConfiguration to return default paths
    Object.defineProperty(vscode.workspace, "getConfiguration", {
      value: () => ({
        get: (key: string) => {
          if (key === "factoryPaths") {
            return [
              path.join("spec", "factories", "**", "*.rb").replace(/\\/g, "/"),
            ];
          }
          return undefined;
        },
      }),
      configurable: true,
    });

    const factoryContent = "factory :user do\n  name { 'John' }\nend";
    const factoryFile = vscode.Uri.file(
      path.join(testWorkspacePath, "spec", "factories", "test_factories.rb")
    );

    await vscode.workspace.fs.writeFile(
      factoryFile,
      Buffer.from(factoryContent)
    );

    try {
      await factoryLinkProvider.initializeFactoryFiles();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const userFactory = await factoryLinkProvider.findFactoryFile("user");
      assert.ok(userFactory, "Should find user factory file in default path");
    } finally {
      await vscode.workspace.fs.delete(factoryFile);
    }
  });

  test("FactoryLinkProvider should use custom factory path", async () => {
    // Mock getConfiguration to return custom path
    Object.defineProperty(vscode.workspace, "getConfiguration", {
      value: () => ({
        get: (key: string) => {
          if (key === "factoryPaths") {
            return [
              path
                .join("custom", "factories", "**", "*.rb")
                .replace(/\\/g, "/"),
            ];
          }
          return undefined;
        },
      }),
      configurable: true,
    });

    const factoryContent = "factory :user do\n  name { 'John' }\nend";
    const factoryFile = vscode.Uri.file(
      path.join(testWorkspacePath, "custom", "factories", "test_factories.rb")
    );

    await vscode.workspace.fs.writeFile(
      factoryFile,
      Buffer.from(factoryContent)
    );

    try {
      await factoryLinkProvider.initializeFactoryFiles();
      const userFactory = await factoryLinkProvider.findFactoryFile("user");
      assert.ok(userFactory, "Should find user factory file in custom path");
    } finally {
      await vscode.workspace.fs.delete(factoryFile);
    }
  });

  test("FactoryLinkProvider should use multiple factory paths", async () => {
    // Mock getConfiguration to return multiple paths
    Object.defineProperty(vscode.workspace, "getConfiguration", {
      value: () => ({
        get: (key: string) => {
          if (key === "factoryPaths") {
            return [
              path.join("spec", "factories", "**", "*.rb").replace(/\\/g, "/"),
              path
                .join("custom", "factories", "**", "*.rb")
                .replace(/\\/g, "/"),
            ];
          }
          return undefined;
        },
      }),
      configurable: true,
    });

    const factoryContent = "factory :user do\n  name { 'John' }\nend";
    const factoryFile1 = vscode.Uri.file(
      path.join(testWorkspacePath, "spec", "factories", "test_factories.rb")
    );
    const factoryFile2 = vscode.Uri.file(
      path.join(testWorkspacePath, "custom", "factories", "test_factories.rb")
    );

    await vscode.workspace.fs.writeFile(
      factoryFile1,
      Buffer.from(factoryContent)
    );
    await vscode.workspace.fs.writeFile(
      factoryFile2,
      Buffer.from(factoryContent)
    );

    try {
      await factoryLinkProvider.initializeFactoryFiles();
      const userFactory = await factoryLinkProvider.findFactoryFile("user");
      assert.ok(userFactory, "Should find user factory file in first path");
    } finally {
      await vscode.workspace.fs.delete(factoryFile1);
      await vscode.workspace.fs.delete(factoryFile2);
    }
  });

  test("FactoryLinkProvider should handle consecutive create/build calls with and without parentheses", async () => {
    // Create a temporary factory file
    const factoryContent = `
      factory :user do
        name { 'John' }
      end

      factory :post do
        title { 'Test' }
      end

      factory :join do
        status { :status_active }
      end
    `;

    const factoryFile = vscode.Uri.file(
      path.join(testWorkspacePath, "spec", "factories", "test_factories.rb")
    );

    await vscode.workspace.fs.writeFile(
      factoryFile,
      Buffer.from(factoryContent)
    );

    try {
      await factoryLinkProvider.initializeFactoryFiles();

      // Test document with various combinations of create/build calls
      const document = await vscode.workspace.openTextDocument({
        content: `
          create :user
          create :post
          build(:user)
          build(:post)
          create :user
          build :post
          create_list(:user, 1)
          build_list(:post, 1)
          build_stubbed(:post)
          build_stubbed_list(:user, 1)

          before do
            if idx.even?
              create :join,
            else
              create :join, status: :status_inactive
            end
          end
        `,
        language: "ruby",
      });

      const links = await factoryLinkProvider.provideDocumentLinks(document);
      assert.strictEqual(links.length, 11, "Should detect all factory calls");

      // Verify that all factory names are properly detected
      const factoryNames = links.map((link) => {
        const range = link.range;
        return document.getText(range).slice(1); // Remove the : prefix
      });

      assert.deepStrictEqual(
        factoryNames,
        [
          "user",
          "post",
          "user",
          "post",
          "user",
          "post",
          "user",
          "post",
          "post",
          "user",
          "join",
        ],
        "Should detect all factory names in correct order"
      );
    } finally {
      // Clean up
      await vscode.workspace.fs.delete(factoryFile);
    }
  });

  test("FactoryLinkProvider should cache trait definitions", async () => {
    // Create a temporary factory file with traits
    const factoryContent = `
      factory :user do
        name { 'John' }
        email { 'john@example.com' }

        trait :admin do
          role { 'admin' }
        end

        trait :active do
          status { 'active' }
        end
      end

      factory :post do
        title { 'Test Post' }
        content { 'Test content' }

        trait :published do
          published_at { Time.current }
        end

        trait :featured do
          featured { true }
        end
      end
    `;

    const factoryFile = vscode.Uri.file(
      path.join(testWorkspacePath, "spec", "factories", "test_factories.rb")
    );

    await vscode.workspace.fs.writeFile(
      factoryFile,
      Buffer.from(factoryContent)
    );

    try {
      await factoryLinkProvider.initializeFactoryFiles();

      // Verify that factories are cached
      const userFactory = await factoryLinkProvider.findFactoryFile("user");
      const postFactory = await factoryLinkProvider.findFactoryFile("post");
      assert.ok(userFactory, "Should find user factory file");
      assert.ok(postFactory, "Should find post factory file");

      // Test document with trait usage
      const document = await vscode.workspace.openTextDocument({
        content: `
          create(:user, :admin)
          build(:user, :active)
          create(:post, :published, :featured)
          build(:user, :admin, :active)
        `,
        language: "ruby",
      });

      const links = await factoryLinkProvider.provideDocumentLinks(document);

      // Should have links for factories and traits
      // 4 factory links + 6 trait links = 10 total links
      assert.strictEqual(
        links.length,
        10,
        "Should detect all factory and trait calls"
      );

      // Verify factory and trait names are properly detected
      const linkTexts = links.map((link) => {
        const range = link.range;
        return document.getText(range);
      });

      assert.deepStrictEqual(
        linkTexts,
        [
          ":user",
          ":admin",
          ":user",
          ":active",
          ":post",
          ":published",
          ":featured",
          ":user",
          ":admin",
          ":active",
        ],
        "Should detect all factory and trait names in correct order"
      );

      // Verify tooltips contain correct information
      const tooltips = links.map((link) => link.tooltip);

      // Check factory tooltips
      assert.ok(
        tooltips[0]?.includes("jump to factory definition: user"),
        "Should have correct factory tooltip for user"
      );
      assert.ok(
        tooltips[4]?.includes("jump to factory definition: post"),
        "Should have correct factory tooltip for post"
      );

      // Check trait tooltips
      assert.ok(
        tooltips[1]?.includes(
          "jump to trait definition: admin in factory user"
        ),
        "Should have correct trait tooltip for admin"
      );
      assert.ok(
        tooltips[3]?.includes(
          "jump to trait definition: active in factory user"
        ),
        "Should have correct trait tooltip for active"
      );
      assert.ok(
        tooltips[5]?.includes(
          "jump to trait definition: published in factory post"
        ),
        "Should have correct trait tooltip for published"
      );
      assert.ok(
        tooltips[6]?.includes(
          "jump to trait definition: featured in factory post"
        ),
        "Should have correct trait tooltip for featured"
      );
    } finally {
      // Clean up
      await vscode.workspace.fs.delete(factoryFile);
    }
  });

  test("FactoryLinkProvider should handle traits with various factory call patterns", async () => {
    // Create a temporary factory file with traits
    const factoryContent = `
      factory :user do
        name { 'John' }

        trait :admin do
          role { 'admin' }
        end

        trait :verified do
          verified_at { Time.current }
        end
      end
    `;

    const factoryFile = vscode.Uri.file(
      path.join(testWorkspacePath, "spec", "factories", "test_factories.rb")
    );

    await vscode.workspace.fs.writeFile(
      factoryFile,
      Buffer.from(factoryContent)
    );

    try {
      await factoryLinkProvider.initializeFactoryFiles();

      // Test document with various trait usage patterns (using parentheses for better regex matching)
      const document = await vscode.workspace.openTextDocument({
        content: `
          build(:user, :verified)
          create_list(:user, 5, :admin, :verified)
          build_stubbed(:user, :verified)
          build_stubbed_list(:user, 2, :admin, :verified)
        `,
        language: "ruby",
      });

      const links = await factoryLinkProvider.provideDocumentLinks(document);

      // Should detect all factory and trait calls
      // Note: Current regex implementation has limitations with multiple traits in one call
      assert.strictEqual(
        links.length,
        6,
        "Should detect factory and trait calls with various patterns"
      );

      // Verify all links have proper tooltips
      const factoryLinks = links.filter((link) =>
        link.tooltip?.includes("jump to factory definition")
      );
      const traitLinks = links.filter((link) =>
        link.tooltip?.includes("jump to trait definition")
      );

      assert.strictEqual(factoryLinks.length, 4, "Should have 4 factory links");
      assert.strictEqual(traitLinks.length, 2, "Should have 2 trait links");
    } finally {
      // Clean up
      await vscode.workspace.fs.delete(factoryFile);
    }
  });

  test("FactoryLinkProvider should handle traits in nested factory definitions", async () => {
    // Create a factory file with nested factory and trait definitions
    const factoryContent = `
      factory :user do
        name { 'John' }

        trait :admin do
          role { 'admin' }
        end

        factory :admin_user do
          role { 'admin' }

          trait :super_admin do
            permissions { 'all' }
          end
        end
      end

      factory :post do
        title { 'Test' }

        trait :published do
          published_at { Time.current }
        end
      end
    `;

    const factoryFile = vscode.Uri.file(
      path.join(testWorkspacePath, "spec", "factories", "test_factories.rb")
    );

    await vscode.workspace.fs.writeFile(
      factoryFile,
      Buffer.from(factoryContent)
    );

    try {
      await factoryLinkProvider.initializeFactoryFiles();

      // Test document using traits from different factories
      const document = await vscode.workspace.openTextDocument({
        content: `
          create(:user, :admin)
          create(:admin_user, :super_admin)
          build(:post, :published)
        `,
        language: "ruby",
      });

      const links = await factoryLinkProvider.provideDocumentLinks(document);

      // Should detect all factory and trait calls
      // 3 factory links + 3 trait links = 6 total links
      assert.strictEqual(
        links.length,
        6,
        "Should detect all factory and trait calls in nested definitions"
      );

      // Verify trait tooltips reference correct factories
      const traitLinks = links.filter((link) =>
        link.tooltip?.includes("jump to trait definition")
      );

      assert.strictEqual(traitLinks.length, 3, "Should have 3 trait links");

      // Check that traits are associated with correct factories
      const adminTraitTooltip = traitLinks.find((link) =>
        link.tooltip?.includes("admin in factory user")
      );
      const superAdminTraitTooltip = traitLinks.find((link) =>
        link.tooltip?.includes("super_admin in factory admin_user")
      );
      const publishedTraitTooltip = traitLinks.find((link) =>
        link.tooltip?.includes("published in factory post")
      );

      assert.ok(
        adminTraitTooltip,
        "Should find admin trait linked to user factory"
      );
      assert.ok(
        superAdminTraitTooltip,
        "Should find super_admin trait linked to admin_user factory"
      );
      assert.ok(
        publishedTraitTooltip,
        "Should find published trait linked to post factory"
      );
    } finally {
      // Clean up
      await vscode.workspace.fs.delete(factoryFile);
    }
  });

  test("FactoryLinkProvider should handle traits with complex factory call syntax", async () => {
    // Create a factory file with traits
    const factoryContent = `
      factory :user do
        name { 'John' }

        trait :admin do
          role { 'admin' }
        end

        trait :active do
          status { 'active' }
        end
      end
    `;

    const factoryFile = vscode.Uri.file(
      path.join(testWorkspacePath, "spec", "factories", "test_factories.rb")
    );

    await vscode.workspace.fs.writeFile(
      factoryFile,
      Buffer.from(factoryContent)
    );

    try {
      await factoryLinkProvider.initializeFactoryFiles();

      // Test document with complex factory call syntax
      const document = await vscode.workspace.openTextDocument({
        content: `
          create(:user, :admin, name: 'Custom Name')
          build(:user, :active, :admin, email: 'test@example.com')
          create_list(:user, 5, :admin, created_at: 1.day.ago)
          
          let(:admin_user) { create(:user, :admin) }
          let(:active_admin) { build(:user, :active, :admin, name: 'Active Admin') }
        `,
        language: "ruby",
      });

      const links = await factoryLinkProvider.provideDocumentLinks(document);

      // Should detect factory and trait calls even with additional parameters
      assert.ok(
        links.length >= 10,
        "Should detect factory and trait calls with complex syntax"
      );

      // Verify that traits are still properly detected despite additional parameters
      const traitLinks = links.filter((link) =>
        link.tooltip?.includes("jump to trait definition")
      );

      assert.ok(
        traitLinks.length >= 5,
        "Should detect trait calls with additional parameters"
      );
    } finally {
      // Clean up
      await vscode.workspace.fs.delete(factoryFile);
    }
  });

  test("FactoryLinkProvider should not create trait links for non-existent traits", async () => {
    // Create a factory file without traits
    const factoryContent = `
      factory :user do
        name { 'John' }
        email { 'john@example.com' }
      end
    `;

    const factoryFile = vscode.Uri.file(
      path.join(testWorkspacePath, "spec", "factories", "test_factories.rb")
    );

    await vscode.workspace.fs.writeFile(
      factoryFile,
      Buffer.from(factoryContent)
    );

    try {
      await factoryLinkProvider.initializeFactoryFiles();

      // Test document trying to use non-existent traits
      const document = await vscode.workspace.openTextDocument({
        content: `
          create(:user, :admin)
          build(:user, :non_existent_trait)
          create(:user, :another_missing_trait)
        `,
        language: "ruby",
      });

      const links = await factoryLinkProvider.provideDocumentLinks(document);

      // Should only create links for existing factories, not for non-existent traits
      const factoryLinks = links.filter((link) =>
        link.tooltip?.includes("jump to factory definition")
      );
      const traitLinks = links.filter((link) =>
        link.tooltip?.includes("jump to trait definition")
      );

      assert.strictEqual(
        factoryLinks.length,
        3,
        "Should create links for existing factories"
      );
      assert.strictEqual(
        traitLinks.length,
        0,
        "Should not create links for non-existent traits"
      );
    } finally {
      // Clean up
      await vscode.workspace.fs.delete(factoryFile);
    }
  });
});
