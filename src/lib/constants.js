export const EXPENSE_CATEGORIES = ['Nakliye', 'İşçilik', 'Depo kirası', 'Elektrik', 'Yakıt', 'Bakım/onarım', 'Diğer'];

export const INCOME_CATEGORIES = ['Hizmet Bedeli', 'Kira Geliri', 'Satış Geliri', 'Diğer Gelir'];

export const MAINTENANCE_TYPES = ['Periyodik Bakım', 'Yağ Değişimi', 'Fren', 'Akü', 'Triger/Kayış', 'Klima', 'Diğer'];

export const DOC_TYPES = ['Ruhsat', 'Muayene', 'Egzoz Pulu', 'K Belgesi', 'SRC Belgesi', 'Diğer'];

export const TIRE_POSITIONS = ['Ön Sol', 'Ön Sağ', 'Arka Sol', 'Arka Sağ', 'Yedek'];

export const TIRE_STATUSES = ['Yeni', 'İyi', 'Orta', 'Değişmeli'];

export const CRATE_MOVEMENT_TYPES = [
  { key: 'kasaVerildi', label: 'Kasa verildi', sign: 1, unit: 'kasa' },
  { key: 'kasaIade', label: 'Kasa iade alındı', sign: -1, unit: 'kasa' },
  { key: 'cuvalVerildi', label: 'Çuval verildi', sign: 1, unit: 'çuval' },
  { key: 'cuvalIade', label: 'Çuval iade alındı', sign: -1, unit: 'çuval' },
];

export const SHIPMENT_STATUSES = ['Yükleniyor', 'Yolda', 'Teslim Edildi'];
