import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, Clock, Image as ImageIcon, RefreshCw, X } from "lucide-react";
import { format } from "date-fns";

function AdminProfilePreview({ userId }) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    let revoked = "";
    let active = true;

    async function loadPreview() {
      try {
        const blob = await base44.auth.getAdminProfileImagePreview(userId);
        const url = URL.createObjectURL(blob);
        revoked = url;
        if (active) setPreviewUrl(url);
      } catch {
        if (active) setPreviewUrl("");
      }
    }

    loadPreview();

    return () => {
      active = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [userId]);

  if (!previewUrl) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 text-slate-500">
        <ImageIcon className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
      <img src={previewUrl} alt="Foto pendente" className="h-44 w-full object-cover" />
    </div>
  );
}

export default function ProfileImagesTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("manual_review");
  const [rejectReasonById, setRejectReasonById] = useState({});

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-profile-images", statusFilter],
    queryFn: () => base44.auth.listAdminProfileImages(statusFilter),
    staleTime: 10000,
  });

  const approveMutation = useMutation({
    mutationFn: (userId) => base44.auth.approveAdminProfileImage(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profile-images"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["profile-all-deposits"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ userId, reason }) => base44.auth.rejectAdminProfileImage(userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profile-images"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["profile-all-deposits"] });
    },
  });

  return (
    <Card className="mt-6 border-purple-700/50 bg-gradient-to-br from-purple-900/50 to-fuchsia-900/40 p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-pink-200">
            Moderacao de Fotos de Perfil
          </h2>
          <p className="text-sm text-purple-200">Aprove ou rejeite as fotos enviadas pelos usuários.</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-purple-700 bg-purple-950/80 px-3 py-2 text-sm text-purple-100"
          >
            <option value="manual_review">Em análise</option>
            <option value="approved">Aprovadas</option>
            <option value="rejected">Rejeitadas</option>
          </select>
          <Button onClick={() => refetch()} className="bg-purple-700 hover:bg-purple-600">
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-purple-700/40 bg-purple-900/30 p-8 text-center text-purple-200">
          Carregando solicitações...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-purple-700/40 bg-purple-900/30 p-8 text-center text-purple-200">
          Nenhum registro para este filtro.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((item) => {
            const rejectReason = rejectReasonById[item.id] || "";
            const uploadedAt = item.profile_image_uploaded_at
              ? format(new Date(item.profile_image_uploaded_at), "dd/MM/yyyy HH:mm")
              : "-";

            return (
              <Card key={item.id} className="border-purple-700/50 bg-slate-950/70 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-white">{item.nick || item.full_name || "Usuario"}</p>
                    <p className="text-xs text-slate-300">{item.email}</p>
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-purple-900/60 px-2 py-0.5 text-[11px] text-purple-200">
                      <Clock className="h-3 w-3" />
                      {uploadedAt}
                    </p>
                  </div>
                </div>

                <AdminProfilePreview userId={item.id} />

                {item.profile_image_reject_reason ? (
                  <p className="mt-2 rounded-lg border border-rose-700/50 bg-rose-900/25 px-2 py-1 text-xs text-rose-200">
                    Motivo: {item.profile_image_reject_reason}
                  </p>
                ) : null}

                {statusFilter === "manual_review" ? (
                  <div className="mt-3 space-y-2">
                    <div>
                      <Label className="mb-1 block text-xs text-slate-300">Motivo da rejeicao (opcional)</Label>
                      <Textarea
                        value={rejectReason}
                        onChange={(event) =>
                          setRejectReasonById((prev) => ({ ...prev, [item.id]: event.target.value }))
                        }
                        className="min-h-20 border-slate-700 bg-slate-900 text-white"
                        placeholder="Ex: imagem com baixa qualidade, não permitida pelas regras..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => approveMutation.mutate(item.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="bg-emerald-700 hover:bg-emerald-600"
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button
                        onClick={() =>
                          rejectMutation.mutate({
                            userId: item.id,
                            reason: rejectReason || "Rejeitada pela moderação.",
                          })
                        }
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="bg-rose-700 hover:bg-rose-600"
                      >
                        <X className="mr-1 h-4 w-4" />
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </Card>
  );
}

