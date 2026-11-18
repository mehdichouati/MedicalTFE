import { Outlet } from 'react-router'
import Header from './Header'
import Footer from './Footer'
import styles from './Layout.module.css'

// Mise en page commune : en-tete + contenu de la page + pied de page.
// fullWidth = true pour le site vitrine (sections sur toute la largeur),
// sinon le contenu est centre dans un conteneur de 1100px maximum.
export default function Layout({ fullWidth = false }) {
  return (
    <div className={styles.layout}>
      <Header />
      <main className={fullWidth ? styles.mainFull : styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}