import React, { useState, useEffect } from 'react';
import { PlusCircle, Trash2, RotateCcw } from 'lucide-react';
import { neonClient } from '../neonClient';

export default function AddPurchase({ onAdded, draft, setDraft, editingReceiptId, setEditingReceiptId, onCancelEdit }) {
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
        { id: Date.now(), itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: '', pricePerUnit: '', totalAmount: '' },
        { id: Date.now() + 1, itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: '', pricePerUnit: '', totalAmount: '' },
        { id: Date.now() + 2, itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: '', pricePerUnit: '', totalAmount: '' }
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
      const { data: items } = await neonClient
        .from('item_list')
        .select('*');

      if (items) {
        const formatted = items.map(i => ({
          ...i,
          size_value: i.size_qty !== undefined && i.size_qty !== null ? i.size_qty : i.size_value
        }));
        setSavedItems(formatted);
        const uniqueCategories = [...new Set(formatted.map(i => i.category).filter(Boolean))].sort();
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
          if (qty > 0 && price > 0) {
            updatedItem.totalAmount = (qty * price).toFixed(1);
          }
        } else if (field === 'pricePerUnit') {
          const qty = parseFloat(updatedItem.quantity) || 0;
          const price = parseFloat(value) || 0;
          if (value === '' || price === 0) {
            updatedItem.totalAmount = '';
          } else if (qty > 0 && price > 0) {
            updatedItem.totalAmount = (qty * price).toFixed(1);
          }
        } else if (field === 'totalAmount') {
          const qty = parseFloat(updatedItem.quantity) || 0;
          const total = parseFloat(value) || 0;
          if (value === '' || total === 0) {
            updatedItem.pricePerUnit = '';
          } else if (qty > 0 && total > 0) {
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
        if (item[field] === '' || item[field] === undefined || item[field] === null) {
          return item;
        }
        const val = parseFloat(item[field]);
        if (!isNaN(val)) {
          if (val === 0 && (field === 'pricePerUnit' || field === 'totalAmount')) {
            return { ...item, [field]: '' };
          }
          const formattedVal = Number.isInteger(val) ? String(val) : String(parseFloat(val.toFixed(1)));
          return { ...item, [field]: formattedVal };
        }
      }
      return item;
    }));
  };

  const addRow = () => {
    setActiveRowId(null);
    setFilteredSuggestions([]);
    setItems([...items, { id: Date.now(), itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: '', pricePerUnit: '', totalAmount: '' }]);
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

  const qtyInputRefs = React.useRef({});

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

    setTimeout(() => {
      if (qtyInputRefs.current[id]) {
        qtyInputRefs.current[id].focus();
        qtyInputRefs.current[id].select?.();
      }
    }, 50);
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

  const filteredSources = source && source.trim().length > 0
    ? ['Canteen', 'Mandoli', 'Friday-Market', 'Surplus'].filter(s => s.toLowerCase().includes(source.trim().toLowerCase()))
    : [];
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

      // Check if any valid item has missing category or quantity
      for (const item of validItems) {
        if (!item.category || !item.category.trim()) {
          alert(`Please enter a category for "${item.itemName}".`);
          return;
        }
        if (!item.quantity) {
          alert(`Please enter a quantity for "${item.itemName}".`);
          return;
        }
      }

      const itemInserts = validItems.map(async (item) => {
        const cleanName = item.itemName.replace(/\s*\([^)]*\)\s*$/, '').trim();
        const querySizeVal = item.sizeValue ? parseFloat(item.sizeValue) : null;
        const querySizeUnit = item.sizeUnit || null;

        let query = neonClient
          .from('item_list')
          .select('id')
          .eq('name', cleanName);

        if (querySizeVal !== null) {
          query = query.eq('size_qty', querySizeVal);
        } else {
          query = query.is('size_qty', null);
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
          const { data: newItem, error: insertError } = await neonClient
            .from('item_list')
            .insert([{
              name: cleanName,
              category: item.category || 'General',
              size_qty: querySizeVal,
              size_unit: querySizeUnit
            }])
            .select();

          if (insertError) throw insertError;

          if (newItem && newItem.length > 0) {
            itemId = newItem[0].id;
          } else {
            let fallbackQuery = neonClient
              .from('item_list')
              .select('id')
              .eq('name', cleanName);

            if (querySizeVal !== null) {
              fallbackQuery = fallbackQuery.eq('size_qty', querySizeVal);
            } else {
              fallbackQuery = fallbackQuery.is('size_qty', null);
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
          source_name: source,
          quantity: parseFloat(item.quantity) || 0,
          unit_price: parseFloat(item.pricePerUnit) || 0,
          total_amount: parseFloat(item.totalAmount) || 0,
          purchase_date: purchaseDate,
          invoice_number: receiptId
        };
      });

      const purchasesToInsert = (await Promise.all(itemInserts)).filter(Boolean);

      if (purchasesToInsert.length === 0) {
        alert('Please add at least one item to the receipt.');
        return;
      }

      if (editingReceiptId) {
        const { error: deleteError } = await neonClient
          .from('purchases')
          .delete()
          .or(`invoice_number.eq.${editingReceiptId},receipt_id.eq.${editingReceiptId}`);
        if (deleteError) throw deleteError;
      }

      const { error } = await neonClient
        .from('purchases')
        .insert(purchasesToInsert);
      if (error) throw error;

      if (setEditingReceiptId) setEditingReceiptId(null);
      setDraft({
        source: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        amountTaken: '',
        items: [
          { id: Date.now(), itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: '', pricePerUnit: '', totalAmount: '' },
          { id: Date.now() + 1, itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: '', pricePerUnit: '', totalAmount: '' },
          { id: Date.now() + 2, itemName: '', category: '', sizeValue: '', sizeUnit: '', quantity: '', pricePerUnit: '', totalAmount: '' }
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
      <div className="flex-between add-receipt-header" style={{ marginBottom: '1.25rem', alignItems: 'center' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', margin: 0, fontSize: 'clamp(1.15rem, 4vw, 1.45rem)' }}>
          <PlusCircle size={22} style={{ verticalAlign: 'middle', marginRight: '8px', flexShrink: 0 }} /> 
          <span>{editingReceiptId ? `Edit Receipt #${editingReceiptId}` : 'Add New Receipt'}</span>
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
          <button type="button" className="btn-reset-form" onClick={resetForm} title="Reset Form" aria-label="Reset Form">
            <RotateCcw size={18} />
          </button>
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="grid-2 add-receipt-main-fields" style={{ marginBottom: '1.25rem' }}>
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Source</label>
            <input
              placeholder="Select Source..."
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
            {showSourceSuggestions && filteredSources.length > 0 && (
              <div className="custom-suggestions dropdown">
                {filteredSources.map((s, idx) => {
                  const safeIndex = sourceSelectedIndex >= filteredSources.length ? 0 : sourceSelectedIndex;
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
                })}
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Purchase Date</label>
            <input
              type="date"
              required
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
              onClick={(e) => e.target.showPicker && e.target.showPicker()}
            />
          </div>
        </div>

        <div className={`receipt-table-wrapper ${(activeRowId || activeCategoryRowId) ? 'suggestions-active' : ''}`}>
          <table className="receipt-table responsive-table">
            <thead>
              <tr>
                <th style={{ width: '6%', textAlign: 'center' }}>S.NO.</th>
                <th style={{ width: '22%', textAlign: 'left' }}>ITEM NAME</th>
                <th style={{ width: '15%', textAlign: 'center' }}>CATEGORY</th>
                <th style={{ width: '18%', textAlign: 'center' }}>SIZE & UNIT</th>
                <th style={{ width: '10%', textAlign: 'center' }}>QTY.</th>
                <th style={{ width: '12%', textAlign: 'center' }}>RATE (₹)</th>
                <th style={{ width: '12%', textAlign: 'center' }}>AMT (₹)</th>
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
                    <div className="item-name-cell-content">
                      <input
                        placeholder="Type or select product..."
                        value={item.itemName}
                        onChange={e => handleItemChange(item.id, 'itemName', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, item.id)}
                        onBlur={() => setTimeout(() => setActiveRowId(null), 200)}
                        autoComplete="off"
                        className="item-name-input"
                        style={{ textAlign: 'left' }}
                      />
                    </div>
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
                      placeholder="General"
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
                    <div className="size-unit-merged-field">
                      <input
                        type="number"
                        step="1"
                        placeholder="Size"
                        value={item.sizeValue}
                        onChange={e => handleItemChange(item.id, 'sizeValue', e.target.value)}
                        className="size-input-part"
                      />
                      <div className="size-unit-divider"></div>
                      <select
                        value={(() => {
                          if (!item.sizeUnit) return '';
                          const l = String(item.sizeUnit).trim().toLowerCase();
                          if (l === 'kg') return 'kg';
                          if (l === 'g') return 'g';
                          if (l === 'l') return 'L';
                          if (l === 'ml') return 'ml';
                          if (l.startsWith('unit') || l.startsWith('pc') || l.startsWith('piece')) return 'Pc.';
                          return item.sizeUnit;
                        })()}
                        onChange={e => handleItemChange(item.id, 'sizeUnit', e.target.value)}
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
                  </td>
                  <td>
                    <input
                      ref={el => qtyInputRefs.current[item.id] = el}
                      type="number"
                      step="1"
                      placeholder="0"
                      value={item.quantity}
                      onChange={e => handleItemChange(item.id, 'quantity', e.target.value)}
                      onBlur={() => handleBlur(item.id, 'quantity')}
                      style={{ textAlign: 'center' }}
                    />
                  </td>
                  <td>
                    <input type="number" step="1" placeholder="0" value={item.pricePerUnit} onChange={e => handleItemChange(item.id, 'pricePerUnit', e.target.value)} onBlur={() => handleBlur(item.id, 'pricePerUnit')} style={{ textAlign: 'center' }} />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="1"
                      placeholder="0"
                      value={item.totalAmount}
                      onChange={e => handleItemChange(item.id, 'totalAmount', e.target.value)}
                      onBlur={() => handleBlur(item.id, 'totalAmount')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addRow();
                          setTimeout(() => {
                            const itemInputs = document.querySelectorAll('input[placeholder="Type or select product..."]');
                            if (itemInputs.length > 0) {
                              itemInputs[itemInputs.length - 1].focus();
                            }
                          }, 50);
                        }
                      }}
                      className="row-amount-input"
                      style={{ textAlign: 'center', fontWeight: 'bold' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button type="button" className="btn-action-delete" onClick={() => removeRow(item.id)} tabIndex={-1} disabled={items.length === 1} title="Delete row">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="receipt-summary-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }} onClick={addRow}>
              + Add Row ( ` )
            </button>
            <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2px', fontWeight: 600 }}>Total Amount:</div>
              <div className="purchase-total-amount" style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: '800' }}>
                ₹{calculateGrandTotal()}
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ background: 'rgba(255,255,255,0.05)', width: '100%', maxWidth: '320px', padding: '1rem', boxSizing: 'border-box' }}>
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
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}
              />
            </div>
            {amountTaken && (
              <div className="flex-between" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Balance Left:</span>
                <span className="purchase-balance-amount" style={{
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                  color: (parseFloat(amountTaken) - parseFloat(calculateGrandTotal())) < 0 ? '#ef4444' : undefined
                }}>
                  ₹{(parseFloat(amountTaken) - parseFloat(calculateGrandTotal())).toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', gap: '12px' }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
            {editingReceiptId ? 'Save Receipt Changes' : 'Save Receipt'}
          </button>
          {editingReceiptId && (
            <button 
              type="button" 
              className="btn btn-secondary-outline"
              style={{ borderRadius: '9999px', padding: '0.6rem 1.4rem' }}
              onClick={() => onCancelEdit ? onCancelEdit() : resetForm()}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
