export type Role = 'admin' | 'rh' | 'consulta';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active?: number;
  demo?: boolean;
}
export interface Department {
  id: string;
  version: number;
  name: string;
  manager: string;
  description: string;
  color: string;
  weekdays: number[];
  vaDeductions: string[];
  vtDeductions: string[];
  sundayPolicy: string;
  womenSundayRest: number;
}
export interface Employee {
  id: string;
  version: number;
  name: string;
  registration: string;
  cpf: string;
  gender: string;
  departmentId: string;
  jobTitle: string;
  email: string;
  admissionDate: string;
  terminationDate: string;
  salary: number;
  weeklyHours: number;
  scheduleName: string;
  weekdays: number[];
  startTime: string;
  breakStart: string;
  breakEnd: string;
  endTime: string;
  expectedPunches: number;
  vaDaily: number;
  vtFare: number;
  vtTrips: number;
  nightPercent: number;
  status: string;
  extraDays: string[];
  excludedDays: string[];
}
export interface Company {
  legalName: string;
  tradeName: string;
  cnpj: string;
  email: string;
  phone: string;
  address: string;
  logo: string;
  minPunchMinutes: number;
  toleranceMinutes: number;
  holidays: string[];
  nightStart: string;
  nightEnd: string;
  nightReducedMinutes: number;
  nightExtension: boolean;
  monthlyDivisor: number;
  timezone: string;
  defaultStartDay: number;
  defaultEndDay: number;
}
export interface RecordData {
  id: string;
  kind: string;
  [key: string]: any;
}
export interface Data {
  user: User;
  company: Company;
  employees: Employee[];
  departments: Department[];
  records: RecordData[];
  demo: boolean;
}
export interface Filters {
  competence: string;
  start: string;
  end: string;
  department: string;
  employee: string;
}
