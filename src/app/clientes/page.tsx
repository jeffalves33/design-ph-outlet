import View from "@/features/clientes/components/page-view";
import { exigirPaginaAutorizada } from "@/features/acesso/server/autorizar";

export const metadata = { title: "clientes · PH Outlet" };
export default async function Page() {
  await exigirPaginaAutorizada("clientes.consultar", { todas: true });
  return <View />;
}
