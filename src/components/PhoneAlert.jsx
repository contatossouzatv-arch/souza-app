import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, AlertCircle, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";

export default function PhoneAlert({ user, onUpdate, platformModalVisible }) {
  const [showAlert, setShowAlert] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // CRITICO: So mostra se o modal de plataforma NAO estiver visivel
    if (user && user.onboarding_completed && !user.phone && !platformModalVisible) {
      // Verifica se ja salvou o telefone (APENAS)
      const phoneSaved = localStorage.getItem('phone_saved');
      
      // Se ja salvou, nao mostra (porque user.phone ja estaria preenchido)
      // Se nao salvou, mostra o alerta
      if (!phoneSaved) {
        // Delay aumentado para dar tempo do modal de plataforma aparecer primeiro
        const timer = setTimeout(() => {
          setShowAlert(true);
        }, 2000);
        
        return () => clearTimeout(timer);
      }
    } else if (platformModalVisible && showAlert) {
      // Se o modal de plataforma aparecer, fecha o alerta de telefone
      setShowAlert(false);
    }
  }, [user, platformModalVisible, showAlert]);

  // Focar no input quando o modal abre (especialmente importante para iOS)
  useEffect(() => {
    if (showAlert && inputRef.current) {
      // Delay para garantir que o modal esta totalmente renderizado
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Forcar o foco no iOS
          inputRef.current.click();
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [showAlert]);

  const handleSave = async () => {
    if (!phone.trim()) {
      alert("Por favor, digite seu telefone");
      return;
    }

    // Valida formato basico de telefone brasileiro
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      alert("Digite um telefone valido (com DDD)");
      return;
    }

    setSaving(true);
    try {
      await base44.auth.updateMe({ phone: phone });
      
      // Atualiza tambem todas as participacoes existentes do usuario
      try {
        await base44.adminEvents.profile.syncPhone(phone);
      } catch (error) {
        console.log("Erro ao atualizar participacoes antigas:", error);
      }

      // Marca que salvou o telefone (para nao mostrar mais o alerta)
      localStorage.setItem('phone_saved', 'true');
      
      setShowAlert(false);
      if (onUpdate) onUpdate();
      
      alert(" Telefone salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar telefone:", error);
      alert("Erro ao salvar telefone. Tente novamente.");
    }
    setSaving(false);
  };

  const handleDismiss = () => {
    // APENAS fecha o alerta - NAO salva no localStorage
    // Assim o alerta vai aparecer novamente na proxima vez que carregar a pagina
    setShowAlert(false);
  };

  const handleInputClick = () => {
    // Forca o foco no input (especialmente para iOS)
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Formata telefone enquanto digita
  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else {
      return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    }
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
  };

  return (
    <AnimatePresence>
      {showAlert && (
        <>
          {/* Backdrop - Clicavel para fechar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] cursor-pointer"
          />

          {/* Alert Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed top-4 left-4 right-4 md:fixed md:top-[50%] md:left-[50%] md:right-auto md:w-[90%] md:max-w-md md:transform md:-translate-x-1/2 md:-translate-y-1/2 z-[9999] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{
              margin: '0 auto'
            }}
          >
            <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-400 shadow-2xl overflow-hidden flex flex-col relative">
              {/* Botao X para Fechar */}
              <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition-all hover:scale-110"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-3 md:p-4 text-center">
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0]
                  }}
                  transition={{ 
                    duration: 0.5,
                    repeat: Infinity,
                    repeatDelay: 2
                  }}
                  className="inline-block"
                >
                  <AlertCircle className="w-10 h-10 md:w-12 md:h-12 text-white mx-auto mb-2" />
                </motion.div>
                <h3 className="text-xl md:text-2xl font-black text-white">
                  ATENCAO IMPORTANTE!
                </h3>
              </div>

              <div className="p-4 md:p-6 space-y-3 md:space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg md:rounded-xl p-3 md:p-4">
                  <p className="text-sm md:text-base font-bold text-yellow-900 mb-1 md:mb-2 text-center">
                     Telefone obrigatório para resgatar prêmios!
                  </p>
                  <p className="text-xs md:text-sm text-yellow-800 text-center">
                    Caso você ganhe algum sorteio, precisaremos do seu telefone para entrar em contato e liberar o prêmio.
                  </p>
                </div>

                <div className="space-y-2 md:space-y-3">
                  <Label 
                    htmlFor="phone" 
                    className="text-gray-800 font-bold text-sm md:text-base flex items-center gap-2"
                    onClick={handleInputClick}
                  >
                    <Phone className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
                    Digite seu Telefone com DDD
                  </Label>
                  <div 
                    onClick={handleInputClick}
                    className="relative"
                  >
                    <Input
                      ref={inputRef}
                      id="phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      pattern="[0-9]*"
                      value={phone}
                      onChange={handlePhoneChange}
                      onClick={handleInputClick}
                      placeholder="(11) 99999-9999"
                      className="text-base md:text-lg border-2 border-orange-300 focus:border-orange-500 w-full"
                      maxLength={15}
                      autoComplete="tel"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      style={{ 
                        WebkitAppearance: 'none',
                        fontSize: '16px' // Evita zoom no iOS
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-600">
                    Exemplo: (11) 98765-4321 ou (11) 8765-4321
                  </p>
                  <p className="text-xs text-orange-600 font-bold">
                     Clique no campo acima para digitar
                  </p>
                </div>

                <div className="bg-gradient-to-r from-red-100 to-orange-100 rounded-lg md:rounded-xl p-3 md:p-4 border-2 border-red-300">
                  <p className="text-xs md:text-sm font-bold text-red-800 text-center">
                     Sem telefone = Sem prêmio!
                  </p>
                  <p className="text-xs text-red-700 text-center mt-1">
                    Não conseguiremos te contatar para liberar seus ganhos.
                  </p>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-base md:text-lg py-4 md:py-6"
                  >
                    <Save className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                    {saving ? "Salvando..." : "Salvar Telefone"}
                  </Button>

                  <Button
                    onClick={handleDismiss}
                    variant="outline"
                    className="w-full border-2 border-gray-300 text-gray-700 hover:bg-gray-100 font-bold py-3"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Fechar (Lembrar Depois)
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}


