'use client'

import { create } from 'zustand'

export type AppDialogId =
  | 'new-account'
  | 'new-transaction'
  | 'new-category'
  | 'edit-category'
  | 'new-budget'
  | 'copilot'
  | 'new-goal'
  | 'new-recurring'

type DialogStore = {
  active: AppDialogId | null
  /** Datos adicionales que algunos dialogs requieren (edit-category necesita el id). */
  payload: { id?: string } | null
  open: (id: AppDialogId, payload?: { id?: string }) => void
  close: () => void
}

export const useDialogStore = create<DialogStore>((set) => ({
  active: null,
  payload: null,
  open: (id, payload) => set({ active: id, payload: payload ?? null }),
  close: () => set({ active: null, payload: null }),
}))
