import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App payment batch bootstrap', () => {
  it('initializes linked historical payment batches without breaking app startup', () => {
    expect(() => renderToStaticMarkup(<App />)).not.toThrow();
  });
});
