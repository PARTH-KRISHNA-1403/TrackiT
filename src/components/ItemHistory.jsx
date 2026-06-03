import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LineChart as ChartIcon, Calendar, MapPin } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function ItemHistory({ item }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (item) {
      supabase
        .from('purchases')
        .select('purchase_date, price_per_unit, source')
        .eq('item_id', item.item_id)
        .order('purchase_date', { ascending: true })
        .then(({ data }) => {
          if (data) {
            const formatted = data.map(d => ({
              date: new Date(d.purchase_date).toLocaleDateString('en-GB'),
              price: parseFloat(d.price_per_unit),
              source: d.source
            }));
            setHistory(formatted);
          }
          setLoading(false);
        });
    }
  }, [item]);

  if (!item) return null;

  return (
    <div className="glass-card animate-fade-in">
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h2><ChartIcon size={24} style={{verticalAlign: 'middle', marginRight: '8px'}}/> Price History: {item.item_name}</h2>
        <span className="price-badge">{item.category}</span>
      </div>

      {loading ? (
        <p>Loading history...</p>
      ) : (
        <>
          <div style={{ height: '300px', width: '100%', marginBottom: '2rem' }}>
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
              <p>No price history available.</p>
            )}
          </div>
 
          <h3>Recent Purchases</h3>
          <div className="purchase-list">
            {history.slice().reverse().slice(0, 5).map((h, idx) => (
              <div key={idx} className="purchase-item">
                <div className="item-details">
                  <p 
                    style={{ color: 'var(--text-main)', fontWeight: '500', cursor: item.size_value && item.size_unit ? 'help' : 'default' }}
                    title={item.size_value && item.size_unit ? `pkt = ${item.size_value}${item.size_unit}` : undefined}
                  >
                    ₹{parseFloat(h.price || 0).toFixed(1)} / {item.size_value && item.size_unit ? 'pkt' : item.default_unit}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}><MapPin size={12}/> {h.source || 'General'}</p>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  <Calendar size={14} style={{verticalAlign:'middle'}}/> {h.date}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
