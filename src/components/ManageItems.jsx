import React, { useState, useEffect } from 'react';
import { PackagePlus, Package, Edit2, Trash2, Check, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function ManageItems() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    sizeValue: '',
    sizeUnit: ''
  });
  const [categories, setCategories] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const [visibleCategories, setVisibleCategories] = useState(new Set());

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

  const fetchItems = async () => {
    try {
      const { data } = await supabase.from('items').select('*').order('name');
      if (data) {
        setItems(data);
      }
    } catch (err) {
      console.error('Failed to fetch items', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await supabase.from('items').select('category');
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

  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const toggleSelect = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm('Are you sure you want to delete the selected items?')) return;
    
    try {
      const { error } = await supabase.from('items').delete().in('id', Array.from(selectedIds));
      if (!error) {
        setSelectedIds(new Set());
        fetchItems();
      } else {
        alert('Failed to delete items: ' + error.message);
      }
    } catch (error) {
      console.error('Failed to delete items', error);
      alert('Error connecting to server.');
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditData({ ...item });
  };

  const handleEditSave = async () => {
    try {
      const parsedSizeValue = editData.size_value && String(editData.size_value).trim() !== '' ? parseFloat(editData.size_value) : null;
      const parsedSizeUnit = editData.size_unit || null;

      const { error } = await supabase.from('items').update({
        name: editData.name,
        category: editData.category,
        size_value: parsedSizeValue,
        size_unit: parsedSizeUnit,
        default_unit: parsedSizeUnit || 'unit'
      }).eq('id', editingId);

      if (!error) {
        setEditingId(null);
        fetchItems();
        fetchCategories();
      } else {
        alert('Failed to update item: ' + error.message);
      }
    } catch (error) {
      console.error('Failed to update item', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('items').insert([{
        name: formData.name,
        category: formData.category,
        size_value: formData.sizeValue ? parseFloat(formData.sizeValue) : null,
        size_unit: formData.sizeUnit || null,
        default_unit: formData.sizeUnit || 'unit'
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
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h2><PackagePlus size={24} style={{verticalAlign: 'middle', marginRight: '8px'}} /> Add New Item Variant</h2>
        <form onSubmit={handleSubmit} className="grid-2">
          <div className="form-group">
            <label>Item Name</label>
            <input required placeholder="e.g., Milk" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="form-group" style={{ position: 'relative' }}>
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
          <div className="form-group">
            <label>Size / Weight Value (Optional)</label>
            <input type="number" step="any" placeholder="e.g., 500" value={formData.sizeValue} onChange={e => setFormData({...formData, sizeValue: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Size Unit</label>
            <select value={formData.sizeUnit} onChange={e => setFormData({...formData, sizeUnit: e.target.value})}>
              <option value="">None</option>
              <option value="unit">unit</option>
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="L">L</option>
              <option value="ml">ml</option>
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gridColumn: 'span 2' }}>
            <button type="submit" className="btn btn-primary" style={{width: '100%'}}>Save Item Variant</button>
          </div>
        </form>
      </div>

       <div className="glass-card">
        <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 
            onClick={() => {
              if (visibleCategories.size === categories.length) {
                setVisibleCategories(new Set());
              } else {
                setVisibleCategories(new Set(categories));
              }
            }} 
            style={{ cursor: 'pointer', userSelect: 'none' }}
            title="Click to toggle all categories"
          >
            <Package size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Saved Items
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button 
                key={cat} 
                
                onClick={() => toggleCategory(cat)}
                className="btn"
                style={{ 
                  padding: '4px 12px', 
                  fontSize: '0.8rem', 
                  background: visibleCategories.has(cat) ? 'var(--secondary)' : 'rgba(255,255,255,0.05)',
                  color: visibleCategories.has(cat) ? '#000' : '#fff'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
          {selectedIds.size > 0 && (
            <button className="btn btn-primary" style={{ background: 'var(--danger)', color: '#fff' }} onClick={handleDeleteSelected}>
              <Trash2 size={16} style={{verticalAlign: 'middle', marginRight: '4px'}}/> Delete Selected ({selectedIds.size})
            </button>
          )}
        </div>

        <div className="purchase-list">
          {Object.entries(groupedItems).map(([category, catItems]) => (
            visibleCategories.has(category) && (
              <div key={category} style={{ marginBottom: '2rem' }}>
                <h3 style={{ 
                  fontSize: '0.9rem', 
                  color: 'var(--secondary)', 
                  textTransform: 'uppercase', 
                  letterSpacing: '1px',
                  marginBottom: '1rem',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  paddingBottom: '0.5rem'
                }}>{category}</h3>
                
                {catItems.map(item => (
                  <div key={item.id} className="flex-between" style={{ padding: '0.6rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: selectedIds.has(item.id) ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                    
                    {editingId === item.id ? (
                      <div className="item-edit-row" style={{ display: 'flex', gap: '1rem', width: '100%', alignItems: 'center' }}>
                        <input style={{ flex: 1 }} value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                        <div style={{ flex: 1, position: 'relative' }}>
                          <input 
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
                            style={{ width: '100%' }}
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
                         <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                          <input type="number" step="any" style={{ width: '110px' }} value={editData.size_value || ''} onChange={e => setEditData({...editData, size_value: e.target.value})} />
                          <select style={{ width: '85px' }} value={editData.size_unit || ''} onChange={e => setEditData({...editData, size_unit: e.target.value})}>
                            <option value="">None</option>
                            <option value="unit">unit</option>
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="L">L</option>
                            <option value="ml">ml</option>
                          </select>
                        </div>
                        <button className="btn-icon" onClick={handleEditSave}><Check size={18} color="#34d399"/></button>
                        <button className="btn-icon" onClick={() => setEditingId(null)}><X size={18} color="#f87171"/></button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedIds.has(item.id)} 
                            onChange={() => toggleSelect(item.id)} 
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                          <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                            {item.name} 
                            {(item.size_value || item.size_unit) && (
                              <span style={{ fontSize: '0.9rem', color: 'var(--secondary)', marginLeft: '8px' }}>
                                ({item.size_value} {item.size_unit})
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <button className="btn-icon" onClick={() => startEdit(item)}><Edit2 size={16} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )
          ))}

          {items.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No items saved yet.</p>}
        </div>
      </div>
    </div>
  );
}
