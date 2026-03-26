import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Plus, Save, Trash2 } from "lucide-react";

const DEFAULT_SETTINGS = {
  platform_link: "",
  live_link: "",
  cashback_redeem_link: "",
};

const DESCRIPTIONS = {
  platform_link: "Link de cadastro da plataforma",
  live_link: "Link da live ao vivo",
  cashback_redeem_link: "Link do WhatsApp para resgate",
};

function getPlatformSettingKey(base, index) {
  return index === 0 ? base : `${base}_${index + 1}`;
}

function getPlatformDescription(base, index) {
  const label = index + 1;
  if (base === "deposit_check_link") return `Link para conferir depositos da plataforma ${label}`;
  if (base === "deposit_check_name") return `Nome da plataforma ${label} para conferencia`;
  return "";
}

function normalizePlatformsFromSettings(appSettings = []) {
  const map = new Map();

  appSettings.forEach((item) => {
    const key = String(item?.key || "").trim();
    let match = key.match(/^deposit_check_link(?:_(\d+))?$/);
    if (match) {
      const index = match[1] ? Math.max(0, Number(match[1]) - 1) : 0;
      const current = map.get(index) || { name: "", link: "" };
      current.link = item?.value || "";
      map.set(index, current);
      return;
    }

    match = key.match(/^deposit_check_name(?:_(\d+))?$/);
    if (match) {
      const index = match[1] ? Math.max(0, Number(match[1]) - 1) : 0;
      const current = map.get(index) || { name: "", link: "" };
      current.name = item?.value || "";
      map.set(index, current);
    }
  });

  const items = Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, value]) => ({ name: value.name || "", link: value.link || "" }));

  return items.length ? items : [{ name: "", link: "" }, { name: "", link: "" }];
}

export default function SettingsTab() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [depositPlatforms, setDepositPlatforms] = useState([{ name: "", link: "" }, { name: "", link: "" }]);

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
    setDepositPlatforms(normalizePlatformsFromSettings(appSettings));
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

      const platformKeysToDelete = appSettings.filter((entry) => /^deposit_check_(link|name)(?:_\d+)?$/.test(String(entry.key || "")));
      for (const entry of platformKeysToDelete) {
        await base44.entities.AppSettings.delete(entry.id);
      }

      for (const [index, platform] of depositPlatforms.entries()) {
        const normalizedName = String(platform.name || "").trim();
        const normalizedLink = String(platform.link || "").trim();
        if (!normalizedName && !normalizedLink) continue;

        const nameKey = getPlatformSettingKey("deposit_check_name", index);
        const linkKey = getPlatformSettingKey("deposit_check_link", index);

        await base44.entities.AppSettings.create({
          key: nameKey,
          value: normalizedName,
          description: getPlatformDescription("deposit_check_name", index),
        });
        await base44.entities.AppSettings.create({
          key: linkKey,
          value: normalizedLink,
          description: getPlatformDescription("deposit_check_link", index),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-ui-config"] });
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
          <div className="mb-3 flex items-center justify-between gap-3">
            <Label className="text-purple-200">Plataformas para Conferir Depósitos</Label>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDepositPlatforms((prev) => [...prev, { name: "", link: "" }])}
              className="border-purple-700 bg-purple-950/60 text-white hover:bg-purple-900"
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar novo
            </Button>
          </div>

          <div className="space-y-3">
            {depositPlatforms.map((platform, index) => (
              <div key={`deposit-platform-${index}`} className="rounded-2xl border border-purple-800/50 bg-purple-950/30 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">Plataforma {index + 1}</p>
                  {depositPlatforms.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setDepositPlatforms((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                      className="h-8 px-2 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-purple-200">Nome da Plataforma {index + 1}</Label>
                    <Input
                      value={platform.name}
                      onChange={(e) =>
                        setDepositPlatforms((prev) =>
                          prev.map((item, itemIndex) => (itemIndex === index ? { ...item, name: e.target.value } : item))
                        )
                      }
                      placeholder={`Ex: Plataforma ${index + 1}`}
                      className="border-purple-700 bg-purple-900/50 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-purple-200">Link para Conferir Depósitos</Label>
                    <Input
                      value={platform.link}
                      onChange={(e) =>
                        setDepositPlatforms((prev) =>
                          prev.map((item, itemIndex) => (itemIndex === index ? { ...item, link: e.target.value } : item))
                        )
                      }
                      placeholder="https://..."
                      className="border-purple-700 bg-purple-900/50 text-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
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

