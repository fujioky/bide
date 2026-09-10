export interface SliderControlProps {
  label: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  /** Suffix printed after the readout, e.g. "px" or "%". */
  unit?: string;
  onChange?: (value: number) => void;
  style?: React.CSSProperties;
}
export function SliderControl(props: SliderControlProps): JSX.Element;
