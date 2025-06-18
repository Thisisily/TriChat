<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { trpc } from '../trpc';
  
  // Props
  export let memoryCards: any[] = [];
  export let selectedCardId: string | null = null;
  
  // Component state
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let animationFrame: number;
  
  // Graph state
  let nodes: Node[] = [];
  let hoveredNode: Node | null = null;
  
  interface Node {
    id: string;
    x: number;
    y: number;
    title: string;
    radius: number;
  }
  
  // Initialize graph with fixed positions
  function initializeGraph() {
    if (!canvas) return;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.35;
    
    nodes = memoryCards.map((card, index) => {
      const angle = (index / memoryCards.length) * Math.PI * 2 - Math.PI / 2;
      return {
        id: card.id,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        title: card.title,
        radius: 25,
      };
    });
  }
  
  // Draw the graph
  function draw() {
    if (!ctx || !canvas) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw connections
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.1)';
    ctx.lineWidth = 1;
    
    // Draw simple connections between adjacent nodes
    nodes.forEach((node, i) => {
      const nextNode = nodes[(i + 1) % nodes.length];
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(nextNode.x, nextNode.y);
      ctx.stroke();
    });
    
    // Draw center connections
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    nodes.forEach(node => {
      ctx.strokeStyle = 'rgba(102, 126, 234, 0.05)';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(node.x, node.y);
      ctx.stroke();
    });
    
    // Draw nodes
    nodes.forEach(node => {
      const isHovered = node === hoveredNode;
      const isSelected = node.id === selectedCardId;
      
      // Glow effect
      if (isHovered || isSelected) {
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 2);
        gradient.addColorStop(0, isSelected ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.2)');
        gradient.addColorStop(1, 'rgba(102, 126, 234, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Node circle
      ctx.fillStyle = isSelected ? 'rgba(102, 126, 234, 0.9)' : 
                      isHovered ? 'rgba(102, 126, 234, 0.7)' : 
                      'rgba(102, 126, 234, 0.5)';
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Node border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Node icon
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧠', node.x, node.y);
      
      // Title (only on hover)
      if (isHovered) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.font = '14px sans-serif';
        const textWidth = ctx.measureText(node.title).width;
        const padding = 10;
        const boxX = node.x - textWidth / 2 - padding;
        const boxY = node.y + node.radius + 10;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(boxX, boxY, textWidth + padding * 2, 28);
        
        // Text
        ctx.fillStyle = 'white';
        ctx.fillText(node.title, node.x, boxY + 14);
      }
    });
  }
  
  // Mouse handlers
  function handleMouseMove(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Find hovered node
    const prevHovered = hoveredNode;
    hoveredNode = null;
    
    for (const node of nodes) {
      const dx = x - node.x;
      const dy = y - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= node.radius) {
        hoveredNode = node;
        canvas.style.cursor = 'pointer';
        break;
      }
    }
    
    if (!hoveredNode) {
      canvas.style.cursor = 'default';
    }
    
    // Only redraw if hover state changed
    if (prevHovered !== hoveredNode) {
      draw();
    }
  }
  
  function handleMouseLeave() {
    hoveredNode = null;
    canvas.style.cursor = 'default';
    draw();
  }
  
  function handleClick() {
    if (hoveredNode) {
      selectedCardId = hoveredNode.id;
      draw();
    }
  }
  
  // Animation loop (only for smooth resizing)
  function animate() {
    // We'll only redraw on state changes, not continuously
    animationFrame = requestAnimationFrame(animate);
  }
  
  onMount(() => {
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initializeGraph();
      draw();
    };
    
    resizeCanvas();
    animate();
    
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  });
  
  onDestroy(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  });
  
  // Reactive updates
  $: if (memoryCards && canvas && ctx) {
    initializeGraph();
    draw();
  }
</script>

<div class="memory-graph-container">
  <canvas
    bind:this={canvas}
    on:mousemove={handleMouseMove}
    on:mouseleave={handleMouseLeave}
    on:click={handleClick}
    class="memory-graph-canvas"
  />
  
  <div class="graph-legend">
    <div class="legend-item">
      <div class="legend-dot"></div>
      <span>Memory Node</span>
    </div>
    <div class="legend-item">
      <div class="legend-line"></div>
      <span>Temporal Connection</span>
    </div>
  </div>
</div>

<style>
  .memory-graph-container {
    position: relative;
    width: 100%;
    height: 400px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 16px;
    overflow: hidden;
  }
  
  .memory-graph-canvas {
    width: 100%;
    height: 100%;
  }
  
  .graph-legend {
    position: absolute;
    bottom: 16px;
    left: 16px;
    display: flex;
    gap: 24px;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
  }
  
  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(102, 126, 234, 0.6);
    border: 2px solid rgba(255, 255, 255, 0.8);
  }
  
  .legend-line {
    width: 20px;
    height: 2px;
    background: rgba(102, 126, 234, 0.4);
  }
</style> 