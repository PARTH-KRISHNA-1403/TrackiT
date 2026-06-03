import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import AddPurchase from './components/AddPurchase';
import ItemHistory from './components/ItemHistory';
import ManageItems from './components/ManageItems';
import Search from './components/Search';
import { supabase } from './supabaseClient';
import { ShoppingCart, Sun, Moon, Printer, Edit2, X, MapPin } from 'lucide-react';

function App() {
  const [purchases, setPurchases] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [tappedQtyIndex, setTappedQtyIndex] = useState(null);
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
      { id: Date.now(), itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: 1, pricePerUnit: '', totalAmount: '' },
      { id: Date.now() + 1, itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: 1, pricePerUnit: '', totalAmount: '' },
      { id: Date.now() + 2, itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: 1, pricePerUnit: '', totalAmount: '' }
    ]
  });


  const fetchData = async () => {
    try {
      const { data: purchasesData, error } = await supabase
        .from('purchases')
        .select(`
          *,
          items (name, category, default_unit, size_value, size_unit)
        `)
        .order('purchase_date', { ascending: false })
        .order('id', { ascending: false });

      if (error) throw error;

      const formattedPurchases = purchasesData.map(p => ({
        ...p,
        item_name: p.items?.name,
        category: p.items?.category,
        default_unit: p.items?.default_unit,
        size_value: p.items?.size_value,
        size_unit: p.items?.size_unit
      }));

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

  const handleEditReceipt = (receipt) => {
    const draftItems = receipt.items.map((item, idx) => ({
      id: item.id || Date.now() + idx,
      itemName: item.item_name,
      category: item.category || '',
      sizeValue: item.size_value !== undefined && item.size_value !== null ? String(item.size_value) : '',
      sizeUnit: item.size_unit || '',
      quantity: item.quantity,
      pricePerUnit: parseFloat(item.price_per_unit).toFixed(1),
      totalAmount: parseFloat(item.total_amount).toFixed(1)
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
  };

  const handlePurchaseAdded = () => {
    fetchData();
    setActiveTab('dashboard');
  };

  const handleItemClick = (purchase) => {
    setSelectedItem(purchase);
    setActiveTab('history');
  };

  return (
    <div className="app-container">
      <header style={{ textAlign: 'center', marginBottom: '3rem', position: 'relative' }}>
        <button 
          onClick={toggleTheme} 
          className="btn-theme-toggle"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        <h1><ShoppingCart size={36} style={{ verticalAlign: 'middle', marginRight: '10px' }} /> Track iT</h1>

        <div className="nav-tabs">
          <button
            className={`btn nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`btn nav-tab-btn ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveTab('add')}
          >
            Add Purchase
          </button>
          <button
            className={`btn nav-tab-btn ${activeTab === 'items' ? 'active' : ''}`}
            onClick={() => setActiveTab('items')}
          >
            Manage Items
          </button>
          <button
            className={`btn nav-tab-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Search
          </button>
        </div>
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
              <ItemHistory item={selectedItem} />
            ) : (
              <p>Please select an item from the dashboard to view its history.</p>
            )}
          </div>
        )}
      </main>

      {/* Receipt Detail Modal */}
      {selectedReceipt && (
        <div 
          className="modal-overlay" 
          onClick={() => { setSelectedReceipt(null); setTappedQtyIndex(null); }}
        >
          <div 
            className="print-receipt"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h2>Bill #{selectedReceipt.receiptId || '00000'}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="modal-header-btn"
                  title="Print/Share Receipt"
                  onClick={() => window.print()}
                >
                  <Printer size={20} />
                </button>
                <button
                  className="modal-header-btn"
                  onClick={() => handleEditReceipt(selectedReceipt)}
                  title="Edit Receipt"
                >
                  <Edit2 size={20} />
                </button>
                <button
                  className="modal-header-btn"
                  onClick={() => { setSelectedReceipt(null); setTappedQtyIndex(null); }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
              {new Date(selectedReceipt.date).toLocaleDateString('en-GB')}
              <br />
              <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}><MapPin size={14} style={{ verticalAlign: 'middle' }} /> {selectedReceipt.source || 'General'}</span>
              {selectedReceipt.receiptId && <span style={{ marginLeft: '15px', color: 'var(--primary)', fontWeight: 'bold' }}>ID: #{selectedReceipt.receiptId}</span>}
            </p>

            <table className="receipt-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'center', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedReceipt.items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{item.item_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.category}</div>
                    </td>
                    <td 
                      style={{ cursor: item.size_value && item.size_unit ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (item.size_value && item.size_unit) {
                          setTappedQtyIndex(prev => prev === i ? null : i);
                        }
                      }}
                    >
                      {item.size_value && item.size_unit
                        ? `${Math.round(item.quantity)} pkt`
                        : `${parseFloat(item.quantity).toFixed(1)} ${item.default_unit || 'unit'}`}
                      {tappedQtyIndex === i && item.size_value && item.size_unit && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginTop: '2px' }}>
                          pkt = {item.size_value}{item.size_unit}
                        </div>
                      )}
                    </td>
                    <td>₹{parseFloat(item.price_per_unit || 0).toFixed(1)}</td>
                    <td style={{ fontWeight: 'bold' }}>₹{parseFloat(item.total_amount || 0).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3" style={{ fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center' }}>Total Amount</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.5rem', color: 'var(--secondary)' }}>
                    ₹{selectedReceipt.total.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
