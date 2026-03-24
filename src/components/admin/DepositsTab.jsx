import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { base44, resolveAssetUrl } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Check,
  Clock,
  ExternalLink,
  History,
  Image as ImageIcon,
  Pencil,
  Search,
  Ticket,
  Trash2,
  Trophy,
  X,
  XCircle,
} from "lucide-react";

function isAutomaticDailyChestDeposit(deposit) {
  return (
    String(deposit?.source_type || "").trim().toLowerCase() === "daily_chest_ticket_reward" ||
    String(deposit?.processed_by_email || "").trim().toLowerCase() === "system:daily_chest"
  );
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `R$ ${amount.toFixed(2)}`;
}

function getStatusBadge(status) {
  const map = {
    pending: { label: "Em análise", className: "bg-orange-600" },
    approved: { label: "Aprovado", className: "bg-green-600" },
    rejected: { label: "Rejeitado", className: "bg-red-600" },
    invalidated: { label: "Invalidado", className: "bg-slate-600" },
  };
  const config = map[status] || map.pending;
  return <Badge className={config.className}>{config.label}</Badge>;
}

const EMPTY_EDIT_FORM = {
  amount: "",
  platformName: "",
  userPlatformId: "",
  proofImageUrl: "",
  proofImageUrls: "",
  reason: "",
};

const EMPTY_ADJUST_FORM = {
  adjustment: "",
  reason: "",
};

const EMPTY_INVALIDATE_FORM = {
  reason: "",
};

