import { createContext, useContext } from 'react';
import type { Data, Filters } from './types';
export interface DhoContext {
  data: Data;
  filters: Filters;
  setFilters: (v: Filters) => void;
  reload: () => Promise<void>;
  notify: (message: string, tone?: string) => void;
  canEdit: boolean;
  isAdmin: boolean;
}
export const Dho = createContext<DhoContext>(null!);
export const useDho = () => useContext(Dho);
