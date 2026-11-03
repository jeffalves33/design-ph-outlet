import View from "@/features/financeiro/components/page-view";
import { exigirPaginaAutorizada } from "@/features/acesso/server/autorizar";

export const metadata = { title: "financeiro · PH Outlet" };
export default async function Page() {
  await exigirPaginaAutorizada("financeiro.consultar", { todas: true });
  return <View />;
}
