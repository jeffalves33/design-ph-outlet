import View from "@/features/metas/components/admin-view";
import { exigirPaginaAutorizada } from "@/features/acesso/server/autorizar";

export const metadata = { title: "colaboradores · PH Outlet" };
export default async function Page() {
  await exigirPaginaAutorizada("equipe.consultar");
  return <View />;
}
