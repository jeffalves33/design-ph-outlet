import View from "@/features/painel/components/page-view";
import { exigirPaginaAutorizada } from "@/features/acesso/server/autorizar";

export const metadata = { title: "Painel · PH Outlet" };
export default async function Page() {
  await exigirPaginaAutorizada("painel.consultar", { todas: true });
  return <View />;
}
