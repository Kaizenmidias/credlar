import { CalendarDays, SlidersHorizontal } from 'lucide-react';
import { useDho } from '../context';
export default function PeriodFilter({ employee = false }: { employee?: boolean }) {
  const { data, filters: f, setFilters } = useDho();
  return (
    <div className="period-filter">
      <div className="filter-leading">
        <SlidersHorizontal size={17} />
        <b>Período de apuração</b>
      </div>
      <label>
        <CalendarDays size={16} />
        <input
          aria-label="Competência"
          type="month"
          value={f.competence}
          onChange={(e) => {
            if (!e.target.value) return;
            const [y, m] = e.target.value.split('-').map(Number);
            const previous = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
            setFilters({
              ...f,
              competence: e.target.value,
              start: `${previous}-${String(data.company.defaultStartDay).padStart(2, '0')}`,
              end: `${e.target.value}-${String(data.company.defaultEndDay).padStart(2, '0')}`,
            });
          }}
        />
      </label>
      <label>
        <input
          aria-label="Data inicial"
          type="date"
          value={f.start}
          max={f.end}
          onChange={(e) => {
            if (e.target.value) setFilters({ ...f, start: e.target.value });
          }}
        />
        <span>até</span>
        <input
          aria-label="Data final"
          type="date"
          value={f.end}
          min={f.start}
          onChange={(e) => {
            if (e.target.value) setFilters({ ...f, end: e.target.value });
          }}
        />
      </label>
      <select
        aria-label="Departamento"
        value={f.department}
        onChange={(e) => setFilters({ ...f, department: e.target.value, employee: '' })}
      >
        <option value="">Todos os departamentos</option>
        {data.departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      {employee && (
        <select
          aria-label="Funcionário"
          value={f.employee}
          onChange={(e) => setFilters({ ...f, employee: e.target.value })}
        >
          <option value="">Todos os funcionários</option>
          {data.employees
            .filter((e) => !f.department || e.departmentId === f.department)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
      )}
    </div>
  );
}
