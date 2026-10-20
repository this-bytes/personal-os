import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Shared setup for the client tests.
 *
 * Testing Library unmounts the tree after every test so a component cannot
 * leak DOM into the next one.
 */
afterEach(() => {
  cleanup();
});
