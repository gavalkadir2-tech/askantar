import React, { useState } from 'react';
import {
  Wallet,
  Receipt,
  Banknote,
  CreditCard,
} from 'lucide-react';
import { ChecksNotesSection, PaymentsCollectionsSection } from '../accounting/AccountingSections';
import { CashTab } from './CashTab';
import { ExpensesTab } from './ExpensesTab';

export function AccountingTab({ bankAccounts, setBankAccounts, checksNotes, setChecksNotes, settings, setSettings, payments, setPayments, expenses, setExpenses, cashEntries, setCashEntries, farmers, purchases, buyers, buyerPayments, setBuyerPayments, sales, onPrintPayment }) {
  const [section, setSection] = useState('kasa');
  const sections = [
    { key: 'kasa', label: 'Kasa', icon: Banknote },
    { key: 'odeme', label: 'Ödeme & Tahsilat', icon: Wallet },
    { key: 'giderler', label: 'Giderler', icon: Receipt },
    { key: 'cek', label: 'Çek & Senet', icon: CreditCard },
  ];
  return (
    <div>
      <div className="zk-h1">Muhasebe</div>
      <div className="zk-h1-sub">Kasa, ödeme/tahsilat, giderler ve çek/senet takibi</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
        {sections.map((s) => (
          <button key={s.key} className={`zk-btn ${section === s.key ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => setSection(s.key)}>
            <s.icon size={13} /> {s.label}
          </button>
        ))}
      </div>
      {section === 'kasa' && (
        <CashTab settings={settings} setSettings={setSettings} payments={payments} expenses={expenses} cashEntries={cashEntries} setCashEntries={setCashEntries} farmers={farmers} bankAccounts={bankAccounts} setBankAccounts={setBankAccounts} purchases={purchases} sales={sales} buyerPayments={buyerPayments} />
      )}
      {section === 'odeme' && (
        <PaymentsCollectionsSection farmers={farmers} payments={payments} setPayments={setPayments} purchases={purchases} buyers={buyers} buyerPayments={buyerPayments} setBuyerPayments={setBuyerPayments} sales={sales} settings={settings} onPrintPayment={onPrintPayment} bankAccounts={bankAccounts} />
      )}
      {section === 'giderler' && <ExpensesTab expenses={expenses} setExpenses={setExpenses} settings={settings} bankAccounts={bankAccounts} />}
      {section === 'cek' && <ChecksNotesSection items={checksNotes} setItems={setChecksNotes} settings={settings} />}
    </div>
  );
}

// ---------- Sevkiyat / İrsaliye ----------
