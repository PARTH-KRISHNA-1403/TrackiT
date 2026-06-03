import React, { useState } from 'react';
import { Search as SearchIcon, MapPin, ReceiptText, ChevronRight } from 'lucide-react';

export default function Search({ onPurchaseClick, purchases, onEditReceipt, onReceiptClick }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Group unique items from actual purchases
  const uniquePurchasedItemsMap = purchases?.reduce((acc, p) => {
    if (!p.item_id) return acc;
    const key = p.item_id;
    if (!acc[key]) {
      acc[key] = {
        item_id: p.item_id,
        item_name: p.item_name,
        category: p.category,
        default_unit: p.default_unit,
        size_value: p.size_value,
        size_unit: p.size_unit
      };
    }
    return acc;
  }, {}) || {};

  const uniquePurchasedItems = Object.values(uniquePurchasedItemsMap);

  const itemResults = searchTerm.trim().length > 0
    ? uniquePurchasedItems.filter(item =>
        item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  // Grouping logic for Receipts in Search Tab
  const receiptsMap = purchases?.reduce((acc, p) => {
    const key = p.receipt_id || `${p.purchase_date}_${p.source}`;
    if (!acc[key]) {
      acc[key] = {
        receiptId: p.receipt_id,
        date: p.purchase_date,
        source: p.source || 'others',
        items: [],
        total: 0
      };
    }
    acc[key].items.push(p);
    acc[key].total += parseFloat(p.total_amount);
    return acc;
  }, {}) || {};

  const receiptsList = Object.values(receiptsMap)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredReceipts = searchTerm.trim().length > 0
    ? receiptsList.filter(r =>
      (r.receiptId && r.receiptId.includes(searchTerm)) ||
      r.source.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : receiptsList;

  const categorizedReceipts = {
    'Mandoli': filteredReceipts.filter(r => r.source === 'Mandoli'),
    'Canteen': filteredReceipts.filter(r => r.source === 'Canteen'),
    'Friday-Market': filteredReceipts.filter(r => r.source === 'Friday-Market'),
    'others': filteredReceipts.filter(r => !['Mandoli', 'Canteen', 'Friday-Market'].includes(r.source))
  };


  return (
    <div className="animate-fade-in">
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <div className="form-group" style={{ position: 'relative' }}>
          <label><SearchIcon size={18} style={{ verticalAlign: 'middle' }} /> Search Item History</label>
          <input
            type="text"
            placeholder="Search for an item (e.g. Milk, Rice)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '3rem' }}
          />
          <SearchIcon style={{ position: 'absolute', left: '1rem', top: '2.5rem', color: 'var(--text-muted)' }} size={20} />
        </div>

        {itemResults.length > 0 && (
          <div className="search-results" style={{ marginTop: '1rem' }}>
            {itemResults.map(item => (
              <div
                key={item.item_id}
                className="flex-between"
                style={{
                  padding: '1rem',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  marginBottom: '0.5rem',
                  cursor: 'pointer'
                }}
                onClick={() => onPurchaseClick({ item_id: item.item_id, item_name: item.item_name, category: item.category, default_unit: item.default_unit, size_value: item.size_value, size_unit: item.size_unit })}
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>
                    {item.item_name}
                    {(item.size_value || item.size_unit) && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--secondary)', marginLeft: '8px' }}>
                        ({item.size_value} {item.size_unit})
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.category} &bull; {item.default_unit}</div>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="receipt-categories">
        {Object.entries(categorizedReceipts).map(([cat, list]) => (
          <div key={cat} className="glass-card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--secondary)' }}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)} Receipts
            </h3>
            <div className="purchase-list">
              {list.length > 0 ? (
                list.map((r, idx) => (
                  <div
                    key={idx}
                    className="flex-between receipt-item"
                    onClick={() => onReceiptClick(r)}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold' }}>
                        {new Date(r.date).toLocaleDateString('en-GB')}
                        {r.receiptId && <span style={{ marginLeft: '10px', fontSize: '0.75rem', padding: '2px 6px', background: 'var(--primary-badge-bg)', color: 'var(--primary)', borderRadius: '4px' }}>#{r.receiptId}</span>}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{r.items.length} items</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold' }}>₹{r.total.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No receipts for this category.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
