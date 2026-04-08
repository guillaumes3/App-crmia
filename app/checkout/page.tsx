"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Checkout() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    }, 2500);
  };

  return (
    <div style={{ background: 'radial-gradient(circle at center, #eff6ff 0%, #dbeafe 100%)', minHeight: '100vh', padding: '40px 20px' }}>
      <div className="container" style={{ maxWidth: '1000px' }}>
        <div style={{ marginBottom: '2rem' }}><Link href="/tarifs" style={{ color: 'var(--text)', fontWeight: 600 }}>← Retour aux tarifs</Link></div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '3rem', alignItems: 'start' }}>
          <div className="stat-card" style={{ padding: '3rem' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Informations de paiement</h2>
            <form onSubmit={handlePayment}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>Numéro de carte</label>
                <input type="text" placeholder="4242 4242 4242 4242" required style={{ width: '100%', padding: '0.8rem', border: '1px solid var(--border)', borderRadius: '8px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>Expiration</label>
                  <input type="text" placeholder="12/26" required style={{ width: '100%', padding: '0.8rem', border: '1px solid var(--border)', borderRadius: '8px' }} />
                </div>
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>CVC</label>
                  <input type="text" placeholder="123" required style={{ width: '100%', padding: '0.8rem', border: '1px solid var(--border)', borderRadius: '8px' }} />
                </div>
              </div>

              <button type="submit" disabled={isProcessing || isSuccess} className="btn btn-primary" style={{ width: '100%', padding: '1.2rem', background: isSuccess ? '#10b981' : 'var(--primary)' }}>
                {isProcessing ? "🔒 Traitement sécurisé..." : (isSuccess ? "✅ Paiement Accepté !" : "Payer 99,00 €")}
              </button>
            </form>
          </div>

          <div style={{ background: '#f1f5f9', padding: '2rem', borderRadius: '16px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Récapitulatif</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}><span>Forfait Pro (HT)</span><span style={{ fontWeight: 'bold' }}>82,50 €</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: '#64748b' }}><span>TVA (20%)</span><span>16,50 €</span></div>
            <hr style={{ borderTop: '1px solid #cbd5e1', margin: '1.5rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: 800 }}><span>Total TTC</span><span>99,00 €</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}