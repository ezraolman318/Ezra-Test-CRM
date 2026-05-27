import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Contacts from './pages/Contacts.jsx';
import Companies from './pages/Companies.jsx';
import Pipeline from './pages/Pipeline.jsx';
import Activities from './pages/Activities.jsx';
import Workflows from './pages/Workflows.jsx';

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">C<span>RM</span></div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/pipeline">Pipeline</NavLink>
          <NavLink to="/contacts">Contacts</NavLink>
          <NavLink to="/companies">Companies</NavLink>
          <NavLink to="/activities">Activities</NavLink>
          <NavLink to="/workflows">Workflows</NavLink>
        </nav>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
