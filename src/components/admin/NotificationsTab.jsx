import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bell, Send, Trash2, CheckCircle, Zap } from "lucide-react";
import { format } from "date-fns";

export default function NotificationsTab() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["push-notifications"],
    queryFn: () => base44.entities.PushNotification.list("-created_date"),
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async ({ title: notificationTitle, message: notificationMessage }) => {
      await base44.entities.PushNotification.create({
        title: notificationTitle,
        message: notificationMessage,
        sent_at: new Date().toISOString(),
        status: "sent",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["push-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["push-notifications-check"] });
      setTitle("");
      setMessage("");
      setSending(false);

      alert(
        "NOTIFICACAO ENVIADA!\n\n" +
          "Os usuários com app aberto vão receber em até 3 segundos.\n\n" +
          "Importante:\n" +
          "- A notificação aparece dentro do app.\n" +
          "- Com app totalmente fechado, depende de Service Worker."
      );
    },
    onError: () => {
      setSending(false);
      alert("Erro ao enviar notificação. Tente novamente.");
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId) => base44.entities.PushNotification.delete(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["push-notifications"] });
    },
  });

  const handleSend = () => {
    if (!title.trim() || !message.trim()) {
      alert("Preencha o titulo e a mensagem.");
      return;
    }

    const confirmed = confirm(
      `ENVIAR NOTIFICACAO?\n\nTitulo: ${title}\nMensagem: ${message}\n\n` +
        "Usuários com app aberto recebem em até 3 segundos."
    );
    if (!confirmed) return;

    setSending(true);
    sendNotificationMutation.mutate({ title, message });
  };

  const handleDelete = (notificationId) => {
    if (confirm("Tem certeza que deseja remover este registro do histórico?")) {
      deleteNotificationMutation.mutate(notificationId);
    }
  };

  const sendTestNotification = async () => {
    setSending(true);
    await sendNotificationMutation.mutateAsync({
      title: "Teste de Notificacao",
      message: "Se você está vendo isso, as notificações estão funcionando.",
    });
    setSending(false);
  };

  const checkPermissions = () => {
    if (!("Notification" in window)) {
      alert("Este navegador não suporta notificações.");
      return;
    }

    const permission = Notification.permission;
    if (permission === "granted") {
      alert(
        "Notificacoes ativas.\n\n" +
          "Sistema atual:\n" +
          "- In-app com verificacao a cada 3 segundos.\n" +
          "- Funciona com app aberto/minimizado."
      );
      return;
    }

    if (permission === "denied") {
      alert(
        "Notificacoes bloqueadas no navegador.\n\n" +
          "Mas as notificações in-app continuam funcionando com app aberto."
      );
      return;
    }

    Notification.requestPermission().then((result) => {
      if (result === "granted") {
        new Notification("Notificacoes ativadas!", {
          body: "Agora você pode enviar notificações.",
          icon: "/icon-192x192.png",
        });
      }
    });
  };

  return (
    <div className="space-y-6 mt-6">
      <Card className="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 border-blue-700/50 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Bell className="w-6 h-6 text-cyan-400" />
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-300">
            Posts do Início
          </h2>
        </div>

        <div className="mb-6 p-4 bg-blue-900/30 border border-blue-700/50 rounded-lg">
          <div className="flex items-start gap-2">
            <Zap className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-blue-300">Sistema de posts e notificações ativo</p>
              <ul className="text-xs text-blue-200 mt-2 space-y-1 list-disc list-inside">
                <li>O post aparece no menu Início automaticamente</li>
                <li>Os usuários recebem notificação de aviso</li>
                <li>Ao clicar na notificação, abre o post no Início</li>
              </ul>
              <div className="mt-3 flex gap-2">
                <Button
                  onClick={checkPermissions}
                  size="sm"
                  variant="outline"
                  className="border-cyan-600 text-cyan-300 hover:bg-cyan-900/30"
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Verificar Status
                </Button>
                <Button
                  onClick={sendTestNotification}
                  disabled={sending}
                  size="sm"
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Enviar Teste
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <Label htmlFor="title" className="text-blue-200">
              Titulo do Post
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Sorteio ao Vivo Agora!"
              maxLength={50}
              className="bg-blue-900/50 border-blue-700 text-white placeholder:text-blue-400"
            />
            <p className="text-xs text-blue-300 mt-1">{title.length}/50 caracteres</p>
          </div>

          <div>
            <Label htmlFor="message" className="text-blue-200">
              Conteudo do Post
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: Entre agora no app e participe do sorteio ao vivo!"
              maxLength={200}
              rows={4}
              className="bg-blue-900/50 border-blue-700 text-white placeholder:text-blue-400"
            />
            <p className="text-xs text-blue-300 mt-1">{message.length}/200 caracteres</p>
            <p className="text-xs text-cyan-300 mt-1">
              Formatos aceitos no post: **negrito**, links (https://...) e quebra de linha.
            </p>
          </div>
        </div>

        <Button
          onClick={handleSend}
          disabled={sending || !title.trim() || !message.trim()}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-lg py-6"
        >
          <Send className="w-5 h-5 mr-2" />
          {sending ? "Publicando..." : "Publicar Post"}
        </Button>
      </Card>

      <Card className="bg-gradient-to-br from-green-900/50 to-teal-900/50 border-green-700/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <h3 className="text-xl font-bold text-green-300">Como Funciona</h3>
        </div>
        <div className="space-y-3 text-sm text-green-200">
          <div className="p-3 bg-green-900/30 border border-green-700/50 rounded-lg">
            <p className="font-bold mb-1">1. Você publica o post</p>
            <p className="text-xs">O post é salvo e aparece no Início.</p>
          </div>
          <div className="p-3 bg-green-900/30 border border-green-700/50 rounded-lg">
            <p className="font-bold mb-1">2. Usuarios recebem notificação</p>
            <p className="text-xs">Quem estiver no app recebe o aviso automaticamente.</p>
          </div>
          <div className="p-3 bg-green-900/30 border border-green-700/50 rounded-lg">
            <p className="font-bold mb-1">3. Clique abre o post</p>
            <p className="text-xs">Ao clicar no aviso, o app abre o post no menu Início.</p>
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border-purple-700/50 p-6">
        <h3 className="text-xl font-bold text-purple-300 mb-4">
          Histórico de Posts ({notifications.length})
        </h3>

        {notifications.length === 0 ? (
          <div className="text-center p-8 text-purple-300">Nenhum post publicado ainda.</div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex items-start justify-between p-4 bg-purple-900/30 border border-purple-700/50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Bell className="w-4 h-4 text-purple-400" />
                    <h4 className="font-bold text-purple-200">{notification.title}</h4>
                    <Badge className="bg-green-600 text-xs">Enviada</Badge>
                  </div>
                  <p className="text-sm text-purple-300 mb-2">{notification.message}</p>
                  <p className="text-xs text-purple-400">
                    {format(new Date(notification.sent_at), "dd/MM/yyyy HH:mm:ss")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(notification.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/30"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

