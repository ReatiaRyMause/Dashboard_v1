import Nav from '../components/Nav'
import CleanView from './CleanView'

export default function CleanPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f8f9fb' }}>
      <Nav />
      <CleanView />
    </div>
  )
}
