import { HashRouter, Routes, Route, Link } from 'react-router-dom'
import Dev from './pages/Dev.jsx'

export default function App() {
  return (
    <HashRouter>
      <nav className="p-3 border-b flex gap-4">
        <Link to="/">Home</Link>
        <Link to="/dev">Dev</Link>
      </nav>
      <Routes>
        <Route path="/" element={<div className="p-4">OpavoLabs: real pages coming soon.</div>} />
        <Route path="/dev" element={<Dev />} />
      </Routes>
    </HashRouter>
  )
}
