# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2024-04-11

### Added

- Support for detecting `build_stubbed`, `build_stubbed_list`, `create_list`, `build_list` factory calls
- Improved factory call detection for consecutive calls

### Changed

- Refactored FactoryLinkProvider for better code organization
- Updated GitHub Actions workflow to use Node.js 22.x

### Fixed

- Enhanced factory call detection with comprehensive test coverage

## [1.1.0] - 2025-04-07

### Added

- Configurable factory paths through VSCode settings
- Test workflow for continuous integration

### Fixed

- Cross-platform path handling improvements
- Updated test cases to work with existing FactoryLinkProvider implementation

### Changed

- Updated README with new features and configuration options

## [1.0.0] - 2024-04-05

### Added

- Initial release of Rails FactoryBot Jump VSCode extension
- FactoryBot factory call detection in test files
- Clickable links for jumping to factory definitions
- Support for both `spec/factories` and `test/factories` directories
- Factory definition caching system
- Automatic cache updates when factory files are modified
- Basic command support (Cmd/Ctrl + click) for navigation

### Changed

- N/A

### Deprecated

- N/A

### Removed

- N/A

### Fixed

- N/A

### Security

- N/A
