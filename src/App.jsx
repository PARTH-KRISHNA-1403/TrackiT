import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Dashboard from './components/Dashboard';
import AddPurchase from './components/AddPurchase';
import ItemHistory from './components/ItemHistory';
import ManageItems from './components/ManageItems';
import Search from './components/Search';
import { supabase } from './supabaseClient';
import { Sun, Moon, LayoutGrid, PlusCircle, Package, ReceiptText, MapPin, Edit2, X, Calendar } from 'lucide-react';

function App() {
  const [purchases, setPurchases] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [tappedQtyIndex, setTappedQtyIndex] = useState(null);
  const [tappedDescIndex, setTappedDescIndex] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'add', 'history', 'items'
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  const [draftPurchase, setDraftPurchase] = useState({
    source: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    amountTaken: '',
    items: [
      { id: Date.now(), itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: '', pricePerUnit: '', totalAmount: '' },
      { id: Date.now() + 1, itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: '', pricePerUnit: '', totalAmount: '' },
      { id: Date.now() + 2, itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: '', pricePerUnit: '', totalAmount: '' }
    ]
  });


  const fetchData = async () => {
    try {
      const { data: purchasesData, error } = await supabase
        .from('purchases')
        .select(`
          *,
          item_list (name, category, size_unit, size_qty, qr_id)
        `)
        .order('purchase_date', { ascending: false })
        .order('id', { ascending: false });

      if (error) throw error;

      const formattedPurchases = purchasesData.map(p => {
        const itemObj = p.item_list || p.items || {};
        const sizeQty = itemObj.size_qty !== undefined && itemObj.size_qty !== null ? itemObj.size_qty : itemObj.size_value;
        return {
          ...p,
          source: p.source_name || p.source,
          receipt_id: p.invoice_number || p.receipt_id,
          price_per_unit: p.unit_price !== undefined ? p.unit_price : p.price_per_unit,
          item_name: itemObj.name,
          category: itemObj.category,
          size_value: sizeQty,
          size_qty: sizeQty,
          size_unit: itemObj.size_unit,
          qr_id: itemObj.qr_id
        };
      });

      setPurchases(formattedPurchases);

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const monthlySpent = formattedPurchases
        .filter(p => {
          const d = new Date(p.purchase_date);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .reduce((sum, p) => sum + parseFloat(p.total_amount), 0);

      const itemCounts = {};
      formattedPurchases.forEach(p => {
        if (p.item_name) {
          itemCounts[p.item_name] = (itemCounts[p.item_name] || 0) + 1;
        }
      });

      const frequentItems = Object.entries(itemCounts)
        .map(([name, count]) => ({ name, purchase_count: count }))
        .sort((a, b) => b.purchase_count - a.purchase_count)
        .slice(0, 5);

      setStats({ monthlySpent, frequentItems });
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [editingReceiptId, setEditingReceiptId] = useState(null);
  const [editingReceiptBackup, setEditingReceiptBackup] = useState(null);

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

  const handleEditReceipt = (receipt) => {
    setEditingReceiptBackup(receipt);

    const draftItems = (receipt.items || []).map((item, idx) => ({
      id: item.id || Date.now() + idx,
      itemName: item.item_name || item.itemName || '',
      category: item.category || '',
      sizeValue: item.size_value !== undefined && item.size_value !== null 
        ? String(item.size_value) 
        : (item.sizeValue !== undefined && item.sizeValue !== null ? String(item.sizeValue) : ''),
      sizeUnit: normalizeUnit(item.size_unit || item.sizeUnit || item.default_unit || item.unit),
      quantity: item.quantity !== undefined && item.quantity !== null 
        ? (item.quantity % 1 === 0 ? Math.round(item.quantity) : item.quantity) 
        : '',
      pricePerUnit: item.price_per_unit !== undefined && item.price_per_unit !== null 
        ? parseFloat(item.price_per_unit).toFixed(1) 
        : (item.unit_price !== undefined && item.unit_price !== null ? parseFloat(item.unit_price).toFixed(1) : (item.pricePerUnit || '')),
      totalAmount: item.total_amount !== undefined && item.total_amount !== null 
        ? parseFloat(item.total_amount).toFixed(1) 
        : (item.totalAmount || ''),
      hasDescription: !!item.description,
      description: item.description || ''
    }));

    setDraftPurchase({
      source: receipt.source || '',
      purchaseDate: receipt.date ? receipt.date.split('T')[0] : new Date().toISOString().split('T')[0],
      amountTaken: '',
      items: draftItems
    });

    setEditingReceiptId(receipt.receiptId);
    setActiveTab('add');
    setSelectedReceipt(null);
    setTappedDescIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingReceiptId(null);
    if (editingReceiptBackup) {
      setSelectedReceipt(editingReceiptBackup);
    }
    setActiveTab('dashboard');
  };

  const handlePurchaseAdded = () => {
    fetchData();
    setActiveTab('dashboard');
  };

  const handleItemClick = (purchase) => {
    setSelectedItem(purchase);
    setActiveTab('history');
  };

  const handleOpenReceiptFromHistory = (historyItem) => {
    const receiptItems = purchases.filter(p => {
      if (historyItem.receiptId && p.receipt_id) {
        return p.receipt_id === historyItem.receiptId;
      }
      return p.purchase_date === historyItem.date && p.source === historyItem.source;
    });

    if (receiptItems.length > 0) {
      const receiptObj = {
        receiptId: receiptItems[0].receipt_id,
        date: receiptItems[0].purchase_date,
        source: receiptItems[0].source,
        items: receiptItems,
        total: receiptItems.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0)
      };
      setSelectedReceipt(receiptObj);
    }
  };

  // Handle ESC key to close selected receipt modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedReceipt(null);
        setTappedQtyIndex(null);
        setTappedDescIndex(null);
      }
    };
    if (selectedReceipt) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedReceipt]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo-icon">
            <ReceiptText size={22} color="#fff" />
          </div>
          <span className="brand-title">Track-iT</span>
          <span className="brand-badge">LEDGER</span>
        </div>

        <nav className="header-nav-tabs">
          <button
            className={`header-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutGrid size={18} />
            <span>Dashboard</span>
          </button>
          <button
            className={`header-tab-btn ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveTab('add')}
          >
            <PlusCircle size={18} />
            <span>Add Purchase</span>
          </button>
          <button
            className={`header-tab-btn ${activeTab === 'items' ? 'active' : ''}`}
            onClick={() => setActiveTab('items')}
          >
            <Package size={18} />
            <span>Manage Items</span>
          </button>
        </nav>

        <button
          onClick={toggleTheme}
          className="btn-theme-toggle"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </header>

      <main>
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in">
            <Dashboard
              stats={stats}
              purchases={purchases}
              onPurchaseClick={handleItemClick}
              onEditReceipt={handleEditReceipt}
              onReceiptClick={setSelectedReceipt}
            />
          </div>
        )}

        {activeTab === 'add' && (
          <AddPurchase
            onAdded={handlePurchaseAdded}
            draft={draftPurchase}
            setDraft={setDraftPurchase}
            editingReceiptId={editingReceiptId}
            setEditingReceiptId={setEditingReceiptId}
            onCancelEdit={handleCancelEdit}
          />
        )}

        {activeTab === 'items' && <ManageItems />}
        {activeTab === 'search' && (
          <Search
            onPurchaseClick={handleItemClick}
            purchases={purchases}
            onEditReceipt={handleEditReceipt}
            onReceiptClick={setSelectedReceipt}
          />
        )}

        {activeTab === 'history' && (
          <div className="animate-fade-in">
            <button
              className="btn"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--border-color)', marginBottom: '1rem' }}
              onClick={() => setActiveTab('dashboard')}
            >
              ← Back to Dashboard
            </button>
            {selectedItem ? (
              <ItemHistory item={selectedItem} onReceiptClick={handleOpenReceiptFromHistory} />
            ) : (
              <p>Please select an item from the dashboard to view its history.</p>
            )}
          </div>
        )}
      </main>

      {/* Modern Glassmorphic Receipt Detail Popup Modal */}
      {selectedReceipt && createPortal(
        <div
          className="scanner-modal-overlay"
          style={{ zIndex: 99999 }}
          onClick={() => { setSelectedReceipt(null); setTappedQtyIndex(null); setTappedDescIndex(null); }}
        >
          <div
            className="glass-card animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '680px',
              border: '1.5px solid var(--primary)',
              background: 'var(--bg-color)',
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Title & Quick Actions */}
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ReceiptText size={22} color="var(--primary)" />
                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem' }}>
                  {selectedReceipt.receiptId ? `Invoice #${selectedReceipt.receiptId}` : 'Receipt Details'}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  onClick={() => handleEditReceipt(selectedReceipt)}
                  title="Edit Receipt"
                >
                  <Edit2 size={16} /> Edit
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => { setSelectedReceipt(null); setTappedQtyIndex(null); setTappedDescIndex(null); }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Invoice Meta Badges (Date & Source) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.15))',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                padding: '0.45rem 0.9rem',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: '700',
                color: '#ffffff'
              }}>
                <Calendar size={14} color="var(--secondary)" />
                <span>{new Date(selectedReceipt.date).toLocaleDateString('en-GB')}</span>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.2), rgba(249, 115, 22, 0.1))',
                border: '1px solid rgba(249, 115, 22, 0.35)',
                padding: '0.45rem 0.9rem',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: '700',
                color: '#fb923c'
              }}>
                <MapPin size={14} color="#fb923c" />
                <span>Source: {selectedReceipt.source || 'General'}</span>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                padding: '0.45rem 0.9rem',
                borderRadius: '12px',
                fontSize: '0.85rem',
                color: 'var(--text-muted)'
              }}>
                Total Items: <strong style={{ color: 'var(--text-main)' }}>{selectedReceipt.items.length}</strong>
              </div>
            </div>

            {/* Neat Glassmorphic Invoice Items Table */}
            <div style={{ overflowX: 'auto', marginBottom: '1.5rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>#</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Item Name</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Unit</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Price (₹)</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReceipt.items.map((item, i) => {
                    // Format Qty: no pkt, avoid unnecessary decimals (e.g. 3 instead of 3.0)
                    const rawQty = parseFloat(item.quantity || 0);
                    const formattedQty = isNaN(rawQty) ? '0' : (rawQty % 1 === 0 ? String(Math.round(rawQty)) : String(rawQty));

                    const cleanUnitString = (u) => {
                      if (!u) return 'Pc.';
                      const s = String(u).trim();
                      if (s.toLowerCase().startsWith('unit')) return 'Pc.';
                      return s;
                    };

                    // Format Unit: <size unit> if size exists, otherwise unit
                    let unitText = cleanUnitString(item.default_unit || item.unit);
                    if (item.size_value && item.size_unit) {
                      unitText = `${item.size_value} ${cleanUnitString(item.size_unit)}`;
                    } else if (item.size_unit) {
                      unitText = cleanUnitString(item.size_unit);
                    }

                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s ease' }}>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                          <div>{item.item_name}</div>
                          {item.description && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{item.category || 'General'}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--secondary)' }}>
                          {formattedQty}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {unitText}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                          ₹{parseFloat(item.price_per_unit || item.unit_price || 0).toFixed(1)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--text-main)' }}>
                          ₹{parseFloat(item.total_amount || 0).toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Amount Footer */}
            <div className="flex-between" style={{ padding: '1rem 1.25rem', background: 'rgba(16, 185, 129, 0.1)', border: '1.5px solid rgba(16, 185, 129, 0.35)', borderRadius: '16px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)' }}>Grand Total</span>
              <span style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--secondary)', textShadow: '0 0 12px rgba(52, 211, 153, 0.35)' }}>
                ₹{selectedReceipt.total.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default App;
