export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-DHO-Request': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r
    .json()
    .catch(() => ({ message: 'Servidor indisponível. Verifique se a API está em execução.' }));
  if (!r.ok) throw Error(data.message || 'Não foi possível concluir a operação.');
  return data;
}
export const currency = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
export const dateBR = (d: string) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');
export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('');
export const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
};
