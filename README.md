# Rails FactoryBot Jump

A VSCode extension that enables quick navigation from Rails test files to FactoryBot factory definitions.

## Features

- Automatically detects FactoryBot factory calls (`create(:factory_name)`, `build(:factory_name)`) in test files
- Provides clickable links to jump to the corresponding factory definition
- Supports both `spec/factories` and `test/factories` directories
- Caches factory definitions for faster navigation
- Automatically updates cache when factory files are modified
- Configurable factory file search paths

## Usage

1. Open a Rails test file containing FactoryBot factory calls
2. Hover over a factory call (e.g., `create(:user)`)
3. Hold Cmd (Mac) or Ctrl (Windows) and click the link to jump to the factory definition

## Configuration

You can configure the paths where the extension searches for factory files by adding the following to your VSCode settings (settings.json):

```json
{
  "rails-factorybot-jump.factoryPaths": [
    "spec/factories/**/*.rb",
    "test/factories/**/*.rb",
    "custom/path/to/factories/**/*.rb"
  ]
}
```

- The default path is `["spec/factories/**/*.rb"]`
- You can specify multiple paths using glob patterns
- Changes to the configuration will automatically update the factory search paths

## Requirements

- VSCode 1.60.0 or higher
- Ruby on Rails project with FactoryBot

## Known Issues

- Currently only supports factory calls with simple arguments
- May not work correctly with complex factory inheritance or traits

## Development

### Prerequisites

- Node.js
- npm or yarn
- VSCode Extension Development Tools

### Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Open the project in VSCode
4. Press F5 to start debugging

## License

MIT License

## Contributing

Please report bugs and feature requests through Issues or Pull Requests.
