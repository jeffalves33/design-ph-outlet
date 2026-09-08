import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Pencil, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Chip, Field, SectionCard, fieldCls } from "@/components/form-bits";
import { StatCard } from "@/components/stat-card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LOJAS, dataCurta, type Colaborador, type Loja } from "@/lib/mock-data";
import { useStore } from "@/lib/store";

const cargos: Colaborador["cargo"][] = [
  "Administrador",
  "Gerente",
  "Vendedor",
  "Estoquista",
];

export const Route = createFileRoute("/colaboradores")({
  head: () => ({
    meta: [
      { title: "Colaboradores e acessos · PH Outlet" },
      {
        name: "description",
        content:
          "Crie e administre colaboradores das lojas PH Outlet e PH Outlet Kids, definindo login, cargo e a quais lojas cada pessoa tem acesso.",
      },
      { property: "og:title", content: "Colaboradores e acessos · PH Outlet" },
      {
        property: "og:description",
        content:
          "Gestão de equipe: login, senha, cargo e permissão de acesso por loja.",
      },
    ],
  }),
  component: Colaboradores,
});

type Rascunho = {
  nome: string;
  login: string;
  senha: string;
  cargo: Colaborador["cargo"];
  lojas: Loja[];
  ativo: boolean;
};

const vazio: Rascunho = {
  nome: "",
  login: "",
  senha: "",
  cargo: "Vendedor",
  lojas: ["outlet"],
  ativo: true,
};

function Colaboradores() {
  const { colaboradores, addColaborador, updateColaborador } = useStore();
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [f, setF] = useState<Rascunho>(vazio);

  const abrirNovo = () => {
    setF(vazio);
    setEditando("novo");
  };

  const abrirEdicao = (c: Colaborador) => {
    setF({
      nome: c.nome,
      login: c.login,
      senha: c.senha,
      cargo: c.cargo,
      lojas: c.lojas,
      ativo: c.ativo,
    });
    setEditando(c.id);
  };

  const salvar = () => {
    if (!f.nome.trim() || !f.login.trim()) {
      toast.error("Informe nome e login de acesso.");
      return;
    }
    if (f.lojas.length === 0) {
      toast.error("Selecione ao menos uma loja de acesso.");
      return;
    }
    if (editando === "novo") {
      addColaborador({
        nome: f.nome.trim(),
        login: f.login.trim(),
        senha: f.senha.trim() || "trocar123",
        cargo: f.cargo,
        lojas: f.lojas,
        ativo: f.ativo,
      });
      toast.success("Colaborador criado com acesso liberado.");
    } else if (editando) {
      updateColaborador(editando, {
        nome: f.nome.trim(),
        login: f.login.trim(),
        senha: f.senha.trim() || "trocar123",
        cargo: f.cargo,
        lojas: f.lojas,
        ativo: f.ativo,
      });
      toast.success("Dados de acesso atualizados.");
    }
    setEditando(null);
  };

  const alternarLoja = (loja: Loja) =>
    setF((prev) => ({
      ...prev,
      lojas: prev.lojas.includes(loja)
        ? prev.lojas.filter((l) => l !== loja)
        : [...prev.lojas, loja],
    }));

  const ativos = colaboradores.filter((c) => c.ativo);
  const acessoTotal = colaboradores.filter((c) => c.lojas.length === LOJAS.length);

  return (
    <AppShell
      title="Colaboradores"
      subtitle="Criação de acessos, cargos e permissão por loja"
      actions={
        <button
          type="button"
          onClick={abrirNovo}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <UserPlus className="size-4" /> Novo colaborador
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Colaboradores" value={String(colaboradores.length)} icon={Users} tone="brand" />
        <StatCard label="Acessos ativos" value={String(ativos.length)} icon={ShieldCheck} tone="success" />
        <StatCard
          label="Acesso às duas lojas"
          value={String(acessoTotal.length)}
          icon={KeyRound}
        />
        <StatCard
          label="Acessos bloqueados"
          value={String(colaboradores.length - ativos.length)}
          icon={KeyRound}
          tone={colaboradores.length - ativos.length ? "warning" : "success"}
        />
      </div>

      <SectionCard
        title="Equipe cadastrada"
        description="Login, cargo e lojas liberadas"
        padded={false}
      >
        <ul className="divide-y divide-border">
          {colaboradores.map((c) => (
            <li key={c.id} className="p-4 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{c.nome}</p>
                    <Chip tone={c.ativo ? "success" : "danger"}>
                      {c.ativo ? "ativo" : "bloqueado"}
                    </Chip>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {c.login} · {c.cargo} · desde {dataCurta(c.desde)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.lojas.map((l) => (
                      <Chip key={l} tone={l === "kids" ? "brand" : "muted"}>
                        {LOJAS.find((x) => x.id === l)?.nome}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => abrirEdicao(c)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-secondary"
                  >
                    <Pencil className="size-3.5" /> Editar acesso
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateColaborador(c.id, { ativo: !c.ativo });
                      toast.success(
                        c.ativo ? "Acesso bloqueado." : "Acesso liberado novamente.",
                      );
                    }}
                    className="h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-secondary"
                  >
                    {c.ativo ? "Bloquear" : "Liberar"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <Dialog open={editando !== null} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editando === "novo" ? "Novo colaborador" : "Editar acesso"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Nome completo">
              <input
                className={fieldCls}
                value={f.nome}
                onChange={(e) => setF({ ...f, nome: e.target.value })}
              />
            </Field>
            <Field label="Login (e-mail)">
              <input
                className={fieldCls}
                value={f.login}
                onChange={(e) => setF({ ...f, login: e.target.value })}
                placeholder="nome@phoutlet.com"
              />
            </Field>
            <Field label="Senha de acesso">
              <input
                className={fieldCls}
                value={f.senha}
                onChange={(e) => setF({ ...f, senha: e.target.value })}
                placeholder="mínimo 6 caracteres"
              />
            </Field>
            <Field label="Cargo">
              <select
                className={fieldCls}
                value={f.cargo}
                onChange={(e) =>
                  setF({ ...f, cargo: e.target.value as Colaborador["cargo"] })
                }
              >
                {cargos.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <p className="eyebrow mb-2">Acesso às lojas</p>
              <div className="flex flex-wrap gap-2">
                {LOJAS.map((l) => {
                  const ativo = f.lojas.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => alternarLoja(l.id)}
                      className={`h-9 rounded-xl border px-3 text-xs font-medium transition-colors ${
                        ativo
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card"
                      }`}
                    >
                      {l.nome}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={f.ativo}
                onChange={(e) => setF({ ...f, ativo: e.target.checked })}
                className="size-4 rounded border-input"
              />
              Acesso liberado ao sistema
            </label>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={salvar}
              className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
