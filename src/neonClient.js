import { neon } from '@neondatabase/serverless';

const DATABASE_URL = import.meta.env.VITE_NEON_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing VITE_NEON_DATABASE_URL! Please configure it in your environment settings or .env.local file.');
}

export const sql = neon(DATABASE_URL || '');

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.type = 'select'; // 'select' | 'insert' | 'update' | 'delete'
    this.selectFields = '*';
    this.insertValues = null;
    this.updateValues = null;
    this.filters = [];
    this.orders = [];
    this.limitCount = null;
    this.isReturning = false;
  }

  select(fields = '*') {
    this.selectFields = fields;
    if (this.type === 'insert' || this.type === 'update') {
      this.isReturning = true;
    } else {
      this.type = 'select';
    }
    return this;
  }

  insert(values) {
    this.type = 'insert';
    this.insertValues = Array.isArray(values) ? values : [values];
    return this;
  }

  update(values) {
    this.type = 'update';
    this.updateValues = values;
    return this;
  }

  delete() {
    this.type = 'delete';
    return this;
  }

  eq(column, value) {
    const col = column === 'receipt_id' ? 'invoice_number' : column;
    this.filters.push({ type: 'eq', col, value });
    return this;
  }

  is(column, value) {
    const col = column === 'receipt_id' ? 'invoice_number' : column;
    if (value === null) {
      this.filters.push({ type: 'is_null', col });
    } else {
      this.filters.push({ type: 'eq', col, value });
    }
    return this;
  }

  in(column, values) {
    const col = column === 'receipt_id' ? 'invoice_number' : column;
    this.filters.push({ type: 'in', col, values: Array.from(values) });
    return this;
  }

  ilike(column, value) {
    const col = column === 'receipt_id' ? 'invoice_number' : column;
    this.filters.push({ type: 'ilike', col, value });
    return this;
  }

  or(orCondition) {
    const parts = orCondition.split(',').map(p => p.trim());
    const conditions = [];
    for (const part of parts) {
      const match = part.match(/^([^.]+)\.([^.]+)\.(.*)$/);
      if (match) {
        let [, col, op, val] = match;
        if (col === 'receipt_id') col = 'invoice_number';
        conditions.push({ col, op, val });
      }
    }
    this.filters.push({ type: 'or_group', conditions });
    return this;
  }

  order(column, options = {}) {
    const ascending = options.ascending !== false;
    this.orders.push({ column, ascending });
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  async execute() {
    try {
      if (this.type === 'select') {
        return await this._executeSelect();
      } else if (this.type === 'insert') {
        return await this._executeInsert();
      } else if (this.type === 'update') {
        return await this._executeUpdate();
      } else if (this.type === 'delete') {
        return await this._executeDelete();
      }
    } catch (err) {
      console.error('Neon Query Error:', err);
      return { data: null, error: err };
    }
  }

  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.execute().catch(onRejected);
  }

  async _executeSelect() {
    const isPurchasesJoin = this.table === 'purchases' && this.selectFields.includes('item_list');
    let sqlText = '';
    const params = [];
    let pIdx = 1;

    let joinNeeded = isPurchasesJoin;
    if (this.table === 'purchases' && this.filters.some(f => f.col === 'item_name')) {
      joinNeeded = true;
    }

    if (isPurchasesJoin) {
      sqlText = `
        SELECT 
          p.id, 
          p.purchase_date::text AS purchase_date, 
          p.source_name, 
          p.invoice_number, 
          p.item_id, 
          p.unit_price, 
          p.quantity, 
          p.total_amount,
          json_build_object(
            'id', i.id,
            'name', i.name,
            'category', i.category,
            'size_unit', i.size_unit,
            'size_qty', i.size_qty,
            'qr_id', i.qr_id
          ) AS item_list
        FROM purchases p
        LEFT JOIN item_list i ON p.item_id = i.id
      `;
    } else if (this.table === 'purchases') {
      sqlText = `
        SELECT 
          p.id, 
          p.purchase_date::text AS purchase_date, 
          p.source_name, 
          p.invoice_number, 
          p.item_id, 
          p.unit_price, 
          p.quantity, 
          p.total_amount
        FROM purchases p
        ${joinNeeded ? 'LEFT JOIN item_list i ON p.item_id = i.id' : ''}
      `;
    } else {
      const fields = this.selectFields === '*' ? '*' : this.selectFields;
      sqlText = `SELECT ${fields} FROM ${this.table}`;
    }

    // WHERE clause
    const whereClauses = [];
    for (const f of this.filters) {
      const prefix = joinNeeded ? (f.col === 'item_name' ? 'i.name' : (f.col.includes('.') ? f.col : `p.${f.col}`)) : f.col;
      if (f.type === 'eq') {
        whereClauses.push(`${prefix} = $${pIdx++}`);
        params.push(f.value);
      } else if (f.type === 'is_null') {
        whereClauses.push(`${prefix} IS NULL`);
      } else if (f.type === 'in') {
        whereClauses.push(`${prefix} = ANY($${pIdx++})`);
        params.push(f.values);
      } else if (f.type === 'ilike') {
        whereClauses.push(`${prefix} ILIKE $${pIdx++}`);
        params.push(f.value);
      } else if (f.type === 'or_group') {
        const orClauses = [];
        for (const cond of f.conditions) {
          const colName = joinNeeded ? (cond.col.includes('.') ? cond.col : `p.${cond.col}`) : cond.col;
          if (cond.op === 'eq') {
            orClauses.push(`${colName} = $${pIdx++}`);
            params.push(cond.val);
          }
        }
        if (orClauses.length > 0) {
          whereClauses.push(`(${orClauses.join(' OR ')})`);
        }
      }
    }

    if (whereClauses.length > 0) {
      sqlText += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // ORDER BY
    if (this.orders.length > 0) {
      const orderClauses = this.orders.map(o => {
        const col = joinNeeded ? (o.column.includes('.') ? o.column : `p.${o.column}`) : o.column;
        return `${col} ${o.ascending ? 'ASC' : 'DESC'}`;
      });
      sqlText += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    if (this.limitCount) {
      sqlText += ` LIMIT ${parseInt(this.limitCount, 10)}`;
    }

    const rows = await sql.query(sqlText, params);
    return { data: rows, error: null };
  }

  async _executeInsert() {
    if (!this.insertValues || this.insertValues.length === 0) {
      return { data: [], error: null };
    }

    const insertedRows = [];
    for (const row of this.insertValues) {
      const cols = [];
      const vals = [];
      const placeholders = [];
      let idx = 1;

      for (const [k, v] of Object.entries(row)) {
        let col = k;
        if (this.table === 'purchases') {
          if (k === 'receipt_id') col = 'invoice_number';
          if (k === 'price_per_unit') col = 'unit_price';
          if (k === 'source') col = 'source_name';
          if (!['purchase_date', 'source_name', 'invoice_number', 'item_id', 'unit_price', 'quantity', 'total_amount'].includes(col)) {
            continue;
          }
        } else if (this.table === 'item_list') {
          if (k === 'sizeValue') col = 'size_qty';
          if (k === 'sizeUnit') col = 'size_unit';
          if (k === 'itemName') col = 'name';
          if (!['name', 'category', 'size_unit', 'size_qty', 'qr_id'].includes(col)) {
            continue;
          }
        }

        cols.push(col);
        vals.push(v);
        placeholders.push(`$${idx++}`);
      }

      const sqlText = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
      const res = await sql.query(sqlText, vals);
      if (res && res.length > 0) {
        insertedRows.push(res[0]);
      }
    }

    return { data: insertedRows, error: null };
  }

  async _executeUpdate() {
    if (!this.updateValues) return { data: null, error: null };
    const cols = [];
    const vals = [];
    let idx = 1;

    for (const [k, v] of Object.entries(this.updateValues)) {
      let col = k;
      if (this.table === 'purchases') {
        if (k === 'receipt_id') col = 'invoice_number';
        if (k === 'price_per_unit') col = 'unit_price';
        if (k === 'source') col = 'source_name';
        if (!['purchase_date', 'source_name', 'invoice_number', 'item_id', 'unit_price', 'quantity', 'total_amount'].includes(col)) {
          continue;
        }
      } else if (this.table === 'item_list') {
        if (k === 'sizeValue' || k === 'size_value') col = 'size_qty';
        if (k === 'sizeUnit') col = 'size_unit';
        if (k === 'itemName') col = 'name';
        if (!['name', 'category', 'size_unit', 'size_qty', 'qr_id'].includes(col)) {
          continue;
        }
      }

      cols.push(`${col} = $${idx++}`);
      vals.push(v);
    }

    let sqlText = `UPDATE ${this.table} SET ${cols.join(', ')}`;
    const whereClauses = [];
    for (const f of this.filters) {
      if (f.type === 'eq') {
        whereClauses.push(`${f.col} = $${idx++}`);
        vals.push(f.value);
      }
    }

    if (whereClauses.length > 0) {
      sqlText += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    sqlText += ' RETURNING *';

    const res = await sql.query(sqlText, vals);
    return { data: res, error: null };
  }

  async _executeDelete() {
    let sqlText = `DELETE FROM ${this.table}`;
    const whereClauses = [];
    const vals = [];
    let idx = 1;

    for (const f of this.filters) {
      if (f.type === 'eq') {
        whereClauses.push(`${f.col} = $${idx++}`);
        vals.push(f.value);
      } else if (f.type === 'in') {
        whereClauses.push(`${f.col} = ANY($${idx++})`);
        vals.push(f.values);
      } else if (f.type === 'or_group') {
        const orClauses = [];
        for (const cond of f.conditions) {
          if (cond.op === 'eq') {
            orClauses.push(`${cond.col} = $${idx++}`);
            vals.push(cond.val);
          }
        }
        if (orClauses.length > 0) {
          whereClauses.push(`(${orClauses.join(' OR ')})`);
        }
      }
    }

    if (whereClauses.length > 0) {
      sqlText += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    await sql.query(sqlText, vals);
    return { error: null };
  }
}

export const neonClient = {
  from(table) {
    return new QueryBuilder(table);
  }
};

export default neonClient;
