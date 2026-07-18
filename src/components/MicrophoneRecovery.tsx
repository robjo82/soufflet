import { RotateCcw, Settings2 } from 'lucide-react';

interface MicrophoneRecoveryProps {
  error: string;
  canOpenSettings: boolean;
  detail: string;
  onRetry: () => void;
  onOpenSettings: () => void;
  variant?: 'setup' | 'tutorial';
}

export function MicrophoneRecovery({
  error,
  canOpenSettings,
  detail,
  onRetry,
  onOpenSettings,
  variant = 'tutorial',
}: MicrophoneRecoveryProps) {
  return (
    <div className={`microphone-recovery ${variant === 'setup' ? 'setup-note' : 'tutorial-limitation'}`} role="alert">
      <span>{error} {detail}</span>
      <div className="microphone-recovery-actions">
        {canOpenSettings && <button type="button" onClick={onOpenSettings}><Settings2 /> Ouvrir les réglages Android</button>}
        <button type="button" onClick={onRetry}><RotateCcw /> Réessayer</button>
      </div>
    </div>
  );
}
