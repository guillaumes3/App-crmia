export const metadata = {
  title: 'Kipilote | Votre business sous contrôle',
  description: 'Logiciel de gestion et pilotage d\'entreprise',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}