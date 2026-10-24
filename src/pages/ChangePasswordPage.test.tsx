// @vitest-environment jsdom
// jsdom: the page renders into the document, and i18n touches it.
import i18n from '@/i18n'

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/errors'
import { type Auth, AuthContext, CHANGE_PASSWORD_PATH, type User } from '@/auth/auth-context'

import { ChangePasswordPage } from './ChangePasswordPage'

const seller: User = { id: 2, name: 'Ana', email: 'ana@test.com', role: 'SELLER', passwordChangeRequired: true }

function renderPage(changePassword: Auth['changePassword'], user = seller) {
  const auth: Auth = {
    state: { status: 'signed-in', user },
    login: async () => {},
    changePassword,
    logout: async () => {},
  }
  render(
    <AuthContext value={auth}>
      <MemoryRouter initialEntries={[CHANGE_PASSWORD_PATH]}>
        <Routes>
          <Route path={CHANGE_PASSWORD_PATH} element={<ChangePasswordPage />} />
          <Route path="/" element={<p>Dashboard</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext>,
  )
}

async function fill(current: string, next: string, confirm = next) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(i18n.t('changePassword.temporaryPassword')), current)
  await user.type(screen.getByLabelText(i18n.t('passwordReset.newPassword')), next)
  await user.type(screen.getByLabelText(i18n.t('passwordReset.confirmPassword')), confirm)
  await user.click(screen.getByRole('button', { name: i18n.t('changePassword.save') }))
}

afterEach(cleanup)

describe('ChangePasswordPage', () => {
  it('asks a user with a temporary password for a different one', async () => {
    const changePassword = vi.fn(async () => {})
    renderPage(changePassword)

    expect(screen.getByText(i18n.t('changePassword.requiredTitle'))).toBeTruthy()
    await fill('temporary-pass-1', 'temporary-pass-1')

    expect(await screen.findByText(i18n.t('changePassword.sameAsCurrent'))).toBeTruthy()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('shows a wrong temporary password next to its field', async () => {
    const changePassword = vi.fn(async () => {
      throw new ApiError(400, { detail: 'Current password is incorrect' })
    })
    renderPage(changePassword)

    await fill('wrong-temporary', 'brand-new-pass-1')

    expect(await screen.findByText(i18n.t('apiErrors.wrongCurrentPassword'))).toBeTruthy()
    expect(screen.queryByText('Dashboard')).toBeNull()
  })

  it('changes it and goes on to the app', async () => {
    const changePassword = vi.fn(async () => {})
    renderPage(changePassword)

    await fill('temporary-pass-1', 'brand-new-pass-1')

    expect(changePassword).toHaveBeenCalledWith('temporary-pass-1', 'brand-new-pass-1')
    expect(await screen.findByText('Dashboard')).toBeTruthy()
  })
})
