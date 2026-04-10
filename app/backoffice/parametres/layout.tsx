export default function ParametresLayout({ children }: { children: React.ReactNode }) {
  // ... (garde ton code précédent)
  return (
    <div style={{ padding: '30px' }}>
      {/* Vérifie qu'il n'y a rien ici avant le h1 */}
      <h1 style={{ fontWeight: 900, marginBottom: '25px', fontSize: '1.8rem' }}>
      </h1>
      {/* ... reste du menu */}
      {children}
    </div>
  );
}