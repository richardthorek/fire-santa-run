/**
 * ProgressBar component
 * Visual indicator of route completion progress
 */

export interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  showLabel?: boolean;
}

export function ProgressBar({ progress, height = 8, showLabel = false }: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          backgroundColor: '#E0E0E0',
          borderRadius: `${height / 2}px`,
          overflow: 'hidden',
          position: 'relative',
        }}
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            height: '100%',
            width: `${clampedProgress}%`,
            background: 'linear-gradient(90deg, #43A047 0%, #66BB6A 100%)',
            transition: 'width 0.3s ease',
            borderRadius: `${height / 2}px`,
          }}
        />
      </div>
      {showLabel && (
        <div
          style={{
            marginTop: '0.25rem',
            fontSize: '0.75rem',
            color: '#616161',
            textAlign: 'right',
          }}
        >
          {clampedProgress.toFixed(0)}% Complete
        </div>
      )}
    </div>
  );
}
