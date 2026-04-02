import Nav from '../components/Nav'
import DataView from './DataView'

export default function DataPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f8f9fb' }}>
      <Nav />
      <DataView />
    </div>
  )
}
