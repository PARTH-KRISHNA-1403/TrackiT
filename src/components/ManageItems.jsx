import React, { useState, useEffect } from 'react';
import { PackagePlus, Package, Edit2, Trash2, Check, X, Search } from 'lucide-react';
import { neonClient } from '../neonClient';

export default function ManageItems({ resetTrigger }) {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    sizeValue: '',
    sizeUnit: ''
  });
  const [categories, setCategories] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const [visibleCategories, setVisibleCategories] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (resetTrigger) {
      setSearchQuery('');
      setVisibleCategories(new Set());
      setEditingId(null);
      setEditData({});
      setFormData({ name: '', category: '', sizeValue: '', sizeUnit: '' });
    }
  }, [resetTrigger]);

  const [showAddCategorySuggestions, setShowAddCategorySuggestions] = useState(false);
  const [showEditCategorySuggestions, setShowEditCategorySuggestions] = useState(false);
  const [addCategorySelectedIndex, setAddCategorySelectedIndex] = useState(0);
  const [editCategorySelectedIndex, setEditCategorySelectedIndex] = useState(0);

  const filteredAddCategories = categories.filter(cat => 
    !formData.category || cat.toLowerCase().includes(formData.category.toLowerCase())
  );

  const filteredEditCategories = categories.filter(cat => 
    !editData.category || cat.toLowerCase().includes(editData.category.toLowerCase())
  );

  const handleAddCategoryKeyDown = (e) => {
    if (!showAddCategorySuggestions || filteredAddCategories.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAddCategorySelectedIndex(prev => (prev + 1) % filteredAddCategories.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAddCategorySelectedIndex(prev => (prev - 1 + filteredAddCategories.length) % filteredAddCategories.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredAddCategories[addCategorySelectedIndex]) {
        e.preventDefault();
        setFormData({ ...formData, category: filteredAddCategories[addCategorySelectedIndex] });
        setShowAddCategorySuggestions(false);
      }
    } else if (e.key === 'Escape') {
      setShowAddCategorySuggestions(false);
    }
  };

  const handleEditCategoryKeyDown = (e) => {
    if (!showEditCategorySuggestions || filteredEditCategories.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setEditCategorySelectedIndex(prev => (prev + 1) % filteredEditCategories.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setEditCategorySelectedIndex(prev => (prev - 1 + filteredEditCategories.length) % filteredEditCategories.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredEditCategories[editCategorySelectedIndex]) {
        e.preventDefault();
        setEditData({ ...editData, category: filteredEditCategories[editCategorySelectedIndex] });
        setShowEditCategorySuggestions(false);
      }
    } else if (e.key === 'Escape') {
      setShowEditCategorySuggestions(false);
    }
  };

  const normalizeUnit = (u) => {
    if (!u) return '';
    const s = String(u).trim();
    const lower = s.toLowerCase();
    if (lower === 'kg') return 'kg';
    if (lower === 'g') return 'g';
    if (lower === 'l') return 'L';
    if (lower === 'ml') return 'ml';
    if (lower.startsWith('pc') || lower.startsWith('unit') || lower.startsWith('piece')) return 'Pc.';
    return s;
  };

  const fetchItems = async () => {
    try {
      const { data } = await neonClient.from('item_list').select('*').order('name');
      if (data) {
        const formatted = data.map(item => {
          const rawSize = item.size_qty !== undefined && item.size_qty !== null ? item.size_qty : item.size_value;
          return {
            ...item,
            size_qty: rawSize !== undefined && rawSize !== null ? rawSize : null,
            size_value: rawSize !== undefined && rawSize !== null ? rawSize : '',
            size_unit: normalizeUnit(item.size_unit || item.unit || item.default_unit)
          };
        });
        setItems(formatted);
      }
    } catch (err) {
      console.error('Failed to fetch items', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await neonClient.from('item_list').select('category');
      if (data) {
        const uniqueCategories = [...new Set(data.map(i => i.category).filter(Boolean))].sort();
        setCategories(uniqueCategories);
      }
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, []);

  const toggleCategory = (cat) => {
    const newSet = new Set(visibleCategories);
    if (newSet.has(cat)) newSet.delete(cat);
    else newSet.add(cat);
    setVisibleCategories(newSet);
  };

  const isSearching = searchQuery.trim().length > 0;

  // Filter items by search query if user is typing
  const filteredItems = isSearching
    ? items.filter(item => {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = item.name && item.name.toLowerCase().includes(q);
        const catMatch = item.category && item.category.toLowerCase().includes(q);
        const unitMatch = item.size_unit && item.size_unit.toLowerCase().includes(q);
        return nameMatch || catMatch || unitMatch;
      })
    : items;

  // Group items by category
  const groupedItems = filteredItems.reduce((acc, item) => {
    const cat = item.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // Category is visible only if searching, or if user explicitly clicked its capsule
  const isCategoryVisible = (cat) => {
    if (isSearching) return true;
    return visibleCategories.has(cat);
  };

  const handleDeleteItem = async (item) => {
    if (!item || !item.id) return;
    const itemLabel = item.name + (item.size_value || item.size_unit ? ` (${item.size_value ? `${item.size_value} ` : ''}${item.size_unit || ''})` : '');
    const confirmDelete = window.confirm(`Are you sure you want to delete "${itemLabel}" from saved items?`);
    if (!confirmDelete) return;

    try {
      const { error } = await neonClient.from('item_list').delete().eq('id', item.id);
      if (!error) {
        await fetchItems();
        await fetchCategories();
      } else {
        alert('Failed to delete item: ' + error.message);
      }
    } catch (error) {
      console.error('Failed to delete item', error);
      alert('Error connecting to server.');
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    const rawSize = item.size_qty !== undefined && item.size_qty !== null ? item.size_qty : item.size_value;
    const formattedSize = rawSize !== undefined && rawSize !== null ? String(rawSize) : '';
    const formattedUnit = normalizeUnit(item.size_unit || item.unit || item.default_unit);

    setEditData({
      id: item.id,
      name: item.name || '',
      category: item.category || '',
      size_value: formattedSize,
      size_qty: formattedSize,
      size_unit: formattedUnit
    });
  };

  const handleEditSave = async () => {
    try {
      if (!editData.name || !editData.name.trim()) {
        alert('Please enter an item name');
        return;
      }

      // Read current edited size value
      const rawVal = editData.size_value !== undefined ? editData.size_value : editData.size_qty;
      const parsedSizeQty = (rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '' && !isNaN(parseFloat(rawVal)))
        ? parseFloat(rawVal)
        : null;
      const parsedSizeUnit = (editData.size_unit && editData.size_unit.trim() !== '') 
        ? normalizeUnit(editData.size_unit) 
        : null;

      const { error } = await neonClient.from('item_list').update({
        name: editData.name.trim(),
        category: editData.category ? editData.category.trim() : 'General',
        size_qty: parsedSizeQty,
        size_unit: parsedSizeUnit
      }).eq('id', editingId);

      if (!error) {
        setEditingId(null);
        await fetchItems();
        await fetchCategories();
      } else {
        alert('Failed to update item: ' + (error.message || 'Database error'));
      }
    } catch (error) {
      console.error('Failed to update item', error);
      alert('Error updating item: ' + (error.message || 'Unknown error'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await neonClient.from('item_list').insert([{
        name: formData.name,
        category: formData.category,
        size_qty: formData.sizeValue ? parseFloat(formData.sizeValue) : null,
        size_unit: formData.sizeUnit || null
      }]);

      if (!error) {
        setFormData({ name: '', category: '', sizeValue: '', sizeUnit: 'unit' });
        fetchItems();
        fetchCategories();
      } else {
        alert('Failed to add item: ' + error.message);
      }
    } catch (error) {
      console.error('Failed to add item', error);
      alert('Error adding item: ' + error.message);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', fontSize: 'clamp(1.15rem, 4vw, 1.45rem)' }}>
          <PackagePlus size={22} style={{ verticalAlign: 'middle', marginRight: '8px', flexShrink: 0 }} /> Add New Item Variant
        </h2>
        <form onSubmit={handleSubmit} className="manage-items-form">
          <div className="form-group manage-item-field">
            <label>Item Name</label>
            <input required placeholder="e.g., Milk" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="form-group manage-item-field" style={{ position: 'relative' }}>
            <label>Category (Type)</label>
            <input 
              required 
              placeholder="e.g., Dairy" 
              value={formData.category} 
              onChange={e => {
                setFormData({...formData, category: e.target.value});
                setAddCategorySelectedIndex(0);
              }} 
              onFocus={() => setShowAddCategorySuggestions(true)}
              onBlur={() => setTimeout(() => setShowAddCategorySuggestions(false), 200)}
              onKeyDown={handleAddCategoryKeyDown}
              autoComplete="off" 
            />
            {showAddCategorySuggestions && filteredAddCategories.length > 0 && (
              <div className="custom-suggestions dropdown">
                {filteredAddCategories.map((cat, idx) => (
                  <div 
                    key={idx} 
                    className={`suggestion-item ${idx === addCategorySelectedIndex ? 'active' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setFormData({ ...formData, category: cat });
                      setShowAddCategorySuggestions(false);
                    }}
                    onMouseEnter={() => setAddCategorySelectedIndex(idx)}
                  >
                    {cat}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="form-group manage-item-field manage-item-size-unit">
            <label>Size & Unit (Optional)</label>
            <div className="size-unit-merged-field" style={{ width: '100%' }}>
              <input 
                type="number" 
                step="any" 
                placeholder="Size (e.g. 500)" 
                value={formData.sizeValue} 
                onChange={e => setFormData({...formData, sizeValue: e.target.value})} 
                className="size-input-part"
                style={{ textAlign: 'left', paddingLeft: '0.85rem' }}
              />
              <div className="size-unit-divider"></div>
              <select 
                value={formData.sizeUnit} 
                onChange={e => setFormData({...formData, sizeUnit: e.target.value})}
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
          <div className="form-group manage-item-submit">
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Save Item Variant</button>
          </div>
        </form>
      </div>

       <div className="glass-card">
        {/* Header & Delete Selected */}
        <div className="flex-between" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2>
            <Package size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Saved Items
          </h2>
        </div>

        {/* Search Bar Above Capsules */}
        <div className="manage-items-search-box" style={{ position: 'relative', marginBottom: '1.25rem' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input 
            type="text"
            placeholder="Search saved item or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="manage-items-search-input"
            style={{
              width: '100%',
              padding: '0.75rem 2.5rem 0.75rem 2.8rem',
              borderRadius: '12px',
              border: '1.5px solid rgba(255, 255, 255, 0.12)',
              background: 'var(--input-bg)',
              color: 'var(--text-main)',
              fontSize: '0.95rem'
            }}
          />
          {searchQuery && (
            <button 
              type="button" 
              className="btn-icon" 
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent' }}
            >
              <X size={16} color="var(--text-muted)" />
            </button>
          )}
        </div>

        {/* Category Capsules (Vanished / hidden when user types in search bar) */}
        {!isSearching && (
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: visibleCategories.size > 0 ? '1.5rem' : '0.5rem' }}>
            {categories.map(cat => (
              <button 
                key={cat} 
                onClick={() => toggleCategory(cat)}
                className={`btn category-toggle-btn ${visibleCategories.has(cat) ? 'active' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="purchase-list">
          {Object.entries(groupedItems).map(([category, catItems]) => (
            isCategoryVisible(category) && (
              <div key={category} style={{ marginBottom: '2rem' }}>
                <h3 className="manage-category-heading">{category}</h3>
                
                {catItems.map(item => (
                  <div key={item.id} className="flex-between manage-saved-item-row" style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                    
                    {editingId === item.id ? (
                      <div className="item-edit-row">
                        <input 
                          className="item-edit-name-input"
                          placeholder="Item Name"
                          value={editData.name} 
                          onChange={e => setEditData({...editData, name: e.target.value})} 
                        />
                        <div className="item-edit-category-wrapper">
                          <input 
                            className="item-edit-category-input"
                            placeholder="Category"
                            value={editData.category} 
                            onChange={e => {
                              setEditData({...editData, category: e.target.value});
                              setEditCategorySelectedIndex(0);
                            }} 
                            onFocus={() => setShowEditCategorySuggestions(true)}
                            onBlur={() => setTimeout(() => setShowEditCategorySuggestions(false), 200)}
                            onKeyDown={handleEditCategoryKeyDown}
                            autoComplete="off"
                          />
                          {showEditCategorySuggestions && filteredEditCategories.length > 0 && (
                            <div className="custom-suggestions dropdown">
                              {filteredEditCategories.map((cat, idx) => (
                                <div 
                                  key={idx} 
                                  className={`suggestion-item ${idx === editCategorySelectedIndex ? 'active' : ''}`}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setEditData({ ...editData, category: cat });
                                    setShowEditCategorySuggestions(false);
                                  }}
                                  onMouseEnter={() => setEditCategorySelectedIndex(idx)}
                                >
                                  {cat}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="size-unit-merged-field item-edit-size-field">
                          <input 
                            type="number" 
                            step="any" 
                            placeholder="Size" 
                            value={editData.size_value ?? ''} 
                            onChange={e => {
                              const val = e.target.value;
                              setEditData(prev => ({ ...prev, size_value: val, size_qty: val }));
                            }} 
                            className="size-input-part"
                          />
                          <div className="size-unit-divider"></div>
                          <select 
                            value={editData.size_unit ?? ''} 
                            onChange={e => {
                              const val = e.target.value;
                              setEditData(prev => ({ ...prev, size_unit: val }));
                            }}
                            className="unit-select-part"
                          >
                            <option value="">None</option>
                            <option value="Pc.">Pc.</option>
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="L">L</option>
                            <option value="ml">ml</option>
                          </select>
                        </div>
                        <div className="item-edit-actions">
                          <button className="btn-action-save" onClick={handleEditSave} title="Save changes">
                            <Check size={16} />
                          </button>
                          <button className="btn-action-cancel" onClick={() => setEditingId(null)} title="Cancel">
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                            {item.name} 
                            {(item.size_value || item.size_unit) && (
                              <span className="manage-item-unit-badge">
                                ({item.size_value ? `${item.size_value} ` : ''}{item.size_unit})
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button className="btn-action-edit" onClick={() => startEdit(item)} title="Edit item">
                            <Edit2 size={15} />
                          </button>
                          <button 
                            className="btn-action-delete" 
                            onClick={() => handleDeleteItem(item)} 
                            title="Delete item"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )
          ))}

          {items.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No items saved yet.</p>}

          {items.length > 0 && !isSearching && visibleCategories.size === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '0.95rem' }}>Select a category above to view items, or type in the search bar.</p>
            </div>
          )}

          {items.length > 0 && isSearching && Object.keys(groupedItems).length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '0.95rem' }}>No items found matching "{searchQuery}".</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
