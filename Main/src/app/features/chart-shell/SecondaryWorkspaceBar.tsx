import { ArrowLeft, FlaskConical, Palette } from "lucide-react";

interface SecondaryWorkspaceBarProps {
  title: string;
  onBackToCharts: () => void;
  onBackToPrototypes?: () => void;
  onOpenAppSettings: () => void;
}

export function SecondaryWorkspaceBar({
  title,
  onBackToCharts,
  onBackToPrototypes,
  onOpenAppSettings,
}: SecondaryWorkspaceBarProps) {
  return (
    <header className="secondary-workspace-bar">
      <div className="secondary-workspace-navigation">
        <button type="button" onClick={onBackToCharts}>
          <ArrowLeft size={16} />
          Back to Charts
        </button>
        {onBackToPrototypes ? (
          <button type="button" onClick={onBackToPrototypes}>
            <FlaskConical size={15} />
            Prototypes
          </button>
        ) : null}
      </div>
      <strong>{title}</strong>
      <button type="button" onClick={onOpenAppSettings} aria-label="Open appearance settings" title="Open appearance settings">
        <Palette size={16} />
      </button>
    </header>
  );
}
