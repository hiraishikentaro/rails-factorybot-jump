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
    factoryLinkProvider = new FactoryLinkProvider();
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
      await factoryLinkProvider.initializeFactoryFiles();
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
});
