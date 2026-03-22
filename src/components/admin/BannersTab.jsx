import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Eye, EyeOff, Upload } from "lucide-react";

export default function BannersTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    image_url: "",
    link_url: "",
    type: "custom",
    active: true,
    order: 0
  });

  const { data: banners = [] } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: () => base44.entities.BannerCarousel.list('order'),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const maxOOrder = Math.max(...banners.map(b => b.order || 0), -1);
      return base44.entities.BannerCarousel.create({...formData, order: maxOOrder + 1});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      queryClient.invalidateQueries({ queryKey: ['carousel-banners'] });
      setFormData({ title: "", image_url: "", link_url: "", type: "custom", active: true, order: 0 });
      setShowForm(false);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }) => base44.entities.BannerCarousel.update(id, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      queryClient.invalidateQueries({ queryKey: ['carousel-banners'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BannerCarousel.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      queryClient.invalidateQueries({ queryKey: ['carousel-banners'] });
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({...formData, image_url: file_url});
    } catch (error) {
      alert("Erro ao fazer upload da imagem");
    }
    setUploading(false);
  };

  return (
    <Card className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-700/50 p-6 mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300">
          Carrossel de Banners
        </h2>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Banner
        </Button>
      </div>

      {showForm && (
        <Card className="bg-purple-900/30 border-purple-700/50 p-6 mb-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-purple-200">Título (opcional)</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Deixe vazio para não exibir título"
                className="bg-purple-900/50 border-purple-700 text-white"
              />
            </div>

            <div>
              <Label htmlFor="image" className="text-purple-200">Imagem do Banner (1080x600 recomendado)</Label>
              <div className="flex gap-2">
                <Input
                  id="image"
                  value={formData.image_url}
                  onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                  placeholder="https://... ou faça upload"
                  className="bg-purple-900/50 border-purple-700 text-white flex-1"
                />
                <Button
                  onClick={() => document.getElementById('file-upload').click()}
                  disabled={uploading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? "Enviando..." : "Upload"}
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {formData.image_url && (
              <div>
                <Label className="text-purple-200">Preview:</Label>
                <img 
                  src={formData.image_url} 
                  alt="Preview" 
                  className="w-full h-48 object-cover rounded-lg mt-2"
                />
              </div>
            )}

            <div>
              <Label htmlFor="link" className="text-purple-200">Link de Destino (opcional)</Label>
              <Input
                id="link"
                value={formData.link_url}
                onChange={(e) => setFormData({...formData, link_url: e.target.value})}
                placeholder="https://..."
                className="bg-purple-900/50 border-purple-700 text-white"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!formData.image_url}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Criar Banner
              </Button>
              <Button
                onClick={() => setShowForm(false)}
                variant="outline"
                className="flex-1 border-red-600 text-red-400"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {banners.map((banner) => (
          <Card key={banner.id} className="bg-purple-900/30 border-purple-700/50 p-4">
            <div className="flex items-start gap-4">
              <img 
                src={banner.image_url} 
                alt={banner.title}
                className="w-32 h-20 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h3 className="font-bold text-lg text-purple-100">{banner.title || "(Sem título)"}</h3>
                <p className="text-sm text-purple-400 truncate">{banner.link_url || "(Sem link)"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleActiveMutation.mutate({ id: banner.id, active: !banner.active })}
                  className={banner.active ? 'text-green-400' : 'text-gray-500'}
                >
                  {banner.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteMutation.mutate(banner.id)}
                  className="text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}
