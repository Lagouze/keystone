interface TxHashProps {
  hash: string
  explorerUrl: string
}

/** Abbreviated transaction hash linking to stellar.expert. Render it only for confirmed chain entries. */
export function TxHash({ hash, explorerUrl }: TxHashProps) {
  const short = hash.length > 12 ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : hash
  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noreferrer"
      title={hash}
      className="font-mono text-xs text-accent underline-offset-2 hover:underline"
    >
      {short}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens stellar.expert)</span>
    </a>
  )
}
