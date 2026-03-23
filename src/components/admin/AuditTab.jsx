import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44, resolveAssetUrl } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Download, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";

function resolveValidationCode(audit, prizeItem = null) {
  return String(
    prizeItem?.metadata?.validation_code ||
    prizeItem?.metadata?.grant_result?.validationCode ||
    audit?.validation_code ||
    audit?.opening_id ||
    audit?.winner_id ||
    audit?.participant_id ||
    audit?.id ||
    ""
  ).trim();
}

function resolveRewardKind(audit) {
  const normalized = String(audit?.reward_type || "").trim().toLowerCase();
  if (normalized === "points_balance" || normalized === "saldo" || normalized === "bonus") {
    return "points_balance";
  }
  return "cash_prize";
}

export default function AuditTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [redemptionCode, setRedemptionCode] = useState("");
  const queryClient = useQueryClient();

  const { data: audits = [] } = useQuery({
    queryKey: ["winner-audits"],
    queryFn: () => base44.entities.DrawWinnerAudit.list("-drawn_at", 1000),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["audit-users"],
    queryFn: () => base44.entities.User.list("-created_date", 1000),
    staleTime: 60000,
  });

  const { data: platformHistory = [] } = useQuery({
    queryKey: ["audit-platform-history"],
    queryFn: () => base44.entities.PlatformHistory.list("-created_date", 1000),
    staleTime: 60000,
  });
  const { data: prizeGalleryItems = [] } = useQuery({
    queryKey: ["audit-prize-gallery"],
    queryFn: () => base44.entities.UserPrizeGalleryItem.list("-claimed_at", 1000),
    staleTime: 60000,
  });

  const usersById = React.useMemo(() => {
    const map = new Map();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  const historyByUserId = React.useMemo(() => {
    const map = new Map();
    platformHistory.forEach((entry) => {
      if (!entry?.user_id) return;
      if (!map.has(entry.user_id)) map.set(entry.user_id, []);
      map.get(entry.user_id).push(entry);
    });
    return map;
  }, [platformHistory]);

  const resolvePlatformName = React.useCallback((audit, user, resolvedPlatformId) => {
    if (audit.platform_name) return audit.platform_name;

    const userHistory = historyByUserId.get(audit.user_id) || [];
    if (resolvedPlatformId) {
      const byExactId = userHistory.find((entry) => String(entry.platform_id || "").trim() === String(resolvedPlatformId).trim());
      if (byExactId?.platform_name) return byExactId.platform_name;
    }

    if (userHistory[0]?.platform_name) return userHistory[0].platform_name;
    if (audit.platform) return audit.platform;
    return "Não informado";
  }, [historyByUserId]);

  const normalizedAudits = React.useMemo(() => {
    const prizeByAuditKey = new Map();
    prizeGalleryItems.forEach((item) => {
      const auditId = String(item?.metadata?.audit_id || "").trim();
      if (auditId) prizeByAuditKey.set(`audit:${auditId}`, item);
      const openingId = String(item?.source_ref_id || item?.metadata?.opening_id || "").trim();
      if (openingId) prizeByAuditKey.set(`opening:${openingId}`, item);
    });

    return audits.map((audit) => {
      const user = usersById.get(audit.user_id);
      const matchedPrize =
        prizeByAuditKey.get(`audit:${String(audit.id || "").trim()}`) ||
        prizeByAuditKey.get(`opening:${String(audit.opening_id || "").trim()}`) ||
        null;
      const platformId = audit.user_platform_id || audit.platform_id || user?.platform_id || "";
      const platformName = resolvePlatformName(audit, user, platformId);
      const prizeAmountNumber = Number(audit.prize_amount || 0);
      const avatarUrlRaw = audit.user_profile_image_url || user?.profile_image_url || "";
      const canUseApprovedPhoto =
        Boolean(audit.user_profile_image_url) ||
        (user?.profile_image_mode === "photo" && user?.profile_image_status === "approved" && user?.profile_image_url);

      return {
        ...audit,
        user_name: audit.user_name || user?.full_name || user?.nick || "Sem nome",
        user_nick: audit.user_nick || user?.nick || "-",
        user_email: audit.user_email || user?.email || "",
        user_phone: audit.user_phone || user?.phone || "",
        user_platform_id: platformId,
        platform_name: platformName,
        avatar_url: canUseApprovedPhoto && avatarUrlRaw ? resolveAssetUrl(avatarUrlRaw) : "",
        raffle_title: audit.raffle_title || "Sorteio sem titulo",
        game_call: audit.game_call || "",
        status: audit.status || "validated",
        reward_type: resolveRewardKind(audit),
        validation_code: resolveValidationCode(audit, matchedPrize),
        redemption_status: audit.redemption_status || "pending",
        redeemed_at: audit.redeemed_at || null,
        prize_amount: Number.isFinite(prizeAmountNumber) ? prizeAmountNumber : 0,
      };
    });
  }, [audits, prizeGalleryItems, usersById, resolvePlatformName]);

  const deleteAuditMutation = useMutation({
    mutationFn: (auditId) => base44.adminAudit.deleteWinnerAudit(auditId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["winner-audits"] });
      queryClient.invalidateQueries({ queryKey: ["inicio-winner-posts"] });
      queryClient.invalidateQueries({ queryKey: ["user-prize-gallery"] });
    },
  });

  const redeemAuditMutation = useMutation({
    mutationFn: (audit) =>
      base44.entities.DrawWinnerAudit.update(audit.id, {
        ...audit,
        redemption_status: "redeemed",
        redeemed_at: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["winner-audits"] });
    },
  });

  const handleDelete = async (audit) => {
    if (window.confirm(`Tem certeza que deseja excluir o registro de ${audit.user_name}?\n\nSorteio: ${audit.raffle_title}\nPrêmio: R$ ${audit.prize_amount?.toFixed(2)}`)) {
      try {
        await deleteAuditMutation.mutateAsync(audit.id);
        alert("Registro excluído com sucesso!");
      } catch (error) {
        alert("Erro ao excluir registro: " + error.message);
      }
    }
  };

  const handleConfirmRedeemed = async () => {
    const normalizedCode = String(redemptionCode || "").trim().toLowerCase();
    if (!normalizedCode) {
      alert("Digite o código de validação.");
      return;
    }

    const targetAudit = normalizedAudits.find((audit) => String(audit.validation_code || "").trim().toLowerCase() === normalizedCode);
    if (!targetAudit) {
      alert("Nenhum registro encontrado para esse código.");
      return;
    }

    if (String(targetAudit.redemption_status || "").toLowerCase() === "redeemed") {
      alert("Esse prêmio já foi marcado como resgatado.");
      return;
    }

    try {
      await redeemAuditMutation.mutateAsync(targetAudit);
      setRedemptionCode("");
      alert(`Resgate confirmado para ${targetAudit.user_name}.`);
    } catch (error) {
      alert("Erro ao confirmar resgate: " + (error?.message || "Tente novamente."));
    }
  };

  const handleManualRedeem = async (audit) => {
    if (String(audit.redemption_status || "").toLowerCase() === "redeemed") {
      alert("Esse prêmio já foi marcado como resgatado.");
      return;
    }
    try {
      await redeemAuditMutation.mutateAsync(audit);
      alert(`Resgate marcado manualmente para ${audit.user_name}.`);
    } catch (error) {
      alert("Erro ao validar manualmente: " + (error?.message || "Tente novamente."));
    }
  };

  const filteredAudits = normalizedAudits.filter((audit) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const platformIdString = String(audit.user_platform_id || "").toLowerCase();
    return (
      audit.user_name?.toLowerCase().includes(search) ||
      audit.user_nick?.toLowerCase().includes(search) ||
      audit.user_email?.toLowerCase().includes(search) ||
      audit.user_phone?.toLowerCase().includes(search) ||
      audit.platform_name?.toLowerCase().includes(search) ||
      platformIdString.includes(search) ||
      audit.raffle_title?.toLowerCase().includes(search) ||
      audit.game_call?.toLowerCase().includes(search) ||
      audit.validation_code?.toLowerCase().includes(search)
    );
  });

  const downloadReport = (daily = false) => {
    let dataToDownload = normalizedAudits;

    if (daily) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dataToDownload = normalizedAudits.filter((audit) => {
        const auditDate = new Date(audit.drawn_at);
        auditDate.setHours(0, 0, 0, 0);
        return auditDate.getTime() === today.getTime();
      });
    }

    const content = dataToDownload.map((audit) => {
      const date = audit.drawn_at ? format(new Date(audit.drawn_at), "dd/MM/yyyy HH:mm:ss") : "N/A";
      const validationDate = audit.validated_at ? format(new Date(audit.validated_at), "dd/MM/yyyy HH:mm:ss") : "N/A";
      return `
===========================================
Data/Hora: ${date}
Sorteio: ${audit.raffle_title}
Call de Jogo: ${audit.game_call || "N/A"}
Código: ${audit.validation_code || "N/A"}
-------------------------------------------
Ganhador: ${audit.user_name} (@${audit.user_nick})
Telefone: ${audit.user_phone || "N/A"}
Email: ${audit.user_email || "N/A"}
Plataforma: ${audit.platform_name || "N/A"}
ID da Plataforma: ${audit.user_platform_id || "N/A"}
-------------------------------------------
Prêmio: R$ ${audit.prize_amount?.toFixed(2) || "0.00"}
Tipo: ${audit.reward_type === "points_balance" ? "BANCA / SALDO" : "DINHEIRO / PIX"}
Status: ${audit.status === "validated" ? "VALIDADO" : "INVALIDADO"}
Resgate: ${audit.redemption_status === "redeemed" ? "CONFIRMADO" : "PENDENTE"}
Data Validação: ${validationDate}
===========================================
`;
    }).join("\n");

    const filename = daily ? `auditoria_${format(new Date(), "dd-MM-yyyy")}.txt` : `auditoria_completa_${format(new Date(), "dd-MM-yyyy_HH-mm")}.txt`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 mt-6">
      <Card className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border-indigo-700/50 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">
              Auditoria de Ganhadores
            </h2>
            <p className="text-sm text-indigo-300 mt-1">
              {filteredAudits.length} registro(s) {searchTerm && `encontrado(s) para "${searchTerm}"`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => downloadReport(true)} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
              <Download className="w-4 h-4 mr-2" />
              Baixar Relatório do Dia
            </Button>
            <Button onClick={() => downloadReport(false)} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              <Download className="w-4 h-4 mr-2" />
              Baixar Relatório Completo
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
            <Input
              type="text"
              placeholder="Buscar por nome, nick, email, telefone, ID da plataforma, sorteio, call ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-indigo-900/50 border-indigo-700 text-white placeholder:text-indigo-400"
            />
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4">
          <p className="text-sm font-semibold text-emerald-200">Confirmar resgate por código</p>
          <p className="mt-1 text-xs text-emerald-300/80">
            Use o código enviado pelo ganhador para marcar que o prêmio em dinheiro ou banca já foi entregue.
          </p>
          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            <Input
              type="text"
              placeholder="Digite o código de validação"
              value={redemptionCode}
              onChange={(e) => setRedemptionCode(e.target.value)}
              className="bg-emerald-950/40 border-emerald-700 text-white placeholder:text-emerald-300/60"
            />
            <Button onClick={handleConfirmRedeemed} disabled={redeemAuditMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {redeemAuditMutation.isPending ? "Confirmando..." : "Confirmar resgate"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-indigo-700/50">
                <th className="text-left p-3 text-indigo-200 font-semibold">Data/Hora</th>
                <th className="text-left p-3 text-indigo-200 font-semibold">Ciclo</th>
                <th className="text-left p-3 text-indigo-200 font-semibold">Sorteio</th>
                <th className="text-left p-3 text-indigo-200 font-semibold">Ganhador</th>
                <th className="text-left p-3 text-indigo-200 font-semibold">Email</th>
                <th className="text-left p-3 text-indigo-200 font-semibold">Telefone</th>
                <th className="text-left p-3 text-indigo-200 font-semibold">Plataforma / ID</th>
                <th className="text-left p-3 text-indigo-200 font-semibold">Código</th>
                <th className="text-left p-3 text-indigo-200 font-semibold">Prêmio</th>
                <th className="text-left p-3 text-indigo-200 font-semibold">Status</th>
                <th className="text-left p-3 text-indigo-200 font-semibold">Resgate</th>
                <th className="text-left p-3 text-indigo-200 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredAudits.length === 0 ? (
                <tr>
                  <td colSpan="12" className="text-center p-8 text-indigo-300">
                    {searchTerm ? "Nenhum resultado encontrado para a busca." : "Nenhum registro de auditoria ainda."}
                  </td>
                </tr>
              ) : (
                filteredAudits.map((audit) => (
                  <tr key={audit.id} className="border-b border-indigo-800/30 hover:bg-indigo-800/20 transition-colors">
                    <td className="p-3 text-indigo-100 text-sm">
                      {audit.drawn_at ? format(new Date(audit.drawn_at), "dd/MM/yyyy HH:mm:ss") : "-"}
                    </td>
                    <td className="p-3 text-center">
                      {audit.cycle_number !== undefined && audit.cycle_number !== null ? (
                        <Badge className="bg-purple-600">Ciclo #{audit.cycle_number}</Badge>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                    <td className="p-3 text-indigo-100">
                      <div className="font-medium">{audit.raffle_title}</div>
                      {audit.game_call ? <div className="text-xs text-indigo-400 italic">"{audit.game_call}"</div> : null}
                    </td>
                    <td className="p-3 text-indigo-100">
                      <div className="flex items-center gap-2">
                        {audit.avatar_url ? (
                          <img src={audit.avatar_url} alt={audit.user_name} className="h-9 w-9 rounded-full border border-indigo-400/60 object-cover" />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-500/50 bg-indigo-900/50 text-lg">
                            {audit.user_avatar || "U"}
                          </span>
                        )}
                        <div>
                          <div className="font-medium">{audit.user_name}</div>
                          <div className="text-xs text-indigo-400">@{audit.user_nick}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-indigo-100 text-sm">{audit.user_email || "-"}</td>
                    <td className="p-3 text-indigo-100 text-sm">{audit.user_phone || "-"}</td>
                    <td className="p-3 text-indigo-100 text-sm">
                      <div className="font-medium text-indigo-100">{audit.platform_name || "-"}</div>
                      <div className="text-xs font-mono text-indigo-300">{audit.user_platform_id || "-"}</div>
                    </td>
                    <td className="p-3 text-indigo-100 text-xs">
                      <div className="max-w-[11rem] truncate font-mono text-cyan-200">{audit.validation_code || "-"}</div>
                    </td>
                    <td className="p-3 text-green-400 font-bold">
                      <div>R$ {audit.prize_amount?.toFixed(2)}</div>
                      <div className="mt-1 text-[11px] font-medium text-indigo-300">
                        {audit.reward_type === "points_balance" ? "Banca / saldo" : "Dinheiro / Pix"}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge className={audit.status === "validated" ? "bg-green-600" : "bg-red-600"}>
                        {audit.status === "validated" ? "Validado" : "Invalidado"}
                      </Badge>
                      {audit.validated_at ? (
                        <div className="text-xs text-indigo-400 mt-1">{format(new Date(audit.validated_at), "dd/MM/yy HH:mm")}</div>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <Badge className={audit.redemption_status === "redeemed" ? "bg-emerald-600" : "bg-amber-600"}>
                        {audit.redemption_status === "redeemed" ? "Resgatado" : "Pendente"}
                      </Badge>
                      {audit.redeemed_at ? (
                        <div className="text-xs text-indigo-400 mt-1">{format(new Date(audit.redeemed_at), "dd/MM/yy HH:mm")}</div>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleManualRedeem(audit)}
                          disabled={redeemAuditMutation.isPending || audit.redemption_status === "redeemed"}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          Validar manual
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(audit)} className="bg-red-600 hover:bg-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
