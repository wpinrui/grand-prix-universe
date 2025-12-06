import { Settings, Volume2, Gauge, Monitor } from 'lucide-react';

interface OptionRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
}

function OptionRow({ icon, label, description }: OptionRowProps) {
  return (
    <div className="flex items-center justify-between p-4 card">
      <div className="flex items-center gap-4">
        <div className="text-muted">{icon}</div>
        <div>
          <p className="font-medium text-primary">{label}</p>
          <p className="text-sm text-muted">{description}</p>
        </div>
      </div>
      <span className="text-sm text-muted italic">Coming soon</span>
    </div>
  );
}

export function GameOptions() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-muted" />
        <h1 className="text-xl font-bold text-primary">Game Options</h1>
      </div>

      <div className="space-y-3">
        <OptionRow
          icon={<Volume2 className="w-5 h-5" />}
          label="Sound"
          description="Music and sound effects volume"
        />
        <OptionRow
          icon={<Gauge className="w-5 h-5" />}
          label="Game Speed"
          description="Simulation and animation speed"
        />
        <OptionRow
          icon={<Monitor className="w-5 h-5" />}
          label="Display"
          description="Graphics and UI settings"
        />
      </div>

      <p className="text-sm text-muted">
        Settings will be saved automatically when changed.
      </p>
    </div>
  );
}
