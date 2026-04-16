import { Layout } from './components/layout'
import { Map } from './components/map'
import { useGeolocation } from './hooks/use-geolocation'
import styles from './app.module.css'

export const App = () => {
  const { latitude, longitude, accuracy, error } = useGeolocation()

  return (
    <Layout>
      {error && <div className={styles.errorBanner}>{error}</div>}
      <Map latitude={latitude} longitude={longitude} accuracy={accuracy} />
    </Layout>
  )
}
