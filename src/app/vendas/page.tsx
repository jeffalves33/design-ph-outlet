import View from "@/features/vendas/components/page-view";
import { exigirPaginaAutorizada } from "@/features/acesso/server/autorizar";
import { listarLojasVenda, listarVendedoresVenda } from "@/features/vendas/server/catalogo-venda";

export const metadata = { title: "vendas · PH Outlet" };
export default async function Page() {
  const perfil = await exigirPaginaAutorizada("vendas.consultar", { todas: true });
  const [lojas, vendedores] = await Promise.all([
    listarLojasVenda(perfil.lojas), listarVendedoresVenda(perfil.lojas),
  ]);
  return <View lojas={lojas} vendedores={vendedores} usuarioId={perfil.id} />;
}
