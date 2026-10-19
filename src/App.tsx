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
import { CustomersPage } from '@/features/customers/CustomersPage'
import { InventoryLayout } from '@/features/inventory/InventoryLayout'
import { LowStockPage } from '@/features/inventory/LowStockPage'
import { MovementsPage } from '@/features/inventory/MovementsPage'
import { StockPage } from '@/features/inventory/StockPage'
import { ProductsPage } from '@/features/products/ProductsPage'
import { NewPurchasePage } from '@/features/purchases/NewPurchasePage'
import { PurchasesLayout } from '@/features/purchases/PurchasesLayout'
import { PurchasesPage } from '@/features/purchases/PurchasesPage'
import { SuppliersPage } from '@/features/purchases/SuppliersPage'
import { SalesPage } from '@/features/sales/SalesPage'
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
          <Route element={<RequireRole roles={['ADMIN', 'SUPERVISOR']} />}>
            <Route path="customers" element={<CustomersPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="inventory" element={<InventoryLayout />}>
              <Route index element={<StockPage />} />
              <Route path="low-stock" element={<LowStockPage />} />
              <Route path="movements" element={<MovementsPage />} />
            </Route>
            <Route path="purchases" element={<PurchasesLayout />}>
              <Route index element={<PurchasesPage />} />
              <Route path="new" element={<NewPurchasePage />} />
              <Route path="suppliers" element={<SuppliersPage />} />
            </Route>
            {/* In the menu already; its screen comes next. */}
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
