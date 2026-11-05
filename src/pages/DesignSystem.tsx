import { useState } from 'react';
import { Plus, ArrowRight, CheckCircle2, Users } from 'lucide-react';
import { PageTitle, Card, Button, Badge, Field, Notice, Modal, Metric } from '../components/ui';
export default function DesignSystem() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageTitle
        eyebrow="DHO CONTROL · V1.0"
        title="Design System"
        description="Uma linguagem visual consistente, do cadastro ao fechamento."
      />
      <Card className="padded">
        <h2>01 / Cores com propósito</h2>
        <div className="swatches">
          {[
            ['Navy', '#172b4d'],
            ['Azul principal', '#3867ef'],
            ['Fundo', '#f6f8fc'],
            ['Sucesso', '#249973'],
            ['Atenção', '#d48b28'],
            ['Crítico', '#d75d68'],
          ].map(([n, c]) => (
            <div key={n}>
              <span style={{ background: c }} />
              <b>{n}</b>
              <small>{c}</small>
            </div>
          ))}
        </div>
      </Card>
      <div className="two-columns">
        <Card className="padded">
          <h2>02 / Tipografia</h2>
          <h1>Pessoas no centro.</h1>
          <h2>Informações claras. Decisões melhores.</h2>
          <p>Texto-base em 14px. Hierarquia por peso e tamanho, com espaçamento generoso.</p>
          <span className="eyebrow">RÓTULOS · 10PX · SEMIBOLD</span>
          <p className="muted">Fonte de sistema: Segoe UI / Inter / sans-serif.</p>
        </Card>
        <Card className="padded">
          <h2>03 / Ações</h2>
          <div className="button-row">
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} />
              Ação principal
            </Button>
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Ação secundária
              <ArrowRight size={16} />
            </Button>
            <Button disabled>Indisponível</Button>
          </div>
          <div className="button-row">
            <Badge tone="green">Conferido</Badge>
            <Badge tone="orange">Pendente</Badge>
            <Badge tone="red">Atenção</Badge>
            <Badge>Em análise</Badge>
          </div>
          <Notice>
            Estados comunicados por texto e cor. Alertas nunca significam erro confirmado.
          </Notice>
        </Card>
      </div>
      <Card className="padded">
        <h2>04 / Formulários e estados</h2>
        <div className="form-grid">
          <Field label="Nome do campo" hint="Instrução próxima ao campo.">
            <input placeholder="Exemplo de entrada" />
          </Field>
          <Field label="Seleção">
            <select>
              <option>Selecione uma opção</option>
              <option>Opção selecionável</option>
            </select>
          </Field>
        </div>
        <Notice tone="green">
          <CheckCircle2 size={18} />
          Operação concluída e registrada no histórico.
        </Notice>
        <Notice tone="orange">Confira as informações antes de continuar.</Notice>
        <Notice tone="red">Não foi possível salvar. Revise os campos indicados.</Notice>
      </Card>
      {open && (
        <Modal
          title="Diálogo padrão"
          description="Foco contido, fechamento por Escape e retorno à ação de origem."
          onClose={() => setOpen(false)}
        >
          <p>
            Use diálogos para cadastros e conferências contextualizadas. Textos devem explicar o
            resultado da ação.
          </p>
          <div className="modal-footer">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setOpen(false)}>Concluir</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
