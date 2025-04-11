import * as vscode from "vscode";
import * as path from "path";

class FactoryLinkProvider implements vscode.DocumentLinkProvider {
  private factoryCache: Map<string, { uri: vscode.Uri; lineNumber: number }> =
    new Map();
  private factoryFiles: vscode.Uri[] = [];
  private isInitialized = false;

  constructor() {
    // Initialize lazily
    this.initializeFactoryFiles();
  }

  async initializeFactoryFiles() {
    if (this.isInitialized) {
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    // Get factory paths from configuration
    const config = vscode.workspace.getConfiguration("rails-factorybot-jump");
    const defaultPath = path
      .join("spec", "factories", "**", "*.rb")
      .replace(/\\/g, "/");
    const factoryPaths = config.get<string[]>("factoryPaths", [defaultPath]);

    // Factory file search patterns
    const patterns = factoryPaths.map(
      (pathPattern) =>
        new vscode.RelativePattern(
          workspaceFolders[0],
          pathPattern.replace(/\\/g, "/")
        )
    );

    // Clear existing cache
    this.factoryFiles = [];
    this.factoryCache.clear();

    // Process each pattern in order
    for (const pattern of patterns) {
      const files = await vscode.workspace.findFiles(pattern);
      this.factoryFiles.push(...files);
      // Cache factory definitions for this pattern immediately
      await this.cacheFactoryDefinitions(files);
    }

    this.isInitialized = true;
  }

  private async cacheFactoryDefinitions(
    files: vscode.Uri[] = this.factoryFiles
  ) {
    for (const file of files) {
      const content = await vscode.workspace.fs.readFile(file);
      const text = new TextDecoder().decode(content);

      // Search for factory definitions
      const factoryRegex = /factory\s+:([a-zA-Z0-9_]+)\b/g;
      let match;

      while ((match = factoryRegex.exec(text)) !== null) {
        const factoryName = match[1];
        // Only cache if not already cached (first definition takes precedence)
        if (!this.factoryCache.has(factoryName)) {
          // Calculate line number of factory definition
          const lines = text.substring(0, match.index).split("\n");
          const lineNumber = lines.length - 1;
          // Cache file and line number
          this.factoryCache.set(factoryName, {
            uri: file,
            lineNumber: lineNumber,
          });
        }
      }
    }
  }

  async provideDocumentLinks(
    document: vscode.TextDocument
  ): Promise<vscode.DocumentLink[]> {
    // Return empty array if initialization is not complete
    if (!this.isInitialized) {
      return [];
    }

    const links: vscode.DocumentLink[] = [];
    const text = document.getText();

    // Regex pattern to match factory calls: create(:factory_name), create :factory_name, build(:factory_name), build :factory_name
    const factoryRegex =
      /(?:create|build)\s*(?:\(\s*)?(:[a-zA-Z0-9_]+)(?:\s*(?:,|\)|\n|$)|\s*,\s*[^)]*(?:\)|\n|$))/g;
    let match;

    while ((match = factoryRegex.exec(text)) !== null) {
      const factoryName = match[1].substring(1); // Remove the : prefix
      // Calculate range for just the :factory_name part
      const factoryNameStart = match.index + match[0].indexOf(match[1]);
      const factoryNameEnd = factoryNameStart + match[1].length;
      const startPos = document.positionAt(factoryNameStart);
      const endPos = document.positionAt(factoryNameEnd);
      const range = new vscode.Range(startPos, endPos);

      // Get factory file and line number from cache
      const factoryInfo = this.factoryCache.get(factoryName);
      if (factoryInfo) {
        const link = new vscode.DocumentLink(
          range,
          vscode.Uri.parse(
            `command:rails-factorybot-jump.gotoLine?${encodeURIComponent(
              JSON.stringify({
                uri: factoryInfo.uri.toString(),
                lineNumber: factoryInfo.lineNumber,
              })
            )}`
          )
        );
        link.tooltip = `Hold Cmd (Mac) or Ctrl (Windows) and click to jump to factory definition: ${factoryName}`;
        links.push(link);
      }
    }

    return links;
  }

  async findFactoryFile(factoryName: string): Promise<vscode.Uri | undefined> {
    // Wait for initialization if not complete
    if (!this.isInitialized) {
      await this.initializeFactoryFiles();
    }

    // Get factory file from cache
    const factoryInfo = this.factoryCache.get(factoryName);
    return factoryInfo?.uri;
  }
}

export { FactoryLinkProvider };