export default function DepositsTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState("manual");
  const [selectedProofByDeposit, setSelectedProofByDeposit] = useState({});
  const [editingDeposit, setEditingDeposit] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [adjustingDeposit, setAdjustingDeposit] = useState(null);
  const [adjustForm, setAdjustForm] = useState(EMPTY_ADJUST_FORM);
  const [invalidatingDeposit, setInvalidatingDeposit] = useState(null);
  const [invalidateForm, setInvalidateForm] = useState(EMPTY_INVALIDATE_FORM);
  const [historyDeposit, setHistoryDeposit] = useState(null);

  const { data: cycles = [] } = useQuery({
    queryKey: ["deposit-cycles-admin"],
    queryFn: () => base44.entities.DepositantDrawCycle.list("-created_date"),
  });

  const activeCycle = cycles.find((item) => item.active);

  const { data: depositsResponse, isLoading } = useQuery({
    queryKey: ["admin-deposits-authoritative", activeCycle?.id],
    queryFn: () => base44.deposits.adminList({ cycleId: activeCycle?.id || "" }),
    enabled: !!activeCycle,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["admin-deposits-users"],
    queryFn: () => base44.entities.User.list(undefined, 1000),
    staleTime: 60000,
  });

  const usersById = useMemo(() => {
    const map = {};
    allUsers.forEach((entry) => {
      map[entry.id] = entry;
    });
    return map;
  }, [allUsers]);

  const deposits = useMemo(() => {
    const items = depositsResponse?.items || [];
    return items.map((deposit) => {
      const profile = usersById[deposit.user_id] || {};
      return {
        ...deposit,
        user_name: deposit.user_name || profile.full_name || profile.name || "Usuário",
        user_email: deposit.user_email || profile.email || "",
        user_platform_id:
          deposit.user_platform_id || deposit.platform_id || profile.platform_id || "",
      };
    });
  }, [depositsResponse?.items, usersById]);

  const { data: historyResponse } = useQuery({
    queryKey: ["admin-deposit-history", historyDeposit?.id],
    queryFn: () => base44.deposits.adminHistory(historyDeposit.id),
    enabled: !!historyDeposit?.id,
  });

  const historyItems = historyResponse?.items || [];

  const getDepositProofLinks = (deposit) => {
    const links = [];
    const pushLink = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized || links.includes(normalized)) return;
      links.push(resolveAssetUrl(normalized));
    };

    pushLink(deposit?.proof_image_url);

    if (Array.isArray(deposit?.proof_image_urls)) {
      deposit.proof_image_urls.forEach(pushLink);
    }

    return links;
  };

  const filteredDeposits = useMemo(() => {
    const baseItems =
      activeView === "automatic"
        ? deposits.filter((deposit) => isAutomaticDailyChestDeposit(deposit))
        : deposits.filter((deposit) => !isAutomaticDailyChestDeposit(deposit));

    if (!searchTerm) return baseItems;
    const search = searchTerm.toLowerCase();
    return baseItems.filter((deposit) =>
      [deposit.user_name, deposit.user_email, deposit.user_platform_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    );
  }, [activeView, deposits, searchTerm]);

  const depositBuckets = useMemo(() => {
    const manual = [];
    const automatic = [];

    deposits.forEach((deposit) => {
      if (isAutomaticDailyChestDeposit(deposit)) {
        automatic.push(deposit);
      } else {
        manual.push(deposit);
      }
    });

    return { manual, automatic };
  }, [deposits]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-deposits-authoritative"] });
    queryClient.invalidateQueries({ queryKey: ["admin-deposits-pending-counter"] });
  };

  const approveMutation = useMutation({
    mutationFn: (depositId) => base44.deposits.approve(depositId),
    onSuccess: invalidateAll,
  });

  const rejectMutation = useMutation({
    mutationFn: ({ depositId, reason }) => base44.deposits.reject(depositId, reason),
    onSuccess: invalidateAll,
  });

  const editMutation = useMutation({
    mutationFn: ({ depositId, payload }) => base44.deposits.adminUpdate(depositId, payload),
    onSuccess: () => {
      invalidateAll();
      setEditingDeposit(null);
      setEditForm(EMPTY_EDIT_FORM);
    },
  });

  const adjustMutation = useMutation({
    mutationFn: ({ depositId, payload }) => base44.deposits.adjustTickets(depositId, payload),
    onSuccess: () => {
      invalidateAll();
      setAdjustingDeposit(null);
      setAdjustForm(EMPTY_ADJUST_FORM);
    },
  });

  const invalidateMutation = useMutation({
    mutationFn: ({ depositId, payload }) => base44.deposits.invalidate(depositId, payload),
    onSuccess: () => {
      invalidateAll();
      setInvalidatingDeposit(null);
      setInvalidateForm(EMPTY_INVALIDATE_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ depositId, payload }) => base44.deposits.adminDelete(depositId, payload),
    onSuccess: () => {
      invalidateAll();
      setInvalidatingDeposit(null);
      setInvalidateForm(EMPTY_INVALIDATE_FORM);
    },
  });

  const stats = useMemo(() => {
    return filteredDeposits.reduce(
      (acc, deposit) => {
        const amount = Number(deposit.amount || 0);
        if (deposit.status === "approved") {
          acc.totalApproved += amount;
          acc.totalTickets += Number(deposit.tickets_count || 0);
        } else if (deposit.status === "pending") {
          acc.totalPending += amount;
        }
        acc.users.add(String(deposit.user_id || ""));
        return acc;
      },
      { totalApproved: 0, totalPending: 0, totalTickets: 0, users: new Set() }
    );
  }, [filteredDeposits]);

  const openEdit = (deposit) => {
    setEditingDeposit(deposit);
    setEditForm({
      amount: String(deposit.amount || ""),
      platformName: String(deposit.platform_name || ""),
      userPlatformId: String(deposit.user_platform_id || ""),
      proofImageUrl: String(deposit.proof_image_url || ""),
      proofImageUrls: Array.isArray(deposit.proof_image_urls) ? deposit.proof_image_urls.join("\n") : "",
      reason: "",
    });
  };

  const submitEdit = () => {
    if (!editingDeposit) return;
    const payload = {
      platformName: editForm.platformName,
      userPlatformId: editForm.userPlatformId,
      proofImageUrl: editForm.proofImageUrl,
      proofImageUrls: editForm.proofImageUrls
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      reason: editForm.reason,
    };
    if (editingDeposit.status !== "approved") {
      payload.amount = Number(editForm.amount);
    }
    editMutation.mutate({ depositId: editingDeposit.id, payload });
  };

  const submitAdjust = () => {
    if (!adjustingDeposit) return;
    adjustMutation.mutate({
      depositId: adjustingDeposit.id,
      payload: {
        adjustment: Number(adjustForm.adjustment),
        reason: adjustForm.reason,
      },
    });
  };

  const submitInvalidate = () => {
    if (!invalidatingDeposit) return;
    if (invalidatingDeposit.status === "approved" || invalidatingDeposit.status === "invalidated") {
      deleteMutation.mutate({
        depositId: invalidatingDeposit.id,
        payload: { reason: invalidateForm.reason },
      });
      return;
    }
    invalidateMutation.mutate({
      depositId: invalidatingDeposit.id,
      payload: { reason: invalidateForm.reason },
    });
  };

  if (!activeCycle) {
    return (
      <Card className="mt-6 border-slate-800 bg-slate-900/50 p-6">
        <div className="py-12 text-center">
          <Trophy className="mx-auto mb-4 h-16 w-16 text-slate-600" />
          <h3 className="mb-2 text-xl font-bold text-white">Nenhum ciclo ativo</h3>
          <p className="text-slate-400">Abra um novo ciclo para receber e processar depósitos.</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="mt-6 border-purple-700/50 bg-gradient-to-br from-purple-900/50 to-indigo-900/50 p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-2xl font-bold text-transparent">
              Depósitos - Ciclo #{activeCycle.cycle_number}
            </h2>
            <p className="mt-1 text-sm text-purple-300">
              Operação admin segura, auditável e sem reabrir `/api/entities`.
            </p>
          </div>
          <div className="mt-4 inline-flex rounded-xl border border-purple-700/60 bg-slate-950/50 p-1">
            <button
              type="button"
              onClick={() => setActiveView("manual")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                activeView === "manual"
                  ? "bg-purple-600 text-white"
                  : "text-purple-300 hover:bg-purple-900/40"
              }`}
            >
              Manuais ({depositBuckets.manual.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveView("automatic")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                activeView === "automatic"
                  ? "bg-cyan-600 text-white"
                  : "text-cyan-300 hover:bg-cyan-950/40"
              }`}
            >
              Automáticos do baú ({depositBuckets.automatic.length})
            </button>
          </div>
          <div className="w-full max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-purple-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pesquisar por nome, email ou ID..."
                className="border-purple-700 bg-purple-900/50 pl-10 text-white placeholder:text-purple-400"
              />
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-purple-700/40 bg-slate-950/40 px-4 py-3 text-sm">
          {activeView === "manual" ? (
            <p className="text-purple-200">
              Esta visão mostra apenas os depósitos enviados manualmente pelos usuários para conferência e aprovação normal.
            </p>
          ) : (
            <p className="text-cyan-200">
              Esta visão mostra apenas os depósitos automáticos gerados pelo sistema para prêmios de bilhetes do Baú Diário.
            </p>
          )}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="border-green-500/50 bg-green-900/30 p-4">
            <div className="text-sm uppercase text-green-200">Total aprovado</div>
            <div className="text-2xl font-bold text-green-400">{formatMoney(stats.totalApproved)}</div>
          </Card>
          <Card className="border-orange-500/50 bg-orange-900/30 p-4">
            <div className="text-sm uppercase text-orange-200">Total pendente</div>
            <div className="text-2xl font-bold text-orange-400">{formatMoney(stats.totalPending)}</div>
          </Card>
          <Card className="border-cyan-500/50 bg-cyan-900/30 p-4">
            <div className="text-sm uppercase text-cyan-200">Bilhetes ativos</div>
            <div className="text-2xl font-bold text-cyan-400">{stats.totalTickets}</div>
          </Card>
          <Card className="border-purple-500/50 bg-purple-900/30 p-4">
            <div className="text-sm uppercase text-purple-200">Participantes</div>
            <div className="text-2xl font-bold text-purple-300">{stats.users.size}</div>
          </Card>
        </div>

        <div className="overflow-x-auto rounded-lg border border-purple-700/50">
          <Table>
            <TableHeader>
              <TableRow className="bg-purple-900/50">
                <TableHead className="text-purple-200">Usuário</TableHead>
                <TableHead className="text-purple-200">Plataforma</TableHead>
                <TableHead className="text-purple-200">Valor</TableHead>
                <TableHead className="text-purple-200">Bilhetes</TableHead>
                <TableHead className="text-purple-200">Status</TableHead>
                <TableHead className="text-purple-200">Processado por</TableHead>
                <TableHead className="text-purple-200">Data</TableHead>
                <TableHead className="text-purple-200">Comprovante</TableHead>
                <TableHead className="text-purple-200">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {false && !isLoading && filteredDeposits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-purple-200">
                    {activeView === "automatic"
                      ? "Nenhum depósito automático do baú encontrado."
                      : "Nenhum depósito manual encontrado."}
                  </TableCell>
                </TableRow>
              ) : null}
              {!isLoading && filteredDeposits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-purple-200">
                    Nenhum depósito encontrado.
                  </TableCell>
                </TableRow>
              ) : null}

              {filteredDeposits.map((deposit) => (
                <TableRow key={deposit.id} className="border-purple-800/30">
                  <TableCell className="max-w-[180px] text-purple-100">
                    <div className="truncate font-medium">{deposit.user_name || "Usuário"}</div>
                    <div className="truncate text-xs text-purple-400">{deposit.user_email || ""}</div>
                    <div className="truncate text-xs text-purple-500">{deposit.user_platform_id || "-"}</div>
                    {isAutomaticDailyChestDeposit(deposit) ? (
                      <div className="mt-1">
                        <Badge className="bg-cyan-700 text-cyan-100">Baú Diário</Badge>
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-purple-300">{deposit.platform_name || "-"}</TableCell>
                  <TableCell className="font-bold text-green-400">{formatMoney(deposit.amount)}</TableCell>
                  <TableCell className="text-yellow-300">
                    <div className="font-bold">{Number(deposit.tickets_count || 0)}</div>
                    {Number(deposit.bonus_ticket_count || 0) > 0 ? (
                      <div className="text-xs text-yellow-500">+{Number(deposit.bonus_ticket_count || 0)} bônus</div>
                    ) : null}
                    {Number(deposit.manual_ticket_adjustment_count || 0) !== 0 ? (
                      <div className="text-xs text-cyan-400">
                        ajuste manual {Number(deposit.manual_ticket_adjustment_count || 0) > 0 ? "+" : ""}
                        {Number(deposit.manual_ticket_adjustment_count || 0)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>{getStatusBadge(deposit.status)}</TableCell>
                  <TableCell className="max-w-[180px] text-xs text-purple-300">
                    {deposit.processed_by_email ? (
                      <>
                        <div className="truncate">{deposit.processed_by_email}</div>
                        <div className="text-purple-500">
                          {deposit.processed_at ? format(new Date(deposit.processed_at), "dd/MM/yyyy HH:mm") : "-"}
                        </div>
                      </>
                    ) : (
                      <span className="text-purple-500">Não processado</span>
                    )}
                  </TableCell>
                  <TableCell className="text-purple-300">
                    {deposit.created_date ? format(new Date(deposit.created_date), "dd/MM/yyyy HH:mm") : "-"}
                  </TableCell>
                  <TableCell>
                    {getDepositProofLinks(deposit).length > 0 ? (
                      <div className="min-w-[220px] space-y-2">
                        <Select
                          value={selectedProofByDeposit[deposit.id] || getDepositProofLinks(deposit)[0]}
                          onValueChange={(value) =>
                            setSelectedProofByDeposit((prev) => ({
                              ...prev,
                              [deposit.id]: value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-9 border-blue-500/40 bg-slate-950/60 text-xs text-blue-100">
                            <SelectValue placeholder="Selecione um comprovante" />
                          </SelectTrigger>
                          <SelectContent>
                            {getDepositProofLinks(deposit).map((link, index) => (
                              <SelectItem key={`${deposit.id}-proof-${index}`} value={link}>
                                {`Comprovante ${index + 1}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <a
                          href={selectedProofByDeposit[deposit.id] || getDepositProofLinks(deposit)[0]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-500/50 bg-blue-600/20 px-3 py-1 text-xs text-blue-300 transition-all hover:bg-blue-600/40 hover:text-blue-200"
                        >
                          <ImageIcon className="h-3 w-3" />
                          Abrir imagem
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-red-400">Sem comprovante</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {deposit.status === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate(deposit.id)}
                            disabled={approveMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectMutation.mutate({ depositId: deposit.id, reason: "Rejeição administrativa" })}
                            disabled={rejectMutation.isPending}
                          >
                            <X className="mr-1 h-4 w-4" />
                            Rejeitar
                          </Button>
                        </>
                      ) : null}

                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-600 text-blue-300"
                        onClick={() => openEdit(deposit)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {deposit.status === "approved" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-yellow-600 text-yellow-300"
                          onClick={() => {
                            setAdjustingDeposit(deposit);
                            setAdjustForm(EMPTY_ADJUST_FORM);
                          }}
                        >
                          <Ticket className="h-4 w-4" />
                        </Button>
                      ) : null}

                      <Button
                        size="sm"
                        variant="outline"
                        className="border-rose-600 text-rose-300"
                        onClick={() => {
                          setInvalidatingDeposit(deposit);
                          setInvalidateForm(EMPTY_INVALIDATE_FORM);
                        }}
                      >
                        {deposit.status === "approved" || deposit.status === "invalidated" ? (
                          <Trash2 className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="border-cyan-600 text-cyan-300"
                        onClick={() => setHistoryDeposit(deposit)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!editingDeposit} onOpenChange={() => setEditingDeposit(null)}>
        <DialogContent className="border-purple-700/50 bg-purple-950 text-white">
          <DialogHeader>
            <DialogTitle>Editar depósito</DialogTitle>
          </DialogHeader>
          {editingDeposit ? (
            <div className="space-y-4">
              <div>
                <Label>Usuário</Label>
                <p className="text-sm text-purple-200">{editingDeposit.user_name}</p>
              </div>
              <div>
                <Label>Valor</Label>
                <Input
                  value={editForm.amount}
                  disabled={editingDeposit.status === "approved"}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, amount: event.target.value }))}
                  className="bg-purple-900/40"
                />
                {editingDeposit.status === "approved" ? (
                  <p className="mt-1 text-xs text-amber-300">Valor de depósito aprovado não pode ser alterado sem reprocessamento seguro.</p>
                ) : null}
              </div>
              <div>
                <Label>Plataforma</Label>
                <Input
                  value={editForm.platformName}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, platformName: event.target.value }))}
                  className="bg-purple-900/40"
                />
              </div>
              <div>
                <Label>ID da plataforma</Label>
                <Input
                  value={editForm.userPlatformId}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, userPlatformId: event.target.value }))}
                  className="bg-purple-900/40"
                />
              </div>
              <div>
                <Label>Comprovante principal</Label>
                <Input
                  value={editForm.proofImageUrl}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, proofImageUrl: event.target.value }))}
                  className="bg-purple-900/40"
                />
              </div>
              <div>
                <Label>Comprovantes adicionais</Label>
                <Input
                  value={editForm.proofImageUrls}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, proofImageUrls: event.target.value }))}
                  className="bg-purple-900/40"
                  placeholder="Uma URL por linha"
                />
              </div>
              <div>
                <Label>Motivo obrigatório</Label>
                <Input
                  value={editForm.reason}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, reason: event.target.value }))}
                  className="bg-purple-900/40"
                />
              </div>
              <Button onClick={submitEdit} disabled={editMutation.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
                Salvar edição
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjustingDeposit} onOpenChange={() => setAdjustingDeposit(null)}>
        <DialogContent className="border-yellow-700/50 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Ajustar bilhetes</DialogTitle>
          </DialogHeader>
          {adjustingDeposit ? (
            <div className="space-y-4">
              <div>
                <Label>Bilhetes atuais</Label>
                <p className="text-xl font-bold text-yellow-300">{Number(adjustingDeposit.tickets_count || 0)}</p>
              </div>
              <div>
                <Label>Ajuste</Label>
                <Input
                  value={adjustForm.adjustment}
                  onChange={(event) => setAdjustForm((prev) => ({ ...prev, adjustment: event.target.value }))}
                  className="bg-slate-900/60"
                  placeholder="Ex: 10 ou -5"
                />
              </div>
              <div>
                <Label>Motivo obrigatório</Label>
                <Input
                  value={adjustForm.reason}
                  onChange={(event) => setAdjustForm((prev) => ({ ...prev, reason: event.target.value }))}
                  className="bg-slate-900/60"
                />
              </div>
              <Button onClick={submitAdjust} disabled={adjustMutation.isPending} className="w-full bg-yellow-600 hover:bg-yellow-700">
                Aplicar ajuste
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!invalidatingDeposit} onOpenChange={() => setInvalidatingDeposit(null)}>
        <DialogContent className="border-rose-700/50 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>
              {invalidatingDeposit?.status === "approved" || invalidatingDeposit?.status === "invalidated"
                ? "Excluir depósito"
                : "Invalidar depósito"}
            </DialogTitle>
          </DialogHeader>
          {invalidatingDeposit ? (
            <div className="space-y-4">
              <p className="text-sm text-rose-200">
                {invalidatingDeposit.status === "approved" || invalidatingDeposit.status === "invalidated"
                  ? "O depósito será removido dos registros exibidos e não ficará como invalidado."
                  : "O depósito será marcado como invalidado para registrar uma divergência administrativa."}
              </p>
              <div>
                <Label>Motivo obrigatório</Label>
                <Input
                  value={invalidateForm.reason}
                  onChange={(event) => setInvalidateForm({ reason: event.target.value })}
                  className="bg-slate-900/60"
                />
              </div>
              <Button
                onClick={submitInvalidate}
                disabled={invalidateMutation.isPending || deleteMutation.isPending}
                className="w-full bg-rose-700 hover:bg-rose-800"
              >
                {invalidatingDeposit.status === "approved" || invalidatingDeposit.status === "invalidated"
                  ? "Confirmar exclusão"
                  : "Confirmar invalidação"}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyDeposit} onOpenChange={() => setHistoryDeposit(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto border-cyan-700/50 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Histórico do depósito</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {historyItems.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum evento registrado.</p>
            ) : (
              historyItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-cyan-300">{item.event_type}</p>
                    <p className="text-xs text-slate-400">
                      {item.created_at ? format(new Date(item.created_at), "dd/MM/yyyy HH:mm:ss") : "-"}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.processed_by_email || "Sistema"} • {item.previous_status || "-"} → {item.next_status || "-"}
                  </p>
                  {item.metadata?.reason ? (
                    <p className="mt-2 text-sm text-slate-200">Motivo: {item.metadata.reason}</p>
                  ) : null}
                  {"adjustment" in (item.metadata || {}) ? (
                    <p className="mt-1 text-sm text-yellow-300">
                      Ajuste: {Number(item.metadata.adjustment) > 0 ? "+" : ""}
                      {Number(item.metadata.adjustment || 0)} • final {Number(item.metadata.final_count || 0)}
                    </p>
                  ) : null}
                  {item.metadata?.changes ? (
                    <div className="mt-2 text-xs text-slate-300">
                      {Object.entries(item.metadata.changes).map(([field, value]) => (
                        <div key={field}>
                          {field}: {JSON.stringify(value.before)} → {JSON.stringify(value.after)}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
