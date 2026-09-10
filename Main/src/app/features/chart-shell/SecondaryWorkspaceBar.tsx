import { ArrowLeft, Palette } from "lucide-react";

interface SecondaryWorkspaceBarProps {
  title: string;
  onBackToCharts: () => void;
  onOpenAppSettings: () => void;
}

export function SecondaryWorkspaceBar({
  title,
  onBackToCharts,
  onOpenAppSettings,
}: SecondaryWorkspaceBarProps) {
  return (
    <header className="secondary-workspace-bar">
      <button type="button" onClick={onBackToCharts}>
        <ArrowLeft size={16} />
        Back to Charts
      </button>
      <strong>{title}</strong>
      <button type="button" onClick={onOpenAppSettings} aria-label="Open appearance settings" title="Open appearance settings">
        <Palette size={16} />
      </button>
    </header>
  );
}
