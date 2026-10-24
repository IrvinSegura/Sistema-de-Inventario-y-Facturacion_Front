// @vitest-environment jsdom
// jsdom: the routes render into the document.
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { type Auth, AuthContext, CHANGE_PASSWORD_PATH, type User } from './auth-context'
import { RequireAuth } from './RequireAuth'

const seller: User = { id: 2, name: 'Ana', email: 'ana@test.com', role: 'SELLER', passwordChangeRequired: false }

function renderAt(path: string, user: User) {
  const auth: Auth = {
    state: { status: 'signed-in', user },
    login: async () => {},
    changePassword: async () => {},
    logout: async () => {},
  }
  render(
    <AuthContext value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/" element={<p>Dashboard</p>} />
            <Route path={CHANGE_PASSWORD_PATH} element={<p>Change password</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext>,
  )
}

afterEach(cleanup)

describe('RequireAuth', () => {
  it('holds a user with a temporary password on the change password page', () => {
    renderAt('/', { ...seller, passwordChangeRequired: true })

    expect(screen.getByText('Change password')).toBeTruthy()
    expect(screen.queryByText('Dashboard')).toBeNull()
  })

  it('lets everyone else through, including to change their password', () => {
    renderAt('/', seller)
    expect(screen.getByText('Dashboard')).toBeTruthy()

    cleanup()
    renderAt(CHANGE_PASSWORD_PATH, seller)
    expect(screen.getByText('Change password')).toBeTruthy()
  })
})
