import { useMemo, useCallback, useEffect } from 'react';

export interface StaffAllocationSliderProps {
  /** Unique ID for the slider input */
  id: string;
  /** Current allocation value (0-100) */
  value: number;
  /** Called when the allocation changes */
  onChange: (value: number) => void;
  /** Number of staff available for allocation */
  staffCount: number;
  /** Label text to display above the slider */
  label?: string;
  /** Helper text to display below the slider */
  helperText?: string;
  /** Custom width class (defaults to w-64) */
  className?: string;
}

/**
 * Generates valid allocation steps based on staff count.
 * Each staff member represents 1 step, so steps are 100/staffCount.
 * The final step is ALWAYS 100 to ensure full allocation is possible.
 *
 * Example: 3 staff → [0, 33, 67, 100]
 * Example: 4 staff → [0, 25, 50, 75, 100]
 */
function generateAllocationSteps(staffCount: number): number[] {
  if (staffCount <= 0) return [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]; // Fallback

  const steps: number[] = [0];
  const stepSize = 100 / staffCount;

  for (let i = 1; i < staffCount; i++) {
    steps.push(Math.round(stepSize * i));
  }

  // Always include 100 as the final step
  steps.push(100);

  return steps;
}

/**
 * Finds the nearest valid step for a given value
 */
function snapToNearestStep(value: number, steps: number[]): number {
  let nearest = steps[0];
  let minDiff = Math.abs(value - nearest);

  for (const step of steps) {
    const diff = Math.abs(value - step);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = step;
    }
  }

  return nearest;
}

/**
 * Reusable staff allocation slider component.
 * Ensures valid step increments based on staff count and always allows 100%.
 *
 * Use this component for all staff allocation sliders:
 * - Testing: Mechanic allocation
 * - Design: Designer allocation
 * - Commercial: Commercial staff allocation
 */
export function StaffAllocationSlider({
  id,
  value,
  onChange,
  staffCount,
  label,
  helperText,
  className = 'w-64',
}: StaffAllocationSliderProps) {
  const steps = useMemo(() => generateAllocationSteps(staffCount), [staffCount]);

  // Auto-snap value to nearest valid step on mount and when staffCount changes
  useEffect(() => {
    const snappedValue = snapToNearestStep(value, steps);
    if (snappedValue !== value) {
      onChange(snappedValue);
    }
  }, [steps]); // Only re-snap when steps change, not on every value change

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = parseInt(e.target.value, 10);
      const snappedValue = snapToNearestStep(rawValue, steps);
      onChange(snappedValue);
    },
    [steps, onChange]
  );

  // Calculate the step attribute - use 1 to allow smooth dragging, we snap in onChange
  // This allows the slider to move smoothly but always output valid values

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-secondary mb-2">
          {label}: {value}%
        </label>
      )}
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={handleChange}
        className={`${className} accent-[var(--accent-500)]`}
      />
      {helperText && <p className="text-xs text-muted mt-1">{helperText}</p>}
    </div>
  );
}
