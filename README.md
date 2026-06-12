# 🛒 Track iT

**Your personal grocery price tracker and purchase ledger.**

Track iT is a modern, mobile-friendly web app that helps you log grocery purchases, organize receipts, track item prices over time, and stay on top of your monthly spending — all backed by a real-time Supabase database.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Dashboard** | At-a-glance view of recent receipts and purchased items, grouped by date and source. |
| **Add Purchase** | Receipt-style form with auto-suggestions, auto-calculated totals, and keyboard shortcuts. |
| **Manage Items** | Add, edit, and delete item variants with size/weight metadata, organized by category. |
| **Search** | Search items and receipts by name, source, or receipt ID. Results grouped by store. |
| **Price History** | Interactive line chart showing how an item's price changes over time (powered by Recharts). |
| **Receipt Modal** | Tap any receipt to view a detailed, printable bill breakdown. Features toggleable glassmorphic detail boxes for items with custom descriptions. |
| **History Redirection** | Click any entry in the recent purchase history (Item History tab) to instantly view the corresponding receipt. |
| **Dark / Light Mode** | Toggle between themes; preference is saved in local storage. |
| **PWA Support** | Installable on mobile devices with offline-ready service worker via `vite-plugin-pwa`. |

---

## 🛠️ Tech Stack

- **Frontend** — [React 19](https://react.dev/) with JSX
- **Build Tool** — [Vite 8](https://vitejs.dev/)
- **Backend / Database** — [Supabase](https://supabase.com/) (PostgreSQL + REST API)
- **Charts** — [Recharts](https://recharts.org/)
- **Icons** — [Lucide React](https://lucide.dev/)
- **PWA** — [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- **Styling** — Vanilla CSS with CSS variables, glassmorphism, and smooth animations

---

## 📁 Project Structure

```
TrackiT/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── AddPurchase.jsx    # Receipt-style purchase entry form
│   │   ├── Dashboard.jsx      # Recent receipts & purchased items overview
│   │   ├── ItemHistory.jsx    # Price history chart for a selected item
│   │   ├── ManageItems.jsx    # CRUD for item variants & categories
│   │   └── Search.jsx         # Search items & receipts by name/source
│   ├── App.jsx                # Root component with routing & receipt modal
│   ├── App.css                # App-level styles
│   ├── index.css              # Global styles, design tokens, animations
│   ├── main.jsx               # React DOM entry point
│   └── supabaseClient.js      # Supabase client initialization
├── .env.local                 # Supabase URL & anon key (not committed)
├── index.html                 # HTML entry point
├── vite.config.js             # Vite + PWA plugin configuration
├── package.json
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) **v18+**
- [npm](https://www.npmjs.com/) (comes with Node.js)
- A [Supabase](https://supabase.com/) project with the required tables (see [Database Schema](#-database-schema) below)

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/TrackiT.git
cd TrackiT
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> You can find these values in your Supabase project dashboard under **Settings → API**.

### 4. Start the development server

```bash
npm run dev
```

The app will be available at **http://localhost:5173** (default Vite port).

### 5. Build for production (optional)

```bash
npm run build
```

---

## 🗄️ Database Schema

The app expects two tables in your Supabase project:

### `items`

| Column | Type | Description |
|---|---|---|
| `id` | `int8` (PK) | Auto-generated item ID |
| `name` | `text` | Item name (e.g., "Milk") |
| `category` | `text` | Category (e.g., "Dairy") |
| `size_value` | `float` | Package size value (e.g., 500) — *nullable* |
| `size_unit` | `text` | Package size unit (e.g., "ml") — *nullable* |
| `default_unit` | `text` | Default measurement unit (e.g., "kg", "unit") |

### `purchases`

| Column | Type | Description |
|---|---|---|
| `id` | `int8` (PK) | Auto-generated purchase ID |
| `item_id` | `int8` (FK → items) | Reference to the purchased item |
| `source` | `text` | Store/vendor name (e.g., "Canteen") |
| `quantity` | `float` | Quantity purchased |
| `price_per_unit` | `float` | Price per unit/packet |
| `total_amount` | `float` | Total cost for this line item |
| `purchase_date` | `timestamptz` | Date of purchase |
| `receipt_id` | `text` | Groups items into a single receipt |
| `description` | `text` | Custom one-time item description (e.g., brand, color) — *nullable* |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| <kbd>`</kbd> (backtick) | Add a new row in the purchase form |
| <kbd>Enter</kbd> (in Amount field) | Add a new row and focus on the item name |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Navigate autocomplete suggestions |
| <kbd>Tab</kbd> / <kbd>Enter</kbd> | Select a suggestion |
| <kbd>Esc</kbd> | Dismiss suggestions |

---

## 📜 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m "Add my feature"`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📄 License

This project is for personal use. Feel free to fork and adapt it for your own needs.
