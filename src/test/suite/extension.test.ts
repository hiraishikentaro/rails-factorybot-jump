import * as assert from "assert";
import * as vscode from "vscode";
import { FactoryLinkProvider } from "../../extension";
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

  suiteTeardown(async () => {
    // Clean up temporary directory with retry mechanism
    let retries = 3;
    while (retries > 0) {
      try {
        if (fs.existsSync(testWorkspacePath)) {
          fs.rmSync(testWorkspacePath, { recursive: true, force: true });
        }
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.error("Failed to clean up temporary directory:", error);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
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
      content: "create(:user)\nbuild(:post)",
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
      content: "create(:user, name: 'John')\nbuild(:post, title: 'Test')",
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
            return [path.join("spec", "factories", "**", "*.rb")];
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
            return [path.join("custom", "factories", "**", "*.rb")];
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
              path.join("spec", "factories", "**", "*.rb"),
              path.join("custom", "factories", "**", "*.rb"),
            ];
          }
          return undefined;
        },
      }),
      configurable: true,
    });

    // Create factory files in both paths
    const factoryContent = "factory :user do\n  name { 'John' }\nend";
    const specFactoryFile = vscode.Uri.file(
      path.join(testWorkspacePath, "spec", "factories", "test_factories.rb")
    );
    const customFactoryFile = vscode.Uri.file(
      path.join(testWorkspacePath, "custom", "factories", "test_factories.rb")
    );

    try {
      // Create factory files
      await vscode.workspace.fs.writeFile(
        specFactoryFile,
        Buffer.from(factoryContent)
      );
      await vscode.workspace.fs.writeFile(
        customFactoryFile,
        Buffer.from(factoryContent)
      );

      // Initialize and verify
      await factoryLinkProvider.initializeFactoryFiles();
      const userFactory = await factoryLinkProvider.findFactoryFile("user");
      assert.ok(userFactory, "Should find user factory file in first path");

      // Clean up first factory file and verify second path
      await vscode.workspace.fs.delete(specFactoryFile);
      factoryLinkProvider = new FactoryLinkProvider();
      await factoryLinkProvider.initializeFactoryFiles();
      const userFactoryFromSecondPath =
        await factoryLinkProvider.findFactoryFile("user");
      assert.ok(
        userFactoryFromSecondPath,
        "Should find user factory file in second path"
      );
    } finally {
      // Clean up
      try {
        await vscode.workspace.fs.delete(specFactoryFile);
      } catch (error) {
        // Ignore error if file doesn't exist
      }
      try {
        await vscode.workspace.fs.delete(customFactoryFile);
      } catch (error) {
        // Ignore error if file doesn't exist
      }
    }
  });
});
