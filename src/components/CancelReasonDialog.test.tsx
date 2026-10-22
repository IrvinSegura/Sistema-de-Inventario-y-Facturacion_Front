// @vitest-environment jsdom
// jsdom: the dialog renders into the document, and i18n touches it.
import '@/i18n'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type CancelMutation, CancelReasonDialog, type CancelReasonTexts } from './CancelReasonDialog'

const texts: CancelReasonTexts = {
  title: 'Cancel #7',
  description: 'It cannot be undone.',
  reason: 'Reason',
  reasonRequired: 'Write a reason',
  keep: 'Keep it',
  confirm: 'Cancel it',
  cancelling: 'Cancelling…',
}

function fakeMutation(overrides: Partial<CancelMutation> = {}): CancelMutation {
  return {
    mutate: vi.fn((_variables, options) => options.onSuccess()),
    reset: vi.fn(),
    isPending: false,
    error: null,
    ...overrides,
  }
}

function renderDialog(mutation: CancelMutation, extra: { errorText?: (error: Error) => string } = {}) {
  const onOpenChange = vi.fn()
  const onCancelled = vi.fn()
  render(<CancelReasonDialog id={7} mutation={mutation} texts={texts} onOpenChange={onOpenChange}
    onCancelled={onCancelled} {...extra} />)
  return { onOpenChange, onCancelled }
}

afterEach(cleanup)

describe('CancelReasonDialog', () => {
  it('asks for a reason before cancelling', async () => {
    const mutation = fakeMutation()
    renderDialog(mutation)

    await userEvent.type(screen.getByLabelText(texts.reason), '   ')
    await userEvent.click(screen.getByRole('button', { name: texts.confirm }))

    expect(await screen.findByText(texts.reasonRequired)).toBeTruthy()
    expect(mutation.mutate).not.toHaveBeenCalled()
  })

  it('sends the trimmed reason, then closes, resets and reports it', async () => {
    const mutation = fakeMutation()
    const { onOpenChange, onCancelled } = renderDialog(mutation)

    await userEvent.type(screen.getByLabelText(texts.reason), '  Wrong supplier ')
    await userEvent.click(screen.getByRole('button', { name: texts.confirm }))

    expect(mutation.mutate).toHaveBeenCalledWith({ id: 7, reason: 'Wrong supplier' }, expect.anything())
    expect(mutation.reset).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onCancelled).toHaveBeenCalledOnce()
  })

  it("can't be closed while the request runs", () => {
    const { onOpenChange } = renderDialog(fakeMutation({ isPending: true }))

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

    expect(onOpenChange).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: texts.keep }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: texts.cancelling })).toBeTruthy()
  })

  it('closes and resets when kept', async () => {
    const mutation = fakeMutation()
    const { onOpenChange } = renderDialog(mutation)

    await userEvent.click(screen.getByRole('button', { name: texts.keep }))

    expect(mutation.reset).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows the failed request with the given message', () => {
    renderDialog(fakeMutation({ error: new Error('Insufficient stock for product: 3') }),
      { errorText: () => 'Units of Rice were already sold' })

    expect(screen.getByText('Units of Rice were already sold')).toBeTruthy()
  })
})
