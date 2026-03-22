import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export default function CountdownTimer({ endDateString }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!endDateString) return;

    const calculateTimeLeft = () => {
      try {
        let endDate;
        
        // Verificar se é formato ISOO (2026-01-25T23:00:00.000Z)
        if (endDateString.includes('T') || endDateString.includes('-')) {
          endDate = new Date(endDateString);
        } else {
          // Formato brasileiro (dd/mm/yyyy hh:mm)
          const [datePart, timePart] = endDateString.split(' ');
          const [day, month, year] = datePart.split('/');
          const [hours, minutes] = (timePart || '23:59').split(':');
          endDate = new Date(year, month - 1, day, hours, minutes);
        }
        
        const now = new Date();
        const difference = endDate - now;

        if (difference > 0) {
          setTimeLeft({
            days: Math.floor(difference / (1000 * 60 * 60 * 24)),
            hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((difference / 1000 / 60) % 60),
            seconds: Math.floor((difference / 1000) % 60)
          });
        } else {
          setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        }
      } catch (error) {
        console.error("Error parsing date:", error);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [endDateString]);

  if (!endDateString) return null;

  const countdownFinished =
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0;

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 backdrop-blur-sm rounded-full border ${
        countdownFinished
          ? "bg-amber-600/85 border-amber-300/70"
          : "bg-red-600/80 border-red-400/50"
      }`}
    >
      <Clock className={`w-3 h-3 text-white ${countdownFinished ? "" : "animate-pulse"}`} />
      <span className="text-xs font-bold text-white">
        {countdownFinished
          ? "AGUARDE O SORTEIO DOS BILHETES EM BREVE!"
          : `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`}
      </span>
    </div>
  );
}
