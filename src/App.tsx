import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, BarChart3, CarFront, Check, ChevronRight, CircleDollarSign, Download, Fuel, History, Home, Menu, Pencil, Plus, Search, Settings, Share2, ShieldCheck, Sparkles, Trash2, TrendingUp, WalletCards, WifiOff, X } from 'lucide-react'
import { calculateAllocation, formatCompact, formatUGX, inPeriod, localDateKey, startOfWeek, totalTransactions, type Period } from './lib/finance'
import { useDrivePlan } from './hooks/useDrivePlan'
import { usePwa } from './hooks/usePwa'
import { platforms, type AllocationRules, type Platform, type Totals, type Transaction } from './types'

type View = 'home' | 'history' | 'analytics' | 'settings'
const names: Record<Platform, string> = { uber: 'Uber', bolt: 'Bolt', safeboda: 'SafeBoda', faras: 'Faras', private: 'Private', other: 'Other' }
const nav = [
  { id: 'home' as const, label: 'Overview', icon: Home },
  { id: 'history' as const, label: 'Transactions', icon: History },
  { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
]

function Brand() {
  return <div className="brand"><img src="/driveplan.png" alt="" /><span>DrivePlan</span></div>
}

function PwaStatus() {
  const { offline, installed, canInstall, showIosHint, install } = usePwa()
  if (offline) return <div className="pwa-status offline" role="status"><WifiOff size={16} /><span><strong>Offline</strong>Your data still saves on this device.</span></div>
  if (canInstall && !installed) return <button className="pwa-status install" onClick={install}><Download size={16} /><span><strong>Install DrivePlan</strong>Use it like a native app.</span></button>
  if (showIosHint) return <div className="pwa-status ios-hint"><Share2 size={16} /><span><strong>Install on iPhone</strong>Share → Add to Home Screen</span></div>
  return null
}

function PlatformSelector({ value, onChange }: { value: Platform, onChange: (value: Platform) => void }) {
  return <div className="platforms" role="radiogroup" aria-label="Earnings source">
    {platforms.map((platform) => <button type="button" role="radio" aria-checked={value === platform} className={value === platform ? 'active' : ''} onClick={() => onChange(platform)} key={platform}>{names[platform]}</button>)}
  </div>
}

function AllocationRows({ amount, rules, platform }: { amount: number, rules: AllocationRules, platform: Platform }) {
  if (!amount) return null
  const value = calculateAllocation(amount, rules, platform)
  const rows = [
    ['Fuel', value.fuelPercentage, value.fuelAmount],
    ['App commission', value.commissionPercentage, value.commissionAmount],
    ['Maintenance reserve', value.maintenancePercentage, value.maintenanceAmount],
    ['Savings', value.savingsPercentage, value.savingsAmount],
  ] as const
  return <div className="allocation-preview" aria-live="polite">
    <div className="preview-head"><span>Live allocation</span><strong>{formatUGX(amount)}</strong></div>
    {rows.map(([label, percent, val]) => <div className={`allocation-row ${label === 'Savings' ? 'saving' : ''}`} key={label}>
      <span>{label}<small>{percent}%</small></span><strong>{formatUGX(val)}</strong>
    </div>)}
  </div>
}

function EntryPanel({ rules, initialPlatform, onSave, onDone }: { rules: AllocationRules, initialPlatform: Platform, onSave: (amount: number, platform: Platform) => void, onDone?: () => void }) {
  const [raw, setRaw] = useState('')
  const [platform, setPlatform] = useState(initialPlatform)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const amount = Number(raw.replace(/\D/g, ''))
  const allocate = () => {
    try {
      calculateAllocation(amount, rules, platform)
      onSave(amount, platform)
      setSaved(true); setRaw(''); setError('')
      window.setTimeout(() => { setSaved(false); onDone?.() }, 700)
    } catch (err) { setError(err instanceof Error ? err.message : 'Check the amount.') }
  }
  return <section className="entry-panel">
    <div className="eyebrow"><Sparkles size={14} /> Quick allocation</div>
    <h1>How much did you make?</h1>
    <p>Enter your trip earnings. We’ll handle the rest.</p>
    <label className="amount-input">
      <span>UGX</span>
      <input ref={inputRef} autoFocus inputMode="numeric" aria-label="Amount earned in Uganda shillings" placeholder="0" value={raw ? Number(raw).toLocaleString('en-UG') : ''} onChange={(e) => setRaw(e.target.value.replace(/\D/g, '').slice(0, 12))} onKeyDown={(e) => e.key === 'Enter' && allocate()} />
    </label>
    <span className="field-label">Earnings source</span>
    <PlatformSelector value={platform} onChange={setPlatform} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <AllocationRows amount={amount} rules={rules} platform={platform} />
    <button className={`primary-action ${saved ? 'success' : ''}`} onClick={allocate} disabled={saved}>
      {saved ? <><Check size={19} /> Transaction saved</> : <>Allocate & save <ArrowUpRight size={19} /></>}
    </button>
  </section>
}

function Donut({ totals }: { totals: Totals }) {
  const values = [totals.fuel, totals.commission, totals.maintenance, totals.savings]
  const total = totals.gross || 1
  let offset = 25
  return <div className="donut-wrap">
    <svg className="donut" viewBox="0 0 42 42" role="img" aria-label="Allocation breakdown">
      <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e4e6e1" strokeWidth="4" />
      {values.map((value, index) => { const percent = value / total * 100; const el = <circle key={index} cx="21" cy="21" r="15.915" fill="transparent" stroke={['#171a17','#777d77','#afb4ae','#36b957'][index]} strokeWidth="4" strokeDasharray={`${percent} ${100 - percent}`} strokeDashoffset={offset} />; offset -= percent; return el })}
    </svg>
    <div className="donut-center"><strong>{totals.trips}</strong><span>trips</span></div>
  </div>
}

function Trend({ items }: { items: Transaction[] }) {
  const week = startOfWeek()
  const values = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(week); day.setDate(week.getDate() + index)
    return items.filter((item) => localDateKey(new Date(item.transactionDate)) === localDateKey(day)).reduce((sum, item) => sum + item.grossAmount, 0)
  })
  const max = Math.max(...values, 1)
  const points = values.map((value, index) => `${index * 16.66},${92 - (value / max) * 76}`).join(' ')
  return <div className="trend-chart">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Weekly earnings trend">
      <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#35b957" stopOpacity=".2" /><stop offset="1" stopColor="#35b957" stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,100 ${points} 100,100`} fill="url(#area)" />
      <polyline points={points} fill="none" stroke="#35b957" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className="chart-labels">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day, i) => <span key={day} className={values[i] === max && max > 1 ? 'active' : ''}>{day}</span>)}</div>
  </div>
}

