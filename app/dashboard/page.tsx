import Nav from '../components/Nav'
import DashboardView from './DashboardView'

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f8f9fb' }}>
      <Nav />
      <DashboardView />
    </div>
  )
}
