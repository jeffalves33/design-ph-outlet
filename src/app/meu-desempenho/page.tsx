import View from "@/features/metas/components/page-view";
import { exigirPaginaAutorizada } from "@/features/acesso/server/autorizar";

export const metadata = { title: "meu-desempenho · PH Outlet" };
export default async function Page() {
  await exigirPaginaAutorizada("metas.proprias.consultar");
  return <View />;
}
