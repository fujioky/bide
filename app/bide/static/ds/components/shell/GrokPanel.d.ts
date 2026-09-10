export interface GrokMessage { role: "ai" | "user"; text: string; }
export interface GrokPanelProps {
  messages: GrokMessage[];
  /** 85%-height bottom sheet with drag handle instead of the 400px right rail. */
  mobile?: boolean;
  placeholder?: string;
  onClose?: () => void;
  style?: React.CSSProperties;
}
export function GrokPanel(props: GrokPanelProps): JSX.Element;
