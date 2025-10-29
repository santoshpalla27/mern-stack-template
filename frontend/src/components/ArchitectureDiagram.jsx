import { useEffect, useRef } from 'react';

const ArchitectureDiagram = ({ architecture, status }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!architecture || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Define component positions
    const components = {
      frontend: { x: width * 0.5, y: height * 0.15, width: 120, height: 80 },
      backend: { x: width * 0.5, y: height * 0.5, width: 120, height: 80 },
      mongodb: { x: width * 0.25, y: height * 0.85, width: 120, height: 80 },
      redis: { x: width * 0.75, y: height * 0.85, width: 120, height: 80 }
    };

    // Get component status
    const getComponentColor = (id) => {
      if (id === 'frontend') return '#10B981'; // Green
      if (id === 'backend') return status ? '#10B981' : '#EF4444'; // Green/Red
      if (id === 'mongodb') return status?.services?.mongodb?.connected ? '#10B981' : '#EF4444';
      if (id === 'redis') {
        if (!status?.services?.redis?.uri?.includes('configured')) return '#9CA3AF'; // Gray
        return status?.services?.redis?.connected ? '#10B981' : '#EF4444';
      }
      return '#6B7280';
    };

    // Draw connections
    const drawConnection = (from, to, active = true) => {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y + from.height / 2);
      ctx.lineTo(to.x, to.y - to.height / 2);
      ctx.strokeStyle = active ? '#3B82F6' : '#D1D5DB';
      ctx.lineWidth = 3;
      ctx.setLineDash(active ? [] : [5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw arrow
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const arrowSize = 10;
      ctx.beginPath();
      ctx.moveTo(to.x, to.y - to.height / 2);
      ctx.lineTo(
        to.x - arrowSize * Math.cos(angle - Math.PI / 6),
        to.y - to.height / 2 - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(to.x, to.y - to.height / 2);
      ctx.lineTo(
        to.x - arrowSize * Math.cos(angle + Math.PI / 6),
        to.y - to.height / 2 - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.strokeStyle = active ? '#3B82F6' : '#D1D5DB';
      ctx.stroke();
    };

    // Draw connections
    drawConnection(components.frontend, components.backend, status !== null);
    drawConnection(components.backend, components.mongodb, status?.services?.mongodb?.connected);
    drawConnection(
      components.backend, 
      components.redis, 
      status?.services?.redis?.connected
    );

    // Draw components
    Object.entries(components).forEach(([id, comp]) => {
      const color = getComponentColor(id);
      
      // Draw box with shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      
      const radius = 8;
      const x = comp.x - comp.width / 2;
      const y = comp.y - comp.height / 2;
      
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + comp.width - radius, y);
      ctx.quadraticCurveTo(x + comp.width, y, x + comp.width, y + radius);
      ctx.lineTo(x + comp.width, y + comp.height - radius);
      ctx.quadraticCurveTo(x + comp.width, y + comp.height, x + comp.width - radius, y + comp.height);
      ctx.lineTo(x + radius, y + comp.height);
      ctx.quadraticCurveTo(x, y + comp.height, x, y + comp.height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.shadowColor = 'transparent';

      // Draw icon/emoji
      ctx.font = '32px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icons = {
        frontend: '🖥️',
        backend: '⚙️',
        mongodb: '🍃',
        redis: '📦'
      };
      ctx.fillText(icons[id], comp.x, comp.y - 10);

      // Draw label
      ctx.font = 'bold 14px Arial';
      ctx.fillStyle = '#1F2937';
      const labels = {
        frontend: 'Frontend',
        backend: 'Backend',
        mongodb: 'MongoDB',
        redis: 'Redis'
      };
      ctx.fillText(labels[id], comp.x, comp.y + 20);

      // Draw status indicator
      ctx.beginPath();
      ctx.arc(comp.x + comp.width / 2 - 15, comp.y - comp.height / 2 + 15, 6, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    });

  }, [architecture, status]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-96 border border-gray-200 rounded-lg bg-gray-50"
    />
  );
};

export default ArchitectureDiagram;