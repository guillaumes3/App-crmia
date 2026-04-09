import './globals.css'; // Tes styles globaux

export const metadata = {
  title: 'CRM AI',
  description: 'Gestion intelligente de stock',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, padding: 0, fontFamily: 'sans-serif' }}>
        {/* On ne met rien ici, le contenu change selon la page */}
        {children}
      </body>
    </html>
  );
}