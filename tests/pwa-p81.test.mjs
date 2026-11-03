import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const raiz = new URL("../", import.meta.url);
const ler = (caminho) => readFileSync(new URL(caminho, raiz), "utf8");

function dimensoesPng(caminho) {
  const dados = readFileSync(new URL(caminho, raiz));
  assert.equal(dados.subarray(1, 4).toString("ascii"), "PNG");
  return { largura: dados.readUInt32BE(16), altura: dados.readUInt32BE(20) };
}

test("manifesto torna o PH instalável em desktop e mobile", () => {
  const manifesto = JSON.parse(ler("public/manifest.webmanifest"));
  assert.equal(manifesto.id, "/");
  assert.equal(manifesto.start_url, "/");
  assert.equal(manifesto.scope, "/");
  assert.equal(manifesto.display, "standalone");
  assert.ok(manifesto.display_override.includes("standalone"));
  assert.ok(manifesto.shortcuts.some((item) => item.url === "/meu-desempenho"));
  for (const tamanho of [192, 512]) {
    const caminho = `public/icon-${tamanho}.png`;
    assert.equal(existsSync(new URL(caminho, raiz)), true);
    assert.deepEqual(dimensoesPng(caminho), { largura: tamanho, altura: tamanho });
  }
  assert.ok(manifesto.icons.some((item) => item.purpose === "maskable"));
});

test("service worker nunca guarda API ou operação e usa offline somente para navegação", () => {
  const worker = ler("public/sw.js");
  assert.match(worker, /requisicao\.method !== "GET"/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /requisicao\.mode === "navigate"/);
  assert.match(worker, /fetch\(requisicao\)\.catch\(\(\) => caches\.match\("\/offline\.html"\)\)/);
  assert.match(worker, /url\.pathname\.startsWith\("\/_next\/static\/"\)/);
  assert.doesNotMatch(worker, /cache\.put\([^\n]*(\/api|navigate)/);
  const offline = ler("public/offline.html");
  assert.match(offline, /Nenhuma venda ou alteração é simulada offline/);
});

test("layout registra PWA, metadados Apple e atualização controlada", () => {
  const layout = ler("src/app/layout.tsx");
  const registro = ler("src/components/pwa-registrar.tsx");
  const instalacao = ler("src/components/pwa-install-button.tsx");
  const shell = ler("src/components/app-shell.tsx");
  const config = ler("next.config.ts");
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /appleWebApp: \{ capable: true/);
  assert.match(layout, /<PwaRegistrar \/>/);
  assert.match(registro, /serviceWorker\.register\("\/sw\.js", \{ scope: "\/" \}\)/);
  assert.match(registro, /ATIVAR_ATUALIZACAO/);
  assert.match(instalacao, /beforeinstallprompt/);
  assert.match(instalacao, /Adicionar à Tela de Início/);
  assert.match(shell, /<PwaInstallButton \/>/);
  assert.match(config, /Service-Worker-Allowed/);
  assert.match(config, /application\/manifest\+json/);
});
