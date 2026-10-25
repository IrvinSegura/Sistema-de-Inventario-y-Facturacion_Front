import { Navigate, Route, Routes } from 'react-router'

import { CHANGE_PASSWORD_PATH } from '@/auth/auth-context'
import { RequireAuth } from '@/auth/RequireAuth'
import { RequireRole } from '@/auth/RequireRole'
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
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { ProductsPage } from '@/features/products/ProductsPage'
import { NewPurchasePage } from '@/features/purchases/NewPurchasePage'
import { PurchasesLayout } from '@/features/purchases/PurchasesLayout'
import { PurchasesPage } from '@/features/purchases/PurchasesPage'
import { CashClosingReportPage } from '@/features/reports/CashClosingReportPage'
import { CashFlowReportPage } from '@/features/reports/CashFlowReportPage'
import { CustomerSalesReportPage } from '@/features/reports/CustomerSalesReportPage'
import { ProductSalesReportPage } from '@/features/reports/ProductSalesReportPage'
import { ReportsLayout } from '@/features/reports/ReportsLayout'
import { SalesReportPage } from '@/features/reports/SalesReportPage'
import { SuppliersPage } from '@/features/purchases/SuppliersPage'
import { SalesPage } from '@/features/sales/SalesPage'
import { LivePage } from '@/features/supervision/LivePage'
import { SupervisionLayout } from '@/features/supervision/SupervisionLayout'
import { UsersPage } from '@/features/users/UsersPage'
import { AppLayout } from '@/layouts/AppLayout'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { LoginPage } from '@/pages/LoginPage'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route element={<RequireAuth />}>
        {/* Full page like the sign-in screens: a user with a temporary password sees nothing else. */}
        <Route path={CHANGE_PASSWORD_PATH} element={<ChangePasswordPage />} />
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
          <Route path="notifications" element={<NotificationsPage />} />
          <Route element={<RequireRole roles={['ADMIN', 'SUPERVISOR']} />}>
            <Route path="supervision" element={<SupervisionLayout />}>
              <Route index element={<LivePage />} />
            </Route>
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
          </Route>
          {/* Sellers get their own sales report; the other reports are for managers. */}
          <Route path="reports" element={<ReportsLayout />}>
            <Route index element={<SalesReportPage />} />
            <Route element={<RequireRole roles={['ADMIN', 'SUPERVISOR']} />}>
              <Route path="products" element={<ProductSalesReportPage />} />
              <Route path="customers" element={<CustomerSalesReportPage />} />
              <Route path="cash-closing" element={<CashClosingReportPage />} />
              <Route path="cash-flow" element={<CashFlowReportPage />} />
            </Route>
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
