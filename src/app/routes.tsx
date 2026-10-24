import { Navigate, type RouteObject } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { StockDetailPage } from '../pages/StockDetailPage'
import { StockAnalysisPage } from '../pages/StockAnalysisPage'
import { AdvancedResearchPage } from '../pages/AdvancedResearchPage'
import { loadAdvancedResearch } from '../services/advanced'
import { loadStockAnalysis } from '../services/analysis'
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
import { ScreenerPage } from '../pages/ScreenerPage'
import { ComparisonPage } from '../pages/ComparisonPage'
import { MarketOverviewPage } from '../pages/MarketOverviewPage'
import { CalendarPage } from '../pages/CalendarPage'
import { RisksPage } from '../pages/RisksPage'
import { loadCalendar, loadRisks } from '../services/notices'
import {
  loadScreener,
  loadComparison,
  loadOverview,
} from '../services/research'

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
      {
        path: 'research',
        element: <Navigate to="/research/screener" replace />,
      },
      {
        path: 'research/screener',
        element: <ScreenerPage />,
        loader: loadScreener,
        errorElement: <TradingErrorPage />,
      },
      {
        path: 'research/compare',
        element: <ComparisonPage />,
        loader: loadComparison,
        errorElement: <TradingErrorPage />,
      },
      {
        path: 'research/overview',
        element: <MarketOverviewPage />,
        loader: loadOverview,
        errorElement: <TradingErrorPage />,
      },
      { path: 'login', element: <LoginPage /> },
      {
        path: 'research/calendar',
        element: <CalendarPage />,
        loader: loadCalendar,
        errorElement: <TradingErrorPage />,
      },
      {
        path: 'research/risks',
        element: <RisksPage />,
        loader: loadRisks,
        errorElement: <TradingErrorPage />,
      },
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
      {
        path: 'stocks/:code/research/:topic',
        element: <AdvancedResearchPage />,
        loader: loadAdvancedResearch,
        errorElement: <TradingErrorPage />,
      },
      {
        path: 'stocks/:code/history',
        element: <StockAnalysisPage />,
        loader: loadStockAnalysis,
        errorElement: <TradingErrorPage />,
      },
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
