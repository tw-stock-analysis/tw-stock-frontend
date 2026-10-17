import { Navigate, type RouteObject } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { StockDetailPage } from '../pages/StockDetailPage'
import { StocksPage } from '../pages/StocksPage'
import { WatchlistPage } from '../pages/WatchlistPage'
import { App } from './App'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'stocks', element: <StocksPage /> },
      { path: 'stocks/:instrumentId', element: <StockDetailPage /> },
      { path: 'watchlists', element: <Navigate to="/watchlists/demo" replace /> },
      { path: 'watchlists/demo', element: <WatchlistPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
