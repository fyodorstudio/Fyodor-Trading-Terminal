export type ChartEventLensDockData = {
  visible: boolean;
  title: string;
  description: string;
  countLabel: string;
  expanded: boolean;
  canEnableEvents: boolean;
  canBroadenImpact: boolean;
  onToggleExpanded: () => void;
  onShowEvents: () => void;
  onOpenSettings: () => void;
  onShowHighMedium: () => void;
};
