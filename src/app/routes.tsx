import { Navigate, type RouteObject } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'
import { DemoStockDetailPage } from '../pages/DemoStockDetailPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { StockDetailPage } from '../pages/StockDetailPage'
import { StockSearchPage } from '../pages/StockSearchPage'
import { TradingCatalogPage } from '../pages/TradingCatalogPage'
import { TradingDatasetPage } from '../pages/TradingDatasetPage'
import { TradingErrorPage } from '../pages/TradingErrorPage'
import { loadCatalog, loadDataset } from '../services/twse'
import { loadStocks, loadStockDetail } from '../services/stocks'
import { WatchlistPage } from '../pages/WatchlistPage'
import { App } from './App'
import { AuthProvider, RequireAuth } from '../features/auth/AuthProvider'
import { LoginPage } from '../pages/LoginPage'
import { SessionsPage } from '../pages/SessionsPage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <AuthProvider>
        <App />
      </AuthProvider>
    ),
    hydrateFallbackElement: (
      <p className="page page-heading" role="status">
        正在載入頁面…
      </p>
    ),
    children: [
      { path: 'login', element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [{ path: 'account/sessions', element: <SessionsPage /> }],
      },
      {
        index: true,
        element: <HomePage />,
        loader: (args) =>
          loadDataset({ ...args, params: { datasetId: 'market-indices' } }),
        errorElement: <TradingErrorPage />,
      },
      {
        path: 'stocks',
        element: <StockSearchPage />,
        loader: loadStocks,
        errorElement: <TradingErrorPage />,
      },
      {
        path: 'market',
        element: <TradingCatalogPage />,
        loader: loadCatalog,
        errorElement: <TradingErrorPage />,
      },
      {
        path: 'market/:datasetId',
        element: <TradingDatasetPage />,
        loader: loadDataset,
        errorElement: <TradingErrorPage />,
      },
      ...['demo-tsmc', 'demo-honhai', 'demo-mediatek'].map((id) => ({
        path: `stocks/${id}`,
        element: <DemoStockDetailPage />,
        loader: () => ({ instrumentId: id }),
      })),
      {
        path: 'stocks/:code',
        element: <StockDetailPage />,
        loader: loadStockDetail,
        errorElement: <TradingErrorPage />,
      },
      {
        path: 'watchlists',
        element: <Navigate to="/watchlists/demo" replace />,
      },
      { path: 'watchlists/demo', element: <WatchlistPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
