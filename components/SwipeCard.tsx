'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Recipe } from '@/lib/types';

interface SwipeCardProps {
  recipe: Recipe;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onTap?: () => void;
}

export function SwipeCard({ recipe, onSwipeLeft, onSwipeRight, onTap }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [exitAnimation, setExitAnimation] = useState<'left' | 'right' | null>(null);
  const [imageError, setImageError] = useState(false);

  // Reset image error state when recipe changes
  useEffect(() => {
    setImageError(false);
  }, [recipe.id]);

  const SWIPE_THRESHOLD = 100;
  const ROTATION_FACTOR = 0.1;

  const handleStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    setStartPos({ x: clientX, y: clientY });
  }, []);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    
    const deltaX = clientX - startPos.x;
    const deltaY = clientY - startPos.y;
    
    setPosition({ x: deltaX, y: deltaY * 0.3 }); // Limit Y movement
    
    if (deltaX > 50) {
      setSwipeDirection('right');
    } else if (deltaX < -50) {
      setSwipeDirection('left');
    } else {
      setSwipeDirection(null);
    }
  }, [isDragging, startPos]);

  const handleEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    
    if (position.x > SWIPE_THRESHOLD) {
      // Swipe right - LIKE
      setExitAnimation('right');
      setTimeout(() => onSwipeRight(), 300);
    } else if (position.x < -SWIPE_THRESHOLD) {
      // Swipe left - DISLIKE
      setExitAnimation('left');
      setTimeout(() => onSwipeLeft(), 300);
    } else {
      // Spring back
      setPosition({ x: 0, y: 0 });
      setSwipeDirection(null);
    }
  }, [isDragging, position.x, onSwipeLeft, onSwipeRight]);

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  const onTouchEnd = () => handleEnd();

  // Mouse handlers (for testing on desktop)
  const onMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  };

  const onMouseUp = () => handleEnd();
  const onMouseLeave = () => {
    if (isDragging) handleEnd();
  };

  const totalTime = recipe.total_time_minutes || 
    ((recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0));

  const cardStyle = {
    transform: exitAnimation 
      ? undefined 
      : `translateX(${position.x}px) translateY(${position.y}px) rotate(${position.x * ROTATION_FACTOR}deg)`,
  };

  const cardClasses = [
    'recipe-card',
    isDragging && 'swiping',
    swipeDirection === 'right' && 'swiping-right',
    swipeDirection === 'left' && 'swiping-left',
    exitAnimation === 'right' && 'card-exit-right',
    exitAnimation === 'left' && 'card-exit-left',
  ].filter(Boolean).join(' ');

  return (
    <div className="recipe-card-container">
      <div
        ref={cardRef}
        className={cardClasses}
        style={cardStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onClick={() => !isDragging && onTap?.()}
      >
        {/* Image */}
        {recipe.image_url && !imageError ? (
          <Image
            src={recipe.image_url}
            alt={recipe.name}
            fill
            className="recipe-card-image"
            unoptimized
            draggable={false}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="recipe-card-image bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
            <span className="text-8xl">🍽️</span>
          </div>
        )}
        
        {/* Gradient overlay */}
        <div className="recipe-card-gradient" />
        
        {/* Swipe indicators */}
        <div className="swipe-indicator like">GILLA 👍</div>
        <div className="swipe-indicator dislike">NEJ 👎</div>
        
        {/* Content */}
        <div className="recipe-card-content">
          <h2 className="recipe-card-title">{recipe.name}</h2>
          
          <div className="recipe-card-meta">
            {totalTime > 0 && (
              <span className="recipe-card-tag">
                ⏱️ {totalTime} min
              </span>
            )}
            {recipe.external_rating && (
              <span className="recipe-card-tag">
                ⭐ {recipe.external_rating.toFixed(1)}
              </span>
            )}
            {recipe.features?.cuisine && (
              <span className="recipe-card-tag">
                {recipe.features.cuisine}
              </span>
            )}
          </div>
          
          {recipe.description && (
            <p className="recipe-card-description">
              {recipe.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
