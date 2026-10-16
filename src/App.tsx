import { Navigate, Route, Routes } from 'react-router'

import { RequireAuth } from '@/auth/RequireAuth'
import { RequireRole } from '@/auth/RequireRole'
import { CashDrawerPage } from '@/features/cash-drawer/CashDrawerPage'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { SellersPage } from '@/features/sellers/SellersPage'
import { AppLayout } from '@/layouts/AppLayout'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { LoginPage } from '@/pages/LoginPage'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="cash-drawer" element={<CashDrawerPage />} />
          <Route element={<RequireRole roles={['ADMIN']} />}>
            <Route path="sellers" element={<SellersPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
