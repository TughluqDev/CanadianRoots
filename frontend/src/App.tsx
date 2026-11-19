import { Route, Routes } from 'react-router'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { BuilderPage } from '@/pages/BuilderPage'
import { DestinationsPage } from '@/pages/DestinationsPage'
import { HomePage } from '@/pages/HomePage'
import { JourneyPage } from '@/pages/JourneyPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { SavedTripsPage } from '@/pages/SavedTripsPage'

export function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="plan" element={<BuilderPage />} />
        <Route path="journey/:tripId" element={<JourneyPage />} />
        <Route path="trips" element={<SavedTripsPage />} />
        <Route path="destinations" element={<DestinationsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
