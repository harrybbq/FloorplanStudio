import type { Confidence, FurnitureSource } from '../../types';

/** Human label + a dot colour for a confidence level. */
export function confidenceMeta(confidence: Confidence): { label: string; dot: string } {
  switch (confidence) {
    case 'verified':
      return { label: 'Verified', dot: '#1a7a4a' }; // em
    case 'estimated':
      return { label: 'Estimated', dot: '#c8970a' }; // gold
    case 'user-entered':
      return { label: 'You entered', dot: '#8a8278' }; // ink-muted
  }
}

/** Human label for where dimensions came from. */
export function sourceLabel(source: FurnitureSource): string {
  switch (source) {
    case 'llm':
      return 'AI lookup';
    case 'scraper':
      return 'Web lookup';
    case 'catalog':
      return 'Catalog';
    case 'manual':
      return 'Manual';
  }
}