function Metric({ label, value, meta, accent, icon: Icon }: { label: string, value: string, meta?: string, accent?: boolean, icon: typeof Fuel }) {
  return <div className={`metric ${accent ? 'accent' : ''}`}><div className="metric-top"><span>{label}</span><Icon size={17} /></div><strong>{value}</strong>{meta && <small>{meta}</small>}</div>
}

function TransactionList({ items, onEdit, onDelete, limit }: { items: Transaction[], onEdit: (item: Transaction) => void, onDelete: (item: Transaction) => void, limit?: number }) {
  const visible = limit ? items.slice(0, limit) : items
  if (!visible.length) return <div className="empty-inline"><CarFront size={26} /><strong>No trips here yet</strong><span>Your saved earnings will appear here.</span></div>
  return <div className="transaction-list">
    {visible.map((item) => <div className="transaction" key={item.id}>
      <div className={`platform-mark ${item.platform}`}>{names[item.platform].slice(0, 1)}</div>
      <div className="transaction-main"><strong>{names[item.platform]}</strong><span>{new Date(item.transactionDate).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })} · {new Date(item.transactionDate).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div className="transaction-saving"><small>Saved</small><span>+{formatUGX(item.savingsAmount).replace('UGX ', '')}</span></div>
      <strong className="transaction-gross">{formatUGX(item.grossAmount)}</strong>
      <div className="row-actions"><button aria-label="Edit transaction" onClick={() => onEdit(item)}><Pencil size={16} /></button><button aria-label="Delete transaction" onClick={() => onDelete(item)}><Trash2 size={16} /></button></div>
    </div>)}
  </div>
}

function TotalStrip({ title, totals }: { title: string, totals: Totals }) {
  return <div className="total-strip"><div><span>{title}</span><strong>{formatUGX(totals.gross)}</strong></div><div><span>Fuel</span><strong>{formatUGX(totals.fuel)}</strong></div><div><span>Commission</span><strong>{formatUGX(totals.commission)}</strong></div><div><span>Maintenance</span><strong>{formatUGX(totals.maintenance)}</strong></div><div className="green"><span>Saved</span><strong>{formatUGX(totals.savings)}</strong></div></div>
}

