type Props = {
  className?: string;
  variant?: "wordmark" | "compact";
};

const WORDMARK = `
  ▄▄▄       ▓█████  ▒█████   ███▄    █
 ▒████▄     ▓█   ▀ ▒██▒  ██▒ ██ ▀█   █
 ▒██  ▀█▄   ▒███   ▒██░  ██▒▓██  ▀█ ██▒
 ░██▄▄▄▄██  ▒▓█  ▄ ▒██   ██░▓██▒  ▐▌██▒
  ▓█   ▓██▒░▒████▒░ ████▓▒░▒██░   ▓██░
  ▒▒   ▓▒█░░░ ▒░ ░░ ▒░▒░▒░ ░ ▒░   ▒ ▒
   ▒   ▒▒ ░ ░ ░  ░  ░ ▒ ▒░ ░ ░░   ░ ▒░
   ░   ▒      ░   ░ ░ ░ ▒     ░   ░ ░
       ░  ░   ░  ░    ░ ░           ░
            t · e · r · m · i · n · a · l
`;

const COMPACT = `
  /\\___ /\\___ ___  _ _
 / _  // -_)/ _ \\/ // /
/_/_/_/\\__//_//_/\\_//
`;

export function AsciiLogo({ className = "", variant = "wordmark" }: Props) {
  return (
    <pre
      aria-hidden
      className={`ascii text-accent/90 glow-accent select-none ${className}`}
    >
      {variant === "wordmark" ? WORDMARK : COMPACT}
    </pre>
  );
}
