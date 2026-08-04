import { describe, expect, it } from 'vitest';
import { INITIAL_CREATORS, INITIAL_PROJECTS } from './pages/OperationalPages';

describe('project prototype fixtures', () => {
  it('creates one stable creator engagement for every displayed project creator', () => {
    const creatorIds = new Set(INITIAL_CREATORS.map((creator) => creator.id));

    INITIAL_PROJECTS.forEach((project) => {
      const references = project.creatorProfiles ?? [];
      expect(references).toHaveLength(project.creators);
      expect(new Set(references.map((reference) => reference.creatorId)).size).toBe(references.length);
      expect(new Set(references.map((reference) => reference.engagementId)).size).toBe(references.length);
      expect(references.every((reference) => creatorIds.has(reference.creatorId))).toBe(true);
      expect(references.every((reference) => reference.projectId === project.projectId)).toBe(true);
    });
  });

  it('does not claim invoices or payment lists that are absent from initial app state', () => {
    INITIAL_PROJECTS.forEach((project) => {
      expect(project.invoiceCount).toBe(0);
      expect(project.paymentOrder).toBe('待生成');
    });
  });
});
