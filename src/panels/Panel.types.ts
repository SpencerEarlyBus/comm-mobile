// features/sessions/panels/Panel.types.ts
export type PanelKey =
  | 'gesture_score'
  | 'posture_score'
  | 'motion_score'
  | 'reinforced_engagement'
  | 'content_relevance'
  | 'vocal_rhythm'
  | 'vocal_expressiveness'
  | 'interpretability'
  | 'filler_usage';

export interface PanelProps {
  sessionId: string;
  // add optional shared deps later (theme, analytics, etc.)
}
