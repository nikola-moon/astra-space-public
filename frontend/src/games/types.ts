import type { Stage } from '../lib/types';

export interface GameProps {
  stage: Stage;
  /** Fin de partie : score (ou null) et phrase de bilan affichée par Nova. */
  onDone: (score: number | null, summary: string) => void;
}
