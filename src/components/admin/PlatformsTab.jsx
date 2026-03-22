import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Eye, EyeOff, Edit2, Save, X, ChevronUp, ChevronDown } from "lucide-react";

export default function PlatformsTab() {
  const queryClient = useQueryClient();
  const [newPlatform, setNewPlatform] = useState({
    name: "",
    link: "",
    color_from: "#7c3aed",
    color_to: "#ec4899",
  });
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const { data: platforms = [] } = useQuery({
    queryKey: ['all-platforms'],
    queryFn: () => base44.entities.Platform.list('order'),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const maxOOrder = platforms.reduce((max, p) => Math.max(max, p.order || 0), 0);
      await base44.entities.Platform.create({
        ...newPlatform,
        active: true,
        order: maxOOrder + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-platforms'] });
      queryClient.invalidateQueries({ queryKey: ['active-platforms'] });
      setNewPlatform({ name: "", link: "", color_from: "#7c3aed", color_to: "#ec4899" });
      alert("✅ Plataforma criada com sucesso!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Platform.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-platforms'] });
      queryClient.invalidateQueries({ queryKey: ['active-platforms'] });
      setEditingId(null);
      setEditData({});
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Platform.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-platforms'] });
      queryClient.invalidateQueries({ queryKey: ['active-platforms'] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }) => base44.entities.Platform.update(id, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-platforms'] });
      queryClient.invalidateQueries({ queryKey: ['active-platforms'] });
      alert("✅ Status atualizado com sucesso!");
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, newOOrder }) => {
      await base44.entities.Platform.update(id, { order: newOOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-platforms'] });
      queryClient.invalidateQueries({ queryKey: ['active-platforms'] });
    },
  });

  const handleCreate = () => {
    if (!newPlatform.name || !newPlatform.link) {
      alert("❌ Preencha nome e link!");
      return;
    }
    createMutation.mutate();
  };

  const handleEdit = (platform) => {
    setEditingId(platform.id);
    setEditData({
      name: platform.name,
      link: platform.link,
      color_from: platform.color_from,
      color_to: platform.color_to,
    });
  };

  const handleSaveEdit = (id) => {
    if (!editData.name || !editData.link) {
      alert("❌ Preencha nome e link!");
      return;
    }
    updateMutation.mutate({ id, data: editData });
  };

  const handleDelete = (id, name) => {
    if (confirm(`❌ Excluir plataforma "${name}"?\n\nEsta ação não pode ser desfeita!`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleMoveUp = (platform) => {
    const currentIndex = platforms.findIndex(p => p.id === platform.id);
    if (currentIndex > 0) {
      const prevPlatform = platforms[currentIndex - 1];
      reorderMutation.mutate({ id: platform.id, newOOrder: prevPlatform.order });
      reorderMutation.mutate({ id: prevPlatform.id, newOOrder: platform.order });
    }
  };

  const handleMoveDown = (platform) => {
    const currentIndex = platforms.findIndex(p => p.id === platform.id);
    if (currentIndex < platforms.length - 1) {
      const nextPlatform = platforms[currentIndex + 1];
      reorderMutation.mutate({ id: platform.id, newOOrder: nextPlatform.order });
      reorderMutation.mutate({ id: nextPlatform.id, newOOrder: platform.order });
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {/* Create New Platform */}
      <Card className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-700/50 p-6">
        <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300">
          Adicionar Nova Plataforma
        </h2>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-purple-200">Nome da Plataforma</Label>
            <Input
              value={newPlatform.name}
              onChange={(e) => setNewPlatform({...newPlatform, name: e.target.value})}
              placeholder="Ex: P20BET"
              className="bg-purple-900/50 border-purple-700 text-white"
            />
          </div>
          <div>
            <Label className="text-purple-200">Link</Label>
            <Input
              value={newPlatform.link}
              onChange={(e) => setNewPlatform({...newPlatform, link: e.target.value})}
              placeholder="https://..."
              className="bg-purple-900/50 border-purple-700 text-white"
            />
          </div>
          <div>
            <Label className="text-purple-200">Cor Inicial (Gradiente)</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={newPlatform.color_from}
                onChange={(e) => setNewPlatform({...newPlatform, color_from: e.target.value})}
                className="w-20 h-10"
              />
              <Input
                value={newPlatform.color_from}
                onChange={(e) => setNewPlatform({...newPlatform, color_from: e.target.value})}
                placeholder="#7c3aed"
                className="bg-purple-900/50 border-purple-700 text-white"
              />
            </div>
          </div>
          <div>
            <Label className="text-purple-200">Cor Final (Gradiente)</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={newPlatform.color_to}
                onChange={(e) => setNewPlatform({...newPlatform, color_to: e.target.value})}
                className="w-20 h-10"
              />
              <Input
                value={newPlatform.color_to}
                onChange={(e) => setNewPlatform({...newPlatform, color_to: e.target.value})}
                placeholder="#ec4899"
                className="bg-purple-900/50 border-purple-700 text-white"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="mb-4 p-4 rounded-lg" style={{
          background: `linear-gradient(135deg, ${newPlatform.color_from} 0%, ${newPlatform.color_to} 100%)`
        }}>
          <p className="text-center text-white font-bold">Preview: {newPlatform.name || "Nome da Plataforma"}</p>
        </div>

        <Button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          {createMutation.isPending ? "Criando..." : "Criar Plataforma"}
        </Button>
      </Card>

      {/* Platforms List */}
      <Card className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border-purple-700/50 p-6">
        <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-cyan-300">
          Plataformas Cadastradas ({platforms.length})
        </h2>

        {platforms.length === 0 ? (
          <div className="text-center text-purple-300 py-8">
            Nenhuma plataforma cadastrada ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {platforms.map((platform, index) => (
              <div
                key={platform.id}
                className="p-4 bg-purple-900/30 border border-purple-700/50 rounded-lg"
              >
                {editingId === platform.id ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-purple-200 text-xs">Nome</Label>
                        <Input
                          value={editData.name}
                          onChange={(e) => setEditData({...editData, name: e.target.value})}
                          className="bg-purple-900/50 border-purple-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-purple-200 text-xs">Link</Label>
                        <Input
                          value={editData.link}
                          onChange={(e) => setEditData({...editData, link: e.target.value})}
                          className="bg-purple-900/50 border-purple-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-purple-200 text-xs">Cor Inicial</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={editData.color_from}
                            onChange={(e) => setEditData({...editData, color_from: e.target.value})}
                            className="w-16 h-8"
                          />
                          <Input
                            value={editData.color_from}
                            onChange={(e) => setEditData({...editData, color_from: e.target.value})}
                            className="bg-purple-900/50 border-purple-700 text-white text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-purple-200 text-xs">Cor Final</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={editData.color_to}
                            onChange={(e) => setEditData({...editData, color_to: e.target.value})}
                            className="w-16 h-8"
                          />
                          <Input
                            value={editData.color_to}
                            onChange={(e) => setEditData({...editData, color_to: e.target.value})}
                            className="bg-purple-900/50 border-purple-700 text-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSaveEdit(platform.id)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Salvar
                      </Button>
                      <Button
                        onClick={() => setEditingId(null)}
                        size="sm"
                        variant="outline"
                        className="border-red-600 text-red-400"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                        style={{
                          background: `linear-gradient(135deg, ${platform.color_from} 0%, ${platform.color_to} 100%)`
                        }}
                      >
                        {platform.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-purple-100">{platform.name}</p>
                          <Badge className={platform.active ? "bg-green-600" : "bg-gray-600"}>
                            {platform.active ? "Ativa" : "Inativa"}
                          </Badge>
                        </div>
                        <p className="text-xs text-purple-400 truncate max-w-xs">{platform.link}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* OOrder Controls */}
                      <div className="flex flex-col gap-1">
                        <Button
                          onClick={() => handleMoveUp(platform)}
                          disabled={index === 0}
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-purple-300 hover:text-purple-100"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={() => handleMoveDown(platform)}
                          disabled={index === platforms.length - 1}
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-purple-300 hover:text-purple-100"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </div>

                      <Button
                        onClick={() => toggleActiveMutation.mutate({ id: platform.id, active: !platform.active })}
                        disabled={toggleActiveMutation.isPending}
                        size="sm"
                        variant={platform.active ? "outline" : "default"}
                        className={platform.active ? "border-orange-600 text-orange-400" : "bg-green-600 hover:bg-green-700"}
                      >
                        {platform.active ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                        {toggleActiveMutation.isPending ? "..." : (platform.active ? "Desativar" : "Ativar")}
                      </Button>

                      <Button
                        onClick={() => handleEdit(platform)}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        Editar
                      </Button>

                      <Button
                        onClick={() => handleDelete(platform.id, platform.name)}
                        size="sm"
                        variant="destructive"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
