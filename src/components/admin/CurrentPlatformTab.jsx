import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Save, AlertCircle } from "lucide-react";

export default function CurrentPlatformTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [active, setActive] = useState(true);

  const { data: platforms = [] } = useQuery({
    queryKey: ['current-platform'],
    queryFn: () => base44.entities.CurrentPlatform.list(),
  });

  const currentPlatform = platforms[0] || null;

  React.useEffect(() => {
    if (currentPlatform) {
      setName(currentPlatform.name);
      setLink(currentPlatform.link);
      setActive(currentPlatform.active);
    }
  }, [currentPlatform]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name || !link) {
        throw new Error("Preencha todos os campos");
      }

      // Gerar ID único para a plataforma
      const platformId = `platform_${Date.now()}`;

      if (currentPlatform) {
        await base44.entities.CurrentPlatform.update(currentPlatform.id, {
          name,
          link,
          active,
          platform_id: platformId // Novo ID ao atualizar
        });
      } else {
        await base44.entities.CurrentPlatform.create({
          name,
          link,
          active,
          platform_id: platformId
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-platform'] });
      alert('Plataforma salva com sucesso! Todos os usuários serão notificados.');
    },
    onError: (error) => {
      alert(error.message || 'Erro ao salvar plataforma');
    }
  });

  return (
    <Card className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border-purple-700/50 p-6 mt-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300 mb-2">
          Plataforma Atual
        </h2>
        <p className="text-sm text-purple-300">
          Configure a plataforma principal. Quando você alterar, todos os usuários precisarão confirmar o cadastro novamente.
        </p>
      </div>

      {currentPlatform && (
        <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-200 font-bold mb-1">Plataforma Ativa</p>
              <p className="text-sm text-yellow-300 mb-2">
                ID da Plataforma: <span className="font-mono font-bold">{currentPlatform.platform_id}</span>
              </p>
              <p className="text-xs text-yellow-200">
                ⚠️ Ao salvar alterações, um novo ID será gerado e TOODOS os usuários verão o box de confirmação novamente.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 mb-6">
        <div>
          <Label htmlFor="platform-name" className="text-purple-200">
            Nome da Plataforma
          </Label>
          <Input
            id="platform-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: P20BET"
            className="bg-purple-900/50 border-purple-700 text-white"
          />
        </div>

        <div>
          <Label htmlFor="platform-link" className="text-purple-200">
            Link de Cadastro
          </Label>
          <Input
            id="platform-link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
            className="bg-purple-900/50 border-purple-700 text-white"
          />
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1"
            >
              <ExternalLink className="w-3 h-3" />
              Testar link
            </a>
          )}
        </div>

        <div className="flex items-center justify-between p-4 bg-purple-900/50 rounded-lg">
          <div>
            <Label className="text-purple-200">Plataforma Ativa</Label>
            <p className="text-xs text-purple-400">
              {active ? 'Usuários verão o box de confirmação' : 'Box de confirmação desativado'}
            </p>
          </div>
          <Switch
            checked={active}
            onCheckedChange={setActive}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !name || !link}
          className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>

      {currentPlatform && (
        <div className="mt-6 p-4 bg-blue-900/30 border border-blue-600/50 rounded-lg">
          <h3 className="text-blue-200 font-bold mb-2">Como funciona:</h3>
          <ul className="text-sm text-blue-300 space-y-1 list-disc list-inside">
            <li>Usuários que já confirmaram esta plataforma não verão o box novamente</li>
            <li>Ao alterar nome/link e salvar, um novo ID é gerado automaticamente</li>
            <li>Com o novo ID, TOODOS os usuários precisarão confirmar o cadastro novamente</li>
            <li>Usuários novos que se cadastrarem já com a plataforma atual não verão o box</li>
            <li>Desative a plataforma para esconder o box de todos temporariamente</li>
          </ul>
        </div>
      )}
    </Card>
  );
}
