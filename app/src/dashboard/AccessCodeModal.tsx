import { useState } from 'react'
import { Button } from '../ui/index.ts'
import { Modal } from '../ui/Modal.tsx'

/** Asks for the team access code that a hosted keeper requires before it deploys, posts or signs anything. */
export function AccessCodeModal({ open, onSave, onClose }: { open: boolean; onSave(code: string): void; onClose(): void }) {
  const [code, setCode] = useState('')
  return (
    <Modal open={open} title="Team access code" onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (code.trim()) onSave(code)
          setCode('')
        }}
      >
        <p className="text-sm text-ink-muted">
          This keeper acts on Stellar Testnet for the team. Enter the access code you were given to start sessions and move
          collateral. Reading the dashboard needs no code.
        </p>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          aria-label="Access code"
          placeholder="Access code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="glass h-12 w-full rounded-full px-5 text-sm text-ink outline-none placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-chain"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button type="submit" variant="primary" disabled={!code.trim()}>
            Unlock actions
          </Button>
        </div>
      </form>
    </Modal>
  )
}
