'use client'

import * as React from 'react'
import { Select as RadixSelect } from 'radix-ui'

import { cn } from '@/lib/utils'
import { icons } from '@/lib/design/icons'

const Select = RadixSelect.Root
const SelectGroup = RadixSelect.Group
const SelectValue = RadixSelect.Value

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadixSelect.Trigger>) {
  const ChevronDown = icons['chevron-down']
  return (
    <RadixSelect.Trigger
      className={cn(
        'bg-bg text-text border-border-default flex h-10 w-full items-center justify-between gap-2 rounded-[8px] border px-3 text-sm',
        'transition-colors duration-150 outline-none',
        'focus:border-border-emphasis focus:ring-2 focus:ring-[color:var(--accent-ai)]/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[placeholder]:text-text-tertiary',
        '[&>span]:line-clamp-1',
        className,
      )}
      {...props}
    >
      {children}
      <RadixSelect.Icon asChild>
        <ChevronDown
          strokeWidth={1.5}
          className="text-text-tertiary h-4 w-4 shrink-0"
        />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof RadixSelect.ScrollUpButton>) {
  const ChevronUp = icons['chevron-up']
  return (
    <RadixSelect.ScrollUpButton
      className={cn(
        'text-text-tertiary flex h-6 cursor-default items-center justify-center',
        className,
      )}
      {...props}
    >
      <ChevronUp strokeWidth={1.5} className="size-4" />
    </RadixSelect.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof RadixSelect.ScrollDownButton>) {
  const ChevronDown = icons['chevron-down']
  return (
    <RadixSelect.ScrollDownButton
      className={cn(
        'text-text-tertiary flex h-6 cursor-default items-center justify-center',
        className,
      )}
      {...props}
    >
      <ChevronDown strokeWidth={1.5} className="size-4" />
    </RadixSelect.ScrollDownButton>
  )
}

function SelectContent({
  className,
  children,
  position = 'popper',
  sideOffset = 6,
  collisionPadding = 12,
  ...props
}: React.ComponentProps<typeof RadixSelect.Content>) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        position={position}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'border-border-default bg-surface-elevated text-text relative z-[60] flex max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] flex-col overflow-hidden rounded-[12px] border shadow-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <RadixSelect.Viewport className="flex-1 overflow-y-auto p-1">
          {children}
        </RadixSelect.Viewport>
        <SelectScrollDownButton />
      </RadixSelect.Content>
    </RadixSelect.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadixSelect.Item>) {
  const Check = icons.check
  return (
    <RadixSelect.Item
      className={cn(
        'text-text-secondary data-[highlighted]:bg-surface-hover data-[highlighted]:text-text',
        'relative flex h-9 cursor-pointer select-none items-center rounded-[6px] py-1.5 pl-3 pr-8 text-sm outline-none',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="absolute right-2 inline-flex items-center">
        <Check strokeWidth={1.5} className="h-3.5 w-3.5" />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof RadixSelect.Label>) {
  return (
    <RadixSelect.Label
      className={cn(
        'text-text-tertiary px-3 py-1.5 text-[11px] uppercase tracking-[0.08em]',
        className,
      )}
      {...props}
    />
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof RadixSelect.Separator>) {
  return (
    <RadixSelect.Separator
      className={cn('bg-border-default mx-1 my-1 h-px', className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
