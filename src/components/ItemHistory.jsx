import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LineChart as ChartIcon, Calendar, MapPin } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function ItemHistory({ item, onReceiptClick }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (item) {
      supabase
        .from('purchases')
        .select('purchase_date, price_per_unit, source, receipt_id, quantity, total_amount')
        .eq('item_id', item.item_id)
        .order('purchase_date', { ascending: true })
        .then(({ data }) => {
          if (data) {
            const formatted = data.map(d => ({
              date: new Date(d.purchase_date).toLocaleDateString('en-GB'),
              rawDate: d.purchase_date,
              price: parseFloat(d.price_per_unit),
              source: d.source,
              receiptId: d.receipt_id,
              quantity: parseFloat(d.quantity),
              totalAmount: parseFloat(d.total_amount)
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
        <h2><ChartIcon size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Price History: {item.item_name}</h2>
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
              <div
                key={idx}
                className="purchase-item receipt-item"
                style={{ cursor: 'pointer' }}
                onClick={() => onReceiptClick && onReceiptClick({
                  receiptId: h.receiptId,
                  date: h.rawDate,
                  source: h.source
                })}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} style={{ color: 'var(--text-muted)' }} /> {h.date}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} /> {h.source || 'General'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                    <span style={{ color: 'var(--secondary)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                      {item.size_value && item.size_unit
                        ? `${Math.round(h.quantity)} pkt`
                        : `${parseFloat(h.quantity).toFixed(1)} ${item.default_unit || 'unit'}`
                      }
                    </span>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                      ₹{parseFloat(h.totalAmount || 0).toFixed(1)}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                    ₹{parseFloat(h.price || 0).toFixed(1)} / {item.size_value && item.size_unit ? 'pkt' : (item.default_unit || 'unit')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
