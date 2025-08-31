// features/sessions/panels/PanelRegistry.ts
import { PanelKey, PanelProps } from './Panel.types';
import GesturePanel from './GesturePanel';
import ReinforcedEngagementPanel from './ReinforcedEngagementPanel';
import ContentRelevancePanel from './ContentRelevancePanel';
import VocalRhythmPanel from './VocalRhythmPanel';
import InterpretabilityPanel from './InterpretabilityPanel';
import VocalExpressivenessPanel from './VocalExpressivenessPanel';
import FillerUsagePanel from './FillerUsagePanel';
import PosturePanel from './PosturePanel';
import MotionPanel from './MotionPanel';

// import others...

type PanelComponent = React.ComponentType<PanelProps>;

export const PANEL_REGISTRY: Record<PanelKey, PanelComponent> = {
  gesture_score: GesturePanel,
  posture_score: PosturePanel,
  motion_score: MotionPanel,
  reinforced_engagement:  ReinforcedEngagementPanel, 
  content_relevance: ContentRelevancePanel,     
  vocal_rhythm: VocalRhythmPanel,     
  vocal_expressiveness: VocalExpressivenessPanel, 
  interpretability: InterpretabilityPanel,     
  filler_usage: FillerUsagePanel,         
};
