'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Field } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateCopilotPreferences } from '@/app/(app)/copilot/actions'

type Provider = 'openai' | 'anthropic'
type Effort = 'minimal' | 'low' | 'medium' | 'high'
type Verbosity = 'low' | 'medium' | 'high'

export type CopilotOverride = {
  provider?: Provider
  model?: string
  reasoningEffort?: Effort
  textVerbosity?: Verbosity
} | null

const DEFAULT = 'default'
const PROVIDER_LABEL: Record<Provider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
}

/**
 * Selector de modelo/proveedor del copiloto por usuario. Cada control tiene la
 * opción "Por defecto", que vuelve al modelo del operador (env). Lo elegido se
 * guarda en profiles.aiProfile.copilot y resolveCopilotProvider lo aplica.
 */
export function CopilotModelSelector({
  operatorProvider,
  operatorModel,
  modelOptions,
  override,
}: {
  operatorProvider: Provider
  operatorModel: string
  modelOptions: Record<Provider, string[]>
  override: CopilotOverride
}) {
  const router = useRouter()
  const [saving, startSaving] = useTransition()

  const [provider, setProvider] = useState<Provider | typeof DEFAULT>(
    override?.provider ?? DEFAULT,
  )
  const [model, setModel] = useState<string>(override?.model ?? DEFAULT)
  const [effort, setEffort] = useState<Effort | typeof DEFAULT>(
    override?.reasoningEffort ?? DEFAULT,
  )
  const [verbosity, setVerbosity] = useState<Verbosity | typeof DEFAULT>(
    override?.textVerbosity ?? DEFAULT,
  )

  const effectiveProvider: Provider =
    provider === DEFAULT ? operatorProvider : provider
  const models = useMemo(
    () => modelOptions[effectiveProvider] ?? [],
    [modelOptions, effectiveProvider],
  )

  function onProviderChange(v: string) {
    setProvider(v as Provider | typeof DEFAULT)
    // Cambiar de proveedor invalida el modelo elegido (otro catálogo).
    setModel(DEFAULT)
  }

  function save() {
    startSaving(async () => {
      const res = await updateCopilotPreferences({
        provider: provider === DEFAULT ? null : provider,
        model: model === DEFAULT ? null : model,
        reasoningEffort: effort === DEFAULT ? null : effort,
        textVerbosity: verbosity === DEFAULT ? null : verbosity,
      })
      if (!res.ok) {
        toast.error(res.error.message)
        return
      }
      toast.success('Preferencias del copiloto guardadas.')
      router.refresh()
    })
  }

  function reset() {
    setProvider(DEFAULT)
    setModel(DEFAULT)
    setEffort(DEFAULT)
    setVerbosity(DEFAULT)
    startSaving(async () => {
      const res = await updateCopilotPreferences({
        provider: null,
        model: null,
        reasoningEffort: null,
        textVerbosity: null,
      })
      if (!res.ok) {
        toast.error(res.error.message)
        return
      }
      toast.success('Restablecido al modelo del operador.')
      router.refresh()
    })
  }

  return (
    <div className="border-border-default bg-surface flex flex-col gap-4 rounded-[12px] border p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-text text-sm font-semibold">Modelo del copiloto</h3>
        <p className="text-text-secondary text-[13px]">
          Elige qué modelo razona tus finanzas. Por defecto usa el del operador
          ({PROVIDER_LABEL[operatorProvider]} {operatorModel}). Necesitas una key
          con scope Generación / Chat para el proveedor elegido.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Proveedor">
          <Select value={provider} onValueChange={onProviderChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT}>Por defecto del operador</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Modelo">
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT}>Por defecto</SelectItem>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Esfuerzo de razonamiento">
          <Select value={effort} onValueChange={(v) => setEffort(v as Effort | typeof DEFAULT)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT}>Por defecto</SelectItem>
              <SelectItem value="minimal">Mínimo</SelectItem>
              <SelectItem value="low">Bajo</SelectItem>
              <SelectItem value="medium">Medio</SelectItem>
              <SelectItem value="high">Alto</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Verbosidad">
          <Select value={verbosity} onValueChange={(v) => setVerbosity(v as Verbosity | typeof DEFAULT)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT}>Por defecto</SelectItem>
              <SelectItem value="low">Baja</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={saving}>
          Restablecer
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </div>
  )
}
