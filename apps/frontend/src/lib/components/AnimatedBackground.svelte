<script lang="ts">
  import { onMount } from 'svelte';
  
  interface Particle {
    x: number;
    y: number;
    size: number;
    speedX: number;
    speedY: number;
    opacity: number;
  }
  
  let canvas: HTMLCanvasElement;
  let particles: Particle[] = [];
  let animationId: number;
  let mouseX = 0;
  let mouseY = 0;
  
  function createParticles() {
    const particleCount = 50;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5 + 0.1
      });
    }
  }
  
  function animate() {
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach((particle) => {
      // Update position
      particle.x += particle.speedX;
      particle.y += particle.speedY;
      
      // Mouse interaction
      const dx = mouseX - particle.x;
      const dy = mouseY - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 100) {
        const force = (100 - distance) / 100;
        particle.x -= dx * force * 0.02;
        particle.y -= dy * force * 0.02;
      }
      
      // Wrap around edges
      if (particle.x < 0) particle.x = canvas.width;
      if (particle.x > canvas.width) particle.x = 0;
      if (particle.y < 0) particle.y = canvas.height;
      if (particle.y > canvas.height) particle.y = 0;
      
      // Draw particle
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
      ctx.fill();
    });
    
    animationId = requestAnimationFrame(animate);
  }
  
  function handleMouseMove(e: MouseEvent) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }
  
  function handleResize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  
  onMount(() => {
    handleResize();
    createParticles();
    animate();
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  });
</script>

<div class="animated-background">
  <canvas bind:this={canvas} class="particle-canvas"></canvas>
  <div class="gradient-overlay"></div>
  <div class="noise-overlay"></div>
</div>

<style>
  .animated-background {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }
  
  .particle-canvas {
    position: absolute;
    inset: 0;
    opacity: 0.6;
  }
  
  .gradient-overlay {
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(ellipse at 20% 30%, rgba(120, 119, 198, 0.15) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 70%, rgba(255, 119, 198, 0.15) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 50%, rgba(255, 219, 98, 0.1) 0%, transparent 70%);
    animation: gradientShift 20s ease-in-out infinite;
  }
  
  @keyframes gradientShift {
    0%, 100% {
      transform: scale(1) rotate(0deg);
    }
    33% {
      transform: scale(1.1) rotate(120deg);
    }
    66% {
      transform: scale(0.9) rotate(240deg);
    }
  }
  
  .noise-overlay {
    position: absolute;
    inset: 0;
    opacity: 0.02;
    background-image: 
      repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255, 255, 255, 0.05) 35px, rgba(255, 255, 255, 0.05) 70px);
    animation: noiseMove 8s linear infinite;
  }
  
  @keyframes noiseMove {
    0% {
      transform: translate(0, 0);
    }
    100% {
      transform: translate(70px, 70px);
    }
  }
  
  @media (prefers-color-scheme: dark) {
    .particle-canvas {
      opacity: 0.4;
    }
    
    .gradient-overlay {
      background: 
        radial-gradient(ellipse at 20% 30%, rgba(147, 139, 250, 0.1) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 70%, rgba(236, 72, 153, 0.1) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(134, 239, 172, 0.08) 0%, transparent 70%);
    }
  }
</style> 