function HomeView({ transactions, rules, lastPlatform, add, onEdit, onDelete, openAdd, goHistory }: { transactions: Transaction[], rules: AllocationRules, lastPlatform: Platform, add: (amount: number, platform: Platform) => void, onEdit: (item: Transaction) => void, onDelete: (item: Transaction) => void, openAdd: () => void, goHistory: () => void }) {
  const todayItems = transactions.filter((item) => inPeriod(item, 'today'))
  const today = totalTransactions(todayItems)
  const week = totalTransactions(transactions.filter((item) => inPeriod(item, 'week')))
  return <>
    <header className="page-heading"><div><span className="eyebrow">{new Date().toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long' })}</span><h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}.</h1></div><button className="add-top" onClick={openAdd}><Plus size={18} /> Add earnings</button></header>
    <div className="home-grid">
      <EntryPanel rules={rules} initialPlatform={lastPlatform} onSave={add} />
      <section className="today-panel">
        <div className="section-head"><div><span className="eyebrow">Today’s earnings</span><h2>{formatUGX(today.gross)}</h2><p>{today.trips} {today.trips === 1 ? 'trip' : 'trips'} logged today</p></div><div className="trend-badge"><TrendingUp size={15} /> Live</div></div>
        <div className="metrics-grid">
          <Metric label="Fuel" value={formatUGX(today.fuel)} meta="30% reserve" icon={Fuel} />
          <Metric label="Commission" value={formatUGX(today.commission)} meta="Platform fees" icon={CircleDollarSign} />
          <Metric label="Maintenance" value={formatUGX(today.maintenance)} meta="Vehicle reserve" icon={ShieldCheck} />
          <Metric label="Savings" value={formatUGX(today.savings)} meta="Retained income" accent icon={WalletCards} />
        </div>
      </section>
    </div>
    <div className="insights-grid">
      <section className="chart-section"><div className="section-title"><div><span>Weekly earnings</span><strong>{formatUGX(week.gross)}</strong></div><small>This week</small></div><Trend items={transactions} /></section>
      <section className="chart-section allocation-section"><div className="section-title"><div><span>Allocation</span><strong>Where it goes</strong></div><small>Today</small></div><Donut totals={today} /><div className="legend"><span><i className="fuel-dot" />Fuel</span><span><i className="commission-dot" />Commission</span><span><i className="maintenance-dot" />Maintenance</span><span><i className="savings-dot" />Savings</span></div></section>
    </div>
    <section className="recent-section"><div className="section-title"><div><span>Recent activity</span><strong>Latest trips</strong></div><button onClick={goHistory}>View all <ChevronRight size={16} /></button></div><TransactionList items={transactions} limit={5} onEdit={onEdit} onDelete={onDelete} /><TotalStrip title="TODAY TOTAL" totals={today} /></section>
  </>
}

function HistoryView({ transactions, onEdit, onDelete }: { transactions: Transaction[], onEdit: (item: Transaction) => void, onDelete: (item: Transaction) => void }) {
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState<'all' | Platform>('all')
  const [period, setPeriod] = useState<Period>('all')
  const filtered = transactions.filter((item) => (platform === 'all' || item.platform === platform) && inPeriod(item, period) && (names[item.platform].toLowerCase().includes(query.toLowerCase()) || String(item.grossAmount).includes(query.replace(/\D/g, ''))))
  return <><header className="page-heading"><div><span className="eyebrow">Transaction log</span><h1>Every earning, accounted for.</h1></div></header>
    <div className="filter-bar"><label className="search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search platform or amount" /></label><select aria-label="Filter by period" value={period} onChange={(e) => setPeriod(e.target.value as Period)}><option value="all">All time</option><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option></select><select aria-label="Filter by platform" value={platform} onChange={(e) => setPlatform(e.target.value as 'all' | Platform)}><option value="all">All platforms</option>{platforms.map((p) => <option value={p} key={p}>{names[p]}</option>)}</select></div>
    <section className="history-section"><TransactionList items={filtered} onEdit={onEdit} onDelete={onDelete} /><TotalStrip title="FILTERED TOTAL" totals={totalTransactions(filtered)} /></section></>
}

function AnalyticsView({ transactions }: { transactions: Transaction[] }) {
  const [period, setPeriod] = useState<Period>('month')
  const items = transactions.filter((item) => inPeriod(item, period))
  const totals = totalTransactions(items)
  const privateItems = items.filter((i) => i.platform === 'private')
  const privateTotals = totalTransactions(privateItems)
  const byPlatform = platforms.map((platform) => ({ platform, ...totalTransactions(items.filter((item) => item.platform === platform)) }))
  const max = Math.max(...byPlatform.map((p) => p.gross), 1)
  return <><header className="page-heading analytics-head"><div><span className="eyebrow">Performance</span><h1>Your money, in focus.</h1></div><div className="period-tabs">{(['today','week','month','all'] as Period[]).map((p) => <button className={period === p ? 'active' : ''} onClick={() => setPeriod(p)} key={p}>{p === 'all' ? 'All time' : p[0].toUpperCase() + p.slice(1)}</button>)}</div></header>
    <div className="hero-kpis"><div><span>Total earned</span><strong>{formatUGX(totals.gross)}</strong><small>{totals.trips} trips · {formatUGX(totals.trips ? totals.gross / totals.trips : 0)} average</small></div><div className="saved-kpi"><span>Total saved</span><strong>{formatUGX(totals.savings)}</strong><small><ArrowUpRight size={14} /> {totals.gross ? Math.round(totals.savings / totals.gross * 100) : 0}% savings rate</small></div></div>
    <div className="analytics-grid"><section className="chart-section wide"><div className="section-title"><div><span>Earnings trend</span><strong>This week</strong></div></div><Trend items={items} /></section><section className="chart-section"><div className="section-title"><div><span>Source performance</span><strong>Platform earnings</strong></div></div><div className="bar-list">{byPlatform.map((row) => <div className="bar-row" key={row.platform}><span>{names[row.platform]}</span><div><i style={{ width: `${row.gross / max * 100}%` }} /></div><strong>{formatCompact(row.gross)}</strong></div>)}</div></section></div>
    <section className="source-metrics"><div><span>Platform earnings</span><strong>{formatUGX(totals.gross - privateTotals.gross)}</strong></div><div><span>Private earnings</span><strong>{formatUGX(privateTotals.gross)}</strong></div><div><span>Private share</span><strong>{totals.gross ? Math.round(privateTotals.gross / totals.gross * 100) : 0}%</strong></div><div className="green"><span>Private retained</span><strong>{formatUGX(privateTotals.savings)}</strong></div></section>
    <TotalStrip title={`${period.toUpperCase()} TOTAL`} totals={totals} /></>
}

function SettingsView({ rules, onSave }: { rules: AllocationRules, onSave: (rules: AllocationRules) => void }) {
  const [draft, setDraft] = useState(rules)
  const [message, setMessage] = useState('')
  const total = draft.fuel + draft.commission + draft.maintenance + draft.savings
  const change = (key: 'fuel' | 'commission' | 'maintenance' | 'savings', value: string) => setDraft({ ...draft, [key]: Math.max(0, Math.min(100, Number(value))) })
  const save = () => { if (total !== 100) return setMessage('Allocation rules must total exactly 100%.'); onSave(draft); setMessage('Settings saved. New trips will use these rates.') }
  return <><header className="page-heading"><div><span className="eyebrow">Preferences</span><h1>Allocation rules.</h1></div></header>
    <div className="settings-layout"><section className="settings-section"><div className="settings-copy"><h2>Global allocation</h2><p>These rates apply to new trips. Existing transactions keep their original allocation.</p></div><div className="rule-fields">{(['fuel','commission','maintenance','savings'] as const).map((key) => <label key={key}><span>{key === 'maintenance' ? 'Maintenance reserve' : key[0].toUpperCase() + key.slice(1)}</span><div><input type="number" min="0" max="100" value={draft[key]} onChange={(e) => change(key, e.target.value)} /><b>%</b></div></label>)}<div className={`allocation-total ${total === 100 ? 'valid' : 'invalid'}`}><span>Total allocation</span><strong>{total}%</strong></div></div></section>
      <section className="settings-section"><div className="settings-copy"><h2>Platform commission</h2><p>Set a custom commission. Clear the field to use the global rate.</p></div><div className="rule-fields platform-rules">{platforms.map((platform) => <label key={platform}><span>{names[platform]}<small>{draft.platformCommissions[platform] == null ? 'Uses global' : 'Custom rate'}</small></span><div><input type="number" min="0" max="60" placeholder={String(draft.commission)} value={draft.platformCommissions[platform] ?? ''} onChange={(e) => { const copy = { ...draft.platformCommissions }; if (e.target.value === '') delete copy[platform]; else copy[platform] = Number(e.target.value); setDraft({ ...draft, platformCommissions: copy }) }} /><b>%</b></div></label>)}</div></section>
      {message && <p className={total === 100 ? 'settings-message success-text' : 'settings-message form-error'}>{message}</p>}<button className="primary-action settings-save" onClick={save} disabled={total !== 100}>Save allocation rules</button></div></>
}

function Dialog({ open, title, onClose, children }: { open: boolean, title: string, onClose: () => void, children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (open && !ref.current?.open) ref.current?.showModal(); if (!open && ref.current?.open) ref.current.close() }, [open])
  return <dialog ref={ref} onCancel={onClose} onClick={(e) => e.target === ref.current && onClose()}><div className="dialog-head"><strong>{title}</strong><button aria-label="Close" onClick={onClose}><X size={19} /></button></div>{children}</dialog>
}

