"use client";
import { getAccessLevel } from '../../utils/authGuard';

export default function ArticlesPage() {
  const userRole = "Commercial"; // Simulation
  const access = getAccessLevel(userRole, "articles");

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1>Gestion du Stock 
          {access === "read" && <span style={{ fontSize: '0.7rem', background: '#e2e8f0', padding: '4px 8px', borderRadius: '5px', marginLeft: '10px' }}>Lecture seule</span>}
        </h1>
        
        {/* Bouton désactivé si pas les droits full */}
        <button 
          disabled={access === "read"}
          style={{ 
            background: access === "read" ? '#cbd5e1' : '#6366f1', 
            cursor: access === "read" ? 'not-allowed' : 'pointer',
            color: 'white', padding: '10px 20px', borderRadius: '10px', border: 'none' 
          }}
        >
          + Ajouter un article
        </button>
      </div>

      {/* La table reste visible pour tout le monde */}
      <table>
        {/* ... contenu de la table ... */}
        {/* Masquer ou désactiver le bouton "Gérer" dans la ligne si read only */}
        {access === "full" && <td><button>Modifier</button></td>}
      </table>
    </div>
  );
}