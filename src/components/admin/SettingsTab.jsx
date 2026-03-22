import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Save } from "lucide-react";

const DEFAULT_SETTINGS = {
  platform_link: "",
  deposit_check_link: "",
  deposit_check_name: "",
  deposit_check_link_2: "",
  deposit_check_name_2: "",
  live_link: "",
  cashback_redeem_link: "",
};

const DESCRIPTIONS = {
  platform_link: "Link de cadastro da plataforma",
  deposit_check_link: "Link para conferir depositos",
  deposit_check_name: "Nome da plataforma 1 para conferencia",
  deposit_check_link_2: "Link para conferir depositos da plataforma 2",
  deposit_check_name_2: "Nome da plataforma 2 para conferencia",
  live_link: "Link da live ao vivo",
  cashback_redeem_link: "Link do WhatsApp para resgate",
};

export default function SettingsTab() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const { data: appSettings = [] } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  useEffect(() => {
    const loaded = { ...DEFAULT_SETTINGS };
    appSettings.forEach((item) => {
      if (Object.prototype.hasOwnProperty.call(loaded, item.key)) {
        loaded[item.key] = item.value || "";
      }
    });
    setSettings(loaded);
  }, [appSettings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [key, value] of Object.entries(settings)) {
        const existing = appSettings.find((entry) => entry.key === key);
        if (existing) {
          await base44.entities.AppSettings.update(existing.id, { value });
        } else {
          await base44.entities.AppSettings.create({
            key,
            value,
            description: DESCRIPTIONS[key] || "",
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["deposit-settings"] });
      queryClient.invalidateQueries({ queryKey: ["live-settings"] });
      queryClient.invalidateQueries({ queryKey: ["winner-settings"] });
      toast({
        title: "Configurações salvas",
        description: "As alteracoes foram aplicadas com sucesso.",
      });
    },
  });

  return (
    <Card className="mt-6 border-purple-700/50 bg-gradient-to-br from-purple-900/50 to-indigo-900/50 p-6">
      <h2 className="mb-6 bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-2xl font-bold text-transparent">
        Configurações Gerais
      </h2>

      <div className="space-y-5">
        <div>
          <Label htmlFor="platform_link" className="text-purple-200">
            Link de Cadastro da Plataforma
          </Label>
          <Input
            id="platform_link"
            value={settings.platform_link}
            onChange={(e) => setSettings({ ...settings, platform_link: e.target.value })}
            placeholder="https://..."
            className="border-purple-700 bg-purple-900/50 text-white"
          />
        </div>

        <div>
          <Label htmlFor="deposit_check_link" className="text-purple-200">
            Link para Conferir Depósitos
          </Label>
          <Input
            id="deposit_check_link"
            value={settings.deposit_check_link}
            onChange={(e) => setSettings({ ...settings, deposit_check_link: e.target.value })}
            placeholder="https://..."
            className="border-purple-700 bg-purple-900/50 text-white"
          />
        </div>

        <div>
          <Label htmlFor="deposit_check_name" className="text-purple-200">
            Nome da Plataforma 1
          </Label>
          <Input
            id="deposit_check_name"
            value={settings.deposit_check_name}
            onChange={(e) => setSettings({ ...settings, deposit_check_name: e.target.value })}
            placeholder="Ex: Plataforma A"
            className="border-purple-700 bg-purple-900/50 text-white"
          />
        </div>

        <div>
          <Label htmlFor="deposit_check_link_2" className="text-purple-200">
            Link para Conferir Depósitos (Plataforma 2)
          </Label>
          <Input
            id="deposit_check_link_2"
            value={settings.deposit_check_link_2}
            onChange={(e) => setSettings({ ...settings, deposit_check_link_2: e.target.value })}
            placeholder="https://..."
            className="border-purple-700 bg-purple-900/50 text-white"
          />
        </div>

        <div>
          <Label htmlFor="deposit_check_name_2" className="text-purple-200">
            Nome da Plataforma 2
          </Label>
          <Input
            id="deposit_check_name_2"
            value={settings.deposit_check_name_2}
            onChange={(e) => setSettings({ ...settings, deposit_check_name_2: e.target.value })}
            placeholder="Ex: Plataforma B"
            className="border-purple-700 bg-purple-900/50 text-white"
          />
        </div>

        <div>
          <Label htmlFor="live_link" className="text-purple-200">
            Link da Live
          </Label>
          <Input
            id="live_link"
            value={settings.live_link}
            onChange={(e) => setSettings({ ...settings, live_link: e.target.value })}
            placeholder="https://youtube.com/..."
            className="border-purple-700 bg-purple-900/50 text-white"
          />
        </div>

        <div>
          <Label htmlFor="cashback_redeem_link" className="text-purple-200">
            Link de Resgate (WhatsApp)
          </Label>
          <Input
            id="cashback_redeem_link"
            value={settings.cashback_redeem_link}
            onChange={(e) => setSettings({ ...settings, cashback_redeem_link: e.target.value })}
            placeholder="https://wa.me/..."
            className="border-purple-700 bg-purple-900/50 text-white"
          />
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </Card>
  );
}

