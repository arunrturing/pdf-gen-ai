# TypeScript Library Template

A well-structured TypeScript library template with type aliasing, modular directory structure, and modern development setup.

## Features

- TypeScript configuration with path aliasing
- ESLint setup with recommended rules
- Jest configuration for testing
- Clean code conventions
- Modular directory structure

## Installation

```bash
npm install ts-lib-template
```

## Usage

```typescript
import { createService } from 'ts-lib-template';

const service = createService({
  debug: true,
  timeout: 1500
});

const data = {
  id: 'example-1',
  name: 'Example Data',
  created: new Date(),
  metadata: {
    source: 'documentation'
    }
};

// Process data
const result = await service.processData(data);

// Check result
if (result.success && result.data) {
    console.log('Processed data:', result.data);
} else {
    console.error('Error:', result.error?.message);
}
```

## Project Structure

- **src/** - Source code
  - **index.ts** - Main entry point
  - **types/** - Type definitions
  - **utils/** - Utility functions
  - **modules/** - Feature modules
- **tests/** - Test files
  - **setup.ts** - Test setup
  - **modules/** - Module tests

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/ts-lib-template.git
cd ts-lib-template

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## License

MIT