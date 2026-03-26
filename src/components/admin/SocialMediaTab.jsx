import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Instagram, MessageCircle, Youtube, Facebook, Twitter, Send, Plus, Trash2, GripVertical, Eye, EyeOff, Edit2, Check, X } from "lucide-react";

const SOCIAL_ICONS = {
  instagram: { Icon: Instagram, label: "Instagram", defaultGradient: ['#e4405f', '#f77737'] },
  whatsapp: { Icon: MessageCircle, label: "WhatsApp", defaultGradient: ['#25D366', '#128C7E'] },
  youtube: { Icon: Youtube, label: "YouTube", defaultGradient: ['#FF0000', '#CC0000'] },
  facebook: { Icon: Facebook, label: "Facebook", defaultGradient: ['#1877F2', '#0C5CC7'] },
  twitter: { Icon: Twitter, label: "Twitter", defaultGradient: ['#1DA1F2', '#0C85D0'] },
  tiktok: { Icon: MessageCircle, label: "TikTok", defaultGradient: ['#000000', '#fe2c55'] },
  telegram: { Icon: Send, label: "Telegram", defaultGradient: ['#0088cc', '#006699'] },
};

export default function SocialMediaTab() {
  const queryClient = useQueryClient();
  const [newSocial, setNewSocial] = useState({
    name: "",
    icon: "instagram",
    link: "",
    color_from: "#e4405f",
    color_to: "#f77737",
    order: 0,
    active: true
  });
  const [editingSocial, setEditingSocial] = useState(null);
  const [barActive, setBarActive] = useState(true);

  const { data: socials = [] } = useQuery({
    queryKey: ['admin-socials'],
    queryFn: () => base44.entities.SocialMedia.list('order'),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['social-bar-settings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  React.useEffect(() => {
    const setting = settings.find(s => s.key === 'social_bar_active');
    if (setting) {
      setBarActive(setting.value === 'true');
    }
  }, [settings]);

  const createSocialMutation = useMutation({
    mutationFn: (data) => base44.entities.SocialMedia.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-socials'] });
      queryClient.invalidateQueries({ queryKey: ['public-ui-config'] });
      setNewSocial({
        name: "",
        icon: "instagram",
        link: "",
        color_from: "#e4405f",
        color_to: "#f77737",
        order: socials.length,
        active: true
      });
    },
  });

  const updateSocialMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SocialMedia.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-socials'] });
      queryClient.invalidateQueries({ queryKey: ['public-ui-config'] });
      setEditingSocial(null);
    },
  });

  const deleteSocialMutation = useMutation({
    mutationFn: (id) => base44.entities.SocialMedia.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-socials'] });
      queryClient.invalidateQueries({ queryKey: ['public-ui-config'] });
    },
  });

  const toggleBarMutation = useMutation({
    mutationFn: async (active) => {
      const existing = settings.find(s => s.key === 'social_bar_active');
      if (existing) {
        await base44.entities.AppSettings.update(existing.id, { value: active ? 'true' : 'false' });
      } else {
        await base44.entities.AppSettings.create({ key: 'social_bar_active', value: active ? 'true' : 'false', description: 'Ativar barra de redes sociais' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-bar-settings'] });
      queryClient.invalidateQueries({ queryKey: ['social-settings'] });
      queryClient.invalidateQueries({ queryKey: ['public-ui-config'] });
    },
  });

  const handleCreateSocial = () => {
    if (!newSocial.name || !newSocial.link) {
      alert("Preencha nome e link!");
      return;
    }
    createSocialMutation.mutate(newSocial);
  };

  const handleToggleActive = (social) => {
    updateSocialMutation.mutate({
      id: social.id,
      data: { ...social, active: !social.active }
    });
  };

  const handleSaveEdit = () => {
    if (!editingSocial.name || !editingSocial.link) {
      alert("Preencha nome e link!");
      return;
    }
    updateSocialMutation.mutate({
      id: editingSocial.id,
      data: editingSocial
    });
  };

  const handleDelete = (id) => {
    if (confirm("Deletar esta rede social?")) {
      deleteSocialMutation.mutate(id);
    }
  };

  const handleReorder = (social, direction) => {
    const currentIndex = socials.findIndex(s => s.id === social.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= socials.length) return;
    
    const otherSocial = socials[newIndex];
    
    updateSocialMutation.mutate({ id: social.id, data: { ...social, order: newIndex } });
    updateSocialMutation.mutate({ id: otherSocial.id, data: { ...otherSocial, order: currentIndex } });
  };

  const handleIconChange = (icon) => {
    const { defaultGradient } = SOCIAL_ICONS[icon];
    setNewSocial({
      ...newSocial,
      icon,
      color_from: defaultGradient[0],
      color_to: defaultGradient[1]
    });
  };

  return (
    <div className="space-y-6 mt-6">
      {/* Toggle Barra */}
      <Card className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border-purple-700/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-purple-300">Barra de Redes Sociais</h3>
            <p className="text-sm text-purple-400">Ative/desative a barra no topo do dashboard</p>
          </div>
          <Button
            onClick={() => {
              setBarActive(!barActive);
              toggleBarMutation.mutate(!barActive);
            }}
            className={`${barActive ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}`}
          >
            {barActive ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
            {barActive ? 'Barra Ativa' : 'Barra Desativada'}
          </Button>
        </div>
      </Card>

      {/* Criar Nova */}
      <Card className="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 border-blue-700/50 p-6">
        <h3 className="text-xl font-bold text-blue-300 mb-4">Adicionar Rede Social</h3>
        
        <div className="space-y-4">
          <div>
            <Label className="text-blue-200">Nome de Exibicao</Label>
            <Input
              value={newSocial.name}
              onChange={(e) => setNewSocial({...newSocial, name: e.target.value})}
              placeholder="Ex: Instagram Oficial"
              className="bg-blue-900/50 border-blue-700 text-white"
            />
          </div>

          <div>
            <Label className="text-blue-200">Icone</Label>
            <div className="grid grid-cols-7 gap-2">
              {Object.entries(SOCIAL_ICONS).map(([key, { Icon, label }]) => (
                <button
                  key={key}
                  onClick={() => handleIconChange(key)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    newSocial.icon === key 
                      ? 'border-blue-400 bg-blue-800' 
                      : 'border-blue-700 bg-blue-900/50 hover:border-blue-500'
                  }`}
                  title={label}
                >
                  <Icon className="w-6 h-6 text-white mx-auto" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-blue-200">Link</Label>
            <Input
              value={newSocial.link}
              onChange={(e) => setNewSocial({...newSocial, link: e.target.value})}
              placeholder="https://..."
              className="bg-blue-900/50 border-blue-700 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-blue-200">Cor Inicial</Label>
              <Input
                type="color"
                value={newSocial.color_from}
                onChange={(e) => setNewSocial({...newSocial, color_from: e.target.value})}
                className="h-12 bg-blue-900/50 border-blue-700"
              />
            </div>
            <div>
              <Label className="text-blue-200">Cor Final</Label>
              <Input
                type="color"
                value={newSocial.color_to}
                onChange={(e) => setNewSocial({...newSocial, color_to: e.target.value})}
                className="h-12 bg-blue-900/50 border-blue-700"
              />
            </div>
          </div>

          <div 
            className="p-4 rounded-lg font-bold text-white text-center"
            style={{
              background: `linear-gradient(135deg, ${newSocial.color_from}, ${newSocial.color_to})`
            }}
          >
            Preview: {newSocial.name || "Nome aqui"}
          </div>

          <Button
            onClick={handleCreateSocial}
            disabled={createSocialMutation.isPending}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {createSocialMutation.isPending ? "Adicionando..." : "Adicionar Rede Social"}
          </Button>
        </div>
      </Card>

      {/* Lista */}
      <Card className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-700/50 p-6">
        <h3 className="text-xl font-bold text-purple-300 mb-4">Redes Sociais ({socials.length})</h3>
        
        {socials.length === 0 ? (
          <p className="text-center text-purple-400 py-8">Nenhuma rede social adicionada ainda.</p>
        ) : (
          <div className="space-y-3">
            {socials.map((social) => {
              const { Icon } = SOCIAL_ICONS[social.icon] || SOCIAL_ICONS.instagram;
              const isEditing = editingSocial?.id === social.id;

              return (
                <div 
                  key={social.id}
                  className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-4"
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        value={editingSocial.name}
                        onChange={(e) => setEditingSocial({...editingSocial, name: e.target.value})}
                        className="bg-purple-900/50 border-purple-700 text-white"
                      />
                      <Input
                        value={editingSocial.link}
                        onChange={(e) => setEditingSocial({...editingSocial, link: e.target.value})}
                        className="bg-purple-900/50 border-purple-700 text-white"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="color"
                          value={editingSocial.color_from}
                          onChange={(e) => setEditingSocial({...editingSocial, color_from: e.target.value})}
                          className="h-10 bg-purple-900/50 border-purple-700"
                        />
                        <Input
                          type="color"
                          value={editingSocial.color_to}
                          onChange={(e) => setEditingSocial({...editingSocial, color_to: e.target.value})}
                          className="h-10 bg-purple-900/50 border-purple-700"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit} className="flex-1 bg-green-600">
                          <Check className="w-4 h-4 mr-1" /> Salvar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingSocial(null)} className="flex-1">
                          <X className="w-4 h-4 mr-1" /> Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-2 rounded-lg"
                          style={{
                            background: `linear-gradient(135deg, ${social.color_from}, ${social.color_to})`
                          }}
                        >
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="font-bold text-white">{social.name}</div>
                          <div className="text-xs text-purple-400">{social.link}</div>
                        </div>
                        {!social.active && <Badge variant="secondary">Desativado</Badge>}
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleReorder(social, 'up')} disabled={socials[0].id === social.id}>
                          <GripVertical className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleToggleActive(social)}>
                          {social.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingSocial(social)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(social.id)} className="text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

