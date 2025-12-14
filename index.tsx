import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Pass your list of images here with titles
const MEMORIES = [
  { url: "https://images.unsplash.com/photo-1543258103-a62bdc069871?w=400&q=80", title: "Mèo con mùa đông" },
  { url: "https://images.unsplash.com/photo-1512389142860-9c449ecd93a8?w=400&q=80", title: "Bánh quy gừng" },
  { url: "https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=400&q=80", title: "Rừng thông tuyết" },
  { url: "https://images.unsplash.com/photo-1482517967863-00e15c9b8043?w=400&q=80", title: "Ánh sáng lung linh" },
  { url: "https://images.unsplash.com/photo-1511268559489-34b624fbfcf5?w=400&q=80", title: "Góc ấm áp" },
  { url: "https://images.unsplash.com/photo-1496275068113-fff8c90750d1?w=400&q=80", title: "Đồ trang trí Noel" },
  { url: "https://images.unsplash.com/photo-1513297887119-d46091b24bfa?w=400&q=80", title: "Bếp lửa hồng" },
  { url: "https://images.unsplash.com/photo-1576919228236-a097c32a5cd4?w=400&q=80", title: "Món quà yêu thương" },
];

// YouTube Video ID for background music
// "aAkMkVFwAoo" is Mariah Carey - All I Want For Christmas Is You
const YOUTUBE_VIDEO_ID = "aAkMkVFwAoo"; 

interface SelectedMemory {
  url: string;
  title: string;
}

// Add types for YouTube API
declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

