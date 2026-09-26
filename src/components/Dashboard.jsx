import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, MapPin, X, Pencil, LineChart as ChartIcon, Calendar, Barcode, ChevronRight, ReceiptText } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../supabaseClient';

export default function Dashboard({ stats, purchases, onPurchaseClick, onEditReceipt, onReceiptClick }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState(null);
  const [savedItems, setSavedItems] = useState([]);
  
  // State for inline edit item modal
  const [editingItem, setEditingItem] = useState(null);
  
  // State for item purchase history & price graph modal
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch saved items from item_list database table
  const fetchSavedItems = async () => {
    const { data } = await supabase
      .from('item_list')
      .select('*')
      .order('name', { ascending: true });

    if (data) {
      setSavedItems(data);
    }
  };

  useEffect(() => {
    fetchSavedItems();
  }, []);

  // When selectedHistoryItem changes, fetch its purchase history for the graph
  useEffect(() => {
    if (selectedHistoryItem) {
      setHistoryLoading(true);
      const query = selectedHistoryItem.id 
        ? supabase.from('purchases').select('*').eq('item_id', selectedHistoryItem.id).order('purchase_date', { ascending: true })
        : supabase.from('purchases').select('*').ilike('item_name', selectedHistoryItem.name).order('purchase_date', { ascending: true });

      query.then(({ data }) => {
        if (data) {
          const formatted = data.map(d => ({
            date: new Date(d.purchase_date).toLocaleDateString('en-GB'),
            rawDate: d.purchase_date,
            price: parseFloat(d.unit_price !== undefined && d.unit_price !== null ? d.unit_price : (d.price_per_unit || 0)),
            source: d.source_name || d.source,
            receiptId: d.invoice_number || d.receipt_id,
            quantity: parseFloat(d.quantity || 0),
            totalAmount: parseFloat(d.total_amount || 0)
          }));
          setHistoryData(formatted);
        } else {
          setHistoryData([]);
        }
        setHistoryLoading(false);
      });
    }
  }, [selectedHistoryItem]);

  // Handle ESC key to close modal popups
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setEditingItem(null);
        setSelectedHistoryItem(null);
      }
    };
    if (editingItem || selectedHistoryItem) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingItem, selectedHistoryItem]);

  const normalizeUnit = (u) => {
    if (!u) return '';
    const s = String(u).trim();
    const lower = s.toLowerCase();
    if (lower === 'kg') return 'kg';
    if (lower === 'g') return 'g';
    if (lower === 'l') return 'L';
    if (lower === 'ml') return 'ml';
    if (lower.startsWith('unit') || lower.startsWith('pc') || lower.startsWith('piece')) return 'Pc.';
    return s;
  };

  // Combine items from savedItems and purchases for uniform search display
  const combinedItemsMap = {};

  // First populate saved database items
  savedItems.forEach(i => {
    const sizeQtyVal = i.size_qty !== undefined && i.size_qty !== null ? i.size_qty : i.size_value;
    combinedItemsMap[i.name.toLowerCase()] = {
      id: i.id,
      name: i.name,
      category: i.category || 'General',
      sizeValue: sizeQtyVal !== undefined && sizeQtyVal !== null ? String(sizeQtyVal) : '',
      sizeUnit: normalizeUnit(i.size_unit),
      qrId: i.qr_id || '',
      purchasesCount: 0,
      latestPrice: null,
      latestDate: null,
      sources: new Set()
    };
  });

  // Next populate/merge purchase records
  (purchases || []).forEach(p => {
    if (!p.item_name) return;
    const key = p.item_name.toLowerCase();
    if (!combinedItemsMap[key]) {
      combinedItemsMap[key] = {
        id: p.item_id || null,
        name: p.item_name,
        category: p.category || 'General',
        sizeValue: p.size_value !== undefined && p.size_value !== null ? String(p.size_value) : '',
        sizeUnit: p.size_unit || '',
        qrId: p.qr_id || '',
        purchasesCount: 0,
        latestPrice: null,
        latestDate: null,
        sources: new Set()
      };
    }

    combinedItemsMap[key].purchasesCount += 1;
    if (p.source) combinedItemsMap[key].sources.add(p.source);

    const pDate = new Date(p.purchase_date);
    if (!combinedItemsMap[key].latestDate || pDate > combinedItemsMap[key].latestDate) {
      combinedItemsMap[key].latestDate = pDate;
      combinedItemsMap[key].latestPrice = parseFloat(p.price_per_unit || p.unit_price || 0);
    }
  });

  const allItems = Object.values(combinedItemsMap);

  // Group receipts by invoice/receipt ID for selected source
  const sourceReceiptsMap = (purchases || []).filter(p => {
    if (!selectedSource) return false;
    const pSource = (p.source || '').trim().toLowerCase();
    if (selectedSource === 'Other') {
      return !['mandoli', 'canteen', 'surplus'].includes(pSource);
    }
    return pSource === selectedSource.toLowerCase();
  }).reduce((acc, p) => {
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
    acc[key].total += parseFloat(p.total_amount || 0);
    return acc;
  }, {});

  const sourceReceipts = Object.values(sourceReceiptsMap).sort((a, b) => new Date(b.date) - new Date(a.date));

  // Filter items by universal search term
  const filteredItems = allItems.filter(item => {
    if (!searchTerm.trim()) return false;
    const q = searchTerm.trim().toLowerCase();
    const sourcesArray = Array.from(item.sources);
    return (
      item.name.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.qrId && String(item.qrId).toLowerCase().includes(q)) ||
      sourcesArray.some(s => s.toLowerCase().includes(q))
    );
  });

  const handleCardClick = (sourceName) => {
    if (selectedSource === sourceName) {
      setSelectedSource(null);
    } else {
      setSelectedSource(sourceName);
    }
  };

  // Open Edit Item modal with item fields prefilled
  const handleOpenEditModal = (e, item) => {
    e.stopPropagation(); // Prevent opening history modal
    setEditingItem({
      id: item.id,
      name: item.name,
      category: item.category || '',
      sizeValue: item.sizeValue || '',
      sizeUnit: item.sizeUnit || '',
      qrId: item.qrId || ''
    });
  };

  // Save changes to database item_list table
  const handleSaveEditedItem = async (e) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name.trim()) return;

    const sizeQtyNum = editingItem.sizeValue ? parseFloat(editingItem.sizeValue) : null;
    const updatePayload = {
      name: editingItem.name.trim(),
      category: editingItem.category.trim() || 'General',
      size_qty: sizeQtyNum,
      size_unit: editingItem.sizeUnit || null,
      qr_id: editingItem.qrId ? editingItem.qrId.trim() : null
    };

    try {
      if (editingItem.id) {
        await supabase
          .from('item_list')
          .update(updatePayload)
          .eq('id', editingItem.id);
      } else {
        await supabase
          .from('item_list')
          .insert([updatePayload]);
      }

      await fetchSavedItems();
      setEditingItem(null);
    } catch (err) {
      console.error('Error updating item details:', err);
      alert('Error saving item changes: ' + err.message);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Universal Search Bar */}
      <div className="universal-search-container" style={{ position: 'relative' }}>
        <Search size={22} className="search-icon" />
        <input 
          type="text"
          placeholder="Universal Search — search source, item name, category, code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="universal-search-input"
        />
        {searchTerm && (
          <button 
            type="button" 
            className="btn-icon" 
            onClick={() => setSearchTerm('')} 
            style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'transparent' }}
          >
            <X size={18} color="var(--text-muted)" />
          </button>
        )}
      </div>

      {/* 4 Source Cards Grid or Animated Full-Width Top Card */}
      {!searchTerm.trim() && (
        !selectedSource ? (
          <div className="cards-grid-4 animate-fade-in">
            <div 
              className="source-card card-mandoli"
              onClick={() => handleCardClick('Mandoli')}
            >
              <h2>Mandoli</h2>
            </div>
            <div 
              className="source-card card-canteen"
              onClick={() => handleCardClick('Canteen')}
            >
              <h2>Canteen</h2>
            </div>
            <div 
              className="source-card card-surplus"
              onClick={() => handleCardClick('Surplus')}
            >
              <h2>Surplus</h2>
            </div>
            <div 
              className="source-card card-other"
              onClick={() => handleCardClick('Other')}
            >
              <h2>Other</h2>
            </div>
          </div>
        ) : (
          <div 
            className={`source-card-expanded card-${selectedSource.toLowerCase()}`}
            onClick={() => setSelectedSource(null)}
          >
            <h2>{selectedSource}</h2>
          </div>
        )
      )}

      {/* Selected Source Invoices Window */}
      {selectedSource && !searchTerm.trim() && (
        <div className="glass-card animate-fade-in" style={{ marginTop: '1.5rem' }}>
          <div className="flex-between" style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ReceiptText size={20} color="var(--primary)" />
                <span>Invoices for {selectedSource}</span>
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {sourceReceipts.length} {sourceReceipts.length === 1 ? 'invoice' : 'invoices'} found
              </div>
            </div>
            <button 
              className="btn" 
              style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.08)' }}
              onClick={() => setSelectedSource(null)}
            >
              Clear Filter
            </button>
          </div>

          <div className="purchase-list">
            {sourceReceipts.map((r, idx) => (
              <div
                key={r.receiptId || idx}
                className="flex-between receipt-item"
                style={{
                  padding: '1rem 1.15rem',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  borderRadius: '14px',
                  marginBottom: '0.6rem',
                  background: 'rgba(255,255,255,0.03)',
                  transition: 'all 0.25s ease'
                }}
                onClick={() => onReceiptClick && onReceiptClick(r)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Eye-catching Date Badge */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.15))',
                    border: '1.5px solid rgba(16, 185, 129, 0.4)',
                    padding: '0.65rem 1rem',
                    borderRadius: '14px',
                    textAlign: 'center',
                    minWidth: '105px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)'
                  }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800' }}>
                      DATE
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#ffffff', marginTop: '2px' }}>
                      {new Date(r.date).toLocaleDateString('en-GB')}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{r.receiptId ? `Invoice #${r.receiptId}` : `Receipt #${idx + 1}`}</span>
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderRadius: '10px', fontWeight: 'bold' }}>
                        {r.items.length} {r.items.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                      {r.items.map(i => i.item_name).slice(0, 3).join(', ')}
                      {r.items.length > 3 ? ` +${r.items.length - 3} more` : ''}
                    </div>
                  </div>
                </div>

                {/* Center Section: Eye-catching Source Badge Block (for 'Other' category) */}
                {selectedSource === 'Other' && (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.25), rgba(249, 115, 22, 0.15))',
                    border: '1.5px solid rgba(249, 115, 22, 0.45)',
                    color: '#fb923c',
                    padding: '0.65rem 1.15rem',
                    borderRadius: '14px',
                    textAlign: 'center',
                    fontWeight: '800',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(234, 88, 12, 0.2)'
                  }}>
                    <MapPin size={16} color="#fb923c" />
                    <span>{r.source || 'Other'}</span>
                  </div>
                )}

                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>Total Amount</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--secondary)', textShadow: '0 0 10px rgba(52, 211, 153, 0.3)' }}>
                      ₹{r.total.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </div>
                  </div>
                  <ChevronRight size={20} color="var(--text-muted)" />
                </div>
              </div>
            ))}

            {sourceReceipts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛒</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  No invoices recorded for {selectedSource} yet
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  Receipts added with "{selectedSource}" as the source will appear here.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Universal Search Results Window */}
      {searchTerm.trim() && (
        <div className="glass-card animate-fade-in" style={{ marginTop: '1.5rem' }}>
          <div className="flex-between" style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--text-main)' }}>
                Search Results for "{searchTerm}"
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} found
              </div>
            </div>
            <button 
              className="btn" 
              style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.08)' }}
              onClick={() => setSearchTerm('')}
            >
              Clear Search
            </button>
          </div>

          <div className="purchase-list">
            {filteredItems.map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex-between"
                style={{
                  padding: '0.85rem 0.75rem',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  borderRadius: '10px',
                  transition: 'background 0.2s ease'
                }}
                onClick={() => setSelectedHistoryItem(item)}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{item.name}</span>
                    {item.sizeValue && item.sizeUnit && (
                      <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderRadius: '12px', fontWeight: 'bold' }}>
                        {item.sizeValue} {item.sizeUnit}
                      </span>
                    )}
                  </div>

                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span>Category: <strong style={{ color: 'var(--text-main)' }}>{item.category}</strong></span>
                    {item.qrId && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--secondary)' }}>
                        <Barcode size={14} /> {item.qrId}
                      </span>
                    )}
                    {Array.from(item.sources).length > 0 && (
                      <span>
                        <MapPin size={12} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                        {Array.from(item.sources).join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {item.latestPrice !== null && (
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--secondary)' }}>
                        ₹{parseFloat(item.latestPrice).toFixed(1)}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                        {item.purchasesCount} {item.purchasesCount === 1 ? 'purchase' : 'purchases'}
                      </div>
                    </div>
                  )}

                  {/* Pencil Edit Icon Button */}
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={(e) => handleOpenEditModal(e, item)}
                    title="Edit Item Details (Units, Barcode ID, etc.)"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      padding: '8px',
                      borderRadius: '50%',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              </div>
            ))}

            {filteredItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  No items found matching "{searchTerm}"
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  Check for typos or try searching by category or barcode ID.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inline Edit Item Modal Window */}
      {editingItem && createPortal(
        <div className="scanner-modal-overlay" style={{ zIndex: 99999 }} onClick={() => setEditingItem(null)}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '460px', border: '1.5px solid var(--primary)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.15rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Pencil size={18} color="var(--primary)" />
                <span>Edit Item Details</span>
              </div>
              <button type="button" className="btn-icon" onClick={() => setEditingItem(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditedItem}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem' }}>Item Name *</label>
                <input 
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem' }}>Category</label>
                <input 
                  type="text"
                  value={editingItem.category}
                  onChange={e => setEditingItem({ ...editingItem, category: e.target.value })}
                  placeholder="e.g. Dairy / Snacks"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem' }}>Size & Unit</label>
                <div className="size-unit-merged-field">
                  <input 
                    type="number"
                    step="1"
                    placeholder="Size"
                    value={editingItem.sizeValue}
                    onChange={e => setEditingItem({ ...editingItem, sizeValue: e.target.value })}
                    className="size-input-part"
                  />
                  <div className="size-unit-divider"></div>
                  <select 
                    value={editingItem.sizeUnit}
                    onChange={e => setEditingItem({ ...editingItem, sizeUnit: e.target.value })}
                    className="unit-select-part"
                  >
                    <option value="">Unit</option>
                    <option value="Pc.">Pc.</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.85rem' }}>Barcode ID / QR ID (Optional)</label>
                <input 
                  type="text"
                  placeholder="e.g. 8901234567890"
                  value={editingItem.qrId}
                  onChange={e => setEditingItem({ ...editingItem, qrId: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save Changes
                </button>
                <button type="button" className="btn" onClick={() => setEditingItem(null)} style={{ background: 'rgba(255,255,255,0.08)' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Item History & Price vs Date Graph Modal Window */}
      {selectedHistoryItem && createPortal(
        <div className="scanner-modal-overlay" style={{ zIndex: 99999 }} onClick={() => setSelectedHistoryItem(null)}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '680px', border: '1.5px solid var(--primary)', background: 'var(--bg-color)', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ChartIcon size={20} color="var(--primary)" />
                  <span>{selectedHistoryItem.name}</span>
                </h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Category: <strong>{selectedHistoryItem.category || 'General'}</strong>
                  {selectedHistoryItem.sizeValue && selectedHistoryItem.sizeUnit && ` • ${selectedHistoryItem.sizeValue} ${selectedHistoryItem.sizeUnit}`}
                  {selectedHistoryItem.qrId && ` • Barcode: ${selectedHistoryItem.qrId}`}
                </div>
              </div>
              <button type="button" className="btn-icon" onClick={() => setSelectedHistoryItem(null)}>
                <X size={20} />
              </button>
            </div>

            {historyLoading ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading price history graph...</p>
            ) : (
              <>
                {/* Price vs Date Line Graph */}
                <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--secondary)', marginBottom: '0.75rem' }}>
                    📈 Price (₹) vs Purchase Date Timeline
                  </div>
                  <div style={{ height: '250px', width: '100%' }}>
                    {historyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis dataKey="date" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)' }}
                            itemStyle={{ color: '#34d399' }}
                            formatter={(value, name, props) => [`₹${parseFloat(value || 0).toFixed(1)}`, `Source: ${props.payload.source || 'General'}`]}
                          />
                          <Line type="monotone" dataKey="price" stroke="#34d399" strokeWidth={3} activeDot={{ r: 8 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No price history recorded yet for this item.</p>
                    )}
                  </div>
                </div>

                {/* Purchase Log Table */}
                <h4 style={{ color: 'var(--text-main)', marginBottom: '0.75rem' }}>Purchase History Log</h4>
                <div className="purchase-list">
                  {historyData.slice().reverse().map((h, idx) => (
                    <div key={idx} className="flex-between" style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} style={{ color: 'var(--text-muted)' }} /> {h.date}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '3px' }}>
                          <MapPin size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {h.source || 'General'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>
                            {h.quantity} {selectedHistoryItem.sizeUnit || 'unit'}
                          </span>
                          <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>
                            ₹{parseFloat(h.totalAmount || 0).toFixed(1)}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                          ₹{parseFloat(h.price || 0).toFixed(1)} / {selectedHistoryItem.sizeUnit || 'unit'}
                        </div>
                      </div>
                    </div>
                  ))}
                  {historyData.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No history entries.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
