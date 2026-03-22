import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44, resolveAssetUrl } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  ImageUp,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  Save,
  Shield,
  ShieldCheck,
  Smartphone,
  Star,
  Trash2,
  UserCog,
  XCircle,
} from "lucide-react";
import TechLoader from "@/components/TechLoader";
import { isHandleAvailable, loadProfilePrefs, normalizeHandle, reserveHandle, saveProfilePrefs } from "@/lib/profilePrefs";
import { generateCroppedProfileImage } from "@/lib/profileImageCrop";
import {
  getSoundPrefs,
  setInteractionSoundEnabled,
  setMenuSoundEnabled,
} from "@/lib/soundPrefs";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import LegalLinksBar from "@/components/LegalLinksBar";

const avatarModules = import.meta.glob("../../assets-para-app/avatar/*.png", {
  eager: true,
  import: "default",
});

const avatarOptions = Object.entries(avatarModules)
  .map(([path, src]) => ({
    id: path.split("/").pop().replace(".png", ""),
    src,
    isFeatured: path.toLowerCase().includes("destaque"),
  }))
  .sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

const DEFAULT_AVATAR_ID =
  avatarOptions.find((item) => item.id.toLowerCase().includes("avatar padrao perfil sem foto"))?.id ||
  avatarOptions[0]?.id ||
  "";