const ChristmasTreeApp = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showText, setShowText] = useState(false);
  const [selectedImage, setSelectedImage] = useState<SelectedMemory | null>(null);
  
  // Audio state (YouTube)
  const [hasStarted, setHasStarted] = useState(false);
  const playerRef = useRef<any>(null);

  // Preload images refs so we don't trigger re-renders
  const loadedImagesRef = useRef<{img: HTMLImageElement, title: string}[]>([]);
  
  // Store hit regions for the current frame to detect clicks
  const hitRegionsRef = useRef<Array<{x: number, y: number, w: number, h: number, url: string, title: string}>>([]);

  // Initialize YouTube Player
  useEffect(() => {
    // Check if script is already there
    if (!document.querySelector('#youtube-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-api-script';
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '0',
        width: '0',
        videoId: YOUTUBE_VIDEO_ID,
        playerVars: {
          'playsinline': 1,
          'controls': 0,
          'loop': 1,
          'playlist': YOUTUBE_VIDEO_ID // Required for loop to work
        },
        events: {
          'onReady': (event: any) => {
            // Attempt to play immediately when ready (might be blocked by browser)
            event.target.playVideo();
          },
          'onStateChange': (event: any) => {
             // 1 = Playing, 2 = Paused
             if (event.data === 1) {
               setHasStarted(true);
             }
          }
        }
      });
    };
  }, []);

  // Effect to handle "Play on first interaction"
  useEffect(() => {
    // If music has already started once, we don't need this global listener anymore
    if (hasStarted) return;

    const attemptPlay = () => {
      if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        playerRef.current.playVideo();
      }
    };

    // Add listeners to document to catch any interaction
    window.addEventListener('click', attemptPlay);
    window.addEventListener('touchstart', attemptPlay);
    window.addEventListener('keydown', attemptPlay);

    return () => {
      window.removeEventListener('click', attemptPlay);
      window.removeEventListener('touchstart', attemptPlay);
      window.removeEventListener('keydown', attemptPlay);
    };
  }, [hasStarted]);

  useEffect(() => {
    // Load images - Reset first to handle strict mode re-runs
    loadedImagesRef.current = [];
    MEMORIES.forEach((item) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = item.url;
      loadedImagesRef.current.push({ img, title: item.title });
    });

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', resize);
    resize();

    // --- Configuration ---
    const particleCount = 2800; // Increased density
    const treeHeight = 500;
    const baseRadius = 180;
    const fov = 800; // Field of view
    
    // Rainbow Colors Palette (7 colors)
    const RAINBOW_COLORS = [
      { r: 255, g: 60, b: 60 },   // Red
      { r: 255, g: 140, b: 0 },   // Orange
      { r: 255, g: 255, b: 60 },  // Yellow
      { r: 60, g: 255, b: 60 },   // Green
      { r: 60, g: 160, b: 255 },  // Blue
      { r: 100, g: 100, b: 255 }, // Indigo
      { r: 220, g: 100, b: 255 }  // Violet
    ];
    
    // --- State ---
    let frame = 0;
    let rotation = 0;
    let revealProgress = 0; // 0 to 1
    const revealSpeed = 0.003;
    let textTriggered = false; // Local flag to prevent re-triggering state

    // --- Particles ---
    interface Particle {
      x: number;
      y: number; // Vertical position
      z: number;
      angle: number;
      radius: number;
      size: number;
      speed: number;
      offset: number;
      type: 'tree' | 'snow' | 'floor' | 'image';
      image?: HTMLImageElement;
      title?: string;
      color?: { r: number, g: number, b: number }; // Added color property
    }

    const particles: Particle[] = [];

    // 1. Tree Particles (Spiral)
    for (let i = 0; i < particleCount; i++) {
      const p = i / particleCount; // 0 to 1 (bottom to top)
      const y = p * treeHeight;
      const r = baseRadius * (1 - p); // Cone shape
      const angle = i * 0.15 + p * 20; 

      // Pick a random rainbow color
      const color = RAINBOW_COLORS[Math.floor(Math.random() * RAINBOW_COLORS.length)];

      particles.push({
        x: 0,
        y: y - treeHeight / 2 + 50,
        z: 0,
        angle: angle,
        radius: r,
        size: Math.random() * 2.5 + 2, 
        speed: 0,
        offset: Math.random() * 100,
        type: 'tree',
        color: color
      });
    }

    // 2. Snow Particles
    const snowCount = 300;
    const snowParticles: Particle[] = [];
    for(let i=0; i<snowCount; i++) {
      snowParticles.push({
        x: (Math.random() - 0.5) * width * 1.5,
        y: (Math.random() - 0.5) * height * 1.5,
        z: (Math.random() - 0.5) * 500, // Depth for snow
        angle: 0,
        radius: 0,
        size: Math.random() * 2 + 1.5,
        speed: Math.random() * 1 + 0.5,
        offset: Math.random() * Math.PI * 2,
        type: 'snow'
      });
    }

    // 3. Floor Particles
    const floorParticles: Particle[] = [];
    for(let i=0; i<400; i++) {
        const radius = Math.random() * 300;
        const angle = Math.random() * Math.PI * 2;
        floorParticles.push({
            x: 0,
            y: -treeHeight / 2 + 50,
            z: 0,
            angle: angle,
            radius: radius,
            size: Math.random() * 2 + 1,
            speed: 0,
            offset: 0,
            type: 'floor'
        });
    }

    // 4. Image Particles
    const imageParticles: Particle[] = [];
    const loadedData = loadedImagesRef.current;
    if (loadedData.length > 0) {
      for(let i=0; i<loadedData.length; i++) {
        // Distribute spirally
        const p = i / loadedData.length;
        // Start a bit higher than base, end near top
        const h = treeHeight * 0.8; 
        const y = -treeHeight/2 + 100 + p * h;
        const r = baseRadius + 80 - (p * 50); // Slightly conical spiral outside tree
        const angle = i * (Math.PI * 2 / 1.618) * 3; // Golden ratio steps

        imageParticles.push({
          x: 0,
          y: y,
          z: 0,
          angle: angle,
          radius: r,
          size: 40, // Width reference
          speed: 0,
          offset: 0,
          type: 'image',
          image: loadedData[i].img,
          title: loadedData[i].title
        });
      }
    }

    // 5. Background Stars
    interface Star {
      x: number;
      y: number;
      size: number;
      baseAlpha: number;
      twinkleOffset: number;
      twinkleSpeed: number;
    }
    const stars: Star[] = [];
    const starCount = 200;
    for(let i=0; i<starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.8,
        baseAlpha: 0.2 + Math.random() * 0.7,
        twinkleOffset: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.005 + Math.random() * 0.02
      });
    }

    // 6. Santa & Reindeer System
    interface SantaParticle {
        x: number;
        y: number;
        life: number;
        vx: number;
        vy: number;
        color: string;
        size: number;
    }
    const santaState = {
        x: width + 300,
        y: height * 0.1,
        active: true, // Start active for immediate effect
        speed: 3
    };
    let santaParticles: SantaParticle[] = [];

    // --- Render Helpers ---
    interface RenderItem {
        z: number;
        draw: () => void;
    }

    // --- Animation Loop ---
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Reset hit regions for this frame
      hitRegionsRef.current = [];

      // Update Reveal
      if (revealProgress < 1.1) {
        revealProgress += revealSpeed;
      } else if (!textTriggered) {
        // Only trigger once
        setShowText(true);
        textTriggered = true;
      }
      
      // Background Gradient
      const grad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, height);
      grad.addColorStop(0, '#0f0f2a'); // Slightly lighter blue-black for better contrast
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw Background Stars
      stars.forEach(s => {
        // Very slow movement (simulating distant parallax/rotation)
        s.x -= 0.05; 
        if (s.x < 0) s.x = width; // Wrap around
        
        const alpha = s.baseAlpha + Math.sin(frame * s.twinkleSpeed + s.twinkleOffset) * 0.2;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, alpha)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Update Santa
      if (santaState.active) {
          santaState.x -= santaState.speed;
          // Gentle bobbing motion
          santaState.y = (height * 0.15) + Math.sin(frame * 0.02) * 20;

          // If moved off screen far enough
          if (santaState.x < -400) {
              santaState.active = false;
          }
      } else {
          // Random chance to respawn
          if (Math.random() < 0.002) { // approx every ~8-10 seconds @ 60fps
              santaState.active = true;
              santaState.x = width + 200;
          }
      }

      // Draw Santa (Behind tree)
      if (santaState.active) {
          ctx.save();
          const sx = santaState.x;
          const sy = santaState.y;
          
          // Draw "magic dust" trail spawning
          if (frame % 3 === 0) {
             santaParticles.push({
                 x: sx + 20, // Spawn near sleigh tail
                 y: sy + 10,
                 life: 1.0,
                 vx: (Math.random() - 0.5) * 2 + 2, // Drift right (opposite to motion)
                 vy: (Math.random() - 0.5) * 2,
                 color: Math.random() > 0.5 ? '#ffd700' : '#ffffff',
                 size: Math.random() * 2 + 1
             });
          }

          // Draw the emojis
          ctx.font = "40px serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "white"; // Ensure text is visible
          // Reindeers (face left by default on most systems)
          // Sequence: Deer Deer Deer Sleigh(Santa)
          // Since moving Left, Deer lead.
          
          // Lead deer
          ctx.fillText("🦌", sx - 140, sy + Math.sin(frame * 0.2) * 5); 
          // Second deer
          ctx.fillText("🦌", sx - 80, sy + Math.sin(frame * 0.2 + 1) * 5); 
          // Santa/Sleigh
          ctx.fillText("🎅", sx, sy);
          
          ctx.restore();
      }

      // Process and Draw Santa Particles (Magic Dust)
      for (let i = santaParticles.length - 1; i >= 0; i--) {
          const p = santaParticles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.05; // Gravity
          p.life -= 0.015;
          
          if (p.life <= 0) {
              santaParticles.splice(i, 1);
              continue;
          }
          
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
      }

      rotation += 0.005;

      const cx = width / 2;
      const cy = height / 2;
      const drawList: RenderItem[] = [];

      // 1. Process Tree Particles
      particles.forEach(p => {
        const normalizedH = (p.y - (-treeHeight/2 + 50)) / treeHeight;
        if (normalizedH > revealProgress) return;
        const isTip = Math.abs(normalizedH - revealProgress) < 0.05;

        const curAngle = p.angle + rotation;
        const wx = Math.cos(curAngle) * p.radius;
        const wz = Math.sin(curAngle) * p.radius;
        const wy = p.y;

        const scale = fov / (fov + wz + 400);
        const x2d = cx + wx * scale;
        const y2d = cy - wy * scale + 50;
        
        drawList.push({
            z: wz,
            draw: () => {
                const size = p.size * scale * (isTip ? 2.5 : 1);

                // Tip sparkle
                if (isTip && Math.random() > 0.5) {
                    ctx.beginPath();
                    ctx.arc(x2d, y2d, size * 2, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random()})`;
                    ctx.fill();
                }

                ctx.beginPath();
                ctx.arc(x2d, y2d, size, 0, Math.PI * 2);
                if (isTip) {
                    ctx.fillStyle = `rgba(255, 255, 255, 1)`;
                } else {
                    // Use the assigned rainbow color for the particle
                    const flicker = Math.random() > 0.9 ? 1 : 0.7;
                    const c = p.color || { r: 255, g: 215, b: 50 }; // Fallback to Gold
                    ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${flicker})`;
                }
                ctx.fill();
            }
        });
      });

      // 2. Process Floor Particles
      floorParticles.forEach(p => {
        if (revealProgress < 0.1) return;
        const curAngle = p.angle + rotation * 0.5;
        const wx = Math.cos(curAngle) * p.radius;
        const wz = Math.sin(curAngle) * p.radius;
        const wy = p.y;
        const scale = fov / (fov + wz + 400);
        const x2d = cx + wx * scale;
        const y2d = cy - wy * scale + 50;
        
        drawList.push({
            z: wz,
            draw: () => {
                // Increased floor visibility
                const distFactor = 1 - (p.radius / 300);
                ctx.beginPath();
                ctx.arc(x2d, y2d, p.size * scale, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(150, 150, 200, ${distFactor * 0.5})`;
                ctx.fill();
            }
        });
      });

      // 3. Process Image Particles
      imageParticles.forEach(p => {
          // Check reveal height
          const normalizedH = (p.y - (-treeHeight/2 + 50)) / treeHeight;
          if (normalizedH > revealProgress - 0.1) return; 

          const curAngle = p.angle + rotation; 
          const wx = Math.cos(curAngle) * p.radius;
          const wz = Math.sin(curAngle) * p.radius;
          const wy = p.y;

          const scale = fov / (fov + wz + 400);
          const x2d = cx + wx * scale;
          const y2d = cy - wy * scale + 50;

          drawList.push({
              z: wz,
              draw: () => {
                  const isLoaded = p.image && p.image.complete && p.image.naturalWidth !== 0;
                  
                  // Use image aspect if loaded, else default to 1.5 (landscape)
                  const aspect = (isLoaded && p.image) ? p.image.width / p.image.height : 1.5;
                  
                  const w = 60 * scale; 
                  const h = w / aspect;
                  
                  // Track hit region only if loaded (or maybe always, but generally only loaded images are interesting)
                  if (isLoaded && p.image) {
                      hitRegionsRef.current.push({
                          x: x2d - w/2 - 3 * scale,
                          y: y2d - h/2 - 3 * scale,
                          w: w + 6 * scale,
                          h: h + 6 * scale,
                          url: p.image.src,
                          title: p.title || ''
                      });
                  }

                  ctx.save();
                  ctx.translate(x2d, y2d);
                  
                  // Draw Border - Bright White
                  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
                  const pad = 3 * scale;
                  ctx.fillRect(-w/2 - pad, -h/2 - pad, w + pad*2, h + pad*2);
                  
                  if (isLoaded && p.image) {
                      // Draw Image
                      ctx.drawImage(p.image, -w/2, -h/2, w, h);
                  } else {
                      // Draw Placeholder
                      ctx.fillStyle = 'rgba(50, 50, 50, 0.5)';
                      ctx.fillRect(-w/2, -h/2, w, h);
                      
                      // Loading indicator (pulsing gold dot)
                      const pulse = 0.5 + Math.sin(frame * 0.15) * 0.4;
                      ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
                      ctx.beginPath();
                      ctx.arc(0, 0, 4 * scale, 0, Math.PI * 2);
                      ctx.fill();
                  }

                  ctx.restore();
              }
          });
      });

      // Sort: Farthest (largest z) first.
      // This means the last items drawn are "on top".
      drawList.sort((a, b) => b.z - a.z);

      // Execute Draw
      drawList.forEach(item => item.draw());

      // 4. Draw Star (Overlay)
      if (revealProgress >= 1.0) {
        const topY = treeHeight/2 + 50; 
        const scale = fov / (fov + 400); // z=0 for top center
        const topX2d = cx;
        const topY2d = cy - topY * scale + 50;
        
        const grd = ctx.createRadialGradient(topX2d, topY2d, 1, topX2d, topY2d, 30);
        grd.addColorStop(0, 'white');
        grd.addColorStop(0.4, 'rgba(255, 215, 0, 0.9)');
        grd.addColorStop(1, 'rgba(255, 215, 0, 0)');
        
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(topX2d, topY2d, 30, 0, Math.PI*2);
        ctx.fill();
      }

      // 5. Draw Snow
      snowParticles.forEach(p => {
        p.y += p.speed;
        p.x += Math.sin(frame * 0.01 + p.offset) * 0.5;

        if (p.y > height/2) {
            p.y = -height/2;
            p.x = (Math.random() - 0.5) * width * 1.5;
        }

        const scale = fov / (fov + p.z + 400); 
        const x2d = cx + p.x * scale;
        const y2d = cy + p.y * scale; 

        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + Math.random() * 0.3})`;
        ctx.arc(x2d, y2d, p.size * scale, 0, Math.PI * 2);
        ctx.fill();
      });

      frame++;
      requestAnimationFrame(render);
    };

    const animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []); // Run only once

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedImage) return; // If modal open, ignore canvas clicks

    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check hit regions
    // We iterate backwards because the last items in hitRegions (pushed last) 
    // correspond to the items drawn last (on top) due to the Z-sort order in drawList.
    const regions = hitRegionsRef.current;
    for (let i = regions.length - 1; i >= 0; i--) {
        const r = regions[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
            setSelectedImage({ url: r.url, title: r.title });
            break;
        }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedImage) return;
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let isHovering = false;
    const regions = hitRegionsRef.current;
    for (let i = regions.length - 1; i >= 0; i--) {
        const r = regions[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
            isHovering = true;
            break;
        }
    }
    
    if (canvasRef.current) {
        canvasRef.current.style.cursor = isHovering ? 'pointer' : 'default';
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas 
        ref={canvasRef} 
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
      />
      
      {/* Hidden YouTube Player */}
      <div id="youtube-player" style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0, pointerEvents: 'none' }}></div>
      
      {/* Text Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#fff',
          opacity: showText ? 1 : 0,
          transition: 'opacity 2s ease-in-out',
          pointerEvents: 'none',
          zIndex: 10,
          textShadow: '0 0 10px rgba(255,215,0, 0.8)',
        }}
      >
        <h1 style={{ 
            fontFamily: "'Dancing Script', cursive", 
            fontSize: '4.5rem', 
            fontWeight: '700',
            margin: 0,
            background: 'linear-gradient(to bottom, #fff, #ffd700)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0px 0px 8px rgba(255,215,0,0.8))'
        }}>
          Merry Christmas
        </h1>
        <p style={{ 
            fontFamily: "'Quicksand', sans-serif", 
            fontSize: '1.4rem', 
            fontWeight: '500',
            marginTop: '0.5rem', 
            letterSpacing: '2px',
            color: '#ffffff',
            textShadow: '0 0 5px rgba(0,0,0,0.5)'
        }}>
          Chúc em Noel vui vẻ
        </p>
      </div>

      {/* Image Modal / Tooltip */}
      {selectedImage && (
        <div 
            onClick={() => setSelectedImage(null)}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.85)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 100,
                cursor: 'pointer',
                backdropFilter: 'blur(5px)'
            }}
        >
            <div 
                style={{
                    padding: '10px',
                    background: 'white',
                    borderRadius: '4px',
                    boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)',
                    transform: 'rotate(-2deg)'
                }}
                onClick={(e) => e.stopPropagation()} // Prevent closing if clicking on the image frame itself? Optional.
            >
                <img 
                    src={selectedImage.url} 
                    alt="Memory" 
                    style={{
                        maxWidth: '80vw',
                        maxHeight: '70vh',
                        display: 'block',
                        border: '1px solid #ddd'
                    }} 
                />
            </div>
            <div style={{
                marginTop: '20px',
                color: '#fff',
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '10px 30px',
                borderRadius: '30px',
                fontFamily: "'Dancing Script', cursive",
                fontSize: '2rem',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                maxWidth: '80%',
                wordBreak: 'break-word',
                textAlign: 'center',
                textShadow: '0 0 5px gold'
            }}>
                {selectedImage.title}
            </div>
            <div style={{
                marginTop: '20px',
                color: 'rgba(255,255,255,0.5)',
                fontFamily: 'Quicksand, sans-serif',
                fontSize: '0.9rem'
            }}>
                Click anywhere to close
            </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<ChristmasTreeApp />);