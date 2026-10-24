// @vitest-environment jsdom
// jsdom: the dialog renders into the document, and i18n touches it.
import i18n from '@/i18n'

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ResetPasswordDialog } from './UserDialogs'

const mutate = vi.fn((_variables: { id: number; temporaryPassword: string }, options: { onSuccess: () => void }) =>
  options.onSuccess())

// The dialog's other hooks aren't used here; only the reset mutation is replaced.
vi.mock('./queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./queries')>()),
  useResetUserPassword: () => ({ mutate, isPending: false, isError: false, error: null }),
}))

afterEach(() => {
  cleanup()
  mutate.mockClear()
})

describe('ResetPasswordDialog', () => {
  it('proposes a temporary password and shows the saved one to hand over', async () => {
    render(<ResetPasswordDialog account={{ id: 7, name: 'Ana' }} onOpenChange={() => {}} />)
    const input = screen.getByLabelText(i18n.t('users.reset.password')) as HTMLInputElement
    const proposed = input.value
    expect(proposed).toHaveLength(12)

    await userEvent.click(screen.getByRole('button', { name: i18n.t('users.reset.save') }))

    expect(mutate).toHaveBeenCalledWith({ id: 7, temporaryPassword: proposed }, expect.anything())
    expect(screen.getByText(proposed)).toBeTruthy()
    expect(screen.getByText(i18n.t('users.reset.saved', { name: 'Ana' }))).toBeTruthy()
  })

  it('generates another one on demand', async () => {
    render(<ResetPasswordDialog account={{ id: 7, name: 'Ana' }} onOpenChange={() => {}} />)
    const input = screen.getByLabelText(i18n.t('users.reset.password')) as HTMLInputElement
    const first = input.value

    await userEvent.click(screen.getByRole('button', { name: i18n.t('users.reset.generate') }))

    expect(input.value).not.toBe(first)
    expect(input.value).toHaveLength(12)
  })

  it('rejects a temporary password that is too short', async () => {
    render(<ResetPasswordDialog account={{ id: 7, name: 'Ana' }} onOpenChange={() => {}} />)
    const input = screen.getByLabelText(i18n.t('users.reset.password'))

    await userEvent.clear(input)
    await userEvent.type(input, 'short')
    await userEvent.click(screen.getByRole('button', { name: i18n.t('users.reset.save') }))

    expect(await screen.findByText(i18n.t('validation.passwordTooShort', { count: 8 }))).toBeTruthy()
    expect(mutate).not.toHaveBeenCalled()
  })
})
