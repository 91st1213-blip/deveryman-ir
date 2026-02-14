export interface Company {
  id: string;
  name: string;
  fullName: string;
  color: string;
  fiscalMonth: number;
}

export const COMPANIES: Company[] = [
  { id: 'mitsui', name: '三井不動産', fullName: '三井不動産株式会社', color: '#004098', fiscalMonth: 3 },
  { id: 'mec', name: '三菱地所', fullName: '三菱地所株式会社', color: '#C8102E', fiscalMonth: 3 },
  { id: 'sumitomo', name: '住友不動産', fullName: '住友不動産株式会社', color: '#003DA5', fiscalMonth: 3 },
  { id: 'tatemono', name: '東京建物', fullName: '東京建物株式会社', color: '#1E50A2', fiscalMonth: 12 },
  { id: 'nomura', name: '野村不動産HD', fullName: '野村不動産ホールディングス株式会社', color: '#00A0E9', fiscalMonth: 3 },
  { id: 'tokyu', name: '東急不動産HD', fullName: '東急不動産ホールディングス株式会社', color: '#E60012', fiscalMonth: 3 },
  { id: 'hulic', name: 'ヒューリック', fullName: 'ヒューリック株式会社', color: '#E60012', fiscalMonth: 12 },
];

export function getCompanyById(id: string): Company | undefined {
  return COMPANIES.find(company => company.id === id);
}

export function getCompanyByName(name: string): Company | undefined {
  return COMPANIES.find(company => company.name === name);
}