const TWO_FACTOR_SETUP_CACHE_KEY = "souza_2fa_setup_cache";
const SUPPORTED_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif)$/i;
const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const PHOTO_PREVIEW_SIZE = 208;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getAvatarMotionVars(id) {
  const text = String(id || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  const base = Math.abs(hash);
  const duration = 4.6 + (base % 18) / 10;
  const delay = ((base >> 3) % 24) / 10;
  const drift = ((base >> 5) % 9) - 4;
  const scale = 1 + ((base >> 7) % 6) / 1000;

  return {
    "--avatar-float-duration": `${duration}s`,
    "--avatar-float-delay": `-${delay}s`,
    "--avatar-float-drift": `${drift}px`,
    "--avatar-float-scale": String(scale),
  };
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: authUser, isLoadingAuth } = useAuth();
  const [user, setUser] = useState(null);
  const [privatePhotoPreview, setPrivatePhotoPreview] = useState("");
  const [isPrivatePreviewLoading, setIsPrivatePreviewLoading] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState("");
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState("");
  const [selectedPhotoZoom, setSelectedPhotoZoom] = useState(1);
  const [selectedPhotoNaturalSize, setSelectedPhotoNaturalSize] = useState({ width: 0, height: 0 });
  const [selectedPhotoOffsetX, setSelectedPhotoOffsetX] = useState(0);
  const [selectedPhotoOffsetY, setSelectedPhotoOffsetY] = useState(0);
  const [photoDragState, setPhotoDragState] = useState(null);
  const photoPreviewDragRef = useRef(null);
  const avatarStripRef = useRef(null);
  const avatarDragRef = useRef({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [profilePreviewFallbackStep, setProfilePreviewFallbackStep] = useState(0);
  const [approvedPhotoUrls, setApprovedPhotoUrls] = useState([]);
  const [selectedApprovedPhotoUrl, setSelectedApprovedPhotoUrl] = useState("");
  const [removedApprovedPhotoUrls, setRemovedApprovedPhotoUrls] = useState([]);
  const [formData, setFormData] = useState({
    full_name: "",
    nick: "",
    phone: "",
    platform_id: "",
    alias: "",
    handle: "",
    avatarId: "",
  });
  const [imageMode, setImageMode] = useState("avatar");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditDataModalOpen, setIsEditDataModalOpen] = useState(false);
  const [isPlatformIdsModalOpen, setIsPlatformIdsModalOpen] = useState(false);
  const [platformIdsModalTop, setPlatformIdsModalTop] = useState(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordModalTop, setPasswordModalTop] = useState(null);
  const [isTwoFactorModalOpen, setIsTwoFactorModalOpen] = useState(false);
  const [twoFactorModalTop, setTwoFactorModalTop] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [editingHistoryId, setEditingHistoryId] = useState("");
  const [editingHistoryForm, setEditingHistoryForm] = useState({ platform_name: "", platform_id: "" });
  const [newHistoryForm, setNewHistoryForm] = useState({ platform_name: "", platform_id: "" });
  const [twoFactorSetup, setTwoFactorSetup] = useState(null);
  const [twoFactorOtp, setTwoFactorOtp] = useState("");
  const [twoFactorDisableOtp, setTwoFactorDisableOtp] = useState("");
  const [twoFactorDiag, setTwoFactorDiag] = useState(null);
  const [copiedField, setCopiedField] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswordFields, setShowPasswordFields] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [soundPrefs, setSoundPrefs] = useState(() => getSoundPrefs());

  const { data: platformHistory = [] } = useQuery({
    queryKey: ["platform-history", user?.id],
    queryFn: () => base44.entities.PlatformHistory.filter({ user_id: user.id }, "-created_date"),
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const photoPreviewMetrics = useMemo(() => {
    const width = Number(selectedPhotoNaturalSize.width || 0);
    const height = Number(selectedPhotoNaturalSize.height || 0);
    if (!width || !height) {
      return {
        drawWidth: PHOTO_PREVIEW_SIZE * selectedPhotoZoom,
        drawHeight: PHOTO_PREVIEW_SIZE * selectedPhotoZoom,
        maxOffsetX: 0,
        maxOffsetY: 0,
      };
    }

    const baseScale = Math.max(PHOTO_PREVIEW_SIZE / width, PHOTO_PREVIEW_SIZE / height);
    const drawWidth = width * baseScale * selectedPhotoZoom;
    const drawHeight = height * baseScale * selectedPhotoZoom;
    return {
      drawWidth,
      drawHeight,
      maxOffsetX: Math.max(0, (drawWidth - PHOTO_PREVIEW_SIZE) / 2),
      maxOffsetY: Math.max(0, (drawHeight - PHOTO_PREVIEW_SIZE) / 2),
    };
  }, [selectedPhotoNaturalSize.width, selectedPhotoNaturalSize.height, selectedPhotoZoom]);

  useEffect(() => {
    if (!authUser) return;
    const prefs = loadProfilePrefs(authUser.id);
    setUser(authUser);
    setFormData({
      full_name: authUser.full_name || "",
      nick: authUser.nick || "",
      phone: authUser.phone || "",
      platform_id: authUser.platform_id || "",
      alias: prefs.alias || "",
      handle: prefs.handle || authUser.nick?.toLowerCase().replace(/\s+/g, "") || "usuario",
      avatarId: prefs.avatarId || authUser.profile_avatar_id || DEFAULT_AVATAR_ID,
    });
    setApprovedPhotoUrls(Array.isArray(prefs.approvedPhotoUrls) ? prefs.approvedPhotoUrls : []);
    setSelectedApprovedPhotoUrl(prefs.selectedPhotoUrl || "");
    setRemovedApprovedPhotoUrls(
      Array.isArray(prefs.removedApprovedPhotoUrls) ? prefs.removedApprovedPhotoUrls : []
    );
    setImageMode(authUser.profile_image_mode || "avatar");
  }, [authUser]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TWO_FACTOR_SETUP_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const expiresAt = Number(parsed?.expires_at || 0);
      if (!parsed?.secret || !parsed?.otpauth_url || !expiresAt || Date.now() > expiresAt) {
        window.localStorage.removeItem(TWO_FACTOR_SETUP_CACHE_KEY);
        return;
      }
      setTwoFactorSetup({
        secret: parsed.secret,
        otpauth_url: parsed.otpauth_url,
        message: parsed.message || "",
      });
    } catch {
      window.localStorage.removeItem(TWO_FACTOR_SETUP_CACHE_KEY);
    }
  }, []);

  useEffect(() => {
    let revokedUrl = "";
    let active = true;

    async function loadPrivatePreview() {
      const shouldLoad = user?.profile_image_status === "manual_review" || user?.profile_image_status === "pending";

      if (!shouldLoad) {
        setPrivatePhotoPreview("");
        setIsPrivatePreviewLoading(false);
        return;
      }

      try {
        setIsPrivatePreviewLoading(true);
        const blob = await base44.auth.getMyPrivateProfileImage();
        revokedUrl = URL.createObjectURL(blob);
        if (active) setPrivatePhotoPreview(revokedUrl);
      } catch {
        if (active) setPrivatePhotoPreview("");
      } finally {
        if (active) setIsPrivatePreviewLoading(false);
      }
    }

    loadPrivatePreview();

    return () => {
      active = false;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [imageMode, user?.profile_image_status, user?.profile_image_uploaded_at]);

  useEffect(() => {
    if (!isPlatformIdsModalOpen) {
      setPlatformIdsModalTop(null);
      return;
    }

    const updateModalTop = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setPlatformIdsModalTop(null);
        return;
      }
      const centerY = vv.offsetTop + vv.height / 2;
      setPlatformIdsModalTop(Math.round(centerY));
    };

    updateModalTop();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", updateModalTop);
    vv?.addEventListener("scroll", updateModalTop);
    window.addEventListener("orientationchange", updateModalTop);

    return () => {
      vv?.removeEventListener("resize", updateModalTop);
      vv?.removeEventListener("scroll", updateModalTop);
      window.removeEventListener("orientationchange", updateModalTop);
    };
  }, [isPlatformIdsModalOpen]);

  useEffect(() => {
    if (!isPasswordModalOpen) {
      setPasswordModalTop(null);
      return;
    }

    const updateModalTop = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setPasswordModalTop(null);
        return;
      }
      const centerY = vv.offsetTop + vv.height / 2;
      setPasswordModalTop(Math.round(centerY));
    };

    updateModalTop();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", updateModalTop);
    vv?.addEventListener("scroll", updateModalTop);
    window.addEventListener("orientationchange", updateModalTop);

    return () => {
      vv?.removeEventListener("resize", updateModalTop);
      vv?.removeEventListener("scroll", updateModalTop);
      window.removeEventListener("orientationchange", updateModalTop);
    };
  }, [isPasswordModalOpen]);

  useEffect(() => {
    if (!isTwoFactorModalOpen) {
      setTwoFactorModalTop(null);
      return;
    }

    const updateModalTop = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setTwoFactorModalTop(null);
        return;
      }
      const centerY = vv.offsetTop + vv.height / 2;
      setTwoFactorModalTop(Math.round(centerY));
    };

    updateModalTop();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", updateModalTop);
    vv?.addEventListener("scroll", updateModalTop);
    window.addEventListener("orientationchange", updateModalTop);

    return () => {
      vv?.removeEventListener("resize", updateModalTop);
      vv?.removeEventListener("scroll", updateModalTop);
      window.removeEventListener("orientationchange", updateModalTop);
    };
  }, [isTwoFactorModalOpen]);

  useEffect(() => {
    return () => {
      if (selectedPhotoPreview) {
        URL.revokeObjectURL(selectedPhotoPreview);
      }
      if (pendingPhotoPreview) {
        URL.revokeObjectURL(pendingPhotoPreview);
      }
    };
  }, [selectedPhotoPreview, pendingPhotoPreview]);

  useEffect(() => {
    if (imageMode !== "photo" && selectedPhotoPreview) {
      setSelectedPhotoFile(null);
      setSelectedPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      setSelectedPhotoNaturalSize({ width: 0, height: 0 });
      setSelectedPhotoZoom(1);
      setSelectedPhotoOffsetX(0);
      setSelectedPhotoOffsetY(0);
    }
  }, [imageMode, selectedPhotoPreview]);

  useEffect(() => {
    if (selectedPhotoPreview) return;
    setPhotoDragState(null);
    photoPreviewDragRef.current = null;
  }, [selectedPhotoPreview]);

  useEffect(() => {
    const isPendingStatus = user?.profile_image_status === "manual_review" || user?.profile_image_status === "pending";
    if (isPendingStatus) return;
    setPendingPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
  }, [user?.profile_image_status]);

  useEffect(() => {
    setSelectedPhotoOffsetX((prev) => clamp(prev, -photoPreviewMetrics.maxOffsetX, photoPreviewMetrics.maxOffsetX));
    setSelectedPhotoOffsetY((prev) => clamp(prev, -photoPreviewMetrics.maxOffsetY, photoPreviewMetrics.maxOffsetY));
  }, [photoPreviewMetrics.maxOffsetX, photoPreviewMetrics.maxOffsetY]);

  useEffect(() => {
    if (!user?.id) return;
    if (user.profile_image_status !== "approved" || !user.profile_image_url) return;

    const approvedUrl = user.profile_image_url;
    if (removedApprovedPhotoUrls.includes(approvedUrl)) return;

    setApprovedPhotoUrls((prev) => {
      const next = prev.includes(approvedUrl) ? prev : [approvedUrl, ...prev];
      saveProfilePrefs(user.id, {
        approvedPhotoUrls: next,
        removedApprovedPhotoUrls,
      });
      return next;
    });

    setSelectedApprovedPhotoUrl((prevSelected) => {
      const hasValidSelection = !!prevSelected && !removedApprovedPhotoUrls.includes(prevSelected);
      const nextSelected = hasValidSelection ? prevSelected : approvedUrl;
      saveProfilePrefs(user.id, {
        selectedPhotoUrl: nextSelected,
        removedApprovedPhotoUrls,
      });
      return nextSelected;
    });
  }, [user?.id, user?.profile_image_status, user?.profile_image_url, removedApprovedPhotoUrls]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const nextHandle = normalizeHandle(formData.handle) || "usuario";
      if (!isHandleAvailable(nextHandle, user.id)) {
        throw new Error("@ ja esta em uso. Escolha outro.");
      }

      await base44.auth.updateMe({
        full_name: formData.full_name,
        nick: formData.nick,
        phone: formData.phone,
        platform_id: formData.platform_id,
        profile_image_mode: imageMode,
        profile_avatar_id: formData.avatarId,
      });

      reserveHandle(user.id, nextHandle);
      saveProfilePrefs(user.id, {
        alias: formData.alias.trim(),
        handle: nextHandle,
        avatarId: formData.avatarId,
      });
    },
    onSuccess: () => {
      setUser((prev) => ({
        ...prev,
        full_name: formData.full_name,
        nick: formData.nick,
        phone: formData.phone,
        platform_id: formData.platform_id,
        profile_image_mode: imageMode,
        profile_avatar_id: formData.avatarId,
      }));
      queryClient.invalidateQueries({ queryKey: ["inicio-users"] });
      setIsEditDataModalOpen(false);
      toast({
        title: "Configurações salvas",
        description: "Seus dados foram atualizados com sucesso.",
      });
    },
    onError: (error) => {
      console.error("Error saving settings:", error);
      toast({
        variant: "destructive",
        title: "Falha ao salvar",
        description: error?.message || "Não foi possível salvar agora.",
      });
    },
  });

  const selectedAvatar = useMemo(
    () =>
      avatarOptions.find((item) => item.id === formData.avatarId) ||
      avatarOptions.find((item) => item.id === DEFAULT_AVATAR_ID) ||
      avatarOptions[0],
    [formData.avatarId]
  );

  useEffect(() => {
    setProfilePreviewFallbackStep(0);
  }, [
    imageMode,
    selectedPhotoPreview,
    user?.profile_image_status,
    user?.profile_image_url,
    privatePhotoPreview,
    selectedAvatar?.src,
  ]);

  const uploadImageMutation = useMutation({
    mutationFn: (file) => base44.auth.uploadProfileImage(file),
    onSuccess: (response) => {
      const isPendingStatus = response?.user?.profile_image_status === "manual_review" || response?.user?.profile_image_status === "pending";
      if (response?.user) {
        setUser(response.user);
        setImageMode(response.user.profile_image_mode || "photo");
      }
      queryClient.invalidateQueries({ queryKey: ["inicio-users"] });
      setSelectedPhotoFile(null);
      setSelectedPhotoPreview((prev) => {
        if (isPendingStatus) {
          setPendingPhotoPreview((pendingPrev) => {
            if (pendingPrev && pendingPrev !== prev) URL.revokeObjectURL(pendingPrev);
            return prev || "";
          });
          return "";
        }
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      setSelectedPhotoNaturalSize({ width: 0, height: 0 });
      setSelectedPhotoZoom(1);
      setSelectedPhotoOffsetX(0);
      setSelectedPhotoOffsetY(0);
      toast({
        title: "Foto enviada",
        description: "Acompanhe o status de moderação abaixo.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha no envio",
        description: error?.message || "Falha ao enviar foto.",
      });
    },
  });

  const cancelPendingImageMutation = useMutation({
    mutationFn: () => base44.auth.cancelMyPendingProfileImage(),
    onSuccess: (response) => {
      if (response?.user) {
        setUser(response.user);
      }
      setPrivatePhotoPreview("");
      setPendingPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      toast({
        title: "Envio cancelado",
        description: "Você pode selecionar outra foto.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha ao cancelar",
        description: error?.message || "Não foi possível cancelar o envio agora.",
      });
    },
  });

  const updatePlatformHistoryMutation = useMutation({
    mutationFn: async () => {
      if (!editingHistoryId) return;
      const nextName = editingHistoryForm.platform_name.trim();
      const nextId = editingHistoryForm.platform_id.trim();

      if (!nextName || !nextId) {
        throw new Error("Preencha plataforma e ID.");
      }

      await base44.entities.PlatformHistory.update(editingHistoryId, {
        platform_name: nextName,
        platform_id: nextId,
      });
    },
    onSuccess: async () => {
      setEditingHistoryId("");
      setEditingHistoryForm({ platform_name: "", platform_id: "" });
      await queryClient.invalidateQueries({ queryKey: ["platform-history", user?.id] });
      toast({
        title: "ID atualizado",
        description: "A lista de IDs foi atualizada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha ao atualizar",
        description: error?.message || "Não foi possível atualizar o ID.",
      });
    },
  });

  const deletePlatformHistoryMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.PlatformHistory.delete(id);
    },
    onSuccess: async () => {
      if (editingHistoryId) {
        setEditingHistoryId("");
        setEditingHistoryForm({ platform_name: "", platform_id: "" });
      }
      await queryClient.invalidateQueries({ queryKey: ["platform-history", user?.id] });
      toast({
        title: "ID removido",
        description: "O ID foi excluido da sua lista.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha ao excluir",
        description: error?.message || "Não foi possível excluir o ID.",
      });
    },
  });

  const createPlatformHistoryMutation = useMutation({
    mutationFn: async () => {
      const nextName = newHistoryForm.platform_name.trim();
      const nextId = newHistoryForm.platform_id.trim();

      if (!user?.id) {
        throw new Error("Usuário não encontrado.");
      }
      if (!nextName || !nextId) {
        throw new Error("Preencha plataforma e ID.");
      }

      await base44.entities.PlatformHistory.create({
        user_id: user.id,
        platform_name: nextName,
        platform_id: nextId,
      });
    },
    onSuccess: async () => {
      setNewHistoryForm({ platform_name: "", platform_id: "" });
      await queryClient.invalidateQueries({ queryKey: ["platform-history", user?.id] });
      toast({
        title: "ID adicionado",
        description: "Novo ID salvo com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha ao adicionar",
        description: error?.message || "Não foi possível adicionar o ID.",
      });
    },
  });

  const handleLogout = () => {
    base44.auth.logout();
  };

  const handleDeleteModalChange = (open) => {
    if (deleteAccountMutation.isPending || deactivateAccountMutation.isPending) return;
    setIsDeleteModalOpen(open);
    if (!open) {
      setDeleteConfirmText("");
    }
  };

  const deactivateAccountMutation = useMutation({
    mutationFn: () => base44.auth.deactivateMe(),
    onSuccess: () => {
      toast({
        title: "Conta desativada",
        description: "Sua conta foi desativada. Ao fazer login novamente, ela será reativada.",
      });
      setIsDeleteModalOpen(false);
      base44.auth.logout("/login");
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha ao desativar",
        description: error?.message || "Não foi possível desativar a conta agora.",
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => base44.auth.deleteMe(),
    onSuccess: () => {
      toast({
        title: "Conta excluida",
        description: "Sua conta foi removida com sucesso.",
      });
      setIsDeleteModalOpen(false);
      base44.auth.logout("/login");
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha ao excluir",
        description: error?.message || "Não foi possível excluir a conta agora.",
      });
    },
  });

  const setupTwoFactorMutation = useMutation({
    mutationFn: () => base44.auth.setup2FA(),
    onSuccess: (data) => {
      setTwoFactorSetup(data || null);
      setTwoFactorOtp("");
      try {
        if (data?.secret && data?.otpauth_url) {
          window.localStorage.setItem(
            TWO_FACTOR_SETUP_CACHE_KEY,
            JSON.stringify({
              ...data,
              expires_at: Date.now() + 20 * 60 * 1000,
            })
          );
        }
      } catch {
        // ignore storage failures
      }
      toast({
        title: "2FA configurado",
        description: "Agora confirme com o código do app autenticador.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha no 2FA",
        description: error?.message || "Não foi possível iniciar a configuração do 2FA.",
      });
    },
  });

  const enableTwoFactorMutation = useMutation({
    mutationFn: (otp) => base44.auth.enable2FA(otp),
    onSuccess: () => {
      setUser((prev) => ({ ...prev, two_factor_enabled: true }));
      setTwoFactorSetup(null);
      setTwoFactorOtp("");
      setTwoFactorDiag(null);
      window.localStorage.removeItem(TWO_FACTOR_SETUP_CACHE_KEY);
      setIsTwoFactorModalOpen(false);
      toast({
        title: "2FA ativado",
        description: "No próximo login será solicitado o código do autenticador.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Código inválido",
        description: error?.message || "Não foi possível ativar o 2FA.",
      });
    },
  });

  const disableTwoFactorMutation = useMutation({
    mutationFn: (otp) => base44.auth.disable2FA(otp),
    onSuccess: () => {
      setUser((prev) => ({ ...prev, two_factor_enabled: false }));
      setTwoFactorDisableOtp("");
      setTwoFactorSetup(null);
      setTwoFactorDiag(null);
      window.localStorage.removeItem(TWO_FACTOR_SETUP_CACHE_KEY);
      toast({
        title: "2FA desativado",
        description: "Sua conta voltou para login somente com email e senha.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha ao desativar",
        description: error?.message || "Não foi possível desativar o 2FA.",
      });
    },
  });

  const diagnoseTwoFactorMutation = useMutation({
    mutationFn: (otp) => base44.auth.diagnose2FA(otp),
    onSuccess: (data) => {
      setTwoFactorDiag(data || null);
      toast({
        title: data?.is_valid ? "Diagnóstico: código válido" : "Diagnóstico: código inválido",
        description: data?.hint || "Diagnóstico concluído.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha no diagnóstico",
        description: error?.message || "Não foi possível diagnosticar o 2FA agora.",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const currentPassword = String(passwordForm.currentPassword || "");
      const newPassword = String(passwordForm.newPassword || "");
      const confirmPassword = String(passwordForm.confirmPassword || "");

      if (!currentPassword) throw new Error("Digite sua senha atual.");
      if (!newPassword) throw new Error("Digite a nova senha.");
      if (newPassword.length < 8) throw new Error("A nova senha deve ter ao menos 8 caracteres.");
      if (newPassword !== confirmPassword) throw new Error("A confirmação da nova senha não confere.");
      if (newPassword === currentPassword) throw new Error("A nova senha deve ser diferente da atual.");

      await base44.auth.changePassword(currentPassword, newPassword);
    },
    onSuccess: () => {
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setIsPasswordModalOpen(false);
      toast({
        title: "Senha alterada",
        description: "Sua senha foi atualizada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Falha ao alterar senha",
        description: error?.message || "Não foi possível alterar a senha agora.",
      });
    },
  });

  const handleCopy = async (value, fieldId) => {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(""), 1200);
      toast({
        title: "Copiado",
        description: "Texto copiado para a área de transferência.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Falha ao copiar",
        description: "Copie manualmente esse valor.",
      });
    }
  };

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const normalizedType = String(file.type || "").toLowerCase();
    const isSupportedType =
      (normalizedType && SUPPORTED_IMAGE_MIME_TYPES.has(normalizedType)) ||
      SUPPORTED_IMAGE_EXTENSIONS.test(String(file.name || ""));

    if (!isSupportedType) {
      toast({
        variant: "destructive",
        title: "Formato não suportado",
        description: "Use uma imagem JPG, PNG, WEBP ou GIF.",
      });
      event.target.value = "";
      return;
    }

    if (selectedPhotoPreview) {
      URL.revokeObjectURL(selectedPhotoPreview);
    }
    setPendingPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });

    const previewUrl = URL.createObjectURL(file);
    const imageProbe = new Image();
    imageProbe.onload = () => {
      setSelectedPhotoNaturalSize({
        width: imageProbe.naturalWidth || imageProbe.width || 0,
        height: imageProbe.naturalHeight || imageProbe.height || 0,
      });
    };
    imageProbe.onerror = () => {
      setSelectedPhotoNaturalSize({ width: 0, height: 0 });
    };
    imageProbe.src = previewUrl;

    setSelectedPhotoFile(file);
    setSelectedPhotoPreview(previewUrl);
    setSelectedPhotoZoom(1);
    setSelectedPhotoOffsetX(0);
    setSelectedPhotoOffsetY(0);
    setImageMode("photo");
  };

  const handlePhotoPreviewPointerDown = (event) => {
    if (!selectedPhotoPreview) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    photoPreviewDragRef.current = event.currentTarget;
    setPhotoDragState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialOffsetX: selectedPhotoOffsetX,
      initialOffsetY: selectedPhotoOffsetY,
    });
  };

  const handlePhotoPreviewPointerMove = (event) => {
    if (!photoDragState || event.pointerId !== photoDragState.pointerId) return;
    const deltaX = event.clientX - photoDragState.startX;
    const deltaY = event.clientY - photoDragState.startY;
    const nextX = clamp(
      Math.round(photoDragState.initialOffsetX + deltaX),
      -photoPreviewMetrics.maxOffsetX,
      photoPreviewMetrics.maxOffsetX
    );
    const nextY = clamp(
      Math.round(photoDragState.initialOffsetY + deltaY),
      -photoPreviewMetrics.maxOffsetY,
      photoPreviewMetrics.maxOffsetY
    );
    setSelectedPhotoOffsetX(nextX);
    setSelectedPhotoOffsetY(nextY);
  };

  const handlePhotoPreviewPointerUp = (event) => {
    if (!photoDragState || event.pointerId !== photoDragState.pointerId) return;
    photoPreviewDragRef.current?.releasePointerCapture?.(event.pointerId);
    photoPreviewDragRef.current = null;
    setPhotoDragState(null);
  };

  const handleAvatarPointerDown = (event) => {
    const container = avatarStripRef.current;
    if (!container) return;
    if (event.button !== 0) return;

    avatarDragRef.current = {
      isDragging: true,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
      moved: false,
    };
  };

  const handleAvatarPointerMove = (event) => {
    const container = avatarStripRef.current;
    const state = avatarDragRef.current;
    if (!container || !state.isDragging) return;

    const deltaX = event.clientX - state.startX;
    if (Math.abs(deltaX) <= 6) return;
    avatarDragRef.current.moved = true;
    container.scrollLeft = state.startScrollLeft - deltaX;
    event.preventDefault();
  };

  const handleAvatarPointerUpOrCancel = (event) => {
    void event;
    avatarDragRef.current.isDragging = false;
  };

  const handleAvatarClickCapture = (event) => {
    if (avatarDragRef.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      avatarDragRef.current.moved = false;
    }
  };

  const handleAvatarWheel = (event) => {
    const container = avatarStripRef.current;
    if (!container) return;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      container.scrollLeft += event.deltaY;
      event.preventDefault();
    }
  };

  const handleUploadSelectedPhoto = async () => {
    if (!selectedPhotoFile) return;
    try {
      setIsPreparingPhoto(true);
      const cropped = await generateCroppedProfileImage(selectedPhotoFile, {
        zoom: selectedPhotoZoom,
        offsetX: selectedPhotoOffsetX,
        offsetY: selectedPhotoOffsetY,
      });
      uploadImageMutation.mutate(cropped);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Falha ao preparar imagem",
        description: error?.message || "Não foi possível preparar a foto.",
      });
    } finally {
      setIsPreparingPhoto(false);
    }
  };

  const handleRemoveApprovedPhoto = (urlToRemove) => {
    const nextApproved = approvedPhotoUrls.filter((url) => url !== urlToRemove);
    const nextRemoved = removedApprovedPhotoUrls.includes(urlToRemove)
      ? removedApprovedPhotoUrls
      : [urlToRemove, ...removedApprovedPhotoUrls];
    const nextSelected = selectedApprovedPhotoUrl === urlToRemove ? "" : selectedApprovedPhotoUrl;

    setApprovedPhotoUrls(nextApproved);
    setRemovedApprovedPhotoUrls(nextRemoved);
    setSelectedApprovedPhotoUrl(nextSelected);

    saveProfilePrefs(user.id, {
      approvedPhotoUrls: nextApproved,
      removedApprovedPhotoUrls: nextRemoved,
      selectedPhotoUrl: nextSelected,
    });
  };

  if (!user) {
    return <TechLoader />;
  }

  const profileImageStatus = user.profile_image_status || "none";
  const pendingPhotoSrc = privatePhotoPreview || pendingPhotoPreview;
  const statusLabelMap = {
    none: "Nenhuma foto enviada",
    approved: "Foto aprovada",
    manual_review: "Em análise de moderação",
    pending: "Em análise de moderação",
    rejected: "Foto rejeitada",
  };
  const profilePreviewSrc =
    user.profile_image_status === "manual_review" || user.profile_image_status === "pending"
      ? privatePhotoPreview || pendingPhotoPreview || selectedPhotoPreview || selectedAvatar?.src
      : imageMode === "photo"
      ? selectedPhotoPreview ||
        (user.profile_image_status === "approved" && (selectedApprovedPhotoUrl || user.profile_image_url)
        ? resolveAssetUrl(selectedApprovedPhotoUrl || user.profile_image_url)
        : selectedAvatar?.src)
      : selectedAvatar?.src;
  const secondaryProfilePreviewSrc =
    user.profile_image_status === "approved" &&
    user.profile_image_url &&
    resolveAssetUrl(user.profile_image_url) !== profilePreviewSrc
      ? resolveAssetUrl(user.profile_image_url)
      : "";
  const safeProfilePreviewSrc =
    profilePreviewFallbackStep === 0
      ? profilePreviewSrc
      : profilePreviewFallbackStep === 1 && secondaryProfilePreviewSrc
      ? secondaryProfilePreviewSrc
      : selectedAvatar?.src;
  const twoFactorQrUrl = twoFactorSetup?.otpauth_url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(twoFactorSetup.otpauth_url)}`
    : "";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-indigo-500/15 to-slate-900 px-4 py-4">
        <h1 className="text-lg font-bold">Configurações da Conta</h1>
        <p className="text-sm text-slate-400">Edite seus dados completos e privados aqui.</p>
      </div>

      <Card className="border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-slate-700 bg-slate-800">
            {safeProfilePreviewSrc ? (
              <img
                src={safeProfilePreviewSrc}
                alt="Imagem de perfil"
                className="h-full w-full object-cover"
                onError={() => setProfilePreviewFallbackStep((step) => Math.min(step + 1, 2))}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl">{user?.avatar_emoji || "U"}</div>
            )}
          </div>
          <div>
            <p className="font-semibold text-white">{formData.nick || user?.full_name || "Usuario"}</p>
            <p className="text-xs text-slate-400">{user?.email || ""}</p>
            <p className="text-[11px] text-cyan-300">{statusLabelMap[profileImageStatus] || profileImageStatus}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setImageMode("avatar");
              setIsEditDataModalOpen(true);
            }}
            className="aspect-square rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-3 text-left transition hover:bg-cyan-500/20"
          >
            <UserCog className="mb-2 h-5 w-5 text-cyan-200" />
            <p className="text-sm font-semibold text-white">Editar dados</p>
            <p className="mt-1 text-xs text-slate-300">Nome, nick, telefone, foto e avatar.</p>
          </button>

          <button
            type="button"
            onClick={() => setIsPlatformIdsModalOpen(true)}
            className="aspect-square rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-left transition hover:bg-emerald-500/20"
          >
            <Pencil className="mb-2 h-5 w-5 text-emerald-200" />
            <p className="text-sm font-semibold text-white">IDs da plataforma</p>
            <p className="mt-1 text-xs text-slate-300">Adicionar, editar e remover IDs salvos.</p>
          </button>

          <button
            type="button"
            onClick={() => setIsPasswordModalOpen(true)}
            className="aspect-square rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-left transition hover:bg-amber-500/20"
          >
            <KeyRound className="mb-2 h-5 w-5 text-amber-200" />
            <p className="text-sm font-semibold text-white">Alterar senha</p>
            <p className="mt-1 text-xs text-slate-300">Exige sua senha atual para confirmar.</p>
          </button>

          <button
            type="button"
            onClick={() => setIsTwoFactorModalOpen(true)}
            className="aspect-square rounded-2xl border border-violet-500/40 bg-violet-500/10 p-3 text-left transition hover:bg-violet-500/20"
          >
            <ShieldCheck className="mb-2 h-5 w-5 text-violet-200" />
            <p className="text-sm font-semibold text-white">Verificação em 2 etapas</p>
            <p className="mt-1 text-xs text-slate-300">Ative e gerencie seu 2FA.</p>
          </button>
        </div>
      </Card>

      <Card className="space-y-3 border-slate-800 bg-slate-900/70 p-4">
        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
          <p className="text-sm font-semibold text-white">Sons do aplicativo</p>
          <p className="mt-1 text-xs text-slate-400">
            Controle separado para navegação de menu e interações nas páginas.
          </p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-100">Sons de menus</p>
                <p className="text-[11px] text-slate-400">Toque ao mudar de aba no menu inferior.</p>
              </div>
              <Switch
                checked={soundPrefs.menu}
                onCheckedChange={(checked) => {
                  setSoundPrefs((prev) => ({ ...prev, menu: checked }));
                  setMenuSoundEnabled(checked);
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-100">Sons de interações</p>
                <p className="text-[11px] text-slate-400">Toques em ações dentro das páginas (ex.: selos).</p>
              </div>
              <Switch
                checked={soundPrefs.interaction}
                onCheckedChange={(checked) => {
                  setSoundPrefs((prev) => ({ ...prev, interaction: checked }));
                  setInteractionSoundEnabled(checked);
                }}
              />
            </div>
          </div>
        </div>

        <Button
          onClick={() => navigate(createPageUrl("Profile"))}
          className="w-full justify-start gap-2 bg-slate-800 hover:bg-slate-700"
        >
          <UserCog className="h-4 w-4" />
          Ver perfil público
        </Button>

        {user?.role === "admin" ? (
          <Button
            onClick={() => navigate(createPageUrl("AdminPanel"))}
            className="w-full justify-start gap-2 bg-cyan-700 hover:bg-cyan-600"
          >
            <Shield className="h-4 w-4" />
            Abrir painel admin
          </Button>
        ) : null}

        <Button onClick={handleLogout} variant="destructive" className="w-full justify-start gap-2">
          <LogOut className="h-4 w-4" />
          Sair da conta
        </Button>

        <Button
          type="button"
          onClick={() => setIsDeleteModalOpen(true)}
          className="w-full justify-start gap-2 bg-rose-900/40 text-rose-200 hover:bg-rose-900/60"
        >
          <Trash2 className="h-4 w-4" />
          Excluir ou desativar conta
        </Button>
      </Card>

      <Dialog open={isEditDataModalOpen} onOpenChange={setIsEditDataModalOpen}>
        <DialogContent className="flex max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-xl flex-col overflow-hidden border border-white/10 bg-slate-900/65 p-4 text-white backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyan-200">
              <UserCog className="h-5 w-5" />
              Editar dados
            </DialogTitle>
          </DialogHeader>

          <div className="hide-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
              <Label className="text-slate-200">Imagem de perfil</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={imageMode === "avatar" ? "default" : "outline"}
                  onClick={() => setImageMode("avatar")}
                  className={imageMode === "avatar" ? "bg-cyan-700 hover:bg-cyan-600" : "border-slate-700 text-slate-300"}
                >
                  Avatar
                </Button>
                <Button
                  type="button"
                  variant={imageMode === "photo" ? "default" : "outline"}
                  onClick={() => setImageMode("photo")}
                  className={imageMode === "photo" ? "bg-cyan-700 hover:bg-cyan-600" : "border-slate-700 text-slate-300"}
                >
                  Foto
                </Button>
              </div>
            </div>

            {imageMode === "photo" ? (
              <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                <Label
                  htmlFor="profile-photo-input"
                  className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-700 bg-cyan-950/30 text-cyan-100"
                >
                  <ImageUp className="h-4 w-4" />
                  Escolher foto
                </Label>
                <Input id="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handlePhotoSelect} className="hidden" />

                {selectedPhotoPreview ? (
                  <div className="space-y-2">
                    <div
                      className="relative mx-auto h-52 w-52 touch-none overflow-hidden rounded-[1.75rem] border border-slate-700 bg-slate-950"
                      onPointerDown={handlePhotoPreviewPointerDown}
                      onPointerMove={handlePhotoPreviewPointerMove}
                      onPointerUp={handlePhotoPreviewPointerUp}
                      onPointerCancel={handlePhotoPreviewPointerUp}
                    >
                      <img
                        src={selectedPhotoPreview}
                        alt="Ajuste da foto"
                        draggable={false}
                        className="pointer-events-none absolute left-1/2 top-1/2 select-none"
                        style={{
                          width: `${photoPreviewMetrics.drawWidth}px`,
                          height: `${photoPreviewMetrics.drawHeight}px`,
                          maxWidth: "none",
                          transform: `translate(calc(-50% + ${selectedPhotoOffsetX}px), calc(-50% + ${selectedPhotoOffsetY}px))`,
                        }}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,transparent_42%,rgba(2,6,23,0.48)_43%,rgba(2,6,23,0.78)_58%,rgba(2,6,23,0.94)_100%)]" />
                      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-300/80 shadow-[0_0_24px_rgba(34,211,238,0.22)]" />
                    </div>
                    <p className="text-center text-[11px] text-slate-400">Arraste e dê zoom com a foto inteira ao fundo. O círculo mostra como ela vai aparecer no perfil.</p>
                    <div>
                      <Label className="mb-1 block text-xs text-slate-300">Zoom</Label>
                      <Input
                        type="range"
                        min={1}
                        max={3}
                        step={0.05}
                        value={selectedPhotoZoom}
                        onChange={(e) => setSelectedPhotoZoom(Number(e.target.value))}
                        className="border-slate-700"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleUploadSelectedPhoto}
                      disabled={uploadImageMutation.isPending || isPreparingPhoto}
                      className="w-full bg-cyan-700 text-white hover:bg-cyan-600"
                    >
                      {uploadImageMutation.isPending || isPreparingPhoto ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        "Enviar foto para análise"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedPhotoFile(null);
                        setSelectedPhotoPreview((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          return "";
                        });
                        setSelectedPhotoNaturalSize({ width: 0, height: 0 });
                        setSelectedPhotoZoom(1);
                        setSelectedPhotoOffsetX(0);
                        setSelectedPhotoOffsetY(0);
                      }}
                      className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Excluir foto selecionada
                    </Button>
                  </div>
                ) : null}

                {(profileImageStatus === "manual_review" || profileImageStatus === "pending") && pendingPhotoSrc ? (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-950/25 p-3">
                    <p className="mb-2 text-xs font-medium text-amber-100">Foto aguardando aprovação</p>
                    <div className="mx-auto h-24 w-24 overflow-hidden rounded-full border border-amber-300/50">
                      <img src={pendingPhotoSrc} alt="Foto aguardando aprovação" className="h-full w-full object-cover" />
                    </div>
                  </div>
                ) : null}

                {profileImageStatus === "manual_review" || profileImageStatus === "pending" ? (
                  <Button
                    type="button"
                    onClick={() => cancelPendingImageMutation.mutate()}
                    disabled={cancelPendingImageMutation.isPending}
                    className="w-full border border-amber-300/50 bg-amber-600/20 text-amber-100 hover:bg-amber-600/35"
                  >
                    {cancelPendingImageMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Cancelar envio atual
                  </Button>
                ) : null}

                {approvedPhotoUrls.length > 0 ? (
                  <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/80 p-2">
                    <p className="text-[11px] font-semibold text-slate-300">Fotos aprovadas</p>
                    <div className="grid grid-cols-4 gap-2">
                      {approvedPhotoUrls.map((url) => {
                        const isSelected = selectedApprovedPhotoUrl === url;
                        return (
                          <button
                            key={url}
                            type="button"
                            onClick={() => {
                              setSelectedApprovedPhotoUrl(url);
                              setImageMode("photo");
                              saveProfilePrefs(user.id, { selectedPhotoUrl: url });
                            }}
                            className={`relative h-16 overflow-visible rounded-lg border-2 transition ${
                              isSelected ? "border-cyan-400 ring-2 ring-cyan-400/30" : "border-slate-700 hover:border-cyan-500/60"
                            }`}
                          >
                            <img src={resolveAssetUrl(url)} alt="Foto aprovada" className="h-full w-full rounded-lg object-cover" />
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleRemoveApprovedPhoto(url);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  handleRemoveApprovedPhoto(url);
                                }
                              }}
                              className="absolute -right-2 -top-2 z-20 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-600/95 text-[10px] font-bold text-white shadow-md"
                            >
                              x
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-100">Escolher avatar</p>
                <div
                  ref={avatarStripRef}
                  data-nav-swipe-lock="true"
                  onPointerDown={handleAvatarPointerDown}
                  onPointerMove={handleAvatarPointerMove}
                  onPointerUp={handleAvatarPointerUpOrCancel}
                  onPointerCancel={handleAvatarPointerUpOrCancel}
                  onClickCapture={handleAvatarClickCapture}
                  onWheel={handleAvatarWheel}
                  className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 pr-10 touch-pan-x select-none"
                >
                  {avatarOptions.map((avatar) => {
                    const isSelected = formData.avatarId === avatar.id;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, avatarId: avatar.id }))}
                        className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border select-none ${isSelected ? "border-cyan-400" : "border-slate-700"}`}
                      >
                        <img
                          src={avatar.src}
                          alt={avatar.id}
                          draggable={false}
                          style={getAvatarMotionVars(avatar.id)}
                          className="avatar-elastic-float h-full w-full object-cover"
                        />
                        {avatar.isFeatured ? (
                          <span className="absolute left-1 top-1 rounded bg-amber-500 px-1 text-[9px] font-bold text-black">
                            Destaque
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-slate-300">Nome</Label>
                <Input value={formData.full_name} onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
              </div>
              <div>
                <Label className="mb-1 block text-slate-300">Apelido</Label>
                <Input value={formData.nick} onChange={(e) => setFormData((prev) => ({ ...prev, nick: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
              </div>
              <div>
                <Label className="mb-1 block text-slate-300">Telefone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
              </div>
              <div>
                <Label className="mb-1 block text-slate-300">Nome público</Label>
                <Input value={formData.alias} onChange={(e) => setFormData((prev) => ({ ...prev, alias: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
              </div>
              <div>
                <Label className="mb-1 block text-slate-300">@ usuário</Label>
                <Input
                  value={formData.handle}
                  onChange={(e) => setFormData((prev) => ({ ...prev, handle: normalizeHandle(e.target.value).slice(0, 24) }))}
                  className="border-slate-700 bg-slate-900 text-white"
                />
              </div>
            </div>

            <div className="sticky bottom-0 -mx-1 mt-1 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent px-1 pt-3">
              <Button type="button" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="w-full bg-cyan-700 text-white hover:bg-cyan-600">
                {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPlatformIdsModalOpen} onOpenChange={setIsPlatformIdsModalOpen}>
        <DialogContent
          style={platformIdsModalTop ? { top: `${platformIdsModalTop}px` } : undefined}
          className="w-[calc(100vw-1.5rem)] max-w-xl border border-white/10 bg-slate-900/65 p-4 text-white backdrop-blur-md max-h-[88dvh] overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-200">
              <Pencil className="h-5 w-5" />
              IDs da plataforma
            </DialogTitle>
          </DialogHeader>

          <div className="hide-scrollbar space-y-3 overflow-y-auto pr-1">
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-100">Adicionar novo ID</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={newHistoryForm.platform_name} onChange={(e) => setNewHistoryForm((prev) => ({ ...prev, platform_name: e.target.value }))} placeholder="Plataforma" className="border-slate-700 bg-slate-900 text-white" />
                <Input value={newHistoryForm.platform_id} onChange={(e) => setNewHistoryForm((prev) => ({ ...prev, platform_id: e.target.value }))} placeholder="ID" className="border-slate-700 bg-slate-900 text-white" />
              </div>
              <Button type="button" onClick={() => createPlatformHistoryMutation.mutate()} disabled={createPlatformHistoryMutation.isPending} className="mt-2 w-full bg-emerald-700 text-white hover:bg-emerald-600">
                {createPlatformHistoryMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Adicionar ID
              </Button>
            </div>

            {platformHistory.length ? (
              platformHistory.map((item) => {
                const isEditing = editingHistoryId === item.id;
                return (
                  <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input value={editingHistoryForm.platform_name} onChange={(e) => setEditingHistoryForm((prev) => ({ ...prev, platform_name: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
                        <Input value={editingHistoryForm.platform_id} onChange={(e) => setEditingHistoryForm((prev) => ({ ...prev, platform_id: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
                        <div className="grid grid-cols-3 gap-2">
                          <Button type="button" onClick={() => updatePlatformHistoryMutation.mutate()} disabled={updatePlatformHistoryMutation.isPending} className="bg-cyan-700 text-white hover:bg-cyan-600">Salvar</Button>
                          <Button type="button" variant="outline" onClick={() => { setEditingHistoryId(""); setEditingHistoryForm({ platform_name: "", platform_id: "" }); }} className="border-slate-700 text-slate-300">Cancelar</Button>
                          <Button type="button" onClick={() => deletePlatformHistoryMutation.mutate(item.id)} disabled={deletePlatformHistoryMutation.isPending} className="bg-rose-700 text-white hover:bg-rose-600">Excluir</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{item.platform_name}</p>
                          <p className="truncate text-xs text-slate-300">{item.platform_id}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setEditingHistoryId(item.id);
                              setEditingHistoryForm({ platform_name: item.platform_name || "", platform_id: item.platform_id || "" });
                            }}
                            className="h-8 border-slate-700 px-2 text-xs text-slate-300"
                          >
                            Editar
                          </Button>
                          <Button type="button" onClick={() => deletePlatformHistoryMutation.mutate(item.id)} disabled={deletePlatformHistoryMutation.isPending} className="h-8 bg-rose-700 px-2 text-xs text-white hover:bg-rose-600">Excluir</Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-300">Você ainda não adicionou IDs extras.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent
          style={passwordModalTop ? { top: `${passwordModalTop}px` } : undefined}
          className="w-[calc(100vw-1.5rem)] max-w-md border border-white/10 bg-slate-900/65 p-4 text-white backdrop-blur-md"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-200">
              <KeyRound className="h-5 w-5" />
              Alterar senha
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <Label className="mb-1 block text-slate-300">Senha atual</Label>
              <div className="relative">
                <Input
                  type={showPasswordFields.current ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  className="border-slate-700 bg-slate-900 pr-10 text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordFields((prev) => ({ ...prev, current: !prev.current }))}
                  className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-slate-400 hover:text-slate-200"
                  aria-label={showPasswordFields.current ? "Ocultar senha atual" : "Mostrar senha atual"}
                >
                  {showPasswordFields.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-slate-300">Nova senha</Label>
              <div className="relative">
                <Input
                  type={showPasswordFields.next ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  className="border-slate-700 bg-slate-900 pr-10 text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordFields((prev) => ({ ...prev, next: !prev.next }))}
                  className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-slate-400 hover:text-slate-200"
                  aria-label={showPasswordFields.next ? "Ocultar nova senha" : "Mostrar nova senha"}
                >
                  {showPasswordFields.next ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-slate-300">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  type={showPasswordFields.confirm ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  className="border-slate-700 bg-slate-900 pr-10 text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordFields((prev) => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-slate-400 hover:text-slate-200"
                  aria-label={showPasswordFields.confirm ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                >
                  {showPasswordFields.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="button" onClick={() => changePasswordMutation.mutate()} disabled={changePasswordMutation.isPending} className="w-full bg-amber-700 text-white hover:bg-amber-600">
              {changePasswordMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Atualizar senha
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isTwoFactorModalOpen} onOpenChange={setIsTwoFactorModalOpen}>
        <DialogContent
          style={twoFactorModalTop ? { top: `${twoFactorModalTop}px` } : undefined}
          className="w-[calc(100vw-1.5rem)] max-w-xl border border-white/10 bg-slate-900/65 p-4 text-white backdrop-blur-md max-h-[88dvh] overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-violet-200">
              <ShieldCheck className="h-5 w-5" />
              Verificação em 2 etapas (2FA)
            </DialogTitle>
          </DialogHeader>
          <div className="hide-scrollbar space-y-3 overflow-y-auto pr-1">
            <p className="text-xs text-slate-300">
              {user?.two_factor_enabled ? "Proteção ativa. Você precisa do código do autenticador para entrar." : "Adicione uma camada extra de segurança com código de 6 dígitos."}
            </p>
            {!user?.two_factor_enabled ? (
              <div className="space-y-2">
                <Button type="button" onClick={() => setupTwoFactorMutation.mutate()} disabled={setupTwoFactorMutation.isPending} className="h-9 w-full gap-1 bg-violet-700 text-white hover:bg-violet-600">
                  {setupTwoFactorMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                  {twoFactorSetup ? "Gerar novo segredo 2FA" : "Configurar 2FA"}
                </Button>
                {twoFactorSetup ? (
                  <div className="space-y-2 rounded-lg border border-violet-800/50 bg-violet-950/20 p-2.5">
                    {twoFactorQrUrl ? (
                      <div className="flex justify-center rounded-md border border-slate-700 bg-slate-950 p-2">
                        <img src={twoFactorQrUrl} alt="QR code para configurar 2FA" className="h-44 w-44 rounded-md border border-slate-700 bg-white p-1" />
                      </div>
                    ) : null}
                    <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 p-2">
                      <p className="min-w-0 flex-1 truncate text-[11px] text-violet-200">{twoFactorSetup.secret}</p>
                      <Button type="button" variant="outline" onClick={() => handleCopy(twoFactorSetup.secret, "secret")} className="h-7 border-slate-700 px-2 text-[10px] text-slate-200">
                        {copiedField === "secret" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input value={twoFactorOtp} onChange={(e) => setTwoFactorOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="000000" className="border-violet-800/70 bg-slate-900 text-white" />
                      <Button type="button" onClick={() => enableTwoFactorMutation.mutate(twoFactorOtp)} disabled={enableTwoFactorMutation.isPending || twoFactorOtp.length !== 6} className="h-10 bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-600">
                        {enableTwoFactorMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ativar"}
                      </Button>
                    </div>
                    <Button type="button" variant="outline" onClick={() => diagnoseTwoFactorMutation.mutate(twoFactorOtp)} disabled={diagnoseTwoFactorMutation.isPending || twoFactorOtp.length !== 6} className="h-9 w-full border-slate-700 text-xs text-slate-200 hover:bg-slate-800">
                      {diagnoseTwoFactorMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Diagnosticar"}
                    </Button>
                    {twoFactorDiag ? (
                      <div className="rounded-md border border-slate-700 bg-slate-900/80 p-2 text-[11px]">
                        <p className={twoFactorDiag.is_valid ? "text-emerald-300" : "text-rose-300"}>
                          {twoFactorDiag.is_valid ? "Código válido" : "Código inválido"} • {twoFactorDiag.hint}
                        </p>
                        <p className="text-slate-400">Hora servidor: {twoFactorDiag.server_time_iso} • janela: {twoFactorDiag.seconds_remaining}s</p>
                        {twoFactorDiag.clock_drift_warning ? <p className="text-amber-300">{twoFactorDiag.clock_drift_warning}</p> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-amber-700/40 bg-amber-950/20 p-2.5">
                <p className="text-[11px] text-amber-100">Para desativar, confirme com um código atual do autenticador.</p>
                <div className="flex gap-2">
                  <Input value={twoFactorDisableOtp} onChange={(e) => setTwoFactorDisableOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="000000" className="border-amber-800/70 bg-slate-900 text-white" />
                  <Button type="button" onClick={() => disableTwoFactorMutation.mutate(twoFactorDisableOtp)} disabled={disableTwoFactorMutation.isPending || twoFactorDisableOtp.length !== 6} className="h-10 bg-rose-700 px-3 text-xs font-semibold text-white hover:bg-rose-600">
                    {disableTwoFactorMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Desativar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={handleDeleteModalChange}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm border border-white/10 bg-slate-900/65 p-4 text-white backdrop-blur-md max-h-[85dvh] overflow-hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-200">
              <AlertTriangle className="h-5 w-5" />
              Gerenciar conta
            </DialogTitle>
          </DialogHeader>

          <div className="hide-scrollbar space-y-3 overflow-y-auto pr-1 text-sm">
            <p className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-slate-200">
              Excluir conta é permanente. Se quiser apenas dar um tempo, use a desativação temporária.
            </p>

            <Button
              type="button"
              onClick={() => deactivateAccountMutation.mutate()}
              disabled={deactivateAccountMutation.isPending || deleteAccountMutation.isPending}
              className="h-auto w-full justify-start gap-2 whitespace-normal text-left leading-snug bg-amber-700/90 py-2.5 text-white hover:bg-amber-600"
            >
              {deactivateAccountMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              Você não prefere apenas desativar por enquanto?
            </Button>

            <div className="space-y-2 rounded-lg border border-rose-800/80 bg-rose-950/40 p-3">
              <p className="text-xs text-rose-100">Para excluir, digite EXCLUIR e confirme abaixo.</p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="border-rose-800 bg-slate-950 text-white placeholder:text-slate-500"
                placeholder="Digite EXCLUIR"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => deleteAccountMutation.mutate()}
                  disabled={
                    deleteAccountMutation.isPending ||
                    deactivateAccountMutation.isPending ||
                    deleteConfirmText.trim().toUpperCase() !== "EXCLUIR"
                  }
                  className="flex-1 bg-rose-700 text-white hover:bg-rose-600"
                >
                  {deleteAccountMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Confirmar exclusão
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDeleteModalChange(false)}
                  disabled={deleteAccountMutation.isPending || deactivateAccountMutation.isPending}
                  className="border-slate-700 text-slate-300"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <LegalLinksBar />
    </div>
  );
}






