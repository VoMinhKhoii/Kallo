import { cn } from '@/lib/core/ui/cn';

interface CalorieRingProps {
  /** Share of the target eaten, 0–1. Over target clamps to a full sweep. */
  fraction: number;
  /** Past the completeness floor: the arc turns green, as a met nutrient does. */
  met: boolean;
  /** Outer diameter in px. */
  size: number;
  strokeWidth: number;
  className?: string;
}

/**
 * A day's calorie progress: a faint track and a rounded arc swept clockwise
 * from 12 o'clock — the Flutter week strip's `WeekDayRingPainter`, in the
 * micronutrient palette (ink while short, green once the day is met).
 *
 * Decorative: the day button names the same numbers in its accessible label.
 */
export function CalorieRing({
  fraction,
  met,
  size,
  strokeWidth,
  className,
}: CalorieRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const sweep = Math.min(Math.max(fraction, 0), 1) * circumference;
  const center = size / 2;

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('pointer-events-none', className)}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-kallo-track"
      />
      {/* A zero-length round-capped dash still paints a dot, so an empty day
          draws no arc at all rather than a stray cap at 12 o'clock. */}
      {sweep > 0 ? (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${sweep} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
          className={met ? 'stroke-kallo-success-accent' : 'stroke-kallo-text'}
        />
      ) : null}
    </svg>
  );
}
