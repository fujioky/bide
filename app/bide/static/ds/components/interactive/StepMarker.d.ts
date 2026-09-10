export interface StepMarkerProps {
  /** Step labels, in order. */
  steps: string[];
  /** Index of the current step; earlier steps render as completed. */
  active?: number;
  style?: React.CSSProperties;
}
export function StepMarker(props: StepMarkerProps): JSX.Element;
