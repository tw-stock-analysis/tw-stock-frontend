import { Navigate, type RouteObject } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { StockDetailPage } from '../pages/StockDetailPage'
import { TradingCatalogPage } from '../pages/TradingCatalogPage'
import { TradingDatasetPage } from '../pages/TradingDatasetPage'
import { TradingErrorPage } from '../pages/TradingErrorPage'
import { loadCatalog, loadDataset } from '../services/twse'
import { WatchlistPage } from '../pages/WatchlistPage'
import { App } from './App'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    hydrateFallbackElement: (
      <p className="page page-heading" role="status">
        正在載入交易資料…
      </p>
    ),
    children: [
      {
        index: true,
        element: <HomePage />,
        loader: (args) =>
          loadDataset({ ...args, params: { datasetId: 'market-indices' } }),
        errorElement: <TradingErrorPage />,
      },
      {
        path: 'stocks',
        element: <TradingDatasetPage />,
        loader: (args) =>
          loadDataset({ ...args, params: { datasetId: 'daily-prices' } }),
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
      { path: 'stocks/:instrumentId', element: <StockDetailPage /> },
      {
        path: 'watchlists',
        element: <Navigate to="/watchlists/demo" replace />,
      },
      { path: 'watchlists/demo', element: <WatchlistPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
