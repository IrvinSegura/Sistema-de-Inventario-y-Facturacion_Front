import { Navigate, Route, Routes } from 'react-router'

import { RequireAuth } from '@/auth/RequireAuth'
import { RequireRole } from '@/auth/RequireRole'
import { ComingSoon } from '@/components/ComingSoon'
import { CashDrawerLayout } from '@/features/cash-drawer/CashDrawerLayout'
import { CashDrawerPage } from '@/features/cash-drawer/CashDrawerPage'
import { DrawerHistoryPage } from '@/features/cash-drawer/DrawerHistoryPage'
import { TodayDrawersPage } from '@/features/cash-drawer/TodayDrawersPage'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { CategoriesPage } from '@/features/categories/CategoriesPage'
import { ProductsPage } from '@/features/products/ProductsPage'
import { UsersPage } from '@/features/users/UsersPage'
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
          <Route element={<RequireRole roles={['SELLER']} />}>
            <Route path="checkout" element={<CheckoutPage />} />
          </Route>
          <Route path="cash-drawer" element={<CashDrawerLayout />}>
            <Route index element={<CashDrawerPage />} />
            <Route path="history" element={<DrawerHistoryPage />} />
            <Route element={<RequireRole roles={['ADMIN', 'SUPERVISOR']} />}>
              <Route path="today" element={<TodayDrawersPage />} />
            </Route>
          </Route>
          <Route path="products" element={<ProductsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          {/* In the menu already; their screens come next. */}
          <Route element={<RequireRole roles={['ADMIN', 'SUPERVISOR']} />}>
            <Route path="sales" element={<ComingSoon section="sales" />} />
            <Route path="inventory" element={<ComingSoon section="inventory" />} />
            <Route path="purchases" element={<ComingSoon section="purchases" />} />
            <Route path="customers" element={<ComingSoon section="customers" />} />
            <Route path="reports" element={<ComingSoon section="reports" />} />
          </Route>
          <Route element={<RequireRole roles={['ADMIN']} />}>
            <Route path="users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
