import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ExternalLink, Save, AlertCircle } from "lucide-react";
import { PLATFORMS_SUMMARY_QUERY_KEY, usePlatformsSummary } from "@/hooks/usePlatformsSummary";

export default function CurrentPlatformTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [active, setActive] = useState(true);

  const { data: platforms = [] } = usePlatformsSummary({
    select: (data) => (data?.currentPlatform ? [data.currentPlatform] : []),
  });

  const currentPlatform = platforms[0] || null;

  React.useEffect(() => {
    if (!currentPlatform) return;
    setName(currentPlatform.name);
    setLink(currentPlatform.link);
    setActive(currentPlatform.active);
  }, [currentPlatform]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name || !link) {
        throw new Error("Preencha todos os campos");
      }

      // Gera um novo identificador para forcar a reconfirmacao da plataforma.
      const platformId = `platform_${Date.now()}`;

      if (currentPlatform) {
        await base44.entities.CurrentPlatform.update(currentPlatform.id, {
          name,
          link,
          active,
          platform_id: platformId,
        });
        return;
      }

      await base44.entities.CurrentPlatform.create({
        name,
        link,
        active,
        platform_id: platformId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORMS_SUMMARY_QUERY_KEY });
      alert("Plataforma salva com sucesso! Todos os usuarios serao notificados.");
    },
    onError: (error) => {
      alert(error.message || "Erro ao salvar plataforma");
    },
  });

  return (
    <Card className="mt-6 border-purple-700/50 bg-gradient-to-br from-purple-900/50 to-indigo-900/50 p-6">
      <div className="mb-6">
        <h2 className="mb-2 bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-2xl font-bold text-transparent">
          Plataforma Atual
        </h2>
        <p className="text-sm text-purple-300">
          Configure a plataforma principal. Quando voce alterar, todos os usuarios precisarao confirmar o cadastro novamente.
        </p>
      </div>

      {currentPlatform ? (
        <div className="mb-6 rounded-lg border border-yellow-600/50 bg-yellow-900/30 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400" />
            <div>
              <p className="mb-1 font-bold text-yellow-200">Plataforma Ativa</p>
              <p className="mb-2 text-sm text-yellow-300">
                ID da Plataforma: <span className="font-mono font-bold">{currentPlatform.platform_id}</span>
              </p>
              <p className="text-xs text-yellow-200">
                Ao salvar alteracoes, um novo ID sera gerado e todos os usuarios verao o box de confirmacao novamente.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-6 space-y-4">
        <div>
          <Label htmlFor="platform-name" className="text-purple-200">
            Nome da Plataforma
          </Label>
          <Input
            id="platform-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex: P20BET"
            className="border-purple-700 bg-purple-900/50 text-white"
          />
        </div>

        <div>
          <Label htmlFor="platform-link" className="text-purple-200">
            Link de Cadastro
          </Label>
          <Input
            id="platform-link"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://..."
            className="border-purple-700 bg-purple-900/50 text-white"
          />
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              <ExternalLink className="h-3 w-3" />
              Testar link
            </a>
          ) : null}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-purple-900/50 p-4">
          <div>
            <Label className="text-purple-200">Plataforma Ativa</Label>
            <p className="text-xs text-purple-400">
              {active ? "Usuarios verao o box de confirmacao" : "Box de confirmacao desativado"}
            </p>
          </div>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !name || !link}
          className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar Configuracoes"}
        </Button>
      </div>

      {currentPlatform ? (
        <div className="mt-6 rounded-lg border border-blue-600/50 bg-blue-900/30 p-4">
          <h3 className="mb-2 font-bold text-blue-200">Como funciona:</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-blue-300">
            <li>Usuarios que ja confirmaram esta plataforma nao verao o box novamente.</li>
            <li>Ao alterar nome ou link e salvar, um novo ID e gerado automaticamente.</li>
            <li>Com o novo ID, todos os usuarios precisarao confirmar o cadastro novamente.</li>
            <li>Usuarios novos que se cadastrarem ja com a plataforma atual nao verao o box.</li>
            <li>Desative a plataforma para esconder o box de todos temporariamente.</li>
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

