import type {Config} from 'jest';
import {defaults} from 'jest-config';
const config: Config = {
  verbose: true,
  testEnvironment: 'node',
  transformIgnorePatterns: [
    "node_modules/(?!(mjs|@project-serum|@solana|@metaplex-foundation|@coral-xyz|ts-jest)/)"
  ],
  // moduleDirectories: [...defaults.moduleDirectories, "node_modules/@coral-xyz", 'bower_components'],

  globals: {
    'ts-jest': {
      tsconfig: {
        module: 'ESNext',
      }
    }
  }
};

export default config;