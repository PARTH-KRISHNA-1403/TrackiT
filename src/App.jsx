import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Dashboard from './components/Dashboard';
import AddPurchase from './components/AddPurchase';
import ItemHistory from './components/ItemHistory';
import ManageItems from './components/ManageItems';
import Search from './components/Search';
import { neonClient } from './neonClient';
import { Sun, Moon, LayoutGrid, PlusCircle, Package, ReceiptText, MapPin, Edit2, X, Calendar, Trash2 } from 'lucide-react';

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
  const createInitialDraft = () => ({
    source: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    amountTaken: '',
    items: [
      { id: Date.now(), itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: '', pricePerUnit: '', totalAmount: '' },
      { id: Date.now() + 1, itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: '', pricePerUnit: '', totalAmount: '' },
      { id: Date.now() + 2, itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: '', pricePerUnit: '', totalAmount: '' }
    ]
  });

  const [draftPurchase, setDraftPurchase] = useState(createInitialDraft);


  const fetchData = async () => {
    try {
      const { data: purchasesData, error } = await neonClient
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
      pricePerUnit: (item.price_per_unit !== undefined && item.price_per_unit !== null && parseFloat(item.price_per_unit) > 0)
        ? parseFloat(item.price_per_unit).toFixed(1)
        : ((item.unit_price !== undefined && item.unit_price !== null && parseFloat(item.unit_price) > 0)
          ? parseFloat(item.unit_price).toFixed(1)
          : ((parseFloat(item.pricePerUnit) > 0) ? String(item.pricePerUnit) : '')),
      totalAmount: (item.total_amount !== undefined && item.total_amount !== null && parseFloat(item.total_amount) > 0)
        ? parseFloat(item.total_amount).toFixed(1)
        : ((parseFloat(item.totalAmount) > 0) ? String(item.totalAmount) : ''),
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
    setDraftPurchase(createInitialDraft());
    if (editingReceiptBackup) {
      setSelectedReceipt(editingReceiptBackup);
    }
    setActiveTab('dashboard');
  };

  const [dashboardResetTrigger, setDashboardResetTrigger] = useState(0);
  const [manageItemsResetTrigger, setManageItemsResetTrigger] = useState(0);

  const handleDashboardTabClick = () => {
    setDashboardResetTrigger(prev => prev + 1);
    setActiveTab('dashboard');
  };

  const handleManageItemsTabClick = () => {
    setManageItemsResetTrigger(prev => prev + 1);
    setActiveTab('items');
  };

  const handleAddPurchaseTabClick = () => {
    if (editingReceiptId) {
      setEditingReceiptId(null);
      setEditingReceiptBackup(null);
      setDraftPurchase(createInitialDraft());
    }
    setActiveTab('add');
  };

  const handleDeleteReceipt = async (receipt) => {
    if (!receipt) return;
    const invoiceLabel = receipt.receiptId ? `Invoice #${receipt.receiptId}` : 'this invoice';
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${invoiceLabel}?\n\nThis will remove the purchase transactions from the database, while keeping your saved items intact in the database.`
    );
    if (!confirmDelete) return;

    try {
      const purchaseIds = (receipt.items || []).map(i => i.id).filter(Boolean);

      if (purchaseIds.length > 0) {
        const { error: delError } = await neonClient
          .from('purchases')
          .delete()
          .in('id', purchaseIds);
        if (delError) throw delError;
      }

      if (receipt.receiptId) {
        await neonClient
          .from('purchases')
          .delete()
          .or(`invoice_number.eq.${receipt.receiptId},receipt_id.eq.${receipt.receiptId}`);
      }

      setSelectedReceipt(null);
      setTappedQtyIndex(null);
      setTappedDescIndex(null);

      await fetchData();
    } catch (err) {
      console.error('Failed to delete invoice:', err);
      alert('Failed to delete invoice: ' + (err.message || 'Unknown error'));
    }
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
        <div 
          className="header-brand" 
          onClick={handleDashboardTabClick}
          style={{ cursor: 'pointer' }}
          title="Return to Main Dashboard"
        >
          <div className="brand-logo-icon">
            <ReceiptText size={22} color="#fff" />
          </div>
          <span className="brand-title">Track-iT</span>
        </div>

        <nav className="header-nav-tabs">
          <button
            className={`header-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={handleDashboardTabClick}
          >
            <LayoutGrid size={18} />
            <span>Dashboard</span>
          </button>
          <button
            className={`header-tab-btn ${activeTab === 'add' ? 'active' : ''}`}
            onClick={handleAddPurchaseTabClick}
          >
            <PlusCircle size={18} />
            <span>Add Purchase</span>
          </button>
          <button
            className={`header-tab-btn ${activeTab === 'items' ? 'active' : ''}`}
            onClick={handleManageItemsTabClick}
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
              onDeleteReceipt={handleDeleteReceipt}
              resetTrigger={dashboardResetTrigger}
            />
          </div>
        )}

        {activeTab === 'add' && (
          <AddPurchase
            key={editingReceiptId ? `edit-${editingReceiptId}` : 'new-purchase'}
            onAdded={handlePurchaseAdded}
            draft={draftPurchase}
            setDraft={setDraftPurchase}
            editingReceiptId={editingReceiptId}
            setEditingReceiptId={setEditingReceiptId}
            onCancelEdit={handleCancelEdit}
          />
        )}

        {activeTab === 'items' && <ManageItems resetTrigger={manageItemsResetTrigger} />}
        {activeTab === 'search' && (
          <Search
            onPurchaseClick={handleItemClick}
            purchases={purchases}
            onEditReceipt={handleEditReceipt}
            onReceiptClick={setSelectedReceipt}
            onDeleteReceipt={handleDeleteReceipt}
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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn invoice-modal-edit-btn"
                  onClick={() => handleEditReceipt(selectedReceipt)}
                  title="Edit Receipt"
                >
                  <Edit2 size={16} /> Edit
                </button>
                <button
                  type="button"
                  className="btn invoice-modal-delete-btn"
                  onClick={() => handleDeleteReceipt(selectedReceipt)}
                  title="Delete Invoice"
                >
                  <Trash2 size={16} /> Delete
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
              <div className="modal-date-badge">
                <Calendar size={15} />
                <span>{new Date(selectedReceipt.date).toLocaleDateString('en-GB')}</span>
              </div>

              <div className="modal-source-badge">
                <MapPin size={15} />
                <span>Source: {selectedReceipt.source || 'General'}</span>
              </div>

              <div className="modal-items-count-box">
                Total Items: <strong>{selectedReceipt.items.length}</strong>
              </div>
            </div>

            {/* Neat Glassmorphic Invoice Items Table */}
            <div style={{ overflowX: 'auto', marginBottom: '1.5rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
              <table className="modal-receipt-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'center' }}>Unit</th>
                    <th style={{ textAlign: 'right' }}>Price (₹)</th>
                    <th style={{ textAlign: 'right' }}>Total (₹)</th>
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
                      <tr key={i}>
                        <td className="col-idx">{i + 1}</td>
                        <td className="col-name">
                          <div className="item-name-text">{item.item_name}</div>
                          {item.description && (
                            <div className="item-desc-text">
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td className="col-category">{item.category || 'General'}</td>
                        <td className="col-qty">
                          {formattedQty}
                        </td>
                        <td className="col-unit">
                          {unitText}
                        </td>
                        <td className="col-price">
                          {parseFloat(item.price_per_unit || item.unit_price || 0) > 0
                            ? `₹${parseFloat(item.price_per_unit || item.unit_price || 0).toFixed(1)}`
                            : ''}
                        </td>
                        <td className="col-total">
                          {parseFloat(item.total_amount || 0) > 0
                            ? `₹${parseFloat(item.total_amount || 0).toFixed(1)}`
                            : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Amount Footer */}
            <div className="flex-between modal-total-footer">
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)' }}>Grand Total</span>
              <span className="modal-grand-total-val">
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
