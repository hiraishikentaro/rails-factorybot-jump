# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VSCode extension that enables "Go to Definition" functionality for FactoryBot factories in Ruby/Rails test files. When users Cmd+click (Mac) or Ctrl+click (Windows) on factory calls like `create(:user)`, the extension navigates to the factory definition.

## Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Run linter
npm run lint

# Run all tests (unit + integration)
npm run test:all

# Run unit tests only (faster)
npm run test:unit

# Run integration tests only
npm run test:integration
```

## Architecture

### Core Flow

1. **Extension Entry** (`src/extension.ts`): Registers `FactoryLinkProvider` as a DocumentLinkProvider for Ruby files and sets up file watchers for factory files.

2. **FactoryLinkProvider** (`src/providers/factoryLinkProvider.ts`): Main orchestrator that:

   - Initializes by scanning factory files on workspace open
   - Detects factory calls (`create`, `build`, etc.) in Ruby test files using regex patterns
   - Creates clickable DocumentLinks that navigate to factory/trait definitions

3. **Service Layer**:

   - `FactoryParser`: Parses Ruby factory files to extract factory and trait definitions with line numbers
   - `CacheManager`: In-memory cache with TTL for factory/trait locations; tracks file-based cache for efficient updates
   - `ConfigurationManager`: Handles VSCode settings (`rails-factorybot-jump.*`)
   - `FileSearcher`: Finds factory files using configurable glob patterns

4. **Models**: `Factory`, `Trait`, `Location` - Data classes representing parsed definitions

### Key Regex Patterns (`src/utils/regexPatterns.ts`)

- `FACTORY_DEFINITION_PATTERN`: Matches `factory :name` declarations
- `TRAIT_DEFINITION_PATTERN`: Matches `trait :name do` within factories
- `getFactoryCallPattern()`: Dynamically generates pattern for supported methods (create, build, build_stubbed, etc.)

### Configuration

Users can customize via `settings.json`:

- `rails-factorybot-jump.factoryPaths`: Array of glob patterns (default: `["spec/factories/**/*.rb"]`)
- `rails-factorybot-jump.cacheTimeout`: Cache TTL in seconds
- `rails-factorybot-jump.parallelBatchSize`: Batch size for parallel file parsing

## Testing

Tests are split into:

- **Unit tests** (`src/test/unit/`): Test individual services/models without VSCode integration
- **Integration tests** (`src/test/suite/`): Full extension tests with VSCode test infrastructure

Both use Mocha as the test framework and run in a VSCode test environment via `@vscode/test-electron`.
