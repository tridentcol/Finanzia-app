'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field } from '@/components/ui/field'
import {
  createEmailAlias,
  deleteEmailAlias,
  BANK_LABELS,
  SUPPORTED_BANKS,
  type SupportedBank,
} from './actions'

const EMAIL_DOMAIN = 'inbox.finanzia.app'

type Alias = {
  id: string
  aliasSlug: string
  bank: string
  accountId: string | null
  createdAt: Date
}

type Account = { id: string; name: string; currency: string }

type Props = {
  aliases: Alias[]
  accounts: Account[]
  userId: string
}

export function IntegracionesBancariasClient({ aliases, accounts }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selectedBank, setSelectedBank] = useState<SupportedBank>('bancolombia')
  const [selectedAccount, setSelectedAccount] = useState<string>('')

  function handleCreate() {
    startTransition(async () => {
      const result = await createEmailAlias({
        bank: selectedBank,
        accountId: selectedAccount || null,
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Alias creado. Configura el reenvío en tu banco.')
      router.refresh()
    })
  }

  function handleDelete(aliasId: string) {
    startTransition(async () => {
      const result = await deleteEmailAlias(aliasId)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Alias eliminado.')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Aliases activos */}
      {aliases.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-text text-sm font-semibold">Alias activos</h2>
          <ul className="flex flex-col gap-3">
            {aliases.map((alias) => {
              const email = `${alias.aliasSlug}@${EMAIL_DOMAIN}`
              const bankLabel =
                alias.bank in BANK_LABELS
                  ? BANK_LABELS[alias.bank as SupportedBank]
                  : alias.bank
              return (
                <li
                  key={alias.id}
                  className="border-border-default bg-surface flex flex-wrap items-center justify-between gap-4 rounded-[12px] border p-4"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-text text-[13px] font-mono">{email}</span>
                    <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                      {bankLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(email)
                        toast.success('Email copiado.')
                      }}
                      className="rounded-[6px] border border-border-default px-2.5 py-1 text-[12px] text-text-tertiary transition-colors hover:border-border-emphasis hover:bg-surface-hover hover:text-text-secondary"
                    >
                      Copiar
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(alias.id)}
                      disabled={pending}
                    >
                      Eliminar
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Crear nuevo alias */}
      <section className="border-border-default bg-surface flex flex-col gap-4 rounded-[12px] border p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-text text-sm font-semibold">Crear alias</h2>
          <p className="text-text-tertiary text-xs max-w-prose">
            Obtienes una dirección única. Configura tu banco para reenviar las
            alertas de movimiento a esa dirección — Finanzia las registra
            automáticamente.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Banco">
            <Select
              value={selectedBank}
              onValueChange={(v) => setSelectedBank(v as SupportedBank)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_BANKS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {BANK_LABELS[b]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Cuenta destino (opcional)">
            <Select
              value={selectedAccount}
              onValueChange={setSelectedAccount}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin vincular" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin vincular</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Button onClick={handleCreate} disabled={pending}>
          {pending ? 'Creando…' : 'Crear alias de email'}
        </Button>
      </section>

      {/* How it works */}
      <section className="flex flex-col gap-3">
        <h2 className="text-text text-sm font-semibold">Cómo funciona</h2>
        <ol className="text-text-secondary flex flex-col gap-2 text-[13px]">
          <li>
            <span className="text-text font-semibold">1.</span> Crea un alias para tu banco. Obtienes
            una dirección tipo <span className="font-mono">abc123@{EMAIL_DOMAIN}</span>.
          </li>
          <li>
            <span className="text-text font-semibold">2.</span> En la app de tu banco, configura que
            las notificaciones de movimientos se reenvíen a esa dirección.
          </li>
          <li>
            <span className="text-text font-semibold">3.</span> Cada vez que el banco te notifique,
            Finanzia parsea el email y crea la transacción automáticamente en la
            cuenta vinculada.
          </li>
        </ol>
      </section>
    </div>
  )
}
