import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Eye, EyeOff, Save, Ticket, Trophy, Ban } from "lucide-react";

export default function PromoBoxesTab() {
  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const [ticketsBoxSettings, setTicketsBoxSettings] = useState({
    title: "Ganhe Bilhetes Extras",
    reward50: "50",
    reward100: "100",
  });

  useEffect(() => {
    const getSettingValue = (key, defaultValue) => {
      const setting = settings.find((s) => s.key === key);
      return setting?.value || defaultValue;
    };

    setTicketsBoxSettings({
      title: getSettingValue("tickets_box_title", "Ganhe Bilhetes Extras"),
      reward50: getSettingValue("tickets_reward_50", "50"),
      reward100: getSettingValue("tickets_reward_100", "100"),
    });
  }, [settings]);

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }) => {
      const existing = settings.find((s) => s.key === key);
      if (existing) {
        await base44.entities.AppSettings.update(existing.id, { value });
      } else {
        await base44.entities.AppSettings.create({ key, value, description: "" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const saveTicketsBoxMutation = useMutation({
    mutationFn: async () => {
      const settingsToUpdate = [
        { key: "tickets_box_title", value: ticketsBoxSettings.title },
        { key: "tickets_reward_50", value: ticketsBoxSettings.reward50 },
        { key: "tickets_reward_100", value: ticketsBoxSettings.reward100 },
      ];

      for (const setting of settingsToUpdate) {
        const existing = settings.find((s) => s.key === setting.key);
        if (existing) {
          await base44.entities.AppSettings.update(existing.id, { value: setting.value });
        } else {
          await base44.entities.AppSettings.create({
            key: setting.key,
            value: setting.value,
            description: `Configuração de bilhetes extras: ${setting.key}`,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({
        title: "Configurações salvas",
        description: "As regras de bilhetes extras foram atualizadas.",
      });
    },
  });

  const getSettingValue = (key) => {
    return settings.find((s) => s.key === key)?.value || "false";
  };

  const toggleSetting = (key) => {
    const currentValue = getSettingValue(key);
    const newValue = currentValue === "true" ? "false" : "true";
    updateSettingMutation.mutate({ key, value: newValue });
  };

  return (
    <div className="mt-6 space-y-6">
      <Card className="border-blue-700/50 bg-gradient-to-br from-blue-900/50 to-indigo-900/50 p-6">
        <h2 className="mb-6 bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-2xl font-bold text-transparent">
          Controles Rapidos
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            onClick={() => toggleSetting("tickets_box_active")}
            className={`cursor-pointer p-6 transition-all ${
              getSettingValue("tickets_box_active") === "true"
                ? "border-green-600 bg-green-900/50"
                : "border-gray-600 bg-gray-900/50"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <Ticket
                className={`h-8 w-8 ${
                  getSettingValue("tickets_box_active") === "true" ? "text-green-400" : "text-gray-400"
                }`}
              />
              {getSettingValue("tickets_box_active") === "true" ? (
                <Eye className="h-5 w-5 text-green-400" />
              ) : (
                <EyeOff className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <h3 className="mb-1 text-lg font-bold text-white">Box Bilhetes</h3>
            <p
              className={`text-sm ${
                getSettingValue("tickets_box_active") === "true" ? "text-green-300" : "text-gray-400"
              }`}
            >
              {getSettingValue("tickets_box_active") === "true" ? "Ativo" : "Inativo"}
            </p>
          </Card>

          <Card
            onClick={() => toggleSetting("depositant_draw_active")}
            className={`cursor-pointer p-6 transition-all ${
              getSettingValue("depositant_draw_active") === "true"
                ? "border-green-600 bg-green-900/50"
                : "border-gray-600 bg-gray-900/50"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <Trophy
                className={`h-8 w-8 ${
                  getSettingValue("depositant_draw_active") === "true" ? "text-green-400" : "text-gray-400"
                }`}
              />
              {getSettingValue("depositant_draw_active") === "true" ? (
                <Eye className="h-5 w-5 text-green-400" />
              ) : (
                <EyeOff className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <h3 className="mb-1 text-lg font-bold text-white">Sorteio Geral</h3>
            <p
              className={`text-sm ${
                getSettingValue("depositant_draw_active") === "true" ? "text-green-300" : "text-gray-400"
              }`}
            >
              {getSettingValue("depositant_draw_active") === "true" ? "Ativo" : "Inativo"}
            </p>
          </Card>

          <Card
            onClick={() => toggleSetting("deposits_enabled")}
            className={`cursor-pointer p-6 transition-all ${
              getSettingValue("deposits_enabled") === "true"
                ? "border-green-600 bg-green-900/50"
                : "border-red-600 bg-red-900/50"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <Ban
                className={`h-8 w-8 ${
                  getSettingValue("deposits_enabled") === "true" ? "text-green-400" : "text-red-400"
                }`}
              />
              {getSettingValue("deposits_enabled") === "true" ? (
                <Eye className="h-5 w-5 text-green-400" />
              ) : (
                <EyeOff className="h-5 w-5 text-red-400" />
              )}
            </div>
            <h3 className="mb-1 text-lg font-bold text-white">Depósitos</h3>
            <p
              className={`text-sm ${
                getSettingValue("deposits_enabled") === "true" ? "text-green-300" : "text-red-300"
              }`}
            >
              {getSettingValue("deposits_enabled") === "true" ? "Permitido" : "Bloqueado"}
            </p>
          </Card>
        </div>
      </Card>

      <Card className="border-indigo-700/50 bg-gradient-to-br from-indigo-900/50 to-purple-900/50 p-6">
        <h2 className="mb-6 bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-2xl font-bold text-transparent">
          Configurar Box de Bilhetes Extras
        </h2>

        <div className="space-y-4">
          <div>
            <Label className="text-indigo-200">Titulo do Box</Label>
            <Input
              value={ticketsBoxSettings.title}
              onChange={(e) => setTicketsBoxSettings({ ...ticketsBoxSettings, title: e.target.value })}
              className="border-indigo-700 bg-indigo-900/50 text-white"
              placeholder="Ex: Ganhe Bilhetes Extras"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-indigo-200">Bilhetes por marco de R$50</Label>
              <Input
                type="number"
                value={ticketsBoxSettings.reward50}
                onChange={(e) => setTicketsBoxSettings({ ...ticketsBoxSettings, reward50: e.target.value })}
                className="border-indigo-700 bg-indigo-900/50 text-white"
              />
              <p className="mt-1 text-xs text-indigo-300">Ex.: 50</p>
            </div>
            <div>
              <Label className="text-indigo-200">Bilhetes por marco de R$100</Label>
              <Input
                type="number"
                value={ticketsBoxSettings.reward100}
                onChange={(e) => setTicketsBoxSettings({ ...ticketsBoxSettings, reward100: e.target.value })}
                className="border-indigo-700 bg-indigo-900/50 text-white"
              />
              <p className="mt-1 text-xs text-indigo-300">Ex.: 100</p>
            </div>
          </div>

          <div className="rounded-lg border border-indigo-600/50 bg-indigo-900/30 p-3">
            <p className="text-sm text-indigo-200">
              Logica cumulativa por total aprovado:
              {" "}
              <strong>R$100</strong>
              {" "}
              conta como
              {" "}
              <strong>1x marco de R$50 + 1x marco de R$100</strong>.
            </p>
          </div>

          <Button
            onClick={() => saveTicketsBoxMutation.mutate()}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            <Save className="mr-2 h-4 w-4" />
            Salvar Configurações do Box de Bilhetes
          </Button>
        </div>
      </Card>
    </div>
  );
}

