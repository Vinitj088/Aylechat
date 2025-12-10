'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

interface SnowflakeProps {
  count?: number;
}

export default function Snowfall({ count = 40 }: SnowflakeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const theme = mounted ? resolvedTheme : 'dark';

  useEffect(() => {
    if (!mounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Choose color based on theme - cyan tinted particles
    const isDark = theme === 'dark';
    const particleColor = isDark ? '103, 232, 249' : '8, 145, 178';

    let animationFrameId: number;
    let snowflakes: Array<{
      x: number;
      y: number;
      radius: number;
      speed: number;
      opacity: number;
      drift: number;
    }> = [];

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    const createSnowflakes = () => {
      snowflakes = [];
      for (let i = 0; i < count; i++) {
        snowflakes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 2 + 1, // Small: 1 to 3px
          speed: Math.random() * 0.8 + 0.3, // Slow: 0.3 to 1.1
          opacity: Math.random() * 0.4 + 0.15, // Visible: 0.15 to 0.55
          drift: Math.random() * 0.5 - 0.25, // Horizontal drift
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      snowflakes.forEach((flake) => {
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particleColor}, ${flake.opacity})`;
        ctx.fill();

        // Update position
        flake.y += flake.speed;
        flake.x += flake.drift + Math.sin(flake.y * 0.01) * 0.2; // Gentle sway

        // Reset if off screen
        if (flake.y > canvas.height) {
          flake.y = -5;
          flake.x = Math.random() * canvas.width;
        }
        if (flake.x > canvas.width) {
          flake.x = 0;
        } else if (flake.x < 0) {
          flake.x = canvas.width;
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    resizeCanvas();
    createSnowflakes();
    animate();

    window.addEventListener('resize', () => {
      resizeCanvas();
      createSnowflakes();
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [count, theme, mounted]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.85 }}
    />
  );
}
