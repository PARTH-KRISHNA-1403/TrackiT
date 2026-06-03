import React, { useState, useEffect } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function AddPurchase({ onAdded, draft, setDraft, editingReceiptId, setEditingReceiptId }) {
  const { source, purchaseDate, amountTaken, items } = draft;
  const [savedItems, setSavedItems] = useState([]);
  const [categories, setCategories] = useState([]);

  const setSource = (val) => setDraft({ ...draft, source: val });
  const setPurchaseDate = (val) => setDraft({ ...draft, purchaseDate: val });
  const setAmountTaken = (val) => setDraft({ ...draft, amountTaken: val });
  const setItems = (val) => setDraft({ ...draft, items: val });

  const resetForm = () => {
    if (setEditingReceiptId) setEditingReceiptId(null);
    setDraft({
      source: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      amountTaken: '',
      items: [
        { id: Date.now(), itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: 1, pricePerUnit: '', totalAmount: '' },
        { id: Date.now() + 1, itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: 1, pricePerUnit: '', totalAmount: '' },
        { id: Date.now() + 2, itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: 1, pricePerUnit: '', totalAmount: '' }
      ]
    });
  };
  const [activeRowId, setActiveRowId] = useState(null);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSourceSuggestions, setShowSourceSuggestions] = useState(false);
  const [activeCategoryRowId, setActiveCategoryRowId] = useState(null);
  const [sourceSelectedIndex, setSourceSelectedIndex] = useState(0);
  const [categorySelectedIndex, setCategorySelectedIndex] = useState(0);

  useEffect(() => {
    const fetchItemsAndCategories = async () => {
      const { data: items } = await supabase
        .from('items')
        .select('*');
        
      if (items) {
        setSavedItems(items);
        const uniqueCategories = [...new Set(items.map(i => i.category).filter(Boolean))].sort();
        setCategories(uniqueCategories);
      }
    };
    fetchItemsAndCategories();
  }, []);

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        if (field === 'itemName') {
          // Update suggestions
          if (value.trim().length > 0) {
            const matches = savedItems.filter(i => 
              i.name.toLowerCase().includes(value.toLowerCase())
            ).slice(0, 3);
            setFilteredSuggestions(matches);
            setActiveRowId(id);
            setSelectedIndex(0);
          } else {
            setFilteredSuggestions([]);
            setActiveRowId(null);
          }

          // Look for exact match to auto-fill
          const matchedItem = savedItems.find(i => {
            const formatted = i.size_value ? `${i.name} (${i.size_value} ${i.size_unit})` : i.name;
            return formatted.toLowerCase() === value.toLowerCase() || i.name.toLowerCase() === value.toLowerCase();
          });

          if (matchedItem) {
            updatedItem.category = matchedItem.category;
            updatedItem.sizeValue = matchedItem.size_value !== undefined && matchedItem.size_value !== null ? String(matchedItem.size_value) : '';
            updatedItem.sizeUnit = matchedItem.size_unit || matchedItem.default_unit || '';
          }
        }

        if (field === 'quantity') {
          const qty = parseFloat(value) || 0;
          const price = parseFloat(updatedItem.pricePerUnit) || 0;
          if (qty && price) {
            updatedItem.totalAmount = (qty * price).toFixed(1);
          }
        } else if (field === 'pricePerUnit') {
          const qty = parseFloat(updatedItem.quantity) || 0;
          const price = parseFloat(value) || 0;
          if (qty && price) {
            updatedItem.totalAmount = (qty * price).toFixed(1);
          }
        } else if (field === 'totalAmount') {
          const qty = parseFloat(updatedItem.quantity) || 0;
          const total = parseFloat(value) || 0;
          if (qty && total) {
            updatedItem.pricePerUnit = (total / qty).toFixed(1);
          }
        }

        return updatedItem;
      }
      return item;
    }));
  };

  const handleBlur = (id, field) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const val = parseFloat(item[field]);
        if (!isNaN(val)) {
          if (field === 'quantity' && item.sizeValue && item.sizeUnit) {
            return { ...item, [field]: String(Math.round(val)) };
          }
          return { ...item, [field]: val.toFixed(1) };
        }
      }
      return item;
    }));
  };

  const addRow = () => {
    setActiveRowId(null);
    setFilteredSuggestions([]);
    setItems([...items, { id: Date.now(), itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: 1, pricePerUnit: '', totalAmount: '' }]);
  };

  const addRowRef = React.useRef(addRow);
  useEffect(() => {
    addRowRef.current = addRow;
  });

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === '`') {
        e.preventDefault();
        addRowRef.current();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const removeRow = (id) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleSelectSuggestion = (id, item) => {
    setItems(items.map(it => {
      if (it.id === id) {
        return {
          ...it,
          itemName: item.name,
          category: item.category,
          sizeValue: item.size_value !== undefined && item.size_value !== null ? String(item.size_value) : '',
          sizeUnit: item.size_unit || item.default_unit || ''
        };
      }
      return it;
    }));
    setActiveRowId(null);
    setFilteredSuggestions([]);
  };

  const handleKeyDown = (e, id) => {
    if (activeRowId !== id || filteredSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredSuggestions[selectedIndex]) {
        e.preventDefault();
        handleSelectSuggestion(id, filteredSuggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setActiveRowId(null);
    }
  };

  const filteredSources = ['Canteen', 'Mandoli', 'Friday-Market'].filter(s => !source || s.toLowerCase().includes(source.toLowerCase()));
  const handleSourceKeyDown = (e) => {
    if (!showSourceSuggestions || filteredSources.length === 0) return;

    const safeIndex = sourceSelectedIndex >= filteredSources.length ? 0 : sourceSelectedIndex;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSourceSelectedIndex((safeIndex + 1) % filteredSources.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSourceSelectedIndex((safeIndex - 1 + filteredSources.length) % filteredSources.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredSources[safeIndex]) {
        e.preventDefault();
        setSource(filteredSources[safeIndex]);
        setShowSourceSuggestions(false);
      }
    } else if (e.key === 'Escape') {
      setShowSourceSuggestions(false);
    }
  };

  const getFilteredCategories = (itemCategory) => categories.filter(cat => !itemCategory || cat.toLowerCase().includes(itemCategory.toLowerCase()));
  const handleCategoryKeyDown = (e, item) => {
    const rowFilteredCategories = getFilteredCategories(item.category);
    if (activeCategoryRowId !== item.id || rowFilteredCategories.length === 0) return;

    const safeIndex = categorySelectedIndex >= rowFilteredCategories.length ? 0 : categorySelectedIndex;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCategorySelectedIndex((safeIndex + 1) % rowFilteredCategories.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCategorySelectedIndex((safeIndex - 1 + rowFilteredCategories.length) % rowFilteredCategories.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (rowFilteredCategories[safeIndex]) {
        e.preventDefault();
        handleItemChange(item.id, 'category', rowFilteredCategories[safeIndex]);
        setActiveCategoryRowId(null);
      }
    } else if (e.key === 'Escape') {
      setActiveCategoryRowId(null);
    }
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + (parseFloat(item.totalAmount) || 0), 0).toFixed(1);
  };

  const generateReceiptId = () => {
    return Math.floor(10000 + Math.random() * 90000).toString();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const receiptId = editingReceiptId || generateReceiptId();
      
      // Filter out empty rows
      const validItems = items.filter(item => item.itemName && item.itemName.trim() !== '');

      if (validItems.length === 0) {
        alert('Please add at least one item to the receipt.');
        return;
      }

      // Check if any valid item has missing category, quantity, rate, or amount
      for (const item of validItems) {
        if (!item.category || !item.category.trim()) {
          alert(`Please enter a category for "${item.itemName}".`);
          return;
        }
        if (!item.quantity) {
          alert(`Please enter a quantity for "${item.itemName}".`);
          return;
        }
        if (!item.pricePerUnit && !item.totalAmount) {
          alert(`Please enter a rate or amount for "${item.itemName}".`);
          return;
        }
      }

      const itemInserts = validItems.map(async (item) => {
        const cleanName = item.itemName.replace(/\s*\([^)]*\)\s*$/, '').trim();
        const querySizeVal = item.sizeValue ? parseFloat(item.sizeValue) : null;
        const querySizeUnit = item.sizeUnit || null;

        let query = supabase
          .from('items')
          .select('id')
          .eq('name', cleanName);

        if (querySizeVal !== null) {
          query = query.eq('size_value', querySizeVal);
        } else {
          query = query.is('size_value', null);
        }

        if (querySizeUnit !== null) {
          query = query.eq('size_unit', querySizeUnit);
        } else {
          query = query.is('size_unit', null);
        }

        let { data: existingItems } = await query;
          
        let itemId;
        if (existingItems && existingItems.length > 0) {
          itemId = existingItems[0].id;
        } else {
          const { data: newItem, error: insertError } = await supabase
            .from('items')
            .insert([{
              name: cleanName,
              category: item.category || 'General',
              size_value: querySizeVal,
              size_unit: querySizeUnit,
              default_unit: querySizeUnit || 'unit'
            }])
            .select();
            
          if (insertError) throw insertError;
          
          if (newItem && newItem.length > 0) {
            itemId = newItem[0].id;
          } else {
            let fallbackQuery = supabase
              .from('items')
              .select('id')
              .eq('name', cleanName);

            if (querySizeVal !== null) {
              fallbackQuery = fallbackQuery.eq('size_value', querySizeVal);
            } else {
              fallbackQuery = fallbackQuery.is('size_value', null);
            }

            if (querySizeUnit !== null) {
              fallbackQuery = fallbackQuery.eq('size_unit', querySizeUnit);
            } else {
              fallbackQuery = fallbackQuery.is('size_unit', null);
            }

            const { data: fallbackItem } = await fallbackQuery.limit(1);
            if (fallbackItem && fallbackItem.length > 0) {
              itemId = fallbackItem[0].id;
            } else {
              throw new Error("Could not retrieve ID for item: " + cleanName);
            }
          }
        }
        
        return {
          item_id: itemId,
          source: source,
          quantity: parseFloat(item.quantity) || 0,
          price_per_unit: parseFloat(item.pricePerUnit) || 0,
          total_amount: parseFloat(item.totalAmount) || 0,
          purchase_date: new Date(purchaseDate).toISOString(),
          receipt_id: receiptId
        };
      });
      
      const purchasesToInsert = (await Promise.all(itemInserts)).filter(Boolean);
      
      if (purchasesToInsert.length === 0) {
        alert('Please add at least one item to the receipt.');
        return;
      }
      
      if (editingReceiptId) {
        const { error: deleteError } = await supabase
          .from('purchases')
          .delete()
          .eq('receipt_id', editingReceiptId);
        if (deleteError) throw deleteError;
      }

      const { error } = await supabase
        .from('purchases')
        .insert(purchasesToInsert);
      if (error) throw error;

      if (setEditingReceiptId) setEditingReceiptId(null);
      setDraft({
        source: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        amountTaken: '',
        items: [
          { id: Date.now(), itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: 1, pricePerUnit: '', totalAmount: '' },
          { id: Date.now() + 1, itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: 1, pricePerUnit: '', totalAmount: '' },
          { id: Date.now() + 2, itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: 1, pricePerUnit: '', totalAmount: '' }
        ]
      });
      if (onAdded) onAdded();
    } catch (error) {
      console.error('Error saving purchase:', error);
      alert('Error saving purchase: ' + error.message);
    }
  };

  return (
    <div className="glass-card animate-fade-in">
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h2><PlusCircle size={24} style={{verticalAlign: 'middle', marginRight: '8px'}} /> {editingReceiptId ? `Edit Receipt #${editingReceiptId}` : 'Add New Receipt'}</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          {editingReceiptId && (
            <button type="button" className="btn" onClick={() => { if (setEditingReceiptId) setEditingReceiptId(null); resetForm(); }} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: '0.8rem', padding: '4px 12px' }}>
              Cancel Edit
            </button>
          )}
          <button type="button" className="btn" onClick={resetForm} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.8rem', padding: '4px 12px' }}>
            Reset Form
          </button>
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Source</label>
            <input 
              placeholder="e.g., Canteen, Mandoli" 
              value={source} 
              onChange={e => {
                setSource(e.target.value);
                setSourceSelectedIndex(0);
              }} 
              onFocus={() => setShowSourceSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSourceSuggestions(false), 200)}
              onKeyDown={handleSourceKeyDown}
              autoComplete="off"
            />
            {showSourceSuggestions && (
              <div className="custom-suggestions dropdown">
                {['Canteen', 'Mandoli', 'Friday-Market']
                  .filter(s => !source || s.toLowerCase().includes(source.toLowerCase()))
                  .map((s, idx, arr) => {
                    const safeIndex = sourceSelectedIndex >= arr.length ? 0 : sourceSelectedIndex;
                    return (
                      <div 
                        key={idx} 
                        className={`suggestion-item ${idx === safeIndex ? 'active' : ''}`} 
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSource(s);
                          setShowSourceSuggestions(false);
                        }}
                        onMouseEnter={() => setSourceSelectedIndex(idx)}
                      >
                        {s}
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Purchase Date</label>
            <input type="date" required value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
          </div>
        </div>

        <div className={`receipt-table-wrapper ${(activeRowId || activeCategoryRowId) ? 'suggestions-active' : ''}`}>
          <table className="receipt-table responsive-table">
            <thead>
              <tr>
                <th style={{ width: '5%', textAlign: 'center' }}>S.no.</th>
                <th style={{ width: '20%', textAlign: 'center' }}>Item</th>
                <th style={{ width: '15%', textAlign: 'center' }}>Category</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Size</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Unit</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Qty.</th>
                <th style={{ width: '12%', textAlign: 'center' }}>Rate</th>
                <th style={{ width: '13%', textAlign: 'center' }}>Amt</th>
                <th style={{ width: '5%' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td style={{ textAlign: 'center' }}>
                    <span className="serial-number">[ {index + 1} ]</span>
                  </td>
                  <td style={{ position: 'relative' }}>
                    <input 
                      placeholder="Item Name" 
                      value={item.itemName} 
                      onChange={e => handleItemChange(item.id, 'itemName', e.target.value)} 
                      onKeyDown={e => handleKeyDown(e, item.id)}
                      onBlur={() => setTimeout(() => setActiveRowId(null), 200)}
                      autoComplete="off" 
                      style={{ textAlign: 'center' }}
                    />
                    {activeRowId === item.id && filteredSuggestions.length > 0 && (
                      <div className="custom-suggestions">
                        {filteredSuggestions.map((suggestion, idx) => (
                          <div 
                            key={suggestion.id}
                            className={`suggestion-item ${idx === selectedIndex ? 'active' : ''}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectSuggestion(item.id, suggestion);
                            }}
                            onMouseEnter={() => setSelectedIndex(idx)}
                          >
                            <div style={{ fontWeight: 'bold' }}>{suggestion.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                              {suggestion.category} {suggestion.size_value ? `(${suggestion.size_value} ${suggestion.size_unit})` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ position: 'relative' }}>
                    <input 
                      placeholder="Category" 
                      value={item.category} 
                      onChange={e => {
                        handleItemChange(item.id, 'category', e.target.value);
                        setCategorySelectedIndex(0);
                      }} 
                      onFocus={() => setActiveCategoryRowId(item.id)}
                      onBlur={() => setTimeout(() => setActiveCategoryRowId(null), 200)}
                      onKeyDown={e => handleCategoryKeyDown(e, item)}
                      autoComplete="off" 
                      style={{ textAlign: 'center' }} 
                    />
                    {activeCategoryRowId === item.id && (
                      <div className="custom-suggestions">
                        {categories
                          .filter(cat => !item.category || cat.toLowerCase().includes(item.category.toLowerCase()))
                          .map((cat, idx, arr) => {
                            const safeIndex = categorySelectedIndex >= arr.length ? 0 : categorySelectedIndex;
                            return (
                              <div 
                                key={idx} 
                                className={`suggestion-item ${idx === safeIndex ? 'active' : ''}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleItemChange(item.id, 'category', cat);
                                  setActiveCategoryRowId(null);
                                }}
                                onMouseEnter={() => setCategorySelectedIndex(idx)}
                              >
                                {cat}
                              </div>
                            );
                          })
                        }
                      </div>
                    )}
                  </td>
                  <td>
                    <input type="number" step="any" placeholder="Size" value={item.sizeValue} onChange={e => handleItemChange(item.id, 'sizeValue', e.target.value)} style={{ textAlign: 'center' }} />
                  </td>
                  <td>
                    <select value={item.sizeUnit} onChange={e => handleItemChange(item.id, 'sizeUnit', e.target.value)} style={{ textAlign: 'center' }}>
                      <option value="">None</option>
                      <option value="unit">unit</option>
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="L">L</option>
                      <option value="ml">ml</option>
                    </select>
                  </td>
                  <td>
                    <input 
                      type="number" 
                      step="0.1" 
                      value={item.quantity} 
                      onChange={e => handleItemChange(item.id, 'quantity', e.target.value)} 
                      onBlur={() => handleBlur(item.id, 'quantity')}
                      style={{ textAlign: 'center' }} 
                    />
                  </td>
                  <td>
                    <input type="number" step="0.1" placeholder="₹ 0.0" value={item.pricePerUnit} onChange={e => handleItemChange(item.id, 'pricePerUnit', e.target.value)} onBlur={() => handleBlur(item.id, 'pricePerUnit')} style={{ textAlign: 'center' }} />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      step="0.1" 
                      placeholder="₹ 0.0" 
                      value={item.totalAmount} 
                      onChange={e => handleItemChange(item.id, 'totalAmount', e.target.value)} 
                      onBlur={() => handleBlur(item.id, 'totalAmount')} 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addRow();
                          setTimeout(() => {
                            const itemInputs = document.querySelectorAll('input[placeholder="Item Name"]');
                            if (itemInputs.length > 0) {
                              itemInputs[itemInputs.length - 1].focus();
                            }
                          }, 50);
                        }
                      }}
                      style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--secondary)' }} 
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button type="button" className="btn-icon" onClick={() => removeRow(item.id)} disabled={items.length === 1}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="receipt-summary-row" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }} onClick={addRow}>
              + Add Row ( ` )
            </button>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '4px' }}>Total Amount:</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--secondary)' }}>
                ₹{calculateGrandTotal()}
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ background: 'rgba(255,255,255,0.05)', width: '100%', maxWidth: '300px', padding: '1rem' }}>
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem' }}>Amount taken with me</label>
              <input 
                type="number" 
                placeholder="₹ 0.0" 
                value={amountTaken} 
                onChange={e => setAmountTaken(e.target.value)} 
                onBlur={() => {
                  const val = parseFloat(amountTaken);
                  if (!isNaN(val)) {
                    setAmountTaken(val.toFixed(1));
                  }
                }}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
            {amountTaken && (
              <div className="flex-between" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Balance Left:</span>
                <span style={{ 
                  fontWeight: 'bold', 
                  fontSize: '1.2rem', 
                  color: (parseFloat(amountTaken) - parseFloat(calculateGrandTotal())) >= 0 ? 'var(--secondary)' : '#ef4444' 
                }}>
                  ₹{(parseFloat(amountTaken) - parseFloat(calculateGrandTotal())).toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Save Receipt</button>
        </div>
      </form>
    </div>
  );
}
