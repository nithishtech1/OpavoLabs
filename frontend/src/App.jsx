import { HashRouter, Routes, Route, Link } from 'react-router-dom'
import Dev from './pages/Dev.jsx'
import DevReal from './pages/DevReal.jsx'

export default function App() {
  return (
    <HashRouter>
      <nav className="p-3 border-b flex gap-4">
        <Link to="/" className="text-blue-600 hover:underline">Home</Link>
        <Link to="/dev" className="text-blue-600 hover:underline">Dev (Mock)</Link>
        <Link to="/dev-real" className="text-blue-600 hover:underline font-semibold">Dev (Real)</Link>
      </nav>
      <Routes>
        <Route path="/" element={<div className="p-4">OpavoLabs: real pages coming soon.</div>} />
        <Route path="/dev" element={<Dev />} />
        <Route path="/dev-real" element={<DevReal />} />
      </Routes>
    </HashRouter>
  )
}
