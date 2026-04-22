import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ViewListing from './pages/ViewListing'
import ViewDetail from './pages/ViewDetail'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ViewListing />} />
        <Route path="/view/:database/:schema/:name" element={<ViewDetail />} />
      </Route>
    </Routes>
  )
}
