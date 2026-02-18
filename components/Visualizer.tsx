import React from 'react';

interface VisualizerProps {
  volume: number; // 0 to 1
  isActive: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ volume, isActive }) => {
  // Create 3 bars
  const bars = [1, 2, 3];
  
  return (
    <div className="flex items-center gap-1 h-6">
      {bars.map((i) => {
        const height = isActive ? Math.max(20, Math.min(100, volume * 100 * (i === 2 ? 1.5 : 1))) : 20;
        return (
          <div
            key={i}
            className={`w-1 bg-green-500 rounded-full transition-all duration-100 ease-in-out`}
            style={{ height: `${height}%`, opacity: isActive ? 1 : 0.5 }}
          />
        );
      })}
    </div>
  );
};

export default Visualizer;