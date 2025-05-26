import * as vscode from "vscode";
import * as path from "path";

class FactoryLinkProvider implements vscode.DocumentLinkProvider {
  private factoryCache: Map<string, { uri: vscode.Uri; lineNumber: number }> =
    new Map();
  private traitCache: Map<
    string,
    { uri: vscode.Uri; lineNumber: number; factoryName: string }
  > = new Map();
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
    const defaultPath = "spec/factories/**/*.rb";
    const factoryPaths = config.get<string[]>("factoryPaths", [defaultPath]);

    // Factory file search patterns - normalize all paths to forward slashes for RelativePattern
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
    this.traitCache.clear();

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

      // Search for trait definitions within factories
      this.cacheTraitDefinitions(file, text);
    }
  }

  private cacheTraitDefinitions(file: vscode.Uri, text: string) {
    // Find factory blocks first to get context for traits
    const factoryBlockRegex =
      /factory\s+:([a-zA-Z0-9_]+)\s+do([\s\S]*?)(?=\n\s*(?:factory|end\s*$))/g;
    let factoryMatch;

    while ((factoryMatch = factoryBlockRegex.exec(text)) !== null) {
      const factoryName = factoryMatch[1];
      const factoryBlock = factoryMatch[2];
      const factoryStartIndex = factoryMatch.index;

      // Search for trait definitions within this factory block
      const traitRegex = /trait\s+:([a-zA-Z0-9_]+)\s+do/g;
      let traitMatch;

      while ((traitMatch = traitRegex.exec(factoryBlock)) !== null) {
        const traitName = traitMatch[1];
        const traitKey = `${factoryName}:${traitName}`;

        // Only cache if not already cached (first definition takes precedence)
        if (!this.traitCache.has(traitKey)) {
          // Calculate absolute position of trait definition
          const traitIndex = factoryStartIndex + traitMatch.index;
          const lines = text.substring(0, traitIndex).split("\n");
          const lineNumber = lines.length - 1;

          // Cache trait with factory context
          this.traitCache.set(traitKey, {
            uri: file,
            lineNumber: lineNumber,
            factoryName: factoryName,
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

    // Regex pattern to match factory calls with traits:
    //   create(:factory_name, :trait1, :trait2, options)
    //   build(:factory_name, :trait1, :trait2, options)
    //   etc.
    const factoryCallRegex =
      /(?:create|create_list|build|build_list|build_stubbed|build_stubbed_list)\s*(?:\(\s*)?((:[a-zA-Z0-9_]+)(?:\s*,\s*(:[a-zA-Z0-9_]+))*)\s*(?:,\s*[^)]*)?(?:\)|\n|$)/g;
    let match;

    while ((match = factoryCallRegex.exec(text)) !== null) {
      const fullMatch = match[1]; // The part with factory name and traits
      const factoryName = match[2].substring(1); // Remove the : prefix from factory name

      // Create link for factory name
      const factoryNameMatch = match[2];
      const factoryNameStart = match.index + match[0].indexOf(factoryNameMatch);
      const factoryNameEnd = factoryNameStart + factoryNameMatch.length;
      const factoryRange = new vscode.Range(
        document.positionAt(factoryNameStart),
        document.positionAt(factoryNameEnd)
      );

      // Get factory file and line number from cache
      const factoryInfo = this.factoryCache.get(factoryName);
      if (factoryInfo) {
        const factoryLink = new vscode.DocumentLink(
          factoryRange,
          vscode.Uri.parse(
            `command:rails-factorybot-jump.gotoLine?${encodeURIComponent(
              JSON.stringify({
                uri: factoryInfo.uri.toString(),
                lineNumber: factoryInfo.lineNumber,
              })
            )}`
          )
        );
        factoryLink.tooltip = `Hold Cmd (Mac) or Ctrl (Windows) and click to jump to factory definition: ${factoryName}`;
        links.push(factoryLink);
      }

      // Find and create links for traits
      const traitRegex = /:([a-zA-Z0-9_]+)/g;
      let traitMatch;
      traitRegex.lastIndex = 0; // Reset regex

      // Skip the first match (factory name)
      traitRegex.exec(fullMatch);

      while ((traitMatch = traitRegex.exec(fullMatch)) !== null) {
        const traitName = traitMatch[1];
        const traitKey = `${factoryName}:${traitName}`;

        // Calculate absolute position of trait symbol
        const traitSymbolStart =
          match.index + match[0].indexOf(fullMatch) + traitMatch.index;
        const traitSymbolEnd = traitSymbolStart + traitMatch[0].length;
        const traitRange = new vscode.Range(
          document.positionAt(traitSymbolStart),
          document.positionAt(traitSymbolEnd)
        );

        // Get trait file and line number from cache
        const traitInfo = this.traitCache.get(traitKey);
        if (traitInfo) {
          const traitLink = new vscode.DocumentLink(
            traitRange,
            vscode.Uri.parse(
              `command:rails-factorybot-jump.gotoLine?${encodeURIComponent(
                JSON.stringify({
                  uri: traitInfo.uri.toString(),
                  lineNumber: traitInfo.lineNumber,
                })
              )}`
            )
          );
          traitLink.tooltip = `Hold Cmd (Mac) or Ctrl (Windows) and click to jump to trait definition: ${traitName} in factory ${factoryName}`;
          links.push(traitLink);
        }
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
