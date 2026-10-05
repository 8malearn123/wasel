// model-viewer is a custom element. React's JSX does not know it, so the tag is
// declared here rather than silenced at every use.
declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        poster?: string;
        alt?: string;
        'camera-controls'?: boolean;
        'touch-action'?: string;
        'auto-rotate'?: boolean;
        'auto-rotate-delay'?: string;
        'shadow-intensity'?: string;
        exposure?: string;
        loading?: string;
        reveal?: string;
      },
      HTMLElement
    >;
  }
}
