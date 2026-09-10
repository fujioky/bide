export interface PlaygroundProps {
  /** Language shown in the picker. */
  lang?: string;
  code?: string;
  /** Result text under the dashed divider. */
  output?: string;
  editable?: boolean;
  style?: React.CSSProperties;
}
export function Playground(props: PlaygroundProps): JSX.Element;