function EditForm({ item, onSave }: { item: Transaction, onSave: (amount: number, platform: Platform, date: string) => void }) {
  const [amount, setAmount] = useState(String(item.grossAmount)); const [platform, setPlatform] = useState(item.platform)
  const local = new Date(item.transactionDate); local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  const [date, setDate] = useState(local.toISOString().slice(0, 16))
  return <div className="edit-form"><label>Gross earnings<input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></label><label>Date and time<input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></label><span className="field-label">Platform</span><PlatformSelector value={platform} onChange={setPlatform} /><button className="primary-action" onClick={() => onSave(Number(amount), platform, new Date(date).toISOString())}>Save changes</button></div>
}

export default function App() {
  const { transactions, rules, setRules, lastPlatform, add, update, remove } = useDrivePlan()
  const [view, setView] = useState<View>('home'); const [addOpen, setAddOpen] = useState(false); const [editItem, setEditItem] = useState<Transaction | null>(null); const [deleteItem, setDeleteItem] = useState<Transaction | null>(null); const [menu, setMenu] = useState(false)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('action') === 'add') setAddOpen(true)
  }, [])
  const navigate = (next: View) => { setView(next); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  return <div className="app-shell">
    <aside className={menu ? 'open' : ''}><Brand /><nav>{nav.map(({ id, label, icon: Icon }) => <button className={view === id ? 'active' : ''} onClick={() => navigate(id)} key={id}><Icon size={19} />{label}</button>)}</nav><div className="sidebar-foot"><div className="status-dot" /><div><strong>Local & private</strong><span>Saved on this device</span></div></div></aside>
    <div className="mobile-top"><Brand /><button aria-label="Open menu" onClick={() => setMenu(!menu)}><Menu size={22} /></button></div>{menu && <button className="scrim" aria-label="Close menu" onClick={() => setMenu(false)} />}
    <PwaStatus />
    <main>{view === 'home' && <HomeView transactions={transactions} rules={rules} lastPlatform={lastPlatform} add={add} onEdit={setEditItem} onDelete={setDeleteItem} openAdd={() => setAddOpen(true)} goHistory={() => navigate('history')} />}{view === 'history' && <HistoryView transactions={transactions} onEdit={setEditItem} onDelete={setDeleteItem} />}{view === 'analytics' && <AnalyticsView transactions={transactions} />}{view === 'settings' && <SettingsView rules={rules} onSave={setRules} />}</main>
    <nav className="bottom-nav">{nav.slice(0, 2).map(({ id, label, icon: Icon }) => <button className={view === id ? 'active' : ''} onClick={() => navigate(id)} key={id}><Icon size={20} /><span>{label === 'Transactions' ? 'History' : label}</span></button>)}<button className="fab" aria-label="Add earnings" onClick={() => setAddOpen(true)}><Plus size={25} /></button>{nav.slice(2).map(({ id, label, icon: Icon }) => <button className={view === id ? 'active' : ''} onClick={() => navigate(id)} key={id}><Icon size={20} /><span>{label}</span></button>)}</nav>
    <Dialog open={addOpen} title="Add earnings" onClose={() => setAddOpen(false)}><EntryPanel rules={rules} initialPlatform={lastPlatform} onSave={add} onDone={() => setAddOpen(false)} /></Dialog>
    <Dialog open={!!editItem} title="Edit transaction" onClose={() => setEditItem(null)}>{editItem && <EditForm item={editItem} onSave={(amount, platform, date) => { update(editItem.id, amount, platform, date); setEditItem(null) }} />}</Dialog>
    <Dialog open={!!deleteItem} title="Delete this transaction?" onClose={() => setDeleteItem(null)}>{deleteItem && <div className="confirm"><div className="danger-icon"><Trash2 size={22} /></div><p>{formatUGX(deleteItem.grossAmount)} from {names[deleteItem.platform]} will be removed. All totals will update automatically.</p><div><button className="secondary-action" onClick={() => setDeleteItem(null)}>Cancel</button><button className="danger-action" onClick={() => { remove(deleteItem.id); setDeleteItem(null) }}>Delete</button></div></div>}</Dialog>
  </div>
}
