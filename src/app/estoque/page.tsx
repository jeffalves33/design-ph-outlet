import View from "@/features/estoque/components/catalogo-view";
import { exigirPaginaAutorizada } from "@/features/acesso/server/autorizar";

export const metadata = { title: "estoque · PH Outlet" };
export default async function Page() {
  await exigirPaginaAutorizada("estoque.consultar", { todas: true });
  return <View />;
}
