import React, { useState } from 'react';
import { ShoppingBag, ReceiptText, ChevronRight, MapPin } from 'lucide-react';

export default function Dashboard({ stats, purchases, onPurchaseClick, onEditReceipt, onReceiptClick }) {
  const [showAllReceipts, setShowAllReceipts] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);

  if (!stats) return null;

  // Grouping logic for Receipts (Group by Date and Source)
  const receiptsMap = purchases?.reduce((acc, p) => {
    const key = p.receipt_id || `${p.purchase_date}_${p.source}`;
    if (!acc[key]) {
      acc[key] = {
        receiptId: p.receipt_id,
        date: p.purchase_date,
        source: p.source,
        items: [],
        total: 0
      };
    }
    acc[key].items.push(p);
    acc[key].total += parseFloat(p.total_amount);
    return acc;
  }, {}) || {};

  const receipts = Object.values(receiptsMap).sort((a, b) => new Date(b.date) - new Date(a.date));

  // Grouping similar purchased items (Unique items with latest purchase info)
  const itemGroupsMap = purchases?.reduce((acc, p) => {
    if (!acc[p.item_name] || new Date(p.purchase_date) > new Date(acc[p.item_name].purchase_date)) {
      acc[p.item_name] = p;
    }
    return acc;
  }, {}) || {};

  const groupedItems = Object.values(itemGroupsMap).sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date));


  return (
    <div className="dashboard-container">
      {/* Main Content Split View (Stats removed as requested) */}
      <div className="grid-2">
        {/* Left: Recent Receipts (Grouped) */}
        <div className="glass-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h3 style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            <ReceiptText size={20} style={{ verticalAlign: 'bottom', marginRight: '8px' }} /> Recent Receipts
          </h3>
          <div className="purchase-list">
            {(showAllReceipts ? receipts : receipts.slice(0, 7)).map((r, idx) => (
              <div
                key={idx}
                className="flex-between receipt-item"
                onClick={() => onReceiptClick(r)}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {new Date(r.date).toLocaleDateString('en-GB')}
                    {r.receiptId && <span style={{ marginLeft: '10px', fontSize: '0.75rem', padding: '2px 6px', background: 'var(--primary-badge-bg)', color: 'var(--primary)', borderRadius: '4px' }}>#{r.receiptId}</span>}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <MapPin size={12} style={{ marginRight: '4px' }} /> {r.source || 'General'} &bull; {r.items.length} {r.items.length === 1 ? 'item' : 'items'}
                  </div>
                  <div style={{ color: 'var(--secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
                    {r.items.slice(0, 2).map(i => i.item_name).join(', ')}{r.items.length > 2 ? ` +${r.items.length - 2} more` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>₹{r.total.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
                  <ChevronRight size={18} color="var(--text-muted)" />
                </div>
              </div>
            ))}
            {receipts.length > 7 && !showAllReceipts && (
              <button
                className="btn"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', marginTop: '1rem' }}
                onClick={() => setShowAllReceipts(true)}
              >
                Show More Receipts
              </button>
            )}
            {receipts.length === 0 && (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No receipts found.</p>
            )}
          </div>
        </div>

        {/* Right: Grouped Purchased Items */}
        <div className="glass-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h3 style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            <ShoppingBag size={20} style={{ verticalAlign: 'bottom', marginRight: '8px' }} /> Purchased Items
          </h3>
          <div className="purchase-list">
            {(showAllItems ? groupedItems : groupedItems.slice(0, 7)).map(p => (
              <div
                key={p.id}
                className="flex-between"
                style={{
                  padding: '0.75rem 0',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer'
                }}
                onClick={() => onPurchaseClick && onPurchaseClick(p)}
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>{p.item_name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    <MapPin size={12} style={{ marginRight: '4px' }} /> {p.source || 'General'} &bull; {new Date(p.purchase_date).toLocaleDateString('en-GB')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--secondary)' }}>₹{parseFloat(p.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    <span 
                      style={{ cursor: p.size_value && p.size_unit ? 'help' : 'default' }}
                      title={p.size_value && p.size_unit ? `pkt = ${p.size_value}${p.size_unit}` : undefined}
                    >
                      {p.size_value && p.size_unit
                        ? `${Math.round(p.quantity)} pkt`
                        : `${parseFloat(p.quantity).toFixed(1)} ${p.default_unit || 'unit'}`}
                    </span> @ ₹{parseFloat(p.price_per_unit || 0).toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
            {groupedItems.length > 7 && !showAllItems && (
              <button
                className="btn"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', marginTop: '1rem' }}
                onClick={() => setShowAllItems(true)}
              >
                Show More Items
              </button>
            )}
            {(!purchases || purchases.length === 0) && (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No items recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